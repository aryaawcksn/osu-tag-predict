"""
RecommendationService: upsert beatmap records and serve recommendations with lazy metadata.

Metadata (title, artist, cover, etc.) is NOT fetched at predict time.
Instead, get_recommendations fetches it on first access and caches it in the DB.

Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3
"""

import asyncio
import os
from datetime import datetime
from typing import List, Optional

import httpx
from sqlalchemy import select, delete, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from database import AsyncSessionFactory
from models import Beatmap, BeatmapLabel

MODEL_VERSION = os.environ.get("MODEL_VERSION", "unknown")

# --------------------------------------------------------------------------- #
# osu! API client-credentials token (cached in memory)                         #
# --------------------------------------------------------------------------- #

_app_token: Optional[str] = None
_app_token_lock = asyncio.Lock()


async def _get_app_token() -> Optional[str]:
    global _app_token
    if _app_token:
        return _app_token
    async with _app_token_lock:
        if _app_token:
            return _app_token
        client_id = os.environ.get("OSU_CLIENT_ID", "")
        client_secret = os.environ.get("OSU_CLIENT_SECRET", "")
        if not client_id or not client_secret:
            return None
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://osu.ppy.sh/oauth/token",
                    json={
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "grant_type": "client_credentials",
                        "scope": "public",
                    },
                    timeout=10,
                )
            if resp.status_code == 200:
                _app_token = resp.json().get("access_token")
                return _app_token
        except Exception:
            pass
    return None


async def _fetch_osu_metadata(beatmap_id: str) -> Optional[dict]:
    """Fetch beatmap metadata from osu! API v2. Returns None on any failure."""
    global _app_token
    token = await _get_app_token()
    if not token:
        return None

    async def _call(tok: str) -> Optional[httpx.Response]:
        try:
            async with httpx.AsyncClient() as client:
                return await client.get(
                    f"https://osu.ppy.sh/api/v2/beatmaps/{beatmap_id}",
                    headers={"Authorization": f"Bearer {tok}"},
                    timeout=10,
                )
        except Exception:
            return None

    resp = await _call(token)
    if resp is None:
        return None

    # Token expired — reset and retry once
    if resp.status_code == 401:
        _app_token = None
        token = await _get_app_token()
        if not token:
            return None
        resp = await _call(token)

    if resp is None or resp.status_code != 200:
        return None

    data = resp.json()
    covers = data.get("beatmapset", {}).get("covers", {})
    return {
        "title": data.get("beatmapset", {}).get("title"),
        "artist": data.get("beatmapset", {}).get("artist"),
        "version": data.get("version"),
        "difficulty_rating": data.get("difficulty_rating"),
        "status": data.get("status"),
        "cover_url": covers.get("cover"),
        "card_url": covers.get("card"),
        "list_url": covers.get("list"),
    }


# --------------------------------------------------------------------------- #
# Upsert                                                                        #
# --------------------------------------------------------------------------- #

async def upsert_beatmap(result: dict) -> dict:
    """
    Insert or update a beatmap record and its labels from a prediction result.
    Metadata columns are left untouched if they already exist.
    Requirements: 4.4, 4.5, 5.2, 5.3
    """
    beatmap_id = result.get("beatmap_id")
    if not beatmap_id:
        raise ValueError("result must contain 'beatmap_id'")

    beatmap_id = str(beatmap_id)
    now = datetime.utcnow()
    labels: List[dict] = result.get("predicted_labels", [])

    core = dict(
        bpm=result.get("bpm"),
        ar=result.get("ar"),
        cs=result.get("cs"),
        od=result.get("od"),
        object_count=result.get("object_count"),
        model_version=MODEL_VERSION,
        updated_at=now,
    )

    async with AsyncSessionFactory() as session:
        async with session.begin():
            stmt = pg_insert(Beatmap).values(
                beatmap_id=beatmap_id,
                predicted_at=now,
                **core,
            ).on_conflict_do_update(
                index_elements=["beatmap_id"],
                set_=core,
            )
            await session.execute(stmt)

            await session.execute(
                delete(BeatmapLabel).where(BeatmapLabel.beatmap_id == beatmap_id)
            )
            for lbl in labels:
                session.add(BeatmapLabel(
                    beatmap_id=beatmap_id,
                    label=lbl["label"],
                    probability=lbl["probability"],
                ))

    return {"beatmap_id": beatmap_id, **core, "labels": labels}


# --------------------------------------------------------------------------- #
# Recommendations with lazy metadata fetch                                      #
# --------------------------------------------------------------------------- #

async def get_recommendations(
    playstyle: str,
    limit: int = 10,
    min_stars: float | None = None,
    max_stars: float | None = None,
    status: str | None = None,
) -> List[dict]:
    """
    Return beatmaps matching the given playstyle, optionally filtered by difficulty.
    If no exact match found within range, expands range by ±0.5 until results found.
    Requirements: 4.1, 4.2, 4.3
    """
    async def _query(mn: float | None, mx: float | None) -> list:
        async with AsyncSessionFactory() as session:
            stmt = (
                select(Beatmap)
                .join(BeatmapLabel, Beatmap.beatmap_id == BeatmapLabel.beatmap_id)
                .where(BeatmapLabel.label == playstyle)
            )
            if mn is not None:
                stmt = stmt.where(Beatmap.difficulty_rating >= mn)
            if mx is not None:
                stmt = stmt.where(Beatmap.difficulty_rating <= mx)
            if status:
                stmt = stmt.where(Beatmap.status == status)
            stmt = stmt.order_by(BeatmapLabel.probability.desc()).limit(limit)
            return list((await session.execute(stmt)).scalars().all())

    beatmaps = await _query(min_stars, max_stars)

    # Fallback: expand range by ±0.5 up to 3 times if no results
    if not beatmaps and (min_stars is not None or max_stars is not None):
        for expansion in [0.5, 1.0, 1.5]:
            mn = (min_stars - expansion) if min_stars is not None else None
            mx = (max_stars + expansion) if max_stars is not None else None
            beatmaps = await _query(mn, mx)
            if beatmaps:
                break

    # If still empty, return without star filter
    if not beatmaps and (min_stars is not None or max_stars is not None):
        beatmaps = await _query(None, None)

    return await _build_records(beatmaps)


async def get_beatmaps_by_tags(
    tags: List[str],
    limit: int = 20,
    offset: int = 0,
    min_stars: float | None = None,
    max_stars: float | None = None,
    status: str | None = None,
) -> List[dict]:
    """
    Return beatmaps that have ALL of the given tags, sorted by average probability
    of the selected tags (highest first). Supports pagination via offset.
    """
    if not tags:
        return []

    from sqlalchemy import func as sqlfunc

    async with AsyncSessionFactory() as session:
        # Subquery: beatmap_ids that have ALL requested tags
        subq = (
            select(BeatmapLabel.beatmap_id)
            .where(BeatmapLabel.label.in_(tags))
            .group_by(BeatmapLabel.beatmap_id)
            .having(sqlfunc.count(BeatmapLabel.label.distinct()) >= len(tags))
            .subquery()
        )

        # Subquery: average probability of selected tags per beatmap (for sorting)
        avg_subq = (
            select(
                BeatmapLabel.beatmap_id,
                sqlfunc.avg(BeatmapLabel.probability).label("avg_prob"),
            )
            .where(BeatmapLabel.label.in_(tags))
            .group_by(BeatmapLabel.beatmap_id)
            .subquery()
        )

        stmt = (
            select(Beatmap, avg_subq.c.avg_prob)
            .where(Beatmap.beatmap_id.in_(select(subq)))
            .join(avg_subq, Beatmap.beatmap_id == avg_subq.c.beatmap_id)
        )
        if min_stars is not None:
            stmt = stmt.where(Beatmap.difficulty_rating >= min_stars)
        if max_stars is not None:
            stmt = stmt.where(Beatmap.difficulty_rating <= max_stars)
        if status:
            stmt = stmt.where(Beatmap.status == status)
        stmt = stmt.order_by(avg_subq.c.avg_prob.desc()).limit(limit).offset(offset)

        rows = (await session.execute(stmt)).all()
        beatmaps = [row[0] for row in rows]

    return await _build_records(beatmaps)


async def _build_records(beatmaps: list) -> List[dict]:
    """Lazy-fetch metadata and build response dicts."""
    # Lazy-fetch metadata for beatmaps that don't have it yet
    missing = [bm for bm in beatmaps if bm.title is None]
    if missing:
        fetch_tasks = [_fetch_osu_metadata(bm.beatmap_id) for bm in missing]
        metadata_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)

        updates = []
        for bm, meta in zip(missing, metadata_results):
            if isinstance(meta, dict) and meta:
                updates.append({"beatmap_id": bm.beatmap_id, **meta})
                for k, v in meta.items():
                    setattr(bm, k, v)

        if updates:
            async with AsyncSessionFactory() as session:
                async with session.begin():
                    for u in updates:
                        bid = u.pop("beatmap_id")
                        await session.execute(
                            update(Beatmap).where(Beatmap.beatmap_id == bid).values(**u)
                        )

    records = []
    async with AsyncSessionFactory() as session:
        for bm in beatmaps:
            lbl_rows = list(
                (await session.execute(
                    select(BeatmapLabel).where(BeatmapLabel.beatmap_id == bm.beatmap_id)
                )).scalars().all()
            )
            records.append({
                "beatmap_id": bm.beatmap_id,
                "bpm": bm.bpm,
                "ar": bm.ar,
                "cs": bm.cs,
                "od": bm.od,
                "object_count": bm.object_count,
                "title": bm.title,
                "artist": bm.artist,
                "version": bm.version,
                "difficulty_rating": bm.difficulty_rating,
                "status": bm.status,
                "cover_url": bm.cover_url,
                "card_url": bm.card_url,
                "list_url": bm.list_url,
                "labels": [{"label": l.label, "probability": l.probability} for l in lbl_rows],
            })
    return records


async def get_cached_results(beatmap_ids: List[str]) -> dict[str, dict]:
    """
    Return cached prediction results for beatmap IDs that exist in DB
    AND were predicted with the current MODEL_VERSION.

    Returns a dict of {beatmap_id: result_dict} for cache hits only.
    Beatmap IDs not in the result need to be predicted fresh.
    """
    if not beatmap_ids:
        return {}

    async with AsyncSessionFactory() as session:
        stmt = (
            select(Beatmap)
            .where(
                Beatmap.beatmap_id.in_(beatmap_ids),
                Beatmap.model_version == MODEL_VERSION,
            )
        )
        beatmaps = list((await session.execute(stmt)).scalars().all())

        results = {}
        for bm in beatmaps:
            lbl_rows = list(
                (await session.execute(
                    select(BeatmapLabel).where(BeatmapLabel.beatmap_id == bm.beatmap_id)
                )).scalars().all()
            )
            if not lbl_rows:
                continue  # no labels = treat as cache miss
            results[bm.beatmap_id] = {
                "beatmap_id": bm.beatmap_id,
                "bpm": bm.bpm,
                "ar": bm.ar,
                "cs": bm.cs,
                "od": bm.od,
                "object_count": bm.object_count,
                "predicted_labels": [
                    {"label": l.label, "probability": l.probability} for l in lbl_rows
                ],
                "all_labels": [
                    {"label": l.label, "probability": l.probability} for l in lbl_rows
                ],
            }

    return results
