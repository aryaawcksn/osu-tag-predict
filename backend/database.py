"""
Async SQLAlchemy engine and session factory for PostgreSQL.
DATABASE_URL env var must be set, e.g.:
  postgresql+asyncpg://user:password@localhost/osu_playstyle
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/osu_playstyle",
)

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncSession:
    """FastAPI dependency that yields an async DB session."""
    async with AsyncSessionFactory() as session:
        yield session


async def init_db() -> None:
    """Create all tables (used for testing / first-run when migration is not applied)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
