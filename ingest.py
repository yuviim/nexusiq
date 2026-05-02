import asyncio
import json
import logging
import sys
from datetime import datetime
from typing import Optional

import httpx

from config import get_config
from document_extractor import DocumentExtractor, ExtractedDocument
from rag_pipeline import RAGPipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("nexusiq.ingest")


# ── Stats tracker ─────────────────────────────────────────────────────────────

class IngestStats:
    def __init__(self):
        self.processed  = 0
        self.ingested   = 0
        self.skipped    = 0
        self.deleted    = 0
        self.failed     = 0
        self.start_time = datetime.now()

    def summary(self) -> str:
        elapsed = (datetime.now() - self.start_time).seconds
        return (
            f"\n{'='*50}\n"
            f"Ingestion complete in {elapsed}s\n"
            f"  Processed : {self.processed}\n"
            f"  Ingested  : {self.ingested}\n"
            f"  Skipped   : {self.skipped}\n"
            f"  Deleted   : {self.deleted}\n"
            f"  Failed    : {self.failed}\n"
            f"{'='*50}"
        )


# ── MCP caller ────────────────────────────────────────────────────────────────

async def _call_mcp(tool: str, args: dict) -> dict:
    from fastmcp import Client
    cfg = get_config()
    url = f"http://{cfg.sharepoint_mcp_host}:{cfg.sharepoint_mcp_port}/sse"

    async with Client(url) as client:
        result = await client.call_tool(tool, args)

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


# ── Chunk metadata builder ────────────────────────────────────────────────────

def _build_metadata(
    doc_id: str,
    name: str,
    web_url: str,
    site_id: str,
    drive_id: str,
    item_id: str,
    content_type: str,
    created_by: str,
    last_mod_by: str,
    last_mod: str,
    extracted: ExtractedDocument,
    embedded_source: Optional[str] = None,
) -> dict:
    """
    Build the metadata dict stored per chunk in ChromaDB.
    This is what the citation panel reads when showing sources.
    embedded_source is set when the chunk came from a PDF
    embedded inside a DOCX.
    """
    meta = {
        "doc_id":             doc_id,
        "name":               name,
        "web_url":            web_url,
        "site_id":            site_id,
        "drive_id":           drive_id,
        "item_id":            item_id,
        "content_type":       content_type,
        "created_by":         created_by,
        "last_modified_by":   last_mod_by,
        "last_modified":      last_mod,
        "extraction_method":  extracted.method,
        "page_count":         extracted.pages,
        "ingested_at":        datetime.now().isoformat(),
        "is_embedded":        embedded_source is not None,
        "embedded_source":    embedded_source or "",
    }
    return meta


# ── Process one item ──────────────────────────────────────────────────────────

async def _process_item(
    item: dict,
    extractor: DocumentExtractor,
    rag: RAGPipeline,
    stats: IngestStats,
) -> None:
    item_id  = item.get("item_id", "")
    drive_id = item.get("drive_id", "")
    name     = item.get("name", "")
    web_url  = item.get("web_url", "")
    site_id  = item.get("site_id", "")
    last_mod = item.get("last_modified", "")

    # Skip unsupported file types early
    supported = (".pdf", ".docx", ".pptx")
    if not any(name.lower().endswith(ext) for ext in supported):
        logger.info(f"Skipping unsupported: {name}")
        stats.skipped += 1
        return

    stats.processed += 1
    doc_id = f"{drive_id}__{item_id}"

    logger.info(f"Processing: {name}")

    try:
        # Get file content from SharePoint MCP
        file_meta = await _call_mcp("get_file_content", {
            "drive_id": drive_id,
            "item_id":  item_id,
        })

        if file_meta.get("error"):
            logger.warning(f"Could not fetch {name}: {file_meta.get('message')}")
            stats.failed += 1
            return

        content_b64  = file_meta.get("content_b64", "")
        content_type = file_meta.get("content_type", "")
        created_by   = file_meta.get("created_by", "")
        last_mod_by  = file_meta.get("last_modified_by", "")

        if not content_b64:
            logger.warning(f"No content for {name}")
            stats.skipped += 1
            return

        # Extract text from the document
        extracted = extractor.extract_from_b64(
            content_b64=content_b64,
            content_type=content_type,
            filename=name,
        )

        if not extracted.text.strip():
            logger.warning(
                f"No text from {name} "
                f"(method={extracted.method}, warnings={extracted.warnings})"
            )
            stats.skipped += 1
            return

        # ── Split text into main content and embedded sections ────────────────
        # document_extractor marks embedded content with:
        # "EMBEDDED DOCUMENTS:\n[Embedded: filename.pdf]\n..."
        # We split on this marker so we can store separate metadata
        # for the parent doc chunks vs the embedded doc chunks.

        main_text     = extracted.text
        embedded_parts = []

        if "EMBEDDED DOCUMENTS:" in extracted.text:
            split = extracted.text.split("EMBEDDED DOCUMENTS:", 1)
            main_text = split[0].strip()

            # Parse each embedded section
            # Format: [Embedded: filename.pdf]\n...text...
            raw_embedded = split[1].strip()
            import re
            sections = re.split(r'\[Embedded: ([^\]]+)\]', raw_embedded)
            # sections alternates: ["", filename, text, filename, text, ...]
            i = 1
            while i < len(sections) - 1:
                emb_filename = sections[i].strip()
                emb_text     = sections[i + 1].strip()
                if emb_text:
                    embedded_parts.append((emb_filename, emb_text))
                i += 2

        # ── Ingest main document content ──────────────────────────────────────
        if main_text:
            main_meta = _build_metadata(
                doc_id=doc_id,
                name=name,
                web_url=web_url,
                site_id=site_id,
                drive_id=drive_id,
                item_id=item_id,
                content_type=content_type,
                created_by=created_by,
                last_mod_by=last_mod_by,
                last_mod=last_mod,
                extracted=extracted,
                embedded_source=None,     # ← not embedded, this is the parent
            )
            chunk_count = rag.ingest_document(
                text=main_text,
                doc_id=doc_id,
                metadata=main_meta,
            )
            logger.info(f"Ingested main: {name} → {chunk_count} chunks")

        # ── Ingest each embedded document separately ──────────────────────────
        for emb_filename, emb_text in embedded_parts:
            emb_doc_id = f"{doc_id}__embedded__{emb_filename}"
            emb_meta = _build_metadata(
                doc_id=emb_doc_id,
                name=name,                    # ← parent doc name for SharePoint link
                web_url=web_url,              # ← parent doc URL (clicks open the DOCX)
                site_id=site_id,
                drive_id=drive_id,
                item_id=item_id,
                content_type="application/pdf",
                created_by=created_by,
                last_mod_by=last_mod_by,
                last_mod=last_mod,
                extracted=extracted,
                embedded_source=emb_filename, # ← embedded PDF name stored here
            )
            emb_chunk_count = rag.ingest_document(
                text=emb_text,
                doc_id=emb_doc_id,
                metadata=emb_meta,
            )
            logger.info(
                f"Ingested embedded: {emb_filename} "
                f"(inside {name}) → {emb_chunk_count} chunks"
            )

        stats.ingested += 1

    except Exception as exc:
        logger.error(f"Failed to process {name}: {exc}")
        stats.failed += 1


# ── Process deletions ─────────────────────────────────────────────────────────

async def _process_deletions(
    deleted_ids: list,
    rag: RAGPipeline,
    stats: IngestStats,
) -> None:
    for item_id in deleted_ids:
        try:
            rag.delete_document(item_id)
            logger.info(f"Deleted chunks for item_id: {item_id}")
            stats.deleted += 1
        except Exception as exc:
            logger.warning(f"Could not delete {item_id}: {exc}")


# ── Sync one drive ────────────────────────────────────────────────────────────

async def _sync_drive(
    drive_id: str,
    site_id: str,
    extractor: DocumentExtractor,
    rag: RAGPipeline,
    stats: IngestStats,
) -> None:
    logger.info(f"Syncing drive: {drive_id}")

    delta = await _call_mcp("get_delta", {"drive_id": drive_id})

    if delta.get("error"):
        logger.error(f"get_delta failed for {drive_id}: {delta.get('message')}")
        return

    changed = delta.get("changed", [])
    deleted = delta.get("deleted", [])
    is_full = delta.get("is_full_sync", False)

    logger.info(
        f"Drive {drive_id}: {len(changed)} changed, "
        f"{len(deleted)} deleted, full_sync={is_full}"
    )

    for item in changed:
        item["site_id"] = site_id

    if deleted:
        await _process_deletions(deleted, rag, stats)

    for item in changed:
        await _process_item(item, extractor, rag, stats)


# ── Main entry point ──────────────────────────────────────────────────────────

async def run_ingestion(force_full: bool = False) -> None:
    cfg = get_config()
    logger.info("NexusIQ ingestion starting")

    extractor = DocumentExtractor()
    rag       = RAGPipeline()
    stats     = IngestStats()

    sites_result = await _call_mcp("list_sites", {})
    sites = sites_result.get("sites", [])

    if not sites:
        logger.warning("No SharePoint sites found — check SHAREPOINT_SITE_IDS in .env")
        return

    logger.info(f"Found {len(sites)} site(s) to sync")

    for site in sites:
        site_id  = site.get("site_id", "")
        drive_id = site.get("drive_id", "")
        name     = site.get("display_name", site_id)

        if not drive_id:
            logger.warning(f"No drive_id for site {name}, skipping")
            continue

        logger.info(f"Processing site: {name}")
        await _sync_drive(drive_id, site_id, extractor, rag, stats)

    logger.info(stats.summary())
    logger.info(f"ChromaDB stats: {rag.collection_stats()}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="NexusIQ SharePoint ingestion")
    parser.add_argument(
        "--full",
        action="store_true",
        help="Force full re-sync by clearing delta tokens",
    )
    args = parser.parse_args()

    if args.full:
        logger.info("Full sync requested — clearing delta tokens")
        from pathlib import Path
        cfg = get_config()
        Path(cfg.sharepoint_delta_token_store).unlink(missing_ok=True)

    asyncio.run(run_ingestion(force_full=args.full))