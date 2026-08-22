"""
FastAPI dependencies for session-based authentication.

get_current_user  — returns User if session cookie is valid, else None (guest)
require_user      — same but raises HTTP 401 if no valid session

Requirements: 2.4
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy import select

from database import AsyncSessionFactory
from models import Session, User

SESSION_COOKIE_NAME = "session_id"


async def get_current_user(
    session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME),
) -> Optional[User]:
    """
    Read the session_id cookie, validate it against the DB, and return the
    associated User object.

    Returns None for guests (no cookie or invalid/expired session).
    Never raises an exception — callers that require auth should use
    `require_user` instead.

    Requirements: 2.4
    """
    if not session_id:
        return None

    async with AsyncSessionFactory() as db:
        result = await db.execute(select(Session).where(Session.id == session_id))
        session: Optional[Session] = result.scalar_one_or_none()

    if session is None:
        return None

    # Treat naive datetimes stored in DB as UTC
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
    Use this as a dependency on endpoints that require authentication.

    Requirements: 2.4
    """
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
