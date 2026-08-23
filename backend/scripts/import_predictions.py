"""
Import predictions from output_predictions.json into the database.

Usage (from project root):
    docker compose cp output_predictions.json backend:/tmp/output_predictions.json
    docker compose exec backend python scripts/import_predictions.py /tmp/output_predictions.json
"""

import asyncio
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from database import AsyncSessionFactory
from models import Beatmap, BeatmapLabel

MODEL_VERSION = os.environ.get("MODEL_VERSION", "unknown")


async def import_file(path: str) -> None:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        data = [data]

    now = datetime.utcnow()
    ok = 0
    skipped = 0

    for item in data:
        beatmap_id = str(item.get("beatmap_id", "")).strip()
        if not beatmap_id:
            skipped += 1
            continue

        labels: list[dict] = item.get("tags_from_model", [])
        if not labels:
            skipped += 1
            continue

        core = dict(
            difficulty_rating=item.get("star_rating"),
            version=item.get("diff_name"),
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
                    tag = lbl.get("tag") or lbl.get("label")
                    prob = lbl.get("probability", 0.0)
                    if tag:
                        session.add(BeatmapLabel(
                            beatmap_id=beatmap_id,
                            label=tag,
                            probability=float(prob),
                        ))

        ok += 1

    print(f"Done: {ok} imported, {skipped} skipped (no id or labels)")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/output_predictions.json"
    asyncio.run(import_file(path))
