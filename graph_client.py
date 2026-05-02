import asyncio
import logging
from typing import Any, Optional

import httpx

from token_manager import TokenManager

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_RETRIES = 3
_BACKOFF_BASE = 2.0


class GraphError(Exception):
    def __init__(self, status_code: int, message: str, code: str = "") -> None:
        self.status_code = status_code
        self.code = code
        super().__init__(f"GraphError {status_code} [{code}]: {message}")


class GraphClient:

    def __init__(self, token_manager: TokenManager, base_url: str) -> None:
        self._token_manager = token_manager
        self._base_url = base_url.rstrip("/")
        self._http: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "GraphClient":
        self._http = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._http:
            await self._http.aclose()

    async def get(self, path: str, params: dict | None = None) -> dict:
        return await self._request("GET", path, params=params)

    async def post(self, path: str, json: dict) -> dict:
        return await self._request("POST", path, json=json)

    async def get_paged(self, path: str, params: dict | None = None) -> list[dict]:
        results: list[dict] = []
        next_url: Optional[str] = None
        first = True

        while True:
            if first:
                data = await self._request("GET", path, params=params)
                first = False
            else:
                data = await self._request_url("GET", next_url)

            results.extend(data.get("value", []))
            next_url = data.get("@odata.nextLink")
            if not next_url:
                break

        return results

    async def _request(
        self,
        method: str,
        path: str,
        params: dict | None = None,
        json: dict | None = None,
    ) -> dict:
        url = f"{self._base_url}{path}"
        return await self._request_url(method, url, params=params, json=json)

    async def _request_url(
        self,
        method: str,
        url: str,
        params: dict | None = None,
        json: dict | None = None,
    ) -> dict:
        assert self._http is not None, "GraphClient must be used as async context manager"

        for attempt in range(_MAX_RETRIES):
            token = await self._token_manager.get_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            }

            try:
                response = await self._http.request(
                    method, url, headers=headers, params=params, json=json
                )
            except httpx.RequestError as exc:
                logger.warning(f"Network error on attempt {attempt}: {exc}")
                if attempt == _MAX_RETRIES - 1:
                    raise GraphError(0, str(exc), "network_error")
                await asyncio.sleep(_BACKOFF_BASE ** attempt)
                continue

            if response.status_code in _RETRYABLE_STATUS:
                wait = float(response.headers.get("Retry-After", _BACKOFF_BASE ** attempt))
                logger.warning(f"Retryable {response.status_code}, waiting {wait}s")
                if attempt == _MAX_RETRIES - 1:
                    raise GraphError(response.status_code, "max retries exceeded", "throttled")
                await asyncio.sleep(wait)
                continue

            if not response.is_success:
                body = response.json() if response.content else {}
                err = body.get("error", {})
                raise GraphError(
                    response.status_code,
                    err.get("message", response.text),
                    err.get("code", ""),
                )

            return response.json() if response.content else {}

        raise GraphError(0, "all retries exhausted", "retries_exceeded")