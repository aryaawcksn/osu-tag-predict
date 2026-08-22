"""
SQLAlchemy ORM models matching the schema defined in migrations/init.sql.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Integer, String, Float, Text, ForeignKey,
    DateTime, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    osu_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )
    queue_items: Mapped[list["QueueItem"]] = relationship(
        "QueueItem", back_populates="user"
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class QueueItem(Base):
    __tablename__ = "queue_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    input_type: Mapped[str] = mapped_column(String(10), nullable=False)
    input_value: Mapped[str] = mapped_column(Text, nullable=False)
    result: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[Optional["User"]] = relationship("User", back_populates="queue_items")


class Beatmap(Base):
    __tablename__ = "beatmaps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    beatmap_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    bpm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ar: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cs: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    od: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    object_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    predicted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    labels: Mapped[list["BeatmapLabel"]] = relationship(
        "BeatmapLabel", back_populates="beatmap", cascade="all, delete-orphan"
    )


class BeatmapLabel(Base):
    __tablename__ = "beatmap_labels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    beatmap_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("beatmaps.beatmap_id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    probability: Mapped[float] = mapped_column(Float, nullable=False)

    __table_args__ = (UniqueConstraint("beatmap_id", "label", name="uq_beatmap_label"),)

    beatmap: Mapped["Beatmap"] = relationship("Beatmap", back_populates="labels")
