import asyncio
import io
import logging
import re
import uuid
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from rag_pipeline import RAGPipeline
from fastapi.responses import StreamingResponse as FastAPIStreamingResponse
import json as json_module
from governance import get_user_role

from config import get_config
from supervisor import nexusiq_app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nexusiq.api")

app = FastAPI(title="NexusIQ API", version="1.0.0")
app.mount("/docs", StaticFiles(directory="docs"), name="docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "https://nexusiqfrontend.z20.web.core.windows.net",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── SQLite store ──────────────────────────────────────────────────────────────

import sqlite3 as _sqlite3
import json as _json
from pathlib import Path as _Path

_SESSION_DB_PATH = _Path("./nexusiq_sessions.db")
_sessions:   dict[str, dict] = {}
_db_configs: dict[str, dict] = {}
_tokens:     dict[str, dict] = {}

DB_LABELS = {
    "mysql":      "MySQL",
    "snowflake":  "Snowflake",
    "databricks": "Databricks",
    "postgresql": "PostgreSQL",
    "exasol":     "Exasol",
    "redshift":   "Redshift",
}

def _init_db():
    con = _sqlite3.connect(_SESSION_DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            data       TEXT NOT NULL,
            updated_at REAL NOT NULL
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS tokens (
            token      TEXT PRIMARY KEY,
            username   TEXT NOT NULL,
            role       TEXT NOT NULL,
            name       TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS db_connections (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            db_type     TEXT NOT NULL,
            host        TEXT,
            port        INTEGER,
            username    TEXT,
            password    TEXT,
            database    TEXT,
            schema_name TEXT,
            warehouse   TEXT,
            is_active   INTEGER DEFAULT 0,
            created_at  TEXT NOT NULL
        )
    """)
    con.commit()
    con.close()

_init_db()

# ── Session helpers ───────────────────────────────────────────────────────────

def _save_session_to_db(session_id: str, session: dict):
    try:
        import time
        con = _sqlite3.connect(_SESSION_DB_PATH)
        con.execute(
            "INSERT OR REPLACE INTO sessions (session_id, data, updated_at) VALUES (?, ?, ?)",
            (session_id, _json.dumps(session, default=str), time.time())
        )
        con.commit()
        con.close()
    except Exception as exc:
        logger.warning(f"Could not persist session: {exc}")

def _get_or_create_session(session_id: str) -> dict:
    if session_id in _sessions:
        return _sessions[session_id]
    try:
        con = _sqlite3.connect(_SESSION_DB_PATH)
        row = con.execute("SELECT data FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
        con.close()
        if row:
            _sessions[session_id] = _json.loads(row[0])
            return _sessions[session_id]
    except Exception:
        pass
    _sessions[session_id] = {
        "thread_id":    str(uuid.uuid4()),
        "messages":     [],
        "chat_history": [],
        "pending_hitl": None,
    }
    return _sessions[session_id]

# ── Token helpers ─────────────────────────────────────────────────────────────

def _save_token_to_db(token: str, username: str, role: str, name: str):
    try:
        con = _sqlite3.connect(_SESSION_DB_PATH)
        con.execute(
            "INSERT OR REPLACE INTO tokens (token, username, role, name, created_at) VALUES (?, ?, ?, ?, ?)",
            (token, username, role, name, datetime.now().isoformat())
        )
        con.commit()
        con.close()
    except Exception as exc:
        logger.warning(f"Could not persist token: {exc}")

def _get_role_for_token(token: Optional[str]) -> str:
    if not token:
        return "analyst"
    user_info = _tokens.get(token, {})
    username  = user_info.get("username", "")
    if username:
        return get_user_role(username)
    try:
        con = _sqlite3.connect(_SESSION_DB_PATH)
        row = con.execute("SELECT username, role, name FROM tokens WHERE token = ?", (token,)).fetchone()
        con.close()
        if row:
            username, role, name = row
            _tokens[token] = {"username": username, "role": role, "name": name}
            logger.info(f"Token re-hydrated from DB: user={username}, role={role}")
            return role
    except Exception as exc:
        logger.warning(f"Could not load token from DB: {exc}")
    return "analyst"

def _get_username_for_token(token: Optional[str]) -> str:
    if not token:
        return "?"
    return _tokens.get(token, {}).get("username", "?")

# ── DB Connection helpers ─────────────────────────────────────────────────────

def _save_connection(conn_id: str, name: str, db_type: str, host: str,
                     port: int, username: str, password: str, database: str,
                     schema_name: str = None, warehouse: str = None, is_active: bool = False):
    try:
        con = _sqlite3.connect(_SESSION_DB_PATH)
        # Deactivate all if this is active
        if is_active:
            con.execute("UPDATE db_connections SET is_active = 0")
        con.execute(
            """INSERT OR REPLACE INTO db_connections
               (id, name, db_type, host, port, username, password, database, schema_name, warehouse, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (conn_id, name, db_type, host, port, username, password, database,
             schema_name, warehouse, 1 if is_active else 0, datetime.now().isoformat())
        )
        con.commit()
        con.close()
    except Exception as exc:
        logger.warning(f"Could not save connection: {exc}")

def _get_all_connections() -> list:
    try:
        con = _sqlite3.connect(_SESSION_DB_PATH)
        rows = con.execute(
            "SELECT id, name, db_type, host, port, database, schema_name, warehouse, is_active FROM db_connections ORDER BY is_active DESC, created_at DESC"
        ).fetchall()
        con.close()
        return [
            {
                "id": r[0], "name": r[1], "db_type": r[2], "host": r[3],
                "port": r[4], "database": r[5], "schema": r[6],
                "warehouse": r[7], "is_active": bool(r[8])
            }
            for r in rows
        ]
    except Exception as exc:
        logger.warning(f"Could not load connections: {exc}")
        return []

def _set_active_connection(conn_id: str):
    try:
        con = _sqlite3.connect(_SESSION_DB_PATH)
        con.execute("UPDATE db_connections SET is_active = 0")
        con.execute("UPDATE db_connections SET is_active = 1 WHERE id = ?", (conn_id,))
        con.commit()
        con.close()
    except Exception as exc:
        logger.warning(f"Could not set active connection: {exc}")

def _build_dsn_from_parts(db_type, host, port, username, password, database, schema_name, warehouse):
    import urllib.parse
    pwd = urllib.parse.quote_plus(password or "")
    if db_type == "mysql":
        return f"mysql+pymysql://{username}:{pwd}@{host}:{port}/{database}"
    elif db_type == "snowflake":
        schema = schema_name or "PUBLIC"
        dsn = f"snowflake://{username}:{pwd}@{host}/{database}/{schema}"
        if warehouse:
            dsn += f"?warehouse={warehouse}"
        return dsn
    elif db_type == "databricks":
        return f"databricks://token:{pwd}@{host}:{port}/{database}?http_path={warehouse or ''}"
    elif db_type == "postgresql":
        return f"postgresql+psycopg2://{username}:{pwd}@{host}:{port}/{database}"
    elif db_type == "exasol":
        return f"exasol+pyexasol://{username}:{pwd}@{host}:443"
    elif db_type == "redshift":
        return f"redshift+psycopg2://{username}:{pwd}@{host}:{port}/{database}"
    else:
        raise ValueError(f"Unsupported db_type: {db_type}")

# ── Auth users ────────────────────────────────────────────────────────────────

_USERS = {
    "admin":   {"password": "nexusiq2026", "name": "Admin User"},
    "yuvaraj": {"password": "nexusiq2026", "name": "Yuvaraj M"},
    "analyst": {"password": "analyst2026", "name": "Alex Analyst"},
}

# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    query:        str
    session_id:   Optional[str] = None
    chat_history: Optional[list] = None
    token:        Optional[str] = None

class ChatResponse(BaseModel):
    session_id:    str
    message_id:    str
    answer:        str
    citations:     list
    confidence:    float
    hitl_required: bool
    hitl_payload:  Optional[dict] = None

class FeedbackRequest(BaseModel):
    message_id: str
    session_id: str
    vote:       str
    reason:     Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token:    str
    username: str
    name:     str
    role:     str = "analyst"

class AgentToggleRequest(BaseModel):
    agent:   str
    enabled: bool

class DBConfigRequest(BaseModel):
    db_type:   str
    host:      str
    port:      int
    username:  str
    password:  str
    database:  str
    schema:    Optional[str] = None
    warehouse: Optional[str] = None

class SwitchRequest(BaseModel):
    connection_id: str
    dsn:     Optional[str] = None
    db_type: Optional[str] = None

class SharePointSaveRequest(BaseModel):
    site_url: str
    token:    Optional[str] = None

# ── State ─────────────────────────────────────────────────────────────────────

_agent_enabled  = {"sharepoint": True, "sql": True, "rag": True}
_feedback_store: list[dict] = []

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    try:
        import time
        con    = _sqlite3.connect(_SESSION_DB_PATH)
        cutoff = time.time() - (7 * 24 * 3600)
        rows   = con.execute(
            "SELECT session_id, data FROM sessions WHERE updated_at > ? ORDER BY updated_at DESC LIMIT 100",
            (cutoff,)
        ).fetchall()
        con.close()
        for sid, data in rows:
            _sessions[sid] = _json.loads(data)
        logger.info(f"Loaded {len(rows)} persisted sessions from DB")
    except Exception as exc:
        logger.warning(f"Could not load sessions: {exc}")

    try:
        con  = _sqlite3.connect(_SESSION_DB_PATH)
        rows = con.execute("SELECT token, username, role, name FROM tokens").fetchall()
        con.close()
        for token, username, role, name in rows:
            _tokens[token] = {"username": username, "role": role, "name": name}
        logger.info(f"Loaded {len(rows)} persisted tokens from DB")
    except Exception as exc:
        logger.warning(f"Could not load tokens: {exc}")

    # Load active connection from db_connections
    try:
        con = _sqlite3.connect(_SESSION_DB_PATH)
        row = con.execute(
            "SELECT db_type, host, port, username, password, database, schema_name, warehouse FROM db_connections WHERE is_active = 1 LIMIT 1"
        ).fetchone()
        con.close()
        if row:
            db_type, host, port, username, password, database, schema_name, warehouse = row
            dsn = _build_dsn_from_parts(db_type, host, port, username, password, database, schema_name, warehouse)
            _db_configs["default"] = {
                "dsn": dsn, "db_type": db_type, "host": host,
                "port": port, "database": database,
                "schema": schema_name, "warehouse": warehouse,
            }
            logger.info(f"Restored active DB connection: {db_type}")
    except Exception as exc:
        logger.warning(f"Could not restore active connection: {exc}")

    asyncio.create_task(_auto_sync_loop())

async def _auto_sync_loop():
    await asyncio.sleep(60)
    while True:
        try:
            logger.info("Auto-sync: running SharePoint ingestion")
            await asyncio.to_thread(_run_ingestion_task)
        except Exception as exc:
            logger.error(f"Auto-sync failed: {exc}")
        await asyncio.sleep(300)

# ── Root / Health ─────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"service": "nexusiq-api", "status": "ok"}

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "nexusiq-api"}

# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user = _USERS.get(request.username.lower())
    if not user or user["password"] != request.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = str(uuid.uuid4())
    role  = get_user_role(request.username.lower())
    name  = user["name"]
    _tokens[token] = {"username": request.username.lower(), "name": name, "role": role, "created_at": datetime.now().isoformat()}
    _save_token_to_db(token, request.username.lower(), role, name)
    logger.info(f"User logged in: {request.username} (role={role})")
    return LoginResponse(token=token, username=request.username.lower(), name=name, role=role)

@app.post("/api/auth/logout")
async def logout(token: str):
    _tokens.pop(token, None)
    try:
        con = _sqlite3.connect(_SESSION_DB_PATH)
        con.execute("DELETE FROM tokens WHERE token = ?", (token,))
        con.commit()
        con.close()
    except Exception:
        pass
    return {"success": True}

@app.get("/api/auth/me")
async def get_me(token: str):
    user = _tokens.get(token)
    if not user:
        _get_role_for_token(token)
        user = _tokens.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

@app.get("/api/auth/role")
async def get_role(token: str):
    role = _get_role_for_token(token)
    user = _tokens.get(token, {})
    return {"role": role, "username": user.get("username"), "name": user.get("name")}

# ── Chat ──────────────────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())
    session    = _get_or_create_session(session_id)
    message_id = str(uuid.uuid4())
    config     = {"configurable": {"thread_id": session["thread_id"]}}
    chat_history = [{"role": m["role"], "content": m["content"]} for m in session["messages"] if m["role"] in ("user", "assistant")][-20:]
    _role     = _get_role_for_token(request.token)
    _username = _get_username_for_token(request.token)
    logger.info(f"Chat: user={_username}, role={_role}")
    initial_state = {"user_query": request.query, "session_id": session_id, "chat_history": chat_history, "agents_enabled": dict(_agent_enabled), "user_role": _role}
    try:
        result = await nexusiq_app.ainvoke(initial_state, config=config)
    except Exception as exc:
        logger.error(f"Graph error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    result       = result or {}
    final_answer = result.get("final_answer") or ""
    citations    = result.get("citations") or []
    confidence   = result.get("confidence") or 0.0
    session["messages"].append({"role": "user", "content": request.query, "message_id": message_id})
    assistant_mid = str(uuid.uuid4())
    session["messages"].append({"role": "assistant", "content": final_answer, "citations": citations, "confidence": confidence, "message_id": assistant_mid})
    session["chat_history"] = (chat_history + [{"role": "user", "content": request.query}, {"role": "assistant", "content": final_answer}])[-20:]
    _save_session_to_db(session_id, session)
    return ChatResponse(session_id=session_id, message_id=assistant_mid, answer=final_answer, citations=citations, confidence=confidence, hitl_required=False, hitl_payload=None)

# ── Streaming Chat ────────────────────────────────────────────────────────────

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())
    session    = _get_or_create_session(session_id)
    message_id = str(uuid.uuid4())
    config     = {"configurable": {"thread_id": session["thread_id"]}}
    chat_history = [{"role": m["role"], "content": m["content"]} for m in session["messages"] if m["role"] in ("user", "assistant")][-20:]
    _role     = _get_role_for_token(request.token)
    _username = _get_username_for_token(request.token)
    logger.info(f"Stream chat: user={_username}, role={_role}, token_in_memory={request.token in _tokens if request.token else False}")
    initial_state = {"user_query": request.query, "session_id": session_id, "chat_history": chat_history, "agents_enabled": dict(_agent_enabled), "user_role": _role}

    async def event_stream():
        try:
            yield f"data: {json_module.dumps({'type': 'status', 'text': 'Searching your data...'})}\n\n"
            result     = await nexusiq_app.ainvoke(initial_state, config=config)
            result     = result or {}
            citations  = result.get("citations") or []
            confidence = result.get("confidence") or 0.0
            answer     = result.get("final_answer") or ""
            if len(answer) < 200 or result.get("intent") == "conversational":
                yield f"data: {json_module.dumps({'type': 'token', 'text': answer})}\n\n"
            else:
                words = answer.split(" ")
                for i, word in enumerate(words):
                    chunk = word + (" " if i < len(words) - 1 else "")
                    yield f"data: {json_module.dumps({'type': 'token', 'text': chunk})}\n\n"
                    await asyncio.sleep(0.02)
            yield f"data: {json_module.dumps({'type': 'done', 'session_id': session_id, 'message_id': message_id, 'citations': citations, 'confidence': confidence})}\n\n"
            session["messages"].append({"role": "user", "content": request.query, "message_id": message_id})
            session["messages"].append({"role": "assistant", "content": answer, "citations": citations, "confidence": confidence, "message_id": str(uuid.uuid4())})
            session["chat_history"] = (chat_history + [{"role": "user", "content": request.query}, {"role": "assistant", "content": answer}])[-20:]
            _save_session_to_db(session_id, session)
        except Exception as exc:
            logger.error(f"Stream error: {exc}")
            yield f"data: {json_module.dumps({'type': 'error', 'text': str(exc)})}\n\n"

    return FastAPIStreamingResponse(event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Access-Control-Allow-Origin": "*"})

# ── Feedback ──────────────────────────────────────────────────────────────────

@app.post("/api/feedback")
async def submit_feedback(request: FeedbackRequest):
    _feedback_store.append({"message_id": request.message_id, "session_id": request.session_id, "vote": request.vote, "reason": request.reason or "", "timestamp": datetime.now().isoformat()})
    return {"success": True}

@app.get("/api/feedback")
async def get_feedback():
    return {"feedback": _feedback_store, "total": len(_feedback_store)}

# ── History / Conversations ───────────────────────────────────────────────────

@app.get("/api/history/{session_id}")
async def get_history(session_id: str):
    return {"messages": _get_or_create_session(session_id)["messages"]}

@app.get("/api/conversations")
async def get_conversations():
    conversations = []
    for session_id, session in _sessions.items():
        messages = session.get("messages", [])
        if not messages:
            continue
        first_user_msg = next((m["content"] for m in messages if m["role"] == "user"), "New conversation")
        title = first_user_msg[:60] + "..." if len(first_user_msg) > 60 else first_user_msg
        conversations.append({"session_id": session_id, "title": title, "timestamp": messages[0].get("message_id", session_id)})
    return {"conversations": conversations}

@app.delete("/api/conversations/{session_id}")
async def delete_conversation(session_id: str):
    _sessions.pop(session_id, None)
    return {"success": True}

# ── Sources status ────────────────────────────────────────────────────────────

@app.get("/api/sources/status")
async def sources_status():
    import httpx
    cfg      = get_config()
    statuses = {}
    for name, port, path in [("sharepoint", cfg.sharepoint_mcp_port, "/sse"), ("sql", cfg.sql_mcp_port, "/sse")]:
        try:
            async with httpx.AsyncClient() as client:
                await client.get(f"http://localhost:{port}{path}", timeout=1.0)
            statuses[name] = True
        except httpx.ReadTimeout:
            statuses[name] = True
        except Exception:
            statuses[name] = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"http://localhost:{cfg.chroma_port}/api/v2/auth/identity")
            statuses["chromadb"] = r.status_code == 200
    except Exception:
        statuses["chromadb"] = False
    return statuses

# ── Session / Agents ──────────────────────────────────────────────────────────

@app.post("/api/session/new")
async def new_session():
    session_id = str(uuid.uuid4())
    _get_or_create_session(session_id)
    return {"session_id": session_id}

@app.post("/api/agents/toggle")
async def toggle_agent(request: AgentToggleRequest):
    if request.agent not in _agent_enabled:
        raise HTTPException(status_code=400, detail=f"Unknown agent: {request.agent}")
    _agent_enabled[request.agent] = request.enabled
    return {"success": True, "agent": request.agent, "enabled": request.enabled}

@app.get("/api/agents/status")
async def agents_status():
    return _agent_enabled

# ── Upload ────────────────────────────────────────────────────────────────────

@app.post("/api/upload/preview")
async def preview_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        filename = file.filename or "upload"
        ext      = filename.rsplit(".", 1)[-1].lower()
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(contents))
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
        df.columns = df.columns.str.strip().str.lower().str.replace(r"[^a-z0-9_]", "_", regex=True).str.replace(r"_+", "_", regex=True).str.strip("_")
        table_name = re.sub(r"[^a-z0-9_]", "_", filename.rsplit(".", 1)[0].lower().strip()).strip("_")[:50]
        return {"columns": list(df.columns), "preview": df.head(5).fillna("").to_dict(orient="records"), "total_rows": len(df), "table_name": table_name, "filename": filename}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/upload/ingest")
async def ingest_file(file: UploadFile = File(...), table_name: str = Form(...)):
    try:
        contents = await file.read()
        filename = file.filename or "upload"
        ext      = filename.rsplit(".", 1)[-1].lower()
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(contents))
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
        df.columns = df.columns.str.strip().str.lower().str.replace(r"[^a-z0-9_]", "_", regex=True).str.replace(r"_+", "_", regex=True).str.strip("_")
        safe_table = re.sub(r"[^a-z0-9_]", "_", table_name.lower()).strip("_")[:50]
        if not safe_table:
            raise HTTPException(status_code=400, detail="Invalid table name")
        from sqlalchemy import create_engine
        cfg    = get_config()
        engine = create_engine(cfg.db_dsn)
        df.to_sql(name=safe_table, con=engine, if_exists="replace", index=False, chunksize=500)
        import agents
        agents._schema_cache      = None
        agents._schema_cache_time = 0.0
        return {"success": True, "table_name": safe_table, "rows": len(df), "columns": list(df.columns), "message": f"Loaded {len(df):,} rows into '{safe_table}'"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.get("/api/upload/tables")
async def list_uploaded_tables():
    try:
        from sqlalchemy import create_engine, inspect, text
        cfg       = get_config()
        engine    = create_engine(cfg.db_dsn)
        inspector = inspect(engine)
        tables    = inspector.get_table_names(schema="nexusiq")
        result    = []
        for t in tables:
            try:
                with engine.connect() as conn:
                    count = conn.execute(text(f"SELECT COUNT(*) FROM nexusiq.{t}")).scalar()
                result.append({"table": t, "rows": count})
            except Exception:
                result.append({"table": t, "rows": 0})
        return {"tables": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ── Documents ─────────────────────────────────────────────────────────────────

@app.get("/api/documents")
async def list_documents():
    try:
        rag   = RAGPipeline()
        docs  = rag.list_documents()
        stats = rag.collection_stats()
        return {"documents": docs, "total_chunks": stats["total_chunks"], "total_docs": len(docs)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.delete("/api/documents/{doc_id:path}")
async def delete_document(doc_id: str):
    try:
        RAGPipeline().delete_document(doc_id)
        return {"success": True, "doc_id": doc_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/api/documents/sync")
async def sync_documents(background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_ingestion_task)
    return {"success": True, "message": "Sync started in background"}

# ── DB Config ─────────────────────────────────────────────────────────────────

def _encode_password(password: str) -> str:
    import urllib.parse
    return urllib.parse.quote_plus(password)

def _build_dsn(request: DBConfigRequest) -> str:
    return _build_dsn_from_parts(
        request.db_type, request.host, request.port, request.username,
        request.password, request.database, request.schema, request.warehouse
    )

def _get_connect_args(request: DBConfigRequest) -> dict:
    if request.db_type in ("mysql", "postgresql", "redshift"):
        return {"connect_timeout": 10}
    return {}

@app.post("/api/db/test")
async def test_db_connection(request: DBConfigRequest):
    try:
        if request.db_type == "exasol":
            import pyexasol
            ports_to_try = [443, request.port] if request.port != 443 else [443]
            last_err = None
            for p in ports_to_try:
                try:
                    conn = pyexasol.connect(
                        dsn=f"{request.host}:{p}",
                        user=request.username,
                        password=request.password,
                        websocket_sslopt={"cert_reqs": 0},
                        connection_timeout=15,
                    )
                    conn.execute("SELECT 1 FROM DUAL")
                    conn.close()
                    return {"success": True, "message": f"Connected to Exasol (port {p})"}
                except Exception as e:
                    last_err = e
            raise Exception(str(last_err))
        dsn = _build_dsn(request)
        from sqlalchemy import create_engine, text
        engine = create_engine(dsn, pool_pre_ping=True, connect_args=_get_connect_args(request))
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return {"success": True, "message": f"Connected to {request.db_type} successfully"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.post("/api/db/save")
async def save_db_connection(request: DBConfigRequest):
    try:
        if request.db_type == "exasol":
            import pyexasol
            exa = pyexasol.connect(
                dsn=f"{request.host}:443",
                user=request.username,
                password=request.password,
                websocket_sslopt={"cert_reqs": 0},
                connection_timeout=20,
            )
            exa.execute("SELECT 1 FROM DUAL")
            exa.close()
        else:
            dsn_test = _build_dsn(request)
            from sqlalchemy import create_engine, text
            engine = create_engine(dsn_test, pool_pre_ping=True, connect_args=_get_connect_args(request))
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            engine.dispose()

        dsn = _build_dsn(request)
        _db_configs["default"] = {
            "dsn": dsn, "db_type": request.db_type, "host": request.host,
            "port": request.port, "database": request.database,
            "schema": request.schema, "warehouse": request.warehouse,
        }
        import sql_mcp
        sql_mcp.update_engine(dsn)
        import agents
        agents._schema_cache      = None
        agents._schema_cache_time = 0.0

        # Save to persistent connections store
        conn_id = str(uuid.uuid4())
        name    = f"{DB_LABELS.get(request.db_type, request.db_type)} ({request.database or request.host})"
        _save_connection(
            conn_id=conn_id, name=name, db_type=request.db_type,
            host=request.host, port=request.port, username=request.username,
            password=request.password, database=request.database or "",
            schema_name=request.schema, warehouse=request.warehouse, is_active=True,
        )

        label = DB_LABELS.get(request.db_type, request.db_type)
        return {"success": True, "message": f"{label} connected and saved", "connection_id": conn_id}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/api/db/config")
async def get_db_config():
    cfg = _db_configs.get("default")
    if not cfg:
        return {"connected": False}
    return {"connected": True, "db_type": cfg["db_type"], "host": cfg["host"],
            "port": cfg["port"], "database": cfg["database"],
            "schema": cfg.get("schema"), "warehouse": cfg.get("warehouse")}

@app.get("/api/db/connections")
async def get_db_connections():
    connections = _get_all_connections()
    # Fallback to current _db_configs if nothing in SQLite
    if not connections:
        cfg = _db_configs.get("default")
        if cfg:
            connections = [{
                "id": "current", "name": DB_LABELS.get(cfg["db_type"], cfg["db_type"]),
                "db_type": cfg["db_type"], "host": cfg.get("host", ""),
                "database": cfg.get("database", ""), "is_active": True,
            }]
    active = next((c for c in connections if c["is_active"]), connections[0] if connections else None)
    return {"connections": connections, "active": active}

@app.post("/api/db/switch")
async def switch_db_connection(request: SwitchRequest):
    try:
        con = _sqlite3.connect(_SESSION_DB_PATH)
        row = con.execute(
            "SELECT db_type, host, port, username, password, database, schema_name, warehouse FROM db_connections WHERE id = ?",
            (request.connection_id,)
        ).fetchone()
        con.close()
        if not row and request.connection_id == 'trino':
            trino_dsn = "trino://admin@localhost:8080/tpch/sf1"
            import sql_mcp
            sql_mcp.update_engine(trino_dsn)
            import agents
            agents._schema_cache      = None
            agents._schema_cache_time = 0.0
            _db_configs["default"] = {
                "dsn": trino_dsn, "db_type": "trino",
                "host": "localhost", "port": 8080,
                "database": "tpch", "schema": "sf1", "warehouse": None,
            }
            logger.info("Switched to Trino (tpch.sf1)")
            return {"success": True, "db_type": "trino", "database": "tpch", "name": "Trino"}

        if not row and request.connection_id == 'exasol_vs':
            exasol_vs_dsn = "exasol+pyexasol://yuviex1:NewPassword123@y3n5pmtigrg4xmldfscr5hdu3m.clusters.exasol.com:8563"
            import sql_mcp
            sql_mcp.update_engine(exasol_vs_dsn)
            import agents
            agents._schema_cache      = None
            agents._schema_cache_time = 0.0
            _db_configs["default"] = {
                "dsn": exasol_vs_dsn, "db_type": "virtual_schema",
                "host": "y3n5pmtigrg4xmldfscr5hdu3m.clusters.exasol.com", "port": 8563,
                "database": "NEXUSIQ_VS,SNOWFLAKE_VS",
                "schema": None, "warehouse": None,
            }
            logger.info("Switched to Exasol Virtual Schema (NEXUSIQ_VS + SNOWFLAKE_VS)")
            return {
                "success": True,
                "db_type": "virtual_schema",
                "database": "NEXUSIQ_VS · SNOWFLAKE_VS",
                "name": "Exasol Virtual Schema"
            }
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")

        db_type, host, port, username, password, database, schema_name, warehouse = row
        dsn = _build_dsn_from_parts(db_type, host, port, username, password, database, schema_name, warehouse)

        # Special handling for Exasol
        if db_type == "exasol":
            import pyexasol
            exa = pyexasol.connect(
                dsn=f"{host}:{port}", user=username, password=password,
                websocket_sslopt={"cert_reqs": 0}, connection_timeout=15,
            )
            exa.execute("SELECT 1 FROM DUAL")
            exa.close()

        _set_active_connection(request.connection_id)
        import sql_mcp
        sql_mcp.update_engine(dsn)
        import agents
        agents._schema_cache      = None
        agents._schema_cache_time = 0.0
        _db_configs["default"] = {
            "dsn": dsn, "db_type": db_type, "host": host,
            "port": port, "database": database,
            "schema": schema_name, "warehouse": warehouse,
        }
        logger.info(f"Switched to {db_type} ({database})")
        return {"success": True, "db_type": db_type, "database": database,
                "name": DB_LABELS.get(db_type, db_type)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# ── SharePoint ────────────────────────────────────────────────────────────────

async def _run_ingestion_task():
    try:
        from ingest import run_ingestion
        await run_ingestion()
    except Exception as exc:
        logger.error(f"Background ingestion failed: {exc}")

@app.post("/api/sharepoint/save")
async def save_sharepoint(request: SharePointSaveRequest, background_tasks: BackgroundTasks):
    _db_configs["sharepoint"] = {"site_url": request.site_url}
    background_tasks.add_task(_run_ingestion_task)
    return {"success": True, "message": "SharePoint connected. Documents are being ingested in the background."}

@app.get("/api/sharepoint/config")
async def get_sharepoint_config():
    cfg = _db_configs.get("sharepoint")
    if not cfg:
        return {"connected": False}
    return {"connected": True, "site_url": cfg["site_url"]}

# ── Suggestions ───────────────────────────────────────────────────────────────

@app.get("/api/suggestions")
async def get_suggestions():
    try:
        from sqlalchemy import create_engine, inspect
        from langchain_anthropic import ChatAnthropic
        from langchain_core.messages import HumanMessage, SystemMessage
        cfg       = get_config()
        engine    = create_engine(cfg.db_dsn)
        inspector = inspect(engine)
        tables    = inspector.get_table_names(schema='nexusiq')
        if not tables:
            return {"suggestions": ["What documents are available?", "Show me a summary of recent activity", "What are the key metrics?", "Summarise the latest reports"]}
        schema_text = ""
        for table in tables[:6]:
            try:
                cols = inspector.get_columns(table, schema='nexusiq')
                schema_text += f"Table: {table} | Columns: {', '.join(c['name'] for c in cols)}\n"
            except Exception:
                pass
        llm      = ChatAnthropic(model=cfg.llm_model, api_key=cfg.anthropic_api_key, max_tokens=200, temperature=0.7)
        response = await llm.ainvoke([
            SystemMessage(content="Generate exactly 4 short natural language questions a business user would ask about this database. Each on its own line. No numbering, no bullets."),
            HumanMessage(content=f"Database schema:\n{schema_text}"),
        ])
        questions = [q.strip() for q in response.content.strip().split('\n') if q.strip() and len(q.strip()) > 10][:4]
        if len(questions) < 4:
            questions += ["Show me the top records by revenue", "Which items have the highest volume?"]
        return {"suggestions": questions}
    except Exception as exc:
        logger.warning(f"Suggestions failed: {exc}")
        return {"suggestions": ["Who are the top 5 sales reps?", "Which departments are over budget?", "Show active projects", "What is the total revenue this month?"]}