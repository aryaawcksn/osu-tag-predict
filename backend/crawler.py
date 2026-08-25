"""
Beatmap crawler — two modes running concurrently:

1. Backfill  — walks ALL ranked+loved pages oldest-first, persisting the
               cursor to DB after every page so it resumes from the exact
               same position after a restart.  Stops when the full
               catalogue has been walked once (done=True per status).

2. Daily     — runs every 24 h, fetches newest pages, stops when a full
               page is already entirely in DB.

Both modes share the same semaphore and never touch user queue slots.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("crawler")

# ── tunables ────────────────────────────────────────────────────────────────
_CRAWLER_CONCURRENCY    = int(os.environ.get("CRAWLER_CONCURRENCY",       "2"))
_DAILY_INTERVAL         = int(os.environ.get("CRAWLER_INTERVAL_SECONDS",  str(24 * 60 * 60)))
_BACKFILL_PREDICT_DELAY = float(os.environ.get("CRAWLER_BACKFILL_DELAY",  "1.5"))
_BACKFILL_PAGE_DELAY    = float(os.environ.get("CRAWLER_PAGE_DELAY",      "2.0"))
_DAILY_PAGES            = int(os.environ.get("CRAWLER_DAILY_PAGES",       "10"))

# ── shared state ────────────────────────────────────────────────────────────
_crawl_lock   = asyncio.Lock()
_semaphore: asyncio.Semaphore | None = None

_last_daily_at:    datetime | None = None
_last_daily_count: int = 0
_backfill_running: bool = False
_backfill_total:   int = 0


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(_CRAWLER_CONCURRENCY)
    return _semaphore


# ── DB cursor helpers ────────────────────────────────────────────────────────

async def _load_cursor(status: str) -> tuple[str | None, bool]:
    """Return (cursor_string, done) from DB for this status key."""
    from database import AsyncSessionFactory
    from models import CrawlerState
    from sqlalchemy import select
    async with AsyncSessionFactory() as session:
        row = (await session.execute(
            select(CrawlerState).where(CrawlerState.key == status)
        )).scalar_one_or_none()
    if row is None:
        return None, False
    return row.cursor_string, bool(row.done)


async def _save_cursor(status: str, cursor: str | None, done: bool = False) -> None:
    """Upsert cursor state for this status key."""
    from database import AsyncSessionFactory
    from models import CrawlerState
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    now = datetime.utcnow()
    async with AsyncSessionFactory() as session:
        async with session.begin():
            stmt = pg_insert(CrawlerState).values(
                key=status,
                cursor_string=cursor,
                done=int(done),
                updated_at=now,
            ).on_conflict_do_update(
                index_elements=["key"],
                set_={"cursor_string": cursor, "done": int(done), "updated_at": now},
            )
            await session.execute(stmt)


async def _reset_cursor(status: str) -> None:
    await _save_cursor(status, None, False)


# ── osu! API helpers ─────────────────────────────────────────────────────────

async def _fetch_page(
    token: str,
    status: str,
    cursor_string: str | None,
    sort: str,
) -> tuple[list[dict], str | None]:
    params: dict = {"mode": "osu", "s": status, "sort": sort}
    if cursor_string:
        params["cursor_string"] = cursor_string
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://osu.ppy.sh/api/v2/beatmapsets/search",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=20,
            )
        if resp.status_code == 429:
            logger.warning("Crawler: rate-limited, sleeping 60s")
            await asyncio.sleep(60)
            return [], cursor_string  # same cursor — caller retries
        if resp.status_code != 200:
            logger.warning("Crawler: search %s returned %s", status, resp.status_code)
            return [], None
        data = resp.json()
        next_cursor = data.get("cursor_string")
        beatmaps: list[dict] = []
        for bset in data.get("beatmapsets", []):
            for bm in bset.get("beatmaps", []):
                if bm.get("mode") != "osu":
                    continue
                beatmaps.append({
                    "beatmap_id":        str(bm["id"]),
                    "beatmapset_id":     str(bset["id"]),
                    "title":             bset.get("title"),
                    "artist":            bset.get("artist"),
                    "version":           bm.get("version"),
                    "difficulty_rating": bm.get("difficulty_rating"),
                    "status":            bm.get("status") or bset.get("status"),
                    "cover_url":         bset.get("covers", {}).get("cover"),
                    "card_url":          bset.get("covers", {}).get("card"),
                    "list_url":          bset.get("covers", {}).get("list"),
                    "bpm":               bm.get("bpm"),
                    "ar":                bm.get("ar"),
                    "cs":                bm.get("cs"),
                    "od":                bm.get("accuracy"),
                    "ranked_date":       bset.get("ranked_date"),
                })
        return beatmaps, next_cursor
    except Exception as exc:
        logger.warning("Crawler: fetch error — %s", exc)
        return [], None


async def _is_predicted(beatmap_id: str) -> bool:
    from database import AsyncSessionFactory
    from models import BeatmapLabel
    from sqlalchemy import select, func as sqlfunc
    async with AsyncSessionFactory() as session:
        n = (await session.execute(
            select(sqlfunc.count()).select_from(BeatmapLabel)
            .where(BeatmapLabel.beatmap_id == beatmap_id)
        )).scalar_one()
    return n > 0


async def _predict_and_store(bm: dict) -> bool:
    import predictor as pred_module
    from recommendation import upsert_beatmap
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            None, pred_module.predict_from_link,
            f"https://osu.ppy.sh/beatmaps/{bm['beatmap_id']}",
        )
        for k, v in bm.items():
            if k not in result or result.get(k) is None:
                result[k] = v
        await upsert_beatmap(result)
        logger.info("Crawler ✓ %s", bm["beatmap_id"])
        return True
    except Exception as exc:
        logger.debug("Crawler ✗ %s — %s", bm["beatmap_id"], exc)
        return False


async def _process_batch(beatmaps: list[dict], delay: float = 0.0) -> int:
    sem = _get_semaphore()
    ok = 0
    for bm in beatmaps:
        async with sem:
            if await _predict_and_store(bm):
                ok += 1
        if delay > 0:
            await asyncio.sleep(delay)
    return ok


# ── backfill ─────────────────────────────────────────────────────────────────

async def run_backfill() -> None:
    """
    Walk ALL ranked+loved pages oldest-first. Cursor is persisted to DB after
    every page — if the process restarts it resumes from exactly where it stopped.
    """
    global _backfill_running, _backfill_total
    _backfill_running = True

    try:
        from recommendation import _get_app_token
        token = await _get_app_token()
        if not token:
            logger.warning("Backfill: no API token")
            return

        for status in ("ranked", "loved"):
            cursor, done = await _load_cursor(status)
            if done:
                logger.info("Backfill %s: already complete, skipping", status)
                continue

            logger.info(
                "Backfill %s: resuming from cursor=%s",
                status, cursor or "START",
            )
            page_idx = 0
            consecutive_all_known = 0

            while True:
                # Refresh token every 50 pages (long runs)
                if page_idx > 0 and page_idx % 50 == 0:
                    token = await _get_app_token() or token

                beatmaps, next_cursor = await _fetch_page(
                    token, status, cursor, sort="ranked_asc"
                )

                if not beatmaps:
                    # No more pages — catalogue fully walked
                    await _save_cursor(status, None, done=True)
                    logger.info("Backfill %s: all pages done", status)
                    break

                new = [bm for bm in beatmaps
                       if not await _is_predicted(bm["beatmap_id"])]

                logger.info(
                    "Backfill %s page %d: %d new / %d on page (cursor=%s)",
                    status, page_idx, len(new), len(beatmaps), cursor or "START",
                )

                if not new:
                    consecutive_all_known += 1
                else:
                    consecutive_all_known = 0
                    count = await _process_batch(new, delay=_BACKFILL_PREDICT_DELAY)
                    _backfill_total += count

                # Persist cursor AFTER processing — safe to resume here on restart
                cursor = next_cursor
                await _save_cursor(status, cursor, done=False)

                if not cursor:
                    await _save_cursor(status, None, done=True)
                    logger.info("Backfill %s: reached last page", status)
                    break

                # Skip ahead quickly if many consecutive pages fully in DB
                if consecutive_all_known >= 5:
                    logger.info(
                        "Backfill %s: 5 full pages already in DB, "
                        "continuing to scan remainder", status
                    )
                    consecutive_all_known = 0

                page_idx += 1
                await asyncio.sleep(_BACKFILL_PAGE_DELAY)

        logger.info("Backfill: complete — %d total predicted", _backfill_total)

    except asyncio.CancelledError:
        logger.info("Backfill: cancelled at %d predicted", _backfill_total)
        raise
    except Exception as exc:
        logger.error("Backfill error: %s", exc)
    finally:
        _backfill_running = False


# ── daily incremental ────────────────────────────────────────────────────────

async def run_crawl() -> int:
    """
    Daily: fetch newest pages for ranked+loved, stop when a full page is
    already entirely in DB. Returns beatmaps predicted.
    """
    global _last_daily_at, _last_daily_count

    if _crawl_lock.locked():
        logger.info("Daily crawl: already running, skipping")
        return 0

    async with _crawl_lock:
        from recommendation import _get_app_token
        token = await _get_app_token()
        if not token:
            logger.warning("Daily crawl: no API token")
            return 0

        logger.info("Daily crawl: starting")
        ok = 0

        for status in ("ranked", "loved"):
            cursor: str | None = None
            for _ in range(_DAILY_PAGES):
                beatmaps, cursor = await _fetch_page(
                    token, status, cursor, sort="ranked_desc"
                )
                if not beatmaps:
                    break
                new = [bm for bm in beatmaps
                       if not await _is_predicted(bm["beatmap_id"])]
                logger.info("Daily %s: %d new / %d", status, len(new), len(beatmaps))
                if not new:
                    break  # up-to-date for this status
                ok += await _process_batch(new)
                if not cursor:
                    break
                await asyncio.sleep(_BACKFILL_PAGE_DELAY)

            # After a successful daily run, reset done flag so backfill
            # can pick up any new beatmaps added since last full walk
            _, done = await _load_cursor(status)
            if done:
                await _reset_cursor(status)

        _last_daily_at = datetime.now(timezone.utc)
        _last_daily_count = ok
        logger.info("Daily crawl: done — %d predicted", ok)
        return ok


# ── entry point ───────────────────────────────────────────────────────────────

async def start_daily_crawler() -> None:
    await asyncio.sleep(30)  # let app finish starting

    backfill_task = asyncio.create_task(run_backfill())

    while True:
        try:
            await run_crawl()
        except Exception as exc:
            logger.error("Daily crawl error: %s", exc)
        await asyncio.sleep(_DAILY_INTERVAL)

        # After daily run resets done flags, restart backfill to pick up new maps
        if backfill_task.done():
            backfill_task = asyncio.create_task(run_backfill())


# ── status ───────────────────────────────────────────────────────────────────

def get_crawler_status() -> dict:
    return {
        "last_daily_run_at":    _last_daily_at.isoformat() if _last_daily_at else None,
        "last_daily_run_count": _last_daily_count,
        "daily_running":        _crawl_lock.locked(),
        "backfill_running":     _backfill_running,
        "backfill_total":       _backfill_total,
        "daily_interval_hours": _DAILY_INTERVAL // 3600,
    }
