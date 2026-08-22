"""
RecommendationService: query beatmap DB for recommendations and upsert beatmap records.
Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from database import AsyncSessionFactory
from models import Beatmap, BeatmapLabel


async def upsert_beatmap(result: dict) -> dict:
    """
    Insert or update a beatmap record and its labels from a prediction result.
    Uses ON CONFLICT DO UPDATE (upsert) to satisfy Requirements 5.3.

    Expected keys in result:
      - beatmap_id (str, required)
      - bpm, ar, cs, od, object_count (optional floats/ints)
      - predicted_labels: list of {"label": str, "probability": float}

    Requirements: 4.4, 4.5, 5.2, 5.3
    """
    beatmap_id = result.get("beatmap_id")
    if not beatmap_id:
        raise ValueError("result must contain 'beatmap_id'")

    beatmap_id = str(beatmap_id)
    bpm = result.get("bpm")
    ar = result.get("ar")
    cs = result.get("cs")
    od = result.get("od")
    object_count = result.get("object_count")
    labels: List[dict] = result.get("predicted_labels", [])

    now = datetime.utcnow()

    async with AsyncSessionFactory() as session:
        async with session.begin():
            # Upsert beatmap row
            stmt = pg_insert(Beatmap).values(
                beatmap_id=beatmap_id,
                bpm=bpm,
                ar=ar,
                cs=cs,
                od=od,
                object_count=object_count,
                predicted_at=now,
                updated_at=now,
            ).on_conflict_do_update(
                index_elements=["beatmap_id"],
                set_={
                    "bpm": bpm,
                    "ar": ar,
                    "cs": cs,
                    "od": od,
                    "object_count": object_count,
                    "updated_at": now,
                },
            )
            await session.execute(stmt)

            # Replace labels: delete existing then insert new ones
            await session.execute(
                delete(BeatmapLabel).where(BeatmapLabel.beatmap_id == beatmap_id)
            )
            for lbl in labels:
                session.add(BeatmapLabel(
                    beatmap_id=beatmap_id,
                    label=lbl["label"],
                    probability=lbl["probability"],
                ))

    return {
        "beatmap_id": beatmap_id,
        "bpm": bpm,
        "ar": ar,
        "cs": cs,
        "od": od,
        "object_count": object_count,
        "labels": labels,
    }


async def get_recommendations(playstyle: str, limit: int = 10) -> List[dict]:
    """
    Query beatmap database for maps tagged with the given playstyle label.
    Falls back to secondary label matches if primary results < 5.
    Requirements: 4.1, 4.2, 4.3
    """
    async with AsyncSessionFactory() as session:
        # Primary: beatmaps where the given playstyle is the highest-probability label
        primary_stmt = (
            select(Beatmap)
            .join(BeatmapLabel, Beatmap.beatmap_id == BeatmapLabel.beatmap_id)
            .where(BeatmapLabel.label == playstyle)
            .order_by(BeatmapLabel.probability.desc())
            .limit(limit)
        )
        result = await session.execute(primary_stmt)
        beatmaps = list(result.scalars().all())

        if len(beatmaps) < 5:
            # Secondary: any beatmap that has the label (already covered above, so
            # just increase limit to fill up to `limit` total)
            extra_needed = limit - len(beatmaps)
            existing_ids = {b.beatmap_id for b in beatmaps}
            secondary_stmt = (
                select(Beatmap)
                .join(BeatmapLabel, Beatmap.beatmap_id == BeatmapLabel.beatmap_id)
                .where(
                    BeatmapLabel.label == playstyle,
                    ~Beatmap.beatmap_id.in_(existing_ids),
                )
                .limit(extra_needed)
            )
            extra_result = await session.execute(secondary_stmt)
            beatmaps += list(extra_result.scalars().all())

        records = []
        for bm in beatmaps:
            # Eager-load labels
            labels_stmt = select(BeatmapLabel).where(BeatmapLabel.beatmap_id == bm.beatmap_id)
            labels_result = await session.execute(labels_stmt)
            lbl_rows = list(labels_result.scalars().all())
            records.append({
                "beatmap_id": bm.beatmap_id,
                "bpm": bm.bpm,
                "ar": bm.ar,
                "cs": bm.cs,
                "od": bm.od,
                "object_count": bm.object_count,
                "labels": [{"label": l.label, "probability": l.probability} for l in lbl_rows],
            })

    return records
