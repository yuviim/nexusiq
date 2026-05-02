# governance.py
# NexusIQ Governance Layer
# Handles role lookup, RLS policy injection, and document access control

import logging
from typing import Optional
import pymysql
from functools import lru_cache

logger = logging.getLogger("nexusiq.governance")

# ── DB connection ─────────────────────────────────────────────────────────────

def _get_conn():
    from config import get_config
    cfg = get_config()
    # Parse MySQL DSN for governance DB (always local MySQL)
    # governance tables are always in the local nexusiq MySQL schema
    return pymysql.connect(
        host='127.0.0.1', port=3306,
        user='root', password='Nivi@3119',
        database='nexusiq', autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )

# ── Role lookup ───────────────────────────────────────────────────────────────

def get_user_role(username: str) -> str:
    """Return role for a username. Defaults to 'analyst' if not found."""
    try:
        con = _get_conn()
        with con.cursor() as cur:
            cur.execute(
                "SELECT role_name FROM nexusiq_user_roles WHERE username = %s",
                (username.lower(),)
            )
            row = cur.fetchone()
        con.close()
        if row:
            return row['role_name']
    except Exception as exc:
        logger.warning(f"Could not fetch role for {username}: {exc}")
    return 'analyst'  # safe default — least privilege

def is_admin(role: str) -> bool:
    return role == 'admin'

# ── RLS — SQL row-level security ──────────────────────────────────────────────

def get_rls_filter(role: str, table_name: str) -> Optional[str]:
    """
    Return a WHERE clause filter for the given role and table.
    Returns None if no restriction applies (admin or no policy).
    """
    if is_admin(role):
        return None
    try:
        con = _get_conn()
        with con.cursor() as cur:
            cur.execute(
                "SELECT filter_clause FROM rls_policies WHERE role_name = %s AND table_name = %s",
                (role, table_name)
            )
            row = cur.fetchone()
        con.close()
        if row and row['filter_clause']:
            return row['filter_clause']
    except Exception as exc:
        logger.warning(f"Could not fetch RLS policy: {exc}")
    return None

def get_all_rls_policies(role: str) -> dict:
    """Return all RLS policies for a role as {table_name: filter_clause}."""
    if is_admin(role):
        return {}
    try:
        con = _get_conn()
        with con.cursor() as cur:
            cur.execute(
                "SELECT table_name, filter_clause FROM rls_policies WHERE role_name = %s",
                (role,)
            )
            rows = cur.fetchall()
        con.close()
        return {r['table_name']: r['filter_clause'] for r in rows if r['filter_clause']}
    except Exception as exc:
        logger.warning(f"Could not fetch RLS policies: {exc}")
    return {}

def inject_rls_into_sql(sql: str, role: str, table_name: str) -> str:
    """
    Inject a WHERE clause into a SQL query based on role policy.
    Returns the original SQL if no policy applies.
    """
    filter_clause = get_rls_filter(role, table_name)
    if not filter_clause:
        return sql

    sql_upper = sql.upper().strip()

    if 'WHERE' in sql_upper:
        # Add to existing WHERE clause
        where_pos = sql_upper.index('WHERE')
        sql = sql[:where_pos + 5] + f" ({filter_clause}) AND " + sql[where_pos + 5:]
    else:
        # Add new WHERE clause before GROUP BY, ORDER BY, LIMIT, or end
        for keyword in ['GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT']:
            if keyword in sql_upper:
                pos = sql_upper.index(keyword)
                sql = sql[:pos] + f" WHERE ({filter_clause}) " + sql[pos:]
                return sql
        sql = sql.rstrip(';') + f" WHERE ({filter_clause})"

    return sql

# ── Document access control ───────────────────────────────────────────────────

def get_denied_doc_patterns(role: str) -> list:
    """Return list of denied doc patterns for a role."""
    if is_admin(role):
        return []
    try:
        con = _get_conn()
        with con.cursor() as cur:
            cur.execute(
                "SELECT doc_pattern FROM doc_permissions WHERE role_name = %s AND allowed = FALSE",
                (role,)
            )
            rows = cur.fetchall()
        con.close()
        return [r['doc_pattern'] for r in rows]
    except Exception as exc:
        logger.warning(f"Could not fetch doc permissions: {exc}")
    return []

def is_doc_allowed(doc_name: str, role: str) -> bool:
    """Check if a document is accessible for the given role."""
    if is_admin(role):
        return True
    import fnmatch
    denied_patterns = get_denied_doc_patterns(role)
    doc_lower = doc_name.lower()
    for pattern in denied_patterns:
        if fnmatch.fnmatch(doc_lower, pattern.lower()):
            logger.info(f"Doc '{doc_name}' denied for role '{role}' — matches pattern '{pattern}'")
            return False
    return True

def filter_citations_by_role(citations: list, role: str) -> list:
    """Filter citation list to remove docs the role cannot access."""
    if is_admin(role):
        return citations
    allowed = []
    for cite in citations:
        label = cite.get('label', '')
        if is_doc_allowed(label, role):
            allowed.append(cite)
        else:
            logger.info(f"Citation '{label}' filtered out for role '{role}'")
    return allowed

def filter_rag_chunks(chunks: list, role: str) -> list:
    """Filter RAG chunks by role doc permissions."""
    if is_admin(role):
        return chunks
    allowed = []
    for chunk in chunks:
        source = chunk.get('metadata', {}).get('source', '') or chunk.get('source', '')
        doc_id  = chunk.get('metadata', {}).get('doc_id', '') or chunk.get('doc_id', '')
        name    = source or doc_id
        if is_doc_allowed(name, role):
            allowed.append(chunk)
    return allowed

# ── Role summary for UI ───────────────────────────────────────────────────────

def get_role_summary(role: str) -> dict:
    """Return a summary of what a role can access — for UI display."""
    policies  = get_all_rls_policies(role)
    denied    = get_denied_doc_patterns(role)
    return {
        "role":            role,
        "is_admin":        is_admin(role),
        "sql_filters":     policies,
        "denied_patterns": denied,
        "can_see_all_sql": is_admin(role),
        "can_see_all_docs": is_admin(role),
    }