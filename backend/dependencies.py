"""
FastAPI dependencies for session-based authentication.
Supports both cookie (legacy) and Authorization: Bearer <session_id> header.

get_current_user  — returns User if session is valid, else None (guest)
require_user      — same but raises HTTP 401 if no valid session

Requirements: 2.4
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy import select

from database import AsyncSessionFactory
from models import Session, User

SESSION_COOKIE_NAME = "session_id"


async def get_current_user(
    session_id_cookie: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME),
    authorization: Optional[str] = Header(None),
) -> Optional[User]:
    """
    Validate session from either:
    - Cookie: session_id
    - Header: Authorization: Bearer <session_id>
    Returns None for guests.
    Requirements: 2.4
    """
    # Prefer Authorization header (for cross-origin requests)
    session_id: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        session_id = authorization[len("Bearer "):]
    elif session_id_cookie:
        session_id = session_id_cookie

    if not session_id:
        return None

    async with AsyncSessionFactory() as db:
        result = await db.execute(select(Session).where(Session.id == session_id))
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
    """Raises HTTP 401 if there is no authenticated user. Requirements: 2.4"""
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
