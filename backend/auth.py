"""
osu! OAuth 2.0 flow handler.

Endpoints:
  GET  /auth/login     — redirect to osu! OAuth authorization page
  GET  /auth/callback  — exchange code, fetch /me, store session, set cookie
  POST /auth/logout    — invalidate session, clear cookie
  GET  /auth/me        — return current user info from active session

Requirements: 2.1, 2.2, 2.3, 2.5
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select

from database import AsyncSessionFactory
from models import Session, User

# --------------------------------------------------------------------------- #
# Config from environment                                                       #
# --------------------------------------------------------------------------- #

OSU_CLIENT_ID = os.environ.get("OSU_CLIENT_ID", "")
OSU_CLIENT_SECRET = os.environ.get("OSU_CLIENT_SECRET", "")
OSU_REDIRECT_URI = os.environ.get("OSU_REDIRECT_URI", "http://localhost:8000/auth/callback")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

OSU_AUTHORIZE_URL = "https://osu.ppy.sh/oauth/authorize"
OSU_TOKEN_URL = "https://osu.ppy.sh/oauth/token"
OSU_API_BASE = "https://osu.ppy.sh/api/v2"

SESSION_COOKIE_NAME = "session_id"
SESSION_TTL_SECONDS = 86400  # 24 hours

router = APIRouter(prefix="/auth", tags=["auth"])


# --------------------------------------------------------------------------- #
# Helper: upsert user and create session                                        #
# --------------------------------------------------------------------------- #

async def _upsert_user(osu_id: int, username: str, db: AsyncSessionFactory) -> User:
    """Insert or update user record, return the User ORM object."""
    async with db() as session:
        async with session.begin():
            result = await session.execute(
                select(User).where(User.osu_id == osu_id)
            )
            user: Optional[User] = result.scalar_one_or_none()
            if user is None:
                user = User(osu_id=osu_id, username=username)
                session.add(user)
                await session.flush()
            else:
                user.username = username
            await session.refresh(user)
            return user


async def _create_session(
    user_id: int,
    access_token: str,
    refresh_token: Optional[str],
    expires_in: int,
) -> str:
    """Create a new session row and return the session_id."""
    session_id = secrets.token_hex(32)  # 64-char hex string
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    async with AsyncSessionFactory() as db:
        async with db.begin():
            db_session = Session(
                id=session_id,
                user_id=user_id,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at.replace(tzinfo=None),  # store as naive UTC
            )
            db.add(db_session)

    return session_id


# --------------------------------------------------------------------------- #
# Routes                                                                        #
# --------------------------------------------------------------------------- #

@router.get("/login")
async def login():
    """
    Redirect the browser to the osu! OAuth authorization page.
    Requirements: 2.1
    """
    params = {
        "client_id": OSU_CLIENT_ID,
        "redirect_uri": OSU_REDIRECT_URI,
        "response_type": "code",
        "scope": "identify public",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{OSU_AUTHORIZE_URL}?{query}")


@router.get("/callback")
async def callback(code: Optional[str] = None, error: Optional[str] = None):
    """
    Handle osu! OAuth callback.
    - Exchange authorization code for tokens.
    - Fetch /me to get user profile.
    - Upsert user and create session in DB.
    - Set httpOnly session cookie.
    Requirements: 2.2, 2.3
    """
    if error or not code:
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=oauth_failed")

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_resp = await client.post(
            OSU_TOKEN_URL,
            json={
                "client_id": OSU_CLIENT_ID,
                "client_secret": OSU_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": OSU_REDIRECT_URI,
            },
        )

    if token_resp.status_code != 200:
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=oauth_failed")

    token_data = token_resp.json()
    access_token: str = token_data.get("access_token", "")
    refresh_token: Optional[str] = token_data.get("refresh_token")
    expires_in: int = token_data.get("expires_in", SESSION_TTL_SECONDS)

    if not access_token:
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=oauth_failed")

    # Fetch user profile from osu! API
    async with httpx.AsyncClient() as client:
        me_resp = await client.get(
            f"{OSU_API_BASE}/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if me_resp.status_code != 200:
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=oauth_failed")

    me_data = me_resp.json()
    osu_id: int = me_data["id"]
    username: str = me_data["username"]

    # Upsert user
    async with AsyncSessionFactory() as db:
        async with db.begin():
            result = await db.execute(select(User).where(User.osu_id == osu_id))
            user: Optional[User] = result.scalar_one_or_none()
            if user is None:
                user = User(osu_id=osu_id, username=username)
                db.add(user)
                await db.flush()
            else:
                user.username = username
            await db.refresh(user)
            user_id = user.id

    # Create session
    session_id = await _create_session(user_id, access_token, refresh_token, expires_in)

    # Redirect to frontend with session token in URL hash
    # Hash is not sent to server so it survives Vercel's routing
    return RedirectResponse(url=f"{FRONTEND_URL}/#session_token={session_id}")


@router.post("/logout")
async def logout(response: Response, session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME)):
    """
    Invalidate the server-side session and clear the cookie.
    Requirements: 2.5
    """
    if session_id:
        async with AsyncSessionFactory() as db:
            async with db.begin():
                await db.execute(delete(Session).where(Session.id == session_id))

    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return {"ok": True}


@router.get("/me")
async def me(session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME)):
    """
    Return current user info from the active session.
    Requirements: 2.4
    """
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with AsyncSessionFactory() as db:
        result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session: Optional[Session] = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(status_code=401, detail="Session not found")

    # Check session expiry
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if session.expires_at < now:
        raise HTTPException(status_code=401, detail="Session expired")

    async with AsyncSessionFactory() as db:
        result = await db.execute(select(User).where(User.id == session.user_id))
        user: Optional[User] = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return {"osu_id": user.osu_id, "username": user.username}
