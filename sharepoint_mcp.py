import asyncio
import json
import logging
import sys
import time
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator, Optional

from fastmcp import FastMCP

from config import get_config
from token_manager import TokenManager
from graph_client import GraphClient, GraphError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("nexusiq.sharepoint_mcp")

_token_manager: Optional[TokenManager] = None
_graph_client: Optional[GraphClient] = None
_startup_time: float = 0.0
_delta_tokens: dict[str, str] = {}

def _load_delta_tokens(path: str) -> dict[str, str]:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except Exception:
        return {}

def _save_delta_tokens(tokens: dict, path: str) -> None:
    tmp = Path(path).with_suffix(".tmp")
    tmp.write_text(json.dumps(tokens, indent=2))
    tmp.replace(Path(path))

@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncIterator[None]:
    global _token_manager, _graph_client, _startup_time, _delta_tokens

    cfg = get_config()
    logger.info("SharePoint MCP server starting")

    _delta_tokens = _load_delta_tokens(cfg.sharepoint_delta_token_store)
    _token_manager = TokenManager()
    _graph_client = GraphClient(
        token_manager=_token_manager,
        base_url="https://graph.microsoft.com/v1.0",
    )
    await _graph_client.__aenter__()

    try:
        await _token_manager.get_token()
        logger.info("Azure AD token acquired at startup")
    except RuntimeError as exc:
        logger.error(f"Fatal: {exc}")
        raise

    _startup_time = time.time()
    logger.info("SharePoint MCP server ready")

    yield

    logger.info("SharePoint MCP server shutting down")
    _save_delta_tokens(_delta_tokens, cfg.sharepoint_delta_token_store)
    await _graph_client.__aexit__(None, None, None)

mcp = FastMCP(
    name="nexusiq-sharepoint",
    instructions=(
        "SharePoint document retrieval for NexusIQ. "
        "Use search_documents to find files, get_file_content for full text, "
        "list_sites to discover sites, get_delta for sync."
    ),
    lifespan=lifespan,
)

def _assert_ready() -> None:
    if _graph_client is None or _token_manager is None:
        raise RuntimeError("Server not initialised")
    
#Tool 1 - Search document

@mcp.tool(description="Search SharePoint for documents matching the query. Returns ranked items with item_id, drive_id, site_id, name, web_url, snippet.")
async def search_documents(query: str, site_id: Optional[str] = None) -> dict:
    _assert_ready()
    cfg = get_config()

    target_sites = [site_id] if site_id else cfg.sharepoint_site_ids

    if not target_sites:
        return await _tenant_search(query)

    all_items: list[dict] = []
    errors: list[str] = []

    for sid in target_sites:
        try:
            drive = await _graph_client.get(f"/sites/{sid}/drive")
            drive_id = drive["id"]
            clean_query = re.sub(r'[?$&+,/:;=@"<>#%{}|\\^~\[\]`]', ' ', query).strip()
            clean_query = re.sub(r'\s+', ' ', clean_query)
            path = f"/drives/{drive_id}/root/search(q='{clean_query}')"
            params = {
                "$top": cfg.sharepoint_search_top_k,
                "$select": "id,name,webUrl,size,lastModifiedDateTime,file,folder",
            }
            data = await _graph_client.get(path, params=params)
            for item in data.get("value", []):
                if "folder" in item:
                    continue
                all_items.append({
                    "item_id": item["id"],
                    "drive_id": drive_id,
                    "site_id": sid,
                    "name": item.get("name", ""),
                    "web_url": item.get("webUrl", ""),
                    "snippet": item.get("name", ""),
                    "last_modified": item.get("lastModifiedDateTime", ""),
                    "size_bytes": item.get("size", 0),
                })
        except GraphError as exc:
            logger.warning(f"Search failed for site {sid}: {exc}")
            errors.append(f"{sid}: {exc}")

    all_items = all_items[:cfg.sharepoint_search_top_k]
    result: dict[str, Any] = {"items": all_items, "total": len(all_items)}
    if errors:
        result["partial_errors"] = errors
    return result

async def _tenant_search(query: str) -> dict:
    cfg = get_config()
    body = {
        "requests": [{
            "entityTypes": ["driveItem"],
            "query": {"queryString": query},
            "from": 0,
            "size": cfg.sharepoint_search_top_k,
            "fields": ["id", "name", "webUrl", "size", "lastModifiedDateTime", "parentReference"],
        }]
    }
    try:
        data = await _graph_client.post("/search/query", json=body)
        hits = (
            data.get("value", [{}])[0]
                .get("hitsContainers", [{}])[0]
                .get("hits", [])
        )
        items = []
        for hit in hits:
            r = hit.get("resource", {})
            p = r.get("parentReference", {})
            items.append({
                "item_id": r.get("id", ""),
                "drive_id": p.get("driveId", ""),
                "site_id": p.get("siteId", ""),
                "name": r.get("name", ""),
                "web_url": r.get("webUrl", ""),
                "snippet": hit.get("summary", r.get("name", "")),
                "last_modified": r.get("lastModifiedDateTime", ""),
                "size_bytes": r.get("size", 0),
            })
        return {"items": items, "total": len(items)}
    except GraphError as exc:
        return {"error": True, "code": exc.code, "message": str(exc)}
    
#Tool 2 - get file content

@mcp.tool(description="Fetch metadata and content for a specific SharePoint file.")
async def get_file_content(drive_id: str, item_id: str) -> dict:
    _assert_ready()
    try:
        # Get metadata
        meta = await _graph_client.get(
            f"/drives/{drive_id}/items/{item_id}",
            params={"$select": "id,name,webUrl,size,lastModifiedDateTime,file,createdBy,lastModifiedBy"},
        )

        # Download file bytes directly using the token
        import base64
        token = await _token_manager.get_token()
        async with __import__("httpx").AsyncClient(
            follow_redirects=True,
            timeout=120.0
        ) as http:
            resp = await http.get(
                f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{item_id}/content",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            content_b64 = base64.b64encode(resp.content).decode("utf-8")

        return {
            "item_id": item_id,
            "drive_id": drive_id,
            "name": meta.get("name", ""),
            "web_url": meta.get("webUrl", ""),
            "content_b64": content_b64,
            "content_type": meta.get("file", {}).get("mimeType", ""),
            "size_bytes": meta.get("size", 0),
            "last_modified": meta.get("lastModifiedDateTime", ""),
            "created_by": meta.get("createdBy", {}).get("user", {}).get("displayName", ""),
            "last_modified_by": meta.get("lastModifiedBy", {}).get("user", {}).get("displayName", ""),
        }
    except Exception as exc:
        logger.error(f"get_file_content failed: {exc}")
        return {"error": True, "code": "", "message": str(exc)}
    
#tool 3 - list sites
@mcp.tool(description="List all SharePoint sites accessible to NexusIQ. Call once at startup and cache the result.")
async def list_sites() -> dict:
    _assert_ready()
    cfg = get_config()
    sites = []

    for sid in cfg.sharepoint_site_ids:
        try:
            meta = await _graph_client.get(
                f"/sites/{sid}",
                params={"$select": "id,displayName,webUrl,description"},
            )
            drive = await _graph_client.get(f"/sites/{sid}/drive", params={"$select": "id"})
            sites.append({
                "site_id": meta["id"],
                "display_name": meta.get("displayName", ""),
                "url": meta.get("webUrl", ""),
                "description": meta.get("description", ""),
                "drive_id": drive.get("id", ""),
            })
        except GraphError as exc:
            logger.warning(f"Could not fetch site {sid}: {exc}")

    return {"sites": sites, "total": len(sites)}

#tool4 get_delta

@mcp.tool(description="Fetch changed or deleted items in a drive since last sync. First call returns all items. Subsequent calls return only changes.")
async def get_delta(drive_id: str) -> dict:
    _assert_ready()
    cfg = get_config()
    stored_token = _delta_tokens.get(drive_id)
    is_full_sync = stored_token is None

    if stored_token:
        path = f"/drives/{drive_id}/root/delta(token='{stored_token}')"
    else:
        path = f"/drives/{drive_id}/root/delta"

    params = {"$select": "id,name,webUrl,size,lastModifiedDateTime,file,folder,deleted,parentReference"}

    try:
        all_items = await _graph_client.get_paged(path, params=params)
    except GraphError as exc:
        if exc.status_code == 410:
            logger.warning(f"Delta token expired for {drive_id}, forcing full sync")
            _delta_tokens.pop(drive_id, None)
            return await get_delta(drive_id)
        return {"error": True, "code": exc.code, "message": str(exc)}

    changed = []
    deleted = []
    new_token = None

    for item in all_items:
        if "@odata.deltaLink" in item:
            new_token = item["@odata.deltaLink"].split("token='")[-1].rstrip("')")
            continue
        if "deleted" in item:
            deleted.append(item["id"])
        elif "file" in item:
            changed.append({
                "item_id": item["id"],
                "drive_id": drive_id,
                "name": item.get("name", ""),
                "web_url": item.get("webUrl", ""),
                "last_modified": item.get("lastModifiedDateTime", ""),
                "size_bytes": item.get("size", 0),
            })

    if new_token:
        _delta_tokens[drive_id] = new_token
        _save_delta_tokens(_delta_tokens, cfg.sharepoint_delta_token_store)

    logger.info(f"get_delta: {len(changed)} changed, {len(deleted)} deleted, full_sync={is_full_sync}")
    return {
        "changed": changed,
        "deleted": deleted,
        "total_changed": len(changed),
        "total_deleted": len(deleted),
        "is_full_sync": is_full_sync,
    }

if __name__ == "__main__":
    cfg = get_config()
    if cfg.sharepoint_mcp_transport == "stdio":
        mcp.run(transport="stdio")
    else:
        mcp.run(
            transport=cfg.sharepoint_mcp_transport,
            host=cfg.sharepoint_mcp_host,
            port=cfg.sharepoint_mcp_port,
        )
