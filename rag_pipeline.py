import logging
from typing import Optional

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer, CrossEncoder

from config import get_config

logger = logging.getLogger(__name__)


class RAGPipeline:

    def __init__(self) -> None:
        cfg = get_config()

        logger.info(f"Loading embedding model: {cfg.embed_model}")
        self._embedder = SentenceTransformer(cfg.embed_model)

        logger.info(f"Loading rerank model: {cfg.rerank_model}")
        self._reranker = CrossEncoder(cfg.rerank_model)

        self._client = chromadb.HttpClient(
            host=cfg.chroma_host,
            port=cfg.chroma_port,
            settings=Settings(anonymized_telemetry=False),
        )

        self._collection = self._client.get_or_create_collection(
            name=cfg.chroma_collection,
            metadata={"hnsw:space": "cosine"},
        )

        self._top_k = cfg.rag_top_k
        self._rerank_top_k = cfg.rag_rerank_top_k

        logger.info("RAGPipeline initialised")

    def _chunk_text(
        self,
        text: str,
        chunk_size: int = 256,
        overlap: int = 48,
    ) -> list[str]:
        words = text.split()
        chunks = []
        start = 0
        while start < len(words):
            end = start + chunk_size
            chunk = " ".join(words[start:end])
            if chunk.strip():
                chunks.append(chunk)
            start += chunk_size - overlap
        return chunks

    def ingest_document(
        self,
        text: str,
        doc_id: str,
        metadata: dict,
    ) -> int:
        chunks = self._chunk_text(text)
        if not chunks:
            logger.warning(f"No chunks produced for doc_id={doc_id}")
            return 0

        chunk_ids = [f"{doc_id}__chunk_{i}" for i, _ in enumerate(chunks)]

        logger.info(f"Embedding {len(chunks)} chunks for doc_id={doc_id}")
        embeddings = self._embedder.encode(chunks, show_progress_bar=False).tolist()

        chunk_metadata = [
            {
                **metadata,
                "doc_id":      doc_id,
                "chunk_index": i,
                "page_number": max(1, round(
                    (i / max(len(chunks) - 1, 1)) * max(metadata.get("page_count", 1) - 1, 0) + 1
                )) if metadata.get("page_count", 0) > 1 else 1,
            }
            for i, _ in enumerate(chunks)
        ]

        self._collection.upsert(
            ids=chunk_ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=chunk_metadata,
        )

        logger.info(f"Ingested {len(chunks)} chunks for doc_id={doc_id}")
        return len(chunks)

    def delete_document(self, doc_id: str) -> None:
        self._collection.delete(where={"doc_id": doc_id})
        logger.info(f"Deleted all chunks for doc_id={doc_id}")

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        rerank_top_k: Optional[int] = None,
        where: Optional[dict] = None,
    ) -> list[dict]:
        k = top_k or self._top_k
        rk = rerank_top_k or self._rerank_top_k

        query_embedding = self._embedder.encode([query]).tolist()[0]

        search_kwargs: dict = {
            "query_embeddings": [query_embedding],
            "n_results": k,
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            search_kwargs["where"] = where

        results = self._collection.query(**search_kwargs)

        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        if not docs:
            return []

        candidates = [
            {
                "text": doc,
                "metadata": meta,
                "distance": dist,
            }
            for doc, meta, dist in zip(docs, metas, distances)
        ]

        return self._rerank(query, candidates, rk)

    def _rerank(
        self,
        query: str,
        candidates: list[dict],
        top_k: int,
    ) -> list[dict]:
        if not candidates:
            return []

        pairs = [[query, c["text"]] for c in candidates]
        scores = self._reranker.predict(pairs).tolist()

        for candidate, score in zip(candidates, scores):
            candidate["rerank_score"] = round(score, 4)

        reranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
        return reranked[:top_k]

    def collection_stats(self) -> dict:
        count = self._collection.count()
        return {
            "collection": self._collection.name,
            "total_chunks": count,
        }
    
    def list_documents(self) -> list[dict]:
        try:
            result = self._collection.get(
                include=["metadatas"],
                limit=10000,
            )
            metadatas = result.get("metadatas", []) or []

            seen = {}
            for meta in metadatas:
                doc_id = meta.get("doc_id", "")
                if not doc_id or meta.get("is_embedded"):
                    continue
                if doc_id not in seen:
                    seen[doc_id] = {
                        "doc_id":      doc_id,
                        "name":        meta.get("name", "Unknown"),
                        "web_url":     meta.get("web_url", ""),
                        "page_count":  meta.get("page_count", 0),
                        "method":      meta.get("extraction_method", "native"),
                        "ingested_at": meta.get("ingested_at", ""),
                        "chunks":      0,
                    }
                seen[doc_id]["chunks"] += 1

            return sorted(seen.values(), key=lambda x: x["ingested_at"], reverse=True)
        except Exception as exc:
            logger.error(f"list_documents failed: {exc}")
            return []