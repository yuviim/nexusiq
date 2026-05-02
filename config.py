from pydantic import Field, computed_field
from pydantic_settings import BaseSettings
from functools import lru_cache


class NexusIQConfig(BaseSettings):

    # ── LLM ───────────────────────────────────────────────────────────────────
    anthropic_api_key: str = Field(..., validation_alias="ANTHROPIC_API_KEY")
    llm_model: str = "claude-sonnet-4-6"
    llm_max_tokens: int = 4096
    llm_temperature: float = 0.0

    # ── Azure AD ──────────────────────────────────────────────────────────────
    azure_tenant_id: str = Field(..., validation_alias="AZURE_TENANT_ID")
    azure_client_id: str = Field(..., validation_alias="AZURE_CLIENT_ID")
    azure_client_secret: str = Field(..., validation_alias="AZURE_CLIENT_SECRET")

    # ── SharePoint ────────────────────────────────────────────────────────────
    sharepoint_site_ids_raw: str = Field("", validation_alias="SHAREPOINT_SITE_IDS")
    sharepoint_mcp_host: str = Field("0.0.0.0", validation_alias="SHAREPOINT_MCP_HOST")
    sharepoint_mcp_port: int = Field(8001, validation_alias="SHAREPOINT_MCP_PORT")
    sharepoint_mcp_transport: str = Field("sse", validation_alias="SHAREPOINT_MCP_TRANSPORT")
    sharepoint_search_top_k: int = Field(20, validation_alias="SEARCH_TOP_K")
    sharepoint_fetch_top_k: int = Field(3, validation_alias="FETCH_TOP_K")
    sharepoint_max_content_chars: int = Field(8000, validation_alias="MAX_CONTENT_CHARS")
    sharepoint_delta_token_store: str = Field("./delta_token.json", validation_alias="DELTA_TOKEN_STORE")

    # ── SQL ───────────────────────────────────────────────────────────────────
    db_dsn: str = Field(..., validation_alias="DB_DSN")
    db_max_rows: int = Field(500, validation_alias="DB_MAX_ROWS")
    sql_mcp_host: str = Field("0.0.0.0", validation_alias="SQL_MCP_HOST")
    sql_mcp_port: int = Field(8002, validation_alias="SQL_MCP_PORT")
    sql_mcp_transport: str = Field("sse", validation_alias="SQL_MCP_TRANSPORT")

    # ── RAG ───────────────────────────────────────────────────────────────────
    chroma_host: str = Field("localhost", validation_alias="CHROMA_HOST")
    chroma_port: int = Field(8003, validation_alias="CHROMA_PORT")
    chroma_collection: str = Field("nexusiq_docs", validation_alias="CHROMA_COLLECTION")
    embed_model: str = Field("all-MiniLM-L6-v2", validation_alias="EMBED_MODEL")
    rerank_model: str = Field("cross-encoder/ms-marco-MiniLM-L-6-v2", validation_alias="RERANK_MODEL")
    rag_top_k: int = Field(20, validation_alias="RAG_TOP_K")
    rag_rerank_top_k: int = Field(5, validation_alias="RAG_RERANK_TOP_K")

    # ── LangGraph ─────────────────────────────────────────────────────────────
    checkpointer_db: str = Field("./nexusiq_checkpoints.db", validation_alias="CHECKPOINTER_DB")

    # ── App ───────────────────────────────────────────────────────────────────
    nexusiq_env: str = Field("development", validation_alias="NEXUSIQ_ENV")
    hitl_threshold: float = Field(0.75, validation_alias="HITL_CONFIDENCE_THRESHOLD")
    reject_threshold: float = Field(0.50, validation_alias="REJECT_CONFIDENCE_THRESHOLD")
    log_level: str = Field("INFO", validation_alias="LOG_LEVEL")

    # ── Computed ──────────────────────────────────────────────────────────────
    @computed_field
    @property
    def sharepoint_site_ids(self) -> list[str]:
        return [s.strip() for s in self.sharepoint_site_ids_raw.split(",") if s.strip()]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "populate_by_name": True,
    }


@lru_cache
def get_config() -> NexusIQConfig:
    return NexusIQConfig()