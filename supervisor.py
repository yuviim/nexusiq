import asyncio
import json
import logging
import uuid
from typing import Literal, Optional

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from config import get_config
from agents import (
    NexusIQState,
    sharepoint_agent_node,
    sql_agent_node,
    rag_agent_node,
    get_llm,
)

logger = logging.getLogger(__name__)


# ── Node 1: validate_input ────────────────────────────────────────────────────

def validate_input_node(state: NexusIQState) -> dict:
    query = state.get("user_query", "").strip()

    if not query:
        return {
            "user_query": "",
            "intent":     "invalid",
            "session_id": state.get("session_id", str(uuid.uuid4())),
        }

    if len(query) > 2000:
        query = query[:2000]

    return {
        "user_query":          query,
        "session_id":          state.get("session_id", str(uuid.uuid4())),
        "chat_history":        state.get("chat_history", []),
        "agents_enabled":      state.get("agents_enabled", {"sharepoint": True, "sql": True, "rag": True}),
        "hitl_required":       False,
        "hitl_approved":       False,
        "sharepoint_result":   None,
        "sql_result":          None,
        "rag_result":          None,
        "final_answer":        None,
        "citations":           None,
        "confidence":          None,
    }


# ── Node 2: intent_router ─────────────────────────────────────────────────────

async def intent_router_node(state: NexusIQState) -> dict:
    query = state["user_query"].lower().strip()

    if not query or state.get("intent") == "invalid":
        return {"intent": "invalid"}

    # Fast path for conversational — no LLM call needed
    greetings = [
        "hello", "hi", "hey", "thanks", "thank you",
        "bye", "goodbye", "how are you", "good morning",
        "good afternoon", "good evening", "what's up", "sup",
    ]
    if any(query == g or query.startswith(g) for g in greetings):
        responses = {
            "hello":          "Hello! How can I help you today?",
            "hi":             "Hi there! What would you like to know?",
            "hey":            "Hey! Ask me anything about your data or documents.",
            "thanks":         "You're welcome! Anything else I can help with?",
            "thank you":      "Happy to help! Let me know if you need anything else.",
            "bye":            "Goodbye! Come back anytime.",
            "goodbye":        "Goodbye! Have a great day.",
            "how are you":    "I'm doing well and ready to help! What would you like to know?",
            "good morning":   "Good morning! What can I help you with today?",
            "good afternoon": "Good afternoon! What would you like to know?",
            "good evening":   "Good evening! How can I assist you?",
        }
        answer = next(
            (v for k, v in responses.items() if query.startswith(k)),
            "Hello! How can I help you today?"
        )
        return {
            "intent":       "conversational",
            "final_answer": answer,
            "citations":    [],
            "confidence":   1.0,
        }

    # LLM classification for everything else
    llm = get_llm()
    messages = [
        SystemMessage(content=(
            "Classify the user query into exactly one of these intents:\n"
            "- conversational: greetings, small talk, thanks, hello, hi, bye\n"
            "- structured: needs database/SQL data (numbers, counts, trends, "
            "comparisons, how many, list records, show data, aggregate, "
            "which companies, what is the location, layoffs, employees, sales)\n"
            "- unstructured: needs document search (policies, procedures, "
            "definitions, explanations, what does X mean, how does X work)\n"
            "- both: explicitly needs BOTH database AND document sources\n\n"
            "When in doubt between structured and both, choose structured.\n"
            "Only choose 'both' if the question clearly requires data AND documents.\n\n"
            "Respond with ONLY a JSON object:\n"
            '{"intent": "structured", "confidence": 0.9, "rationale": "asks for count"}\n'
            "No other text."
        )),
        HumanMessage(content=query),
    ]

    try:
        response = await llm.ainvoke(messages, max_tokens=100)
        text     = response.content.strip().strip("```json").strip("```").strip()
        parsed   = json.loads(text)
        intent   = parsed.get("intent", "both")
        if intent not in ("structured", "unstructured", "both", "conversational"):
            intent = "both"
        logger.info(f"Intent: {intent} for query: {query[:60]}")
        return {"intent": intent}
    except Exception as exc:
        logger.warning(f"Intent classification failed: {exc}, defaulting to 'both'")
        return {"intent": "both"}


# ── Routing function ──────────────────────────────────────────────────────────

def route_intent(state: NexusIQState) -> str:
    intent  = state.get("intent", "both")
    enabled = state.get("agents_enabled", {"sharepoint": True, "sql": True, "rag": True})

    if intent == "invalid":        return "format_response"
    if intent == "conversational": return "format_response"

    if intent == "structured":
        return "sql_agent_node" if enabled.get("sql", True) else "format_response"
    if intent == "unstructured":
        return "rag_agent_node" if enabled.get("rag", True) else "format_response"
    if intent == "both":
        sql_on = enabled.get("sql", True)
        rag_on = enabled.get("rag", True)
        sp_on  = enabled.get("sharepoint", True)
        if sql_on and (rag_on or sp_on): return "parallel_dispatch"
        if sql_on:  return "sql_agent_node"
        if rag_on:  return "rag_agent_node"
        return "format_response"

    return "parallel_dispatch"


# ── Node 3: parallel_dispatch ─────────────────────────────────────────────────

async def parallel_dispatch_node(state: NexusIQState) -> dict:
    enabled = state.get("agents_enabled", {"sharepoint": True, "sql": True, "rag": True})
    tasks   = []
    keys    = []

    if enabled.get("sharepoint", True):
        tasks.append(sharepoint_agent_node(state)); keys.append("sharepoint")
    if enabled.get("sql", True):
        tasks.append(sql_agent_node(state)); keys.append("sql")
    if enabled.get("rag", True):
        tasks.append(rag_agent_node(state)); keys.append("rag")

    results = await asyncio.gather(*tasks)
    merged  = {}
    for r in results:
        merged.update(r)
    return merged


# ── Node 4: result_merger ─────────────────────────────────────────────────────

async def result_merger_node(state: NexusIQState) -> dict:
    results = []
    for key in ("sharepoint_result", "sql_result", "rag_result"):
        r = state.get(key)
        if r and not r.get("error") and r.get("answer"):
            results.append(r)

    if not results:
        return {
            "final_answer": (
                "I was unable to find relevant information to answer your question. "
                "Please try rephrasing or check that your data sources are connected."
            ),
            "citations":  [],
            "confidence": 0.0,
        }

    if len(results) == 1:
        r = results[0]
        return {
            "final_answer": r["answer"],
            "citations":    r.get("sources", []),
            "confidence":   r.get("confidence", 0.5),
        }

    results.sort(key=lambda x: x.get("confidence", 0), reverse=True)

    combined_context = "\n\n---\n\n".join([
        f"From {r['agent_name']} agent (confidence {r['confidence']:.2f}):\n{r['answer']}"
        for r in results
    ])

    llm = get_llm()
    messages = [
        SystemMessage(content=(
            "You are a synthesis assistant. You have answers from multiple specialist agents. "
            "Write one coherent, concise response that combines all the information. "
            "Do not invent new claims. Preserve all factual content. "
            "If sources complement each other, explain how they connect."
        )),
        HumanMessage(content=(
            f"Question: {state['user_query']}\n\n"
            f"Agent answers:\n{combined_context}"
        )),
    ]
    response = await llm.ainvoke(messages)

    all_sources = []
    for r in results:
        all_sources.extend(r.get("sources", []))

    weights       = [r.get("confidence", 0.5) for r in results]
    avg_confidence = sum(weights) / len(weights)

    return {
        "final_answer": response.content,
        "citations":    all_sources,
        "confidence":   round(avg_confidence, 3),
    }


# ── Node 5: citation_builder ──────────────────────────────────────────────────

def citation_builder_node(state: NexusIQState) -> dict:
    raw_sources = state.get("citations", []) or []
    formatted   = []

    for i, source in enumerate(raw_sources):
        source_type = source.get("type", "unknown")

        if source_type in ("sharepoint", "rag"):
            formatted.append({
                "index":           i + 1,
                "type":            source_type,
                "label":           source.get("name", "Document"),
                "url":             source.get("url", ""),
                "detail":          f"Relevance: {source.get('rerank_score', '')}" if source_type == "rag" else "",
                "embedded_source": source.get("embedded_source", ""),
                "is_embedded":     source.get("is_embedded", False),
                "page_number":     source.get("page_number"),
                "chunk_index":     source.get("chunk_index"),
                "total_chunks":    source.get("total_chunks"),
                "rerank_score":    source.get("rerank_score"),
            })
        elif source_type == "sql":
            formatted.append({
                "index":           i + 1,
                "type":            "sql",
                "label":           f"Database query ({source.get('row_count', 0)} rows)",
                "url":             "",
                "detail":          source.get("sql", ""),
                "embedded_source": "",
                "is_embedded":     False,
                "page_number":     source.get("page_number"),
                "chunk_index":     None,
                "total_chunks":    None,
                "rerank_score":    None,
            })

    return {"citations": formatted}


# ── Node 6: confidence_gate ───────────────────────────────────────────────────

def confidence_gate_node(state: NexusIQState) -> dict:
    cfg        = get_config()
    confidence = state.get("confidence", 0.0)

    if confidence < cfg.reject_threshold:
        logger.info(f"Confidence {confidence} below reject threshold")
        return {
            "final_answer": (
                "I don't have enough reliable information to answer this question confidently. "
                "Please try rephrasing or contact your team directly."
            ),
            "hitl_required": False,
            "confidence":    confidence,
        }

    return {"hitl_required": False}


# ── Routing function ──────────────────────────────────────────────────────────

def route_confidence(state: NexusIQState) -> str:
    return "format_response"


# ── Node 7: format_response ───────────────────────────────────────────────────

def format_response_node(state: NexusIQState) -> dict:
    answer     = state.get("final_answer") or "No answer available."
    citations  = state.get("citations") or []
    confidence = state.get("confidence") or 0.0

    if state.get("intent") == "conversational" and answer:
        return {
            "final_answer": answer,
            "citations":    [],
            "confidence":   1.0,
            "chat_history": state.get("chat_history", []) + [
                {"role": "user",      "content": state["user_query"]},
                {"role": "assistant", "content": answer},
            ],
        }

    history = state.get("chat_history", []) + [
        {"role": "user",      "content": state["user_query"]},
        {"role": "assistant", "content": answer},
    ]

    logger.info(f"format_response: confidence={confidence}, citations={len(citations)}")
    return {
        "final_answer": answer,
        "citations":    citations,
        "confidence":   confidence,
        "chat_history": history[-20:],
    }


# ── Build and compile the graph ───────────────────────────────────────────────

def build_graph():
    checkpointer = MemorySaver()
    builder      = StateGraph(NexusIQState)

    builder.add_node("validate_input",        validate_input_node)
    builder.add_node("intent_router",         intent_router_node)
    builder.add_node("sql_agent_node",        sql_agent_node)
    builder.add_node("rag_agent_node",        rag_agent_node)
    builder.add_node("sharepoint_agent_node", sharepoint_agent_node)
    builder.add_node("parallel_dispatch",     parallel_dispatch_node)
    builder.add_node("result_merger",         result_merger_node)
    builder.add_node("citation_builder",      citation_builder_node)
    builder.add_node("confidence_gate",       confidence_gate_node)
    builder.add_node("format_response",       format_response_node)

    builder.set_entry_point("validate_input")

    builder.add_edge("validate_input", "intent_router")

    builder.add_conditional_edges(
        "intent_router",
        route_intent,
        {
            "sql_agent_node":        "sql_agent_node",
            "rag_agent_node":        "rag_agent_node",
            "sharepoint_agent_node": "sharepoint_agent_node",
            "parallel_dispatch":     "parallel_dispatch",
            "format_response":       "format_response",
        }
    )

    builder.add_edge("sql_agent_node",        "result_merger")
    builder.add_edge("rag_agent_node",        "result_merger")
    builder.add_edge("sharepoint_agent_node", "result_merger")
    builder.add_edge("parallel_dispatch",     "result_merger")
    builder.add_edge("result_merger",         "citation_builder")
    builder.add_edge("citation_builder",      "confidence_gate")

    builder.add_conditional_edges(
        "confidence_gate",
        route_confidence,
        {
            "format_response": "format_response",
        }
    )

    builder.add_edge("format_response", END)

    app = builder.compile(checkpointer=checkpointer)

    logger.info("NexusIQ supervisor graph compiled")
    return app


nexusiq_app = build_graph()