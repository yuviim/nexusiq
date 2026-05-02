import asyncio #--because our server is async, token refresh must not block the event loop.
import logging 
import time #--to track when the token expires.
from typing import Optional

import msal #---Microsoft's own library that handles the OAuth2 handshake with Azure AD.

from config import get_config
from dataclasses import dataclass


logger = logging.getLogger(__name__) #---__name__ resolves to the module name at runtime. Every log line from this file will be prefixed with token_manager — easy to filter.

@dataclass
class _CachedToken:
    access_token:str
    expires_at: float #expires_at is a Unix timestamp — the moment the token stops being valid. We store it so we can check freshness later.

class TokenManager:
    def __init__(self) -> None:
        cfg = get_config()
        self._refresh_buffer = 300 #— refresh 5 minutes before expiry. Never let the token expire mid-request.
        self._cached: Optional[_CachedToken] = None
        self._lock = asyncio.Lock() #if two requests arrive at the same moment and both see an expired token, only one should call Azure AD. The lock ensures that. Without it you'd make two simultaneous token requests — wasteful and potentially rate-limited.

        authority = f"https://login.microsoftonline.com/{cfg.azure_tenant_id}"
        self._app = msal.ConfidentialClientApplication( # MSAL's class for server-to-server auth (no human login involved). Takes your app credentials and talks to Azure AD.
            client_id = cfg.azure_client_id,
            client_credential=cfg.azure_client_secret,
            authority=authority,
        )
        self._scope = ["https://graph.microsoft.com/.default"] #tells Azure AD you want access to Graph API with whatever permissions your App Registration has been granted.
        logger.info("TokenManager initialised")

    async def get_token(self) -> str: #This is the only method any other file ever calls. Always returns a fresh token. The async with self._lock means only one coroutine can be inside this block at a time.
        async with self._lock:
            if self._needs_refresh():
                await self._refresh()
            return self._cached.access_token
        
    def _needs_refresh(self) -> bool:
        if self._cached is None:
            return True
        return time.time() >= (self._cached.expires_at - self._refresh_buffer) #time.time() returns the current Unix timestamp. If the current time is within 300 seconds of expiry, we refresh early.

    async def _refresh(self) -> None:
        logger.info("Acquiring new token from Azure AD")
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._acquire_sync)

        if "access_token" not in result:
            error = result.get("error", "unknown")
            desc = result.get("error_description", "")
            raise RuntimeError(f"Token acquisition failed — {error}: {desc}")

        expires_in = result.get("expires_in", 3600)
        self._cached = _CachedToken(
            access_token=result["access_token"],
            expires_at=time.time() + expires_in,
        )
        logger.info(f"Token acquired, expires in {expires_in}s")

    def _acquire_sync(self) -> dict:
        result = self._app.acquire_token_for_client(scopes=self._scope)
        return result or {}