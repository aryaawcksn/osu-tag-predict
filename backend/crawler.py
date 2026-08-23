"""
Daily beatmap crawler: fetches recently ranked/loved osu! standard beatmaps
from the osu! API and predicts them in the background without blocking the queue.

Runs once per day via asyncio background task started in lifespan.
Uses a separate semaphore so it never occupies user-facing queue slots.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("crawler")

# How many beatmaps to predict concurrently in crawler (independent of user queue)
_CRAWLER_CONCURRENCY = int(os.environ.get("CRAWLER_CONCURRENCY", "2"))
# How many ranked pages to fetch per run (20 beatmaps per page)
_PAGES_PER_RUN = int(os.environ.get("CRAWLER_PAGES_PER_RUN", "5"))
# Interval between daily runs in seconds (default 24h)
_INTERVAL_SECONDS = int(os.environ.get("CRAWLER_INTERVAL_SECONDS", str(24 * 60 * 60)))

_crawl_lock = asyncio.Lock()
_last_run_at: datetime | None = None
_last_run_count: int = 0


async def _fetch_ranked_beatmaps(token: str, cursor_string: str | None = None) -> tuple[list[dict], str | None]:
    """
    Fetch one page of ranked/loved osu!std beatmaps from osu! API v2.
    Returns (beatmap_list, next_cursor_string).
    """
    params: dict = {
        "mode": "osu",
        "s": "ranked",  # ranked + approved
        "sort": "ranked_desc",
    }
    if cursor_string:
        params["cursor_string"] = cursor_string

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://osu.ppy.sh/api/v2/beatmapsets/search",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=15,
            )
        if resp.status_code != 200:
            logger.warning("Beatmap search returned %s", resp.status_code)
            return [], None
        data = resp.json()
        beatmapsets = data.get("beatmapsets", [])
        next_cursor = data.get("cursor_string")
        # Expand beatmapsets → individual osu!std beatmaps
        beatmaps: list[dict] = []
        for bset in beatmapsets:
            for bm in bset.get("beatmaps", []):
                if bm.get("mode") == "osu":
                    beatmaps.append({
                        "beatmap_id": str(bm["id"]),
                        "beatmapset_id": str(bset["id"]),
                        "title": bset.get("title"),
                        "artist": bset.get("artist"),
                        "version": bm.get("version"),
                        "difficulty_rating": bm.get("difficulty_rating"),
                        "status": bm.get("status") or bset.get("status"),
                        "cover_url": bset.get("covers", {}).get("cover"),
                        "card_url": bset.get("covers", {}).get("card"),
                        "list_url": bset.get("covers", {}).get("list"),
                        "bpm": bm.get("bpm"),
                        "ar": bm.get("ar"),
                        "cs": bm.get("cs"),
                        "od": bm.get("accuracy"),
                    })
        return beatmaps, next_cursor
    except Exception as exc:
        logger.warning("Error fetching beatmap page: %s", exc)
        return [], None


async def _predict_and_store(beatmap_id: str, metadata: dict) -> bool:
    """
    Download, predict, and upsert a single beatmap.
    Returns True on success, False on any failure.
    """
    import predictor as pred_module
    from recommendation import upsert_beatmap

    loop = asyncio.get_event_loop()

    beatmap_url = f"https://osu.ppy.sh/beatmaps/{beatmap_id}"
    try:
        result = await loop.run_in_executor(None, pred_module.predict_from_link, beatmap_url)
        # Merge API metadata (don't overwrite predicted stats)
        for k, v in metadata.items():
            if k not in result or result.get(k) is None:
                result[k] = v
        await upsert_beatmap(result)
        logger.info("Crawler: predicted beatmap %s", beatmap_id)
        return True
    except Exception as exc:
        logger.debug("Crawler: skipped beatmap %s — %s", beatmap_id, exc)
        return False


async def _is_already_predicted(beatmap_id: str) -> bool:
    """Check if beatmap already has labels in DB."""
    from database import AsyncSessionFactory
    from models import BeatmapLabel
    from sqlalchemy import select, func as sqlfunc
    async with AsyncSessionFactory() as session:
        count = (await session.execute(
            select(sqlfunc.count()).select_from(BeatmapLabel)
            .where(BeatmapLabel.beatmap_id == beatmap_id)
        )).scalar_one()
    return count > 0


async def run_crawl() -> int:
    """
    Fetch recent ranked osu!std beatmaps, predict the ones not yet in DB.
    Returns number of beatmaps successfully predicted.
    """
    global _last_run_at, _last_run_count

    if _crawl_lock.locked():
        logger.info("Crawler already running, skipping")
        return 0

    async with _crawl_lock:
        from recommendation import _get_app_token
        token = await _get_app_token()
        if not token:
            logger.warning("Crawler: no API token available, skipping")
            return 0

        logger.info("Crawler: starting daily run")
        semaphore = asyncio.Semaphore(_CRAWLER_CONCURRENCY)
        ok = 0
        cursor: str | None = None

        for page in range(_PAGES_PER_RUN):
            beatmaps, cursor = await _fetch_ranked_beatmaps(token, cursor)
            if not beatmaps:
                break

            # Filter out already-predicted beatmaps
            new_beatmaps = []
            for bm in beatmaps:
                if not await _is_already_predicted(bm["beatmap_id"]):
                    new_beatmaps.append(bm)

            logger.info("Crawler: page %d — %d new beatmaps to predict", page + 1, len(new_beatmaps))

            async def _bounded_predict(bm: dict) -> bool:
                async with semaphore:
                    return await _predict_and_store(bm["beatmap_id"], bm)

            results = await asyncio.gather(
                *[_bounded_predict(bm) for bm in new_beatmaps],
                return_exceptions=True,
            )
            ok += sum(1 for r in results if r is True)

            if not cursor:
                break
            # Small delay between pages to be polite to the API
            await asyncio.sleep(2)

        _last_run_at = datetime.now(timezone.utc)
        _last_run_count = ok
        logger.info("Crawler: done — %d beatmaps predicted", ok)
        return ok


async def start_daily_crawler() -> None:
    """Background task: runs crawl once immediately then every _INTERVAL_SECONDS."""
    # Initial short delay to let the app fully start
    await asyncio.sleep(30)
    while True:
        try:
            await run_crawl()
        except Exception as exc:
            logger.error("Crawler error: %s", exc)
        await asyncio.sleep(_INTERVAL_SECONDS)


def get_crawler_status() -> dict:
    return {
        "last_run_at": _last_run_at.isoformat() if _last_run_at else None,
        "last_run_count": _last_run_count,
        "running": _crawl_lock.locked(),
        "interval_hours": _INTERVAL_SECONDS // 3600,
    }
