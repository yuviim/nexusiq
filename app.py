import asyncio
import logging
import uuid
from typing import Optional

import streamlit as st
from langgraph.types import Command

from config import get_config
from supervisor import nexusiq_app

st.set_page_config(
    page_title="NexusIQ",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ── Session state ─────────────────────────────────────────────────────────────

def init_session():
    if "session_id"   not in st.session_state:
        st.session_state.session_id   = str(uuid.uuid4())
    if "messages"     not in st.session_state:
        st.session_state.messages     = []
    if "pending_hitl" not in st.session_state:
        st.session_state.pending_hitl = None
    if "thread_id"    not in st.session_state:
        st.session_state.thread_id    = str(uuid.uuid4())


# ── Graph invocation ──────────────────────────────────────────────────────────

def run_graph(query: str) -> dict:
    config = {"configurable": {"thread_id": st.session_state.thread_id}}
    initial_state = {
        "user_query": query,
        "session_id": st.session_state.session_id,
    }
    try:
        result = asyncio.run(nexusiq_app.ainvoke(initial_state, config=config))
        return result
    except Exception as exc:
        logging.error(f"Graph invocation failed: {exc}")
        return {
            "final_answer":  f"An error occurred: {exc}",
            "citations":     [],
            "confidence":    0.0,
            "hitl_required": False,
        }


def resume_hitl(action: str, edited_answer: Optional[str] = None) -> dict:
    config   = {"configurable": {"thread_id": st.session_state.thread_id}}
    decision = {"action": action}
    if edited_answer:
        decision["edited_answer"] = edited_answer
    try:
        result = asyncio.run(
            nexusiq_app.ainvoke(Command(resume=decision), config=config)
        )
        return result
    except Exception as exc:
        logging.error(f"HITL resume failed: {exc}")
        return {
            "final_answer": f"Resume failed: {exc}",
            "citations":    [],
            "confidence":   0.0,
        }


# ── Citation renderer ─────────────────────────────────────────────────────────

def render_citations(citations: list) -> None:
    if not citations:
        return

    with st.expander(f"📚 Sources ({len(citations)})", expanded=False):
        for cite in citations:
            cite_type = cite.get("type", "unknown")
            label     = cite.get("label", "Source")
            url       = cite.get("url", "")
            detail    = cite.get("detail", "")
            embedded  = cite.get("embedded_source", "")

            if cite_type == "sql":
                st.markdown(f"**[{cite['index']}] 🗄️ {label}**")
                if detail:
                    st.code(detail, language="sql")

            elif cite_type in ("rag", "sharepoint"):
                if url:
                    st.markdown(f"**[{cite['index']}] 📄 [{label}]({url})**")
                else:
                    st.markdown(f"**[{cite['index']}] 📄 {label}**")
                if embedded:
                    st.caption(f"   └── embedded: {embedded}")
                if detail:
                    st.caption(detail)


# ── HITL widget ───────────────────────────────────────────────────────────────

def render_hitl_widget(hitl_state: dict):
    st.warning("⚠️ This answer needs human review before being shown.")

    st.markdown("**Draft answer:**")
    st.markdown(hitl_state.get("answer_draft", ""))

    confidence = hitl_state.get("confidence", 0.0)
    st.caption(f"Confidence score: {confidence:.0%}")

    render_citations(hitl_state.get("citations", []))

    st.markdown("---")
    edited = st.text_area(
        "Edit answer (optional):",
        value=hitl_state.get("answer_draft", ""),
        height=150,
        key="hitl_edit_box",
    )

    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("✅ Approve", use_container_width=True):
            return ("approve", None)
    with col2:
        if st.button("✏️ Approve with edits", use_container_width=True):
            return ("edit", edited)
    with col3:
        if st.button("❌ Reject", use_container_width=True):
            return ("reject", None)

    return None


# ── Sidebar ───────────────────────────────────────────────────────────────────

def render_sidebar() -> None:
    cfg = get_config()
    with st.sidebar:
        st.title("NexusIQ")
        st.caption("Enterprise Knowledge Assistant")
        st.divider()

        st.markdown("**Session**")
        st.caption(f"ID: `{st.session_state.session_id[:8]}...`")
        if st.button("New session", use_container_width=True):
            st.session_state.clear()
            st.rerun()

        st.divider()
        st.markdown("**Data sources**")
        st.markdown("🟢 SharePoint MCP")
        st.markdown("🟢 SQL MCP")
        st.markdown("🟢 ChromaDB RAG")

        st.divider()
        st.markdown("**Config**")
        st.caption(f"Model: `{cfg.llm_model}`")
        st.caption(f"HITL threshold: `{cfg.hitl_threshold}`")
        st.caption(f"Env: `{cfg.nexusiq_env}`")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    init_session()
    render_sidebar()

    st.title("🔍 NexusIQ")
    st.caption("Ask anything — I'll search your documents and databases.")
    st.divider()

    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if msg.get("citations"):
                render_citations(msg["citations"])
            if msg.get("confidence") is not None:
                st.caption(f"Confidence: {msg['confidence']:.0%}")

    if st.session_state.pending_hitl:
        hitl_result = render_hitl_widget(st.session_state.pending_hitl)
        if hitl_result:
            action, edited = hitl_result
            with st.spinner("Processing your decision..."):
                result = resume_hitl(action, edited)
            st.session_state.pending_hitl = None
            answer     = result.get("final_answer", "")
            citations  = result.get("citations", [])
            confidence = result.get("confidence", 0.0)
            st.session_state.messages.append({
                "role":       "assistant",
                "content":    answer,
                "citations":  citations,
                "confidence": confidence,
            })
            st.rerun()
        return

    if query := st.chat_input("Ask a question about your data or documents..."):
        st.session_state.messages.append({"role": "user", "content": query})
        with st.chat_message("user"):
            st.markdown(query)

        with st.chat_message("assistant"):
            with st.spinner("Searching..."):
                result = run_graph(query)

            hitl_required = result.get("hitl_required", False)

            if hitl_required:
                st.session_state.pending_hitl = {
                    "answer_draft": result.get("final_answer"),
                    "confidence":   result.get("confidence"),
                    "citations":    result.get("citations", []),
                }
                st.rerun()
            else:
                answer     = result.get("final_answer", "No answer found.")
                citations  = result.get("citations", [])
                confidence = result.get("confidence", 0.0)

                st.markdown(answer)
                render_citations(citations)
                st.caption(f"Confidence: {confidence:.0%}")

                st.session_state.messages.append({
                    "role":       "assistant",
                    "content":    answer,
                    "citations":  citations,
                    "confidence": confidence,
                })


if __name__ == "__main__":
    main()