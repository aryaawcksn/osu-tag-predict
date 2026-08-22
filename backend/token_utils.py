"""
Token refresh logic for osu! OAuth access tokens.

Before making any osu! API call, callers should use `get_valid_token(session_id)`
to obtain a (possibly refreshed) access token.

Requirements: 2.6
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from sqlalchemy import select, update

from database import AsyncSessionFactory
from models import Session

OSU_TOKEN_URL = "https://osu.ppy.sh/oauth/token"
OSU_CLIENT_ID = os.environ.get("OSU_CLIENT_ID", "")
OSU_CLIENT_SECRET = os.environ.get("OSU_CLIENT_SECRET", "")

# Refresh the token this many seconds before it actually expires to avoid
# race conditions at the boundary.
REFRESH_BUFFER_SECONDS = 60


async def get_valid_token(session_id: str) -> Optional[str]:
    """
    Return a valid access token for the given session_id.

    - If the current token is still valid (with a 60-second buffer), return it.
    - If it is expired and a refresh_token is stored, attempt a token refresh,
      update the DB, and return the new access token.
    - If refresh fails or no refresh token is available, return None.

    Requirements: 2.6
    """
    async with AsyncSessionFactory() as db:
        result = await db.execute(select(Session).where(Session.id == session_id))
        session: Optional[Session] = result.scalar_one_or_none()

    if session is None:
        return None

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    buffer = timedelta(seconds=REFRESH_BUFFER_SECONDS)

    # Token still valid — return as-is
    if session.expires_at - buffer > now_naive:
        return session.access_token

    # Token expired (or within buffer) — try to refresh
    if not session.refresh_token:
        return None

    refreshed = await _refresh_token(session.refresh_token)
    if refreshed is None:
        return None

    new_access_token, new_refresh_token, expires_in = refreshed
    new_expires_at = now_naive + timedelta(seconds=expires_in)

    async with AsyncSessionFactory() as db:
        async with db.begin():
            await db.execute(
                update(Session)
                .where(Session.id == session_id)
                .values(
                    access_token=new_access_token,
                    refresh_token=new_refresh_token,
                    expires_at=new_expires_at,
                )
            )

    return new_access_token


async def _refresh_token(
    refresh_token: str,
) -> Optional[tuple[str, Optional[str], int]]:
    """
    Call the osu! token endpoint with grant_type=refresh_token.
    Returns (access_token, refresh_token, expires_in) on success, None on failure.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                OSU_TOKEN_URL,
                json={
                    "client_id": OSU_CLIENT_ID,
                    "client_secret": OSU_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "scope": "identify public",
                },
            )
        if resp.status_code != 200:
            return None
        data = resp.json()
        return (
            data["access_token"],
            data.get("refresh_token"),
            data.get("expires_in", 86400),
        )
    except Exception:
        return None
