import logging
import re
import sys
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

from fastmcp import FastMCP
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool

from config import get_config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("nexusiq.sql_mcp")

_engine        = None
_exasol        = None
_exasol_params = {}
_db_type       = "mysql"
_startup_time: float = 0.0

# ── Virtual Schema registry ────────────────────────────────────────────────
# Maps VS name → description for the SQL agent to understand what each VS contains
VIRTUAL_SCHEMAS = {
    "NEXUSIQ_VS":   "MySQL database — customers, employees, products, projects, sales_orders, budget_actuals",
    "SNOWFLAKE_VS": "Snowflake data warehouse — customers, employees, products, projects, sales_orders, budget_actuals",
}

_WRITE_KEYWORDS = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE|EXEC|EXECUTE)\b',
    re.IGNORECASE
)



def _is_trino_dsn(dsn: str) -> bool:
    return dsn.startswith("trino://")

def _make_trino_conn(dsn: str):
    import trino
    # Parse trino://user@host:port/catalog/schema
    rest = dsn.replace("trino://", "")
    user_host, path = rest.split("@", 1) if "@" in rest else ("admin", rest)
    user = user_host
    parts = path.split("/")
    host_port = parts[0]
    catalog = parts[1] if len(parts) > 1 else "tpch"
    schema = parts[2] if len(parts) > 2 else "sf1"
    host, port = (host_port.rsplit(":", 1) if ":" in host_port else (host_port, "8080"))
    return trino.dbapi.connect(
        host=host, port=int(port), user=user,
        catalog=catalog, schema=schema,
    )

def _is_exasol_dsn(dsn: str) -> bool:
    return dsn.startswith("exasol+pyexasol://")


def _parse_exasol_dsn(dsn: str) -> dict:
    import urllib.parse
    rest = dsn.replace("exasol+pyexasol://", "")
    userinfo, hostport = rest.rsplit("@", 1)
    user, password = userinfo.split(":", 1)
    password = urllib.parse.unquote_plus(password)
    host, port = (hostport.rsplit(":", 1) if ":" in hostport else (hostport, "8563"))
    return {"user": user, "password": password, "host": host, "port": int(port)}


import threading
_exasol_lock = threading.Lock()

def _make_exasol_conn(params: dict):
    import pyexasol
    return pyexasol.connect(
        dsn=f"{params['host']}:{params['port']}",
        user=params["user"],
        password=params["password"],
        websocket_sslopt={"cert_reqs": 0},
        connection_timeout=15,
        query_timeout=300,
    )


def _get_exasol_conn():
    global _exasol
    with _exasol_lock:
        try:
            _exasol.execute("SELECT 1 FROM DUAL")
        except Exception:
            import time
            logger.info("Exasol connection lost — reconnecting")
            time.sleep(1)
            _exasol = _make_exasol_conn(_exasol_params)
        return _exasol


@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncIterator[None]:
    global _engine, _exasol, _exasol_params, _db_type, _startup_time

    cfg = get_config()
    logger.info("SQL MCP server starting")

    if _is_trino_dsn(cfg.db_dsn):
        _engine = _make_trino_conn(cfg.db_dsn)
        _db_type = "trino"
        logger.info("Trino connection verified")
    elif _is_exasol_dsn(cfg.db_dsn):
        _exasol_params = _parse_exasol_dsn(cfg.db_dsn)
        _exasol  = _make_exasol_conn(_exasol_params)
        _db_type = "exasol"
        logger.info("Exasol connection verified via pyexasol")

        # Log available Virtual Schemas
        try:
            rows = _exasol.execute(
                "SELECT SCHEMA_NAME FROM EXA_ALL_VIRTUAL_SCHEMAS ORDER BY SCHEMA_NAME"
            ).fetchall()
            vs_names = [r[0] for r in rows]
            logger.info(f"Virtual Schemas available: {vs_names}")
        except Exception as e:
            logger.warning(f"Could not list Virtual Schemas: {e}")
    else:
        _engine = create_engine(
            cfg.db_dsn, poolclass=QueuePool,
            pool_size=5, max_overflow=10, pool_pre_ping=True, echo=False,
        )
        with _engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        _db_type = _engine.dialect.name
        logger.info(f"Database connection verified — dialect: {_db_type}")

    _startup_time = time.time()
    logger.info("SQL MCP server ready")
    yield

    logger.info("SQL MCP server shutting down")
    if _engine:
        try: _engine.dispose()
        except: pass
    if _exasol:
        try: _exasol.close()
        except: pass


mcp = FastMCP(
    name="nexusiq-sql",
    instructions=(
        "SQL database query server for NexusIQ. "
        "Connects to Exasol which federates multiple databases via Virtual Schemas. "
        "NEXUSIQ_VS contains MySQL data. SNOWFLAKE_VS contains Snowflake data. "
        "Use list_tables to discover tables, get_schema for column details, "
        "explain_query to validate, execute_query to run queries. "
        "Always prefix table names with the Virtual Schema: e.g. NEXUSIQ_VS.employees or SNOWFLAKE_VS.customers"
    ),
    lifespan=lifespan,
)


def _assert_ready() -> None:
    if _engine is None and _exasol is None:
        raise RuntimeError("SQL MCP server not initialised")


def update_engine(dsn: str) -> None:
    global _engine, _exasol, _exasol_params, _db_type

    if _is_exasol_dsn(dsn):
        if _exasol:
            try: _exasol.close()
            except: pass
        if _engine:
            _engine.dispose()
            _engine = None
        _exasol_params = _parse_exasol_dsn(dsn)
        _exasol  = _make_exasol_conn(_exasol_params)
        _db_type = "exasol"
        logger.info("Exasol engine updated via pyexasol")
    else:
        if _exasol:
            try: _exasol.close()
            except: pass
            _exasol = None
        old_engine = _engine
        new_engine = create_engine(
            dsn, poolclass=QueuePool,
            pool_size=5, max_overflow=10, pool_pre_ping=True, echo=False,
        )
        with new_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        _engine  = new_engine
        _db_type = _engine.dialect.name
        logger.info(f"New engine verified — dialect: {_db_type}")
        if old_engine:
            old_engine.dispose()


def _is_safe_sql(sql: str) -> bool:
    return not bool(_WRITE_KEYWORDS.search(sql))


@mcp.tool(description=(
    "List all tables across all Virtual Schemas in Exasol. "
    "Shows tables from NEXUSIQ_VS (MySQL) and SNOWFLAKE_VS (Snowflake). "
    "Call this first so the SQL agent knows what tables exist and which Virtual Schema they belong to."
))
def list_tables(schema: Optional[str] = None) -> dict:
    _assert_ready()
    try:
        if _db_type == "trino":
            cur = _engine.cursor()
            cur.execute("SHOW SCHEMAS FROM tpch")
            schemas = [r[0] for r in cur.fetchall() if r[0] not in ('information_schema',)]
            tables = []
            for s in schemas:
                try:
                    cur2 = _engine.cursor()
                    cur2.execute(f"SHOW TABLES FROM tpch.{s}")
                    for r in cur2.fetchall():
                        tables.append({"schema": f"tpch.{s}", "table": r[0], "full_name": f"tpch.{s}.{r[0]}", "source": "Trino TPC-H"})
                except: pass
            logger.info(f"list_tables (trino): {len(tables)} tables found")
            return {"tables": tables, "total": len(tables), "note": "Use tpch.sf1.tablename in queries"}

        if _db_type == "exasol":
            exa = _get_exasol_conn()

            if schema:
                # List tables in a specific Virtual Schema
                rows = exa.execute(
                    "SELECT TABLE_NAME FROM SYS.EXA_ALL_VIRTUAL_TABLES "
                    "WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
                    [schema.upper()]
                ).fetchall()
                tables = [{
                    "schema": schema.upper(),
                    "table": r[0],
                    "full_name": f"{schema.upper()}.{r[0]}",
                    "source": VIRTUAL_SCHEMAS.get(schema.upper(), "Virtual Schema")
                } for r in rows]
            else:
                # List all tables across all Virtual Schemas
                rows = exa.execute(
                    "SELECT TABLE_SCHEMA, TABLE_NAME FROM SYS.EXA_ALL_VIRTUAL_TABLES "
                    "ORDER BY TABLE_SCHEMA, TABLE_NAME"
                ).fetchall()
                tables = [{
                    "schema": r[0],
                    "table": r[1],
                    "full_name": f"{r[0]}.{r[1]}",
                    "source": VIRTUAL_SCHEMAS.get(r[0], "Virtual Schema")
                } for r in rows]

                # Also include regular Exasol tables if any
                reg_rows = exa.execute(
                    "SELECT TABLE_SCHEMA, TABLE_NAME FROM EXA_ALL_TABLES "
                    "WHERE TABLE_SCHEMA NOT IN ('SYS', 'EXA_STATISTICS', 'ADAPTER') "
                    "ORDER BY TABLE_SCHEMA, TABLE_NAME"
                ).fetchall()
                for r in reg_rows:
                    tables.append({
                        "schema": r[0],
                        "table": r[1],
                        "full_name": f"{r[0]}.{r[1]}",
                        "source": "Exasol native table"
                    })

            logger.info(f"list_tables (exasol): {len(tables)} tables found")
            return {
                "tables": tables,
                "total": len(tables),
                "virtual_schemas": list(VIRTUAL_SCHEMAS.keys()),
                "note": "Prefix queries with schema name e.g. SELECT * FROM NEXUSIQ_VS.employees"
            }

        # Non-Exasol fallback
        from sqlalchemy import inspect
        inspector = inspect(_engine)
        schemas   = [schema] if schema else [_engine.url.database or "nexusiq"]
        tables    = []
        for s in schemas:
            try:
                for t in inspector.get_table_names(schema=s):
                    tables.append({"schema": s, "table": t, "full_name": f"{s}.{t}" if s else t})
            except Exception as exc:
                logger.warning(f"Could not list tables for schema {s}: {exc}")
        return {"tables": tables, "total": len(tables)}

    except Exception as exc:
        logger.error(f"list_tables failed: {exc}")
        return {"tables": [], "total": 0, "error": str(exc)}


@mcp.tool(description=(
    "Get column names and types for a table in a Virtual Schema. "
    "Specify schema as NEXUSIQ_VS or SNOWFLAKE_VS. "
    "The SQL agent needs this to generate accurate SQL queries."
))
def get_schema(table: str, schema: Optional[str] = None) -> dict:
    _assert_ready()
    try:
        if _db_type == "trino":
            # For Trino use 3-part naming: catalog.schema.table
            parts = table.split(".")
            if len(parts) == 3:
                catalog, schema_name, tbl = parts
            elif len(parts) == 2:
                schema_name, tbl = parts
                catalog = "tpch"
            else:
                tbl = table
                schema_name = (schema or "sf1").split(".")[-1]
                catalog = "tpch"
            cur = _engine.cursor()
            cur.execute(f"DESCRIBE {catalog}.{schema_name}.{tbl}")
            rows = cur.fetchall()
            columns = [{"name": r[0], "type": r[1], "nullable": True} for r in rows]
            return {
                "table": tbl,
                "schema": f"{catalog}.{schema_name}",
                "full_name": f"{catalog}.{schema_name}.{tbl}",
                "columns": columns,
                "primary_keys": [],
                "foreign_keys": []
            }

        if _db_type == "exasol":
            exa = _get_exasol_conn()

            # Try Virtual Schema columns first
            vs_schema = (schema or "NEXUSIQ_VS").upper()
            table_upper = table.upper()

            rows = exa.execute(
                    f"SELECT COLUMN_NAME, ADAPTER_NOTES "
                    f"FROM SYS.EXA_ALL_VIRTUAL_COLUMNS "
                    f"WHERE UPPER(COLUMN_SCHEMA) = '{vs_schema}' AND UPPER(COLUMN_TABLE) = '{table_upper}'"
                ).fetchall()
            # Map to standard format
            if rows:
                columns = [{"name": r[0], "type": "VARCHAR", "nullable": True} for r in rows]
                return {
                    "table": table_upper,
                    "schema": vs_schema,
                    "full_name": f"{vs_schema}.{table_upper}",
                    "columns": columns,
                    "primary_keys": [],
                    "foreign_keys": [],
                    "source": VIRTUAL_SCHEMAS.get(vs_schema, "Virtual Schema")
                }
            if not rows:
                try:
                    rows = exa.execute(
                        f"SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_IS_NULLABLE "
                        f"FROM SYS.EXA_ALL_COLUMNS "
                        f"WHERE UPPER(TABLE_SCHEMA) = '{vs_schema}' AND UPPER(TABLE_NAME) = '{table_upper}' "
                        f"ORDER BY ORDINAL_POSITION"
                    ).fetchall()
                    columns = [{"name": r[0], "type": r[1], "nullable": r[2] == "Y"} for r in rows]
                except Exception:
                    columns = []

            columns = [{"name": r[0], "type": r[1], "nullable": r[2] == "Y"} for r in rows]
            return {
                "table": table_upper,
                "schema": vs_schema,
                "full_name": f"{vs_schema}.{table_upper}",
                "columns": columns,
                "primary_keys": [],
                "foreign_keys": [],
                "source": VIRTUAL_SCHEMAS.get(vs_schema, "Virtual Schema")
            }

        from sqlalchemy import inspect
        inspector = inspect(_engine)
        columns   = [{
            "name": col["name"],
            "type": str(col["type"]),
            "nullable": col.get("nullable", True),
        } for col in inspector.get_columns(table, schema=schema)]
        pk  = inspector.get_pk_constraint(table, schema=schema)
        fks = inspector.get_foreign_keys(table, schema=schema)
        return {
            "table": table, "schema": schema, "columns": columns,
            "primary_keys": pk.get("constrained_columns", []),
            "foreign_keys": [{
                "columns": fk["constrained_columns"],
                "references_table": fk["referred_table"],
                "references_columns": fk["referred_columns"]
            } for fk in fks],
        }
    except Exception as exc:
        logger.error(f"get_schema failed for {table}: {exc}")
        return {"error": True, "message": str(exc)}


@mcp.tool(description="Validate a SQL query before executing it. Always call before execute_query.")
def explain_query(sql: str) -> dict:
    _assert_ready()
    if not _is_safe_sql(sql):
        return {"safe": False, "reason": "Query contains write operations which are not permitted", "sql": sql}
    try:
        if _db_type == "trino":
            return {"safe": True, "plan": [{"note": "Trino query validated — ready to execute"}], "sql": sql}
        if _db_type == "exasol":
            return {"safe": True, "plan": [{"note": "Exasol query validated — ready to execute"}], "sql": sql}
        with _engine.connect() as conn:
            result = conn.execute(text(f"EXPLAIN {sql}"))
            plan   = [dict(row._mapping) for row in result]
        return {"safe": True, "plan": plan, "sql": sql}
    except Exception as exc:
        return {"safe": False, "reason": str(exc), "sql": sql}


@mcp.tool(description=(
    "Execute a SQL SELECT query through Exasol Virtual Schemas. "
    "Always prefix table names with the Virtual Schema: "
    "NEXUSIQ_VS.table_name for MySQL data, "
    "SNOWFLAKE_VS.table_name for Snowflake data. "
    "Results capped at DB_MAX_ROWS."
))
def execute_query(sql: str) -> dict:
    _assert_ready()
    cfg = get_config()
    if not _is_safe_sql(sql):
        return {"error": True, "message": "Query contains write operations which are not permitted"}
    try:
        if _db_type == "trino":
            cur = _engine.cursor()
            cur.execute(sql)
            cols = [d[0] for d in cur.description]
            rows = []
            for i, row in enumerate(cur.fetchall()):
                if i >= cfg.db_max_rows: break
                rows.append(dict(zip(cols, [str(v) if v is not None else None for v in row])))
            logger.info(f"execute_query (trino): {len(rows)} rows returned")
            return {"columns": cols, "rows": rows, "row_count": len(rows), "capped": len(rows) == cfg.db_max_rows}

        if _db_type == "exasol":
            exa  = _get_exasol_conn()
            stmt = exa.execute(sql)
            cols = list(stmt.columns())
            rows = []
            for i, row in enumerate(stmt):
                if i >= cfg.db_max_rows: break
                rows.append(dict(zip(cols, row)))
            logger.info(f"execute_query (exasol): {len(rows)} rows returned")
            return {
                "columns": cols,
                "rows": rows,
                "row_count": len(rows),
                "capped": len(rows) == cfg.db_max_rows
            }

        with _engine.connect() as conn:
            result  = conn.execute(text(sql))
            columns = list(result.keys())
            rows    = []
            for i, row in enumerate(result):
                if i >= cfg.db_max_rows: break
                rows.append(dict(row._mapping))
        logger.info(f"execute_query: {len(rows)} rows returned")
        return {"columns": columns, "rows": rows, "row_count": len(rows), "capped": len(rows) == cfg.db_max_rows}
    except Exception as exc:
        logger.error(f"execute_query failed: {exc}")
        return {"error": True, "message": str(exc)}


if __name__ == "__main__":
    cfg = get_config()
    if cfg.sql_mcp_transport == "stdio":
        mcp.run(transport="stdio")
    else:
        mcp.run(transport=cfg.sql_mcp_transport, host=cfg.sql_mcp_host, port=cfg.sql_mcp_port)