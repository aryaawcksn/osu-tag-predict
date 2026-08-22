"""
FastAPI dependencies for session-based authentication.

get_current_user  — returns User if session is valid (cookie or header), else None
require_user      — same but raises HTTP 401 if no valid session

Requirements: 2.4
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy import select

from database import AsyncSessionFactory
from models import Session, User

SESSION_COOKIE_NAME = "session_id"


async def get_current_user(
    request: Request,
    session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME),
) -> Optional[User]:
    """
    Validate session from X-Session-Token header or session_id cookie.
    Header takes precedence for cross-domain setups.
    Returns None for guests.
    Requirements: 2.4
    """
    token_header = request.headers.get("X-Session-Token")
    effective_session_id = token_header or session_id

    if not effective_session_id:
        return None

    async with AsyncSessionFactory() as db:
        result = await db.execute(select(Session).where(Session.id == effective_session_id))
        session: Optional[Session] = result.scalar_one_or_none()

    if session is None:
        return None

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    if session.expires_at < now_naive:
        return None

    async with AsyncSessionFactory() as db:
        result = await db.execute(select(User).where(User.id == session.user_id))
        user: Optional[User] = result.scalar_one_or_none()

    return user


async def require_user(user: Optional[User] = Depends(get_current_user)) -> User:
    """
    Like get_current_user but raises HTTP 401 if there is no authenticated user.
    Requirements: 2.4
    """
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
