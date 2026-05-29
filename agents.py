import asyncio
import base64
import io
import json
import logging
import math
import time
from typing import Optional, TypedDict

import anthropic
from fastmcp import Client
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from config import get_config
from rag_pipeline import RAGPipeline
from governance import (
    inject_rls_into_sql,
    filter_rag_chunks,
    filter_citations_by_role,
    get_all_rls_policies,
    is_admin,
)

logger = logging.getLogger(__name__)


# ── Shared state ──────────────────────────────────────────────────────────────

class NexusIQState(TypedDict):
    user_query:        str
    intent:            str
    session_id:        str
    chat_history:      list
    agents_enabled:    dict
    user_role:         str          # ← NEW: 'admin' | 'analyst'
    sharepoint_result: Optional[dict]
    sql_result:        Optional[dict]
    rag_result:        Optional[dict]
    final_answer:      Optional[str]
    citations:         Optional[list]
    confidence:        Optional[float]
    hitl_required:     bool
    hitl_approved:     bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_agent_result(
    agent_name: str,
    answer: str,
    sources: list,
    confidence: float,
    error: Optional[str] = None,
    sql: Optional[str] = None,
) -> dict:
    return {
        "agent_name": agent_name,
        "answer":     answer,
        "sources":    sources,
        "confidence": confidence,
        "error":      error,
        "sql":        sql,
    }


def _extract(result) -> dict:
    if isinstance(result, dict):
        return result
    if hasattr(result, "data") and isinstance(result.data, dict):
        return result.data
    if hasattr(result, "content"):
        for block in result.content:
            if hasattr(block, "text"):
                try:
                    return json.loads(block.text)
                except Exception:
                    pass
    return {}


def _normalise_rerank_score(score: float) -> float:
    return round(1 / (1 + math.exp(-score * 0.4)), 3)


def _extract_text(raw_bytes: bytes, content_type: str, name: str) -> str:
    try:
        if "wordprocessingml" in content_type or name.endswith(".docx"):
            import mammoth
            result = mammoth.extract_raw_text(io.BytesIO(raw_bytes))
            return result.value[:8000]
        elif content_type == "application/pdf" or name.endswith(".pdf"):
            import pdfplumber
            with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
                return "\n".join(
                    p.extract_text() or "" for p in pdf.pages
                )[:8000]
        elif "text" in content_type or name.endswith((".txt", ".md", ".csv")):
            return raw_bytes.decode("utf-8", errors="ignore")[:8000]
        else:
            return raw_bytes.decode("utf-8", errors="ignore")[:4000]
    except Exception as exc:
        logger.warning(f"Text extraction failed for {name}: {exc}")
        return ""


def _format_history(chat_history: list) -> str:
    if not chat_history:
        return ""
    lines = []
    for msg in chat_history[-6:]:
        role = "User" if msg["role"] == "user" else "Assistant"
        lines.append(f"{role}: {msg['content'][:300]}")
    return "\n".join(lines)


# ── LLM singleton ─────────────────────────────────────────────────────────────

_llm: Optional[ChatAnthropic] = None

def get_llm() -> ChatAnthropic:
    global _llm
    if _llm is None:
        cfg = get_config()
        _llm = ChatAnthropic(
            model=cfg.llm_model,
            api_key=cfg.anthropic_api_key,
            max_tokens=cfg.llm_max_tokens,
            temperature=cfg.llm_temperature,
        )
    return _llm


# ── Schema cache ──────────────────────────────────────────────────────────────

_schema_cache: Optional[str] = None
_schema_cache_time: float = 0.0
_SCHEMA_CACHE_TTL = 60


# ── Agent 1: SharePoint ───────────────────────────────────────────────────────

async def sharepoint_agent_node(state: NexusIQState) -> dict:
    logger.info("SharePoint agent starting")
    cfg = get_config()
    history_text = _format_history(state.get("chat_history", []))
    user_role    = state.get("user_role", "analyst")

    try:
        async with Client(f"http://{cfg.sharepoint_mcp_host}:{cfg.sharepoint_mcp_port}/sse") as client:

            search_result = _extract(await client.call_tool(
                "search_documents",
                {"query": state["user_query"]},
            ))

            items = search_result.get("items", [])
            if not items:
                return {
                    "sharepoint_result": make_agent_result(
                        agent_name="sharepoint",
                        answer="No relevant documents found in SharePoint.",
                        sources=[],
                        confidence=0.0,
                    )
                }

            # ── Governance: filter items by role ──────────────────────────────
            from governance import is_doc_allowed
            if not is_admin(user_role):
                items = [
                    item for item in items
                    if is_doc_allowed(item.get("name", ""), user_role)
                ]
                logger.info(f"SharePoint: {len(items)} items after governance filter (role={user_role})")

            if not items:
                return {
                    "sharepoint_result": make_agent_result(
                        agent_name="sharepoint",
                        answer="No documents available for your access level.",
                        sources=[],
                        confidence=0.0,
                    )
                }

            top_items = items[:cfg.sharepoint_fetch_top_k]
            full_docs = []
            for item in top_items:
                try:
                    doc = _extract(await client.call_tool(
                        "get_file_content",
                        {"drive_id": item["drive_id"], "item_id": item["item_id"]},
                    ))
                    full_docs.append({**item, **doc})
                except Exception as exc:
                    logger.warning(f"Could not fetch content for {item['item_id']}: {exc}")

            context_parts = []
            for d in full_docs:
                text         = ""
                content_b64  = d.get("content_b64", "")
                content_type = d.get("content_type", "")
                name         = d.get("name", "")

                if content_b64:
                    try:
                        raw_bytes = base64.b64decode(content_b64)
                        text = _extract_text(raw_bytes, content_type, name)
                    except Exception as exc:
                        logger.warning(f"Could not decode content for {name}: {exc}")

                context_parts.append(
                    f"Document: {name}\n"
                    f"URL: {d.get('web_url', '')}\n"
                    f"Content:\n{text if text else '[Could not extract text]'}"
                )

            context = "\n\n---\n\n".join(context_parts)

            history_section = (
                f"\n\nConversation so far:\n{history_text}" if history_text else ""
            )

            llm = get_llm()
            messages = [
                SystemMessage(content=(
                    "You are a document retrieval assistant. "
                    "Answer the user's question using only the provided documents. "
                    "Be concise and cite which document supports each claim. "
                    "Use the conversation history to understand follow-up questions."
                    f"{history_section}"
                )),
                HumanMessage(content=(
                    f"Question: {state['user_query']}\n\n"
                    f"Documents:\n{context}"
                )),
            ]
            response = await llm.ainvoke(messages)

            sources = [
                {
                    "type":            "sharepoint",
                    "name":            d.get("name", ""),
                    "url":             d.get("web_url", ""),
                    "embedded_source": "",
                    "is_embedded":     False,
                }
                for d in full_docs
            ]
            confidence = min(0.95, 0.5 + len(full_docs) * 0.15)

            logger.info(f"SharePoint agent done, confidence={confidence}")
            return {
                "sharepoint_result": make_agent_result(
                    agent_name="sharepoint",
                    answer=response.content,
                    sources=sources,
                    confidence=confidence,
                )
            }

    except Exception as exc:
        logger.error(f"SharePoint agent failed: {exc}")
        return {
            "sharepoint_result": make_agent_result(
                agent_name="sharepoint",
                answer="",
                sources=[],
                confidence=0.0,
                error=str(exc),
            )
        }


# ── Agent 2: SQL ──────────────────────────────────────────────────────────────

async def sql_agent_node(state: NexusIQState) -> dict:
    logger.info("SQL agent starting")
    cfg = get_config()
    global _schema_cache, _schema_cache_time
    t0 = time.time()
    history_text = _format_history(state.get("chat_history", []))
    user_role    = state.get("user_role", "analyst")

    # ── Governance: build RLS context for prompt ──────────────────────────────
    rls_policies = get_all_rls_policies(user_role)
    rls_note = ""
    if rls_policies:
        rls_note = "\n\nIMPORTANT — Row-level security is enforced. You MUST add these filters:\n"
        for table, clause in rls_policies.items():
            rls_note += f"- Table '{table}': WHERE {clause}\n"
        rls_note += "Always include these filters in your WHERE clause. Do not omit them."

    try:
        async with Client(f"http://{cfg.sql_mcp_host}:{cfg.sql_mcp_port}/sse") as client:

            tables_result = _extract(await client.call_tool("list_tables", {}))
            tables = tables_result.get("tables", [])

            if not tables:
                return {
                    "sql_result": make_agent_result(
                        agent_name="sql",
                        answer="No tables found in the database.",
                        sources=[],
                        confidence=0.0,
                    )
                }

            if _schema_cache and (time.time() - _schema_cache_time) < _SCHEMA_CACHE_TTL:
                schema_text = _schema_cache
            else:
                async def fetch_one_schema(t: dict) -> Optional[str]:
                    try:
                        async with Client(
                            f"http://{cfg.sql_mcp_host}:{cfg.sql_mcp_port}/sse"
                        ) as c:
                            schema = _extract(await c.call_tool(
                                "get_schema",
                                {"table": t["table"], "schema": t.get("schema")},
                            ))
                            cols = ", ".join(
                                f"{col['name']} ({col['type']})"
                                for col in schema.get("columns", [])
                            )
                            return (
                                f"Table: {t['full_name']}\n"
                                f"Columns: {cols}\n"
                                f"Primary keys: {schema.get('primary_keys', [])}"
                            )
                    except Exception:
                        return None

                schema_results = await asyncio.gather(
                    *[fetch_one_schema(t) for t in tables[:3]]
                )
                schema_context = [r for r in schema_results if r]
                schema_text    = "\n\n".join(schema_context)
                _schema_cache      = schema_text
                _schema_cache_time = time.time()

            llm = get_llm()

            history_section = (
                f"\n\nConversation history:\n{history_text}" if history_text else ""
            )

            nl_to_sql_messages = [
                SystemMessage(content=(
                    "You are a SQL expert. Generate a single SELECT query to answer "
                    "the user's question.\n"
                    "Rules:\n"
                    "- Only SELECT statements\n"
                    "- No subqueries unless necessary\n"
                    "- Always alias columns with descriptive names\n"
                    "- Use LOWER() when filtering string columns on local tables only, NOT on Virtual Schema tables\n"
                    "- For SNOWFLAKE_VS columns, filter without LOWER(): SNOWFLAKE_VS.CREDIT_SCORES.RISK_CATEGORY = 'HIGH' not LOWER(...)\n"
                    "- Use conversation history to resolve references\n"
                    "- Respond with ONLY the SQL, no explanation\n"
                    "- IMPORTANT: When using Exasol Virtual Schemas, ALWAYS prefix table names "
                    "with the schema name. Use NEXUSIQ_VS.employees, NEXUSIQ_VS.customers, "
                    "NEXUSIQ_VS.sales_orders, NEXUSIQ_VS.products, NEXUSIQ_VS.projects, "
                    "NEXUSIQ_VS.budget_actuals for MySQL data. "
                    "Use SNOWFLAKE_VS.employees, SNOWFLAKE_VS.customers etc for Snowflake data.\n"
                    "- If the schema_text shows tables with a schema prefix like NEXUSIQ_VS or "
                    "SNOWFLAKE_VS, always include that prefix in your SQL.\n"
                    "- For Exasol Virtual Schema queries, NEVER query SNOWFLAKE_VS tables directly with WHERE filters as it causes pushdown errors.\n"
                    "- Instead use these pre-loaded BANKING tables that contain Snowflake data:\n"
                    "  BANKING.SF_CUSTOMERS (CID, NAME, COUNTRY) - customer profiles from Snowflake\n"
                    "  BANKING.SF_TEMP (CUSTOMER_ID, RISK_CATEGORY, KYC_STATUS) - credit risk data from Snowflake\n"
                    "  BANKING.ACCOUNTS (CUSTOMER_ID, BALANCE, STATUS) - local account data\n"
                    "- For high-risk frozen account queries use: FROM BANKING.SF_TEMP t JOIN BANKING.SF_CUSTOMERS c ON c.CID = t.CUSTOMER_ID JOIN BANKING.ACCOUNTS a ON a.CUSTOMER_ID = TO_NUMBER(t.CUSTOMER_ID) WHERE a.STATUS IN ('FROZEN', 'SUSPENDED')\n"
                    "e.g. FROM SNOWFLAKE_VS.CUSTOMERS, BANKING.ACCOUNTS WHERE SNOWFLAKE_VS.CUSTOMERS.CUSTOMER_ID = BANKING.ACCOUNTS.CUSTOMER_ID\n"
                    "ALWAYS prefix every column with full schema.table reference e.g. SNOWFLAKE_VS.CUSTOMERS.NAME not just NAME.\n\n"
                    f"Database schema:\n{schema_text}"
                    f"{rls_note}"
                    f"{history_section}"
                )),
                HumanMessage(content=state["user_query"]),
            ]
            sql_response = await llm.ainvoke(nl_to_sql_messages)
            generated_sql = (
                sql_response.content
                .strip()
                .strip("```sql")
                .strip("```")
                .strip()
            )

            # ── Governance: inject RLS as safety net ──────────────────────────
            # Even if LLM missed it, we force-inject the filter
            for table_name, filter_clause in rls_policies.items():
                if table_name.lower() in generated_sql.lower():
                    generated_sql = inject_rls_into_sql(generated_sql, user_role, table_name)
                    logger.info(f"RLS injected for role={user_role} table={table_name}")

            explain_result = _extract(await client.call_tool(
                "explain_query", {"sql": generated_sql}
            ))

            if not explain_result.get("safe", False):
                return {
                    "sql_result": make_agent_result(
                        agent_name="sql",
                        answer="I was unable to generate a safe query for this question.",
                        sources=[],
                        confidence=0.0,
                        error=explain_result.get("reason", "Query failed safety check"),
                    )
                }

            query_result = _extract(await client.call_tool(
                "execute_query", {"sql": generated_sql}
            ))

            if query_result.get("error"):
                return {
                    "sql_result": make_agent_result(
                        agent_name="sql",
                        answer="The query executed but returned an error.",
                        sources=[],
                        confidence=0.0,
                        error=query_result.get("message"),
                    )
                }

            rows   = query_result.get("rows", [])
            capped = query_result.get("capped", False)

            # ── Governance: add role notice to answer if filtered ─────────────
            role_notice = ""
            if rls_policies and not is_admin(user_role):
                role_notice = f"\n\n> 🔒 *Results filtered by your access level ({user_role})*"

            answer_messages = [
                SystemMessage(content=(
                    "You are a data analyst. Convert SQL results into a concise answer. "
                    "Use a markdown table for the data. "
                    "Add 2-3 key insights maximum. "
                    "Keep the total response under 200 words."
                )),
                HumanMessage(content=(
                    f"Question: {state['user_query']}\n"
                    f"SQL: {generated_sql}\n"
                    f"Results ({len(rows)} rows{', capped' if capped else ''}):\n"
                    f"{rows[:20]}"
                )),
            ]
            answer_response = await llm.ainvoke(answer_messages, max_tokens=1024)

            sources = [{
                "type":      "sql",
                "sql":       generated_sql,
                "row_count": len(rows),
                "capped":    capped,
            }]
            confidence = 0.85 if rows else 0.3

            logger.info(f"SQL agent done, rows={len(rows)}, role={user_role}")
            return {
                "sql_result": make_agent_result(
                    agent_name="sql",
                    answer=answer_response.content + role_notice,
                    sources=sources,
                    confidence=confidence,
                    sql=generated_sql,
                )
            }

    except Exception as exc:
        logger.error(f"SQL agent failed: {exc}")
        return {
            "sql_result": make_agent_result(
                agent_name="sql",
                answer="",
                sources=[],
                confidence=0.0,
                error=str(exc),
            )
        }


# ── Agent 3: RAG ──────────────────────────────────────────────────────────────

async def rag_agent_node(state: NexusIQState) -> dict:
    logger.info("RAG agent starting")
    history_text = _format_history(state.get("chat_history", []))
    user_role    = state.get("user_role", "analyst")

    try:
        rag = RAGPipeline()
        chunks = rag.retrieve(query=state["user_query"])

        # ── Governance: filter chunks by role ─────────────────────────────────
        chunks = filter_rag_chunks(chunks, user_role)
        logger.info(f"RAG: {len(chunks)} chunks after governance filter (role={user_role})")

        if not chunks:
            return {
                "rag_result": make_agent_result(
                    agent_name="rag",
                    answer="No relevant content found for your access level.",
                    sources=[],
                    confidence=0.0,
                )
            }

        context = "\n\n".join([
            f"[Chunk {i+1}] {c['text']}\n"
            f"Source: {c['metadata'].get('name', '')} | "
            f"{c['metadata'].get('web_url', '')}"
            for i, c in enumerate(chunks)
        ])

        history_section = (
            f"\n\nConversation history:\n{history_text}" if history_text else ""
        )

        llm = get_llm()
        messages = [
            SystemMessage(content=(
                "You are a knowledge base assistant. "
                "Answer the user's question using only the provided document chunks. "
                "Cite the chunk number for each claim you make. "
                "Use conversation history to understand follow-up questions."
                f"{history_section}"
            )),
            HumanMessage(content=(
                f"Question: {state['user_query']}\n\n"
                f"Context:\n{context}"
            )),
        ]
        response = await llm.ainvoke(messages)

        sources = [
            {
                "type":            "rag",
                "chunk_index":     c["metadata"].get("chunk_index", i),
                "doc_id":          c["metadata"].get("doc_id", ""),
                "name":            c["metadata"].get("name", ""),
                "url":             c["metadata"].get("web_url", ""),
                "rerank_score":    c.get("rerank_score", 0.0),
                "embedded_source": c["metadata"].get("embedded_source", ""),
                "is_embedded":     c["metadata"].get("is_embedded", False),
                "page_number":     c["metadata"].get("page_number"),
            }
            for i, c in enumerate(chunks)
        ]

        # ── Governance: filter citations ──────────────────────────────────────
        sources = filter_citations_by_role(sources, user_role)

        top_score  = chunks[0].get("rerank_score", 0.0) if chunks else 0.0
        confidence = min(0.95, max(0.25, _normalise_rerank_score(top_score)))

        # Add role notice if filtered
        role_notice = ""
        if not is_admin(user_role):
            role_notice = f"\n\n> 🔒 *Results filtered by your access level ({user_role})*"

        logger.info(f"RAG agent done, chunks={len(chunks)}, role={user_role}")
        return {
            "rag_result": make_agent_result(
                agent_name="rag",
                answer=response.content + role_notice,
                sources=sources,
                confidence=confidence,
            )
        }

    except Exception as exc:
        logger.error(f"RAG agent failed: {exc}")
        return {
            "rag_result": make_agent_result(
                agent_name="rag",
                answer="",
                sources=[],
                confidence=0.0,
                error=str(exc),
            )
        }