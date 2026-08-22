"""
QueueManager: manages prediction job queue with asyncio semaphore (max 5 slots).
Persists all state changes to the queue_items table in PostgreSQL.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Callable, Coroutine, Dict, List, Literal, Optional, Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionFactory
from models import QueueItem

# --------------------------------------------------------------------------- #
# Pydantic-like plain dataclasses (no heavy dependency needed at module level) #
# --------------------------------------------------------------------------- #

from dataclasses import dataclass, field

JobStatus = Literal["waiting", "processing", "done", "failed"]

MAX_CAPACITY = 5


@dataclass
class QueueJob:
    id: str
    status: JobStatus
    position: Optional[int]
    result: Optional[dict]
    error: Optional[str]
    user_id: Optional[int]
    input_type: str
    input_value: str


@dataclass
class QueueState:
    total_capacity: int
    occupied_slots: int
    jobs: List[QueueJob] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# QueueManager                                                                  #
# --------------------------------------------------------------------------- #

class QueueManager:
    """
    Manages prediction jobs with a max-5-slot asyncio semaphore.
    All state transitions are persisted to the DB via queue_items table.
    """

    def __init__(self, max_slots: int = MAX_CAPACITY):
        self._max_slots = max_slots
        self._semaphore = asyncio.Semaphore(max_slots)
        # In-memory index: job_id -> QueueJob
        self._jobs: Dict[str, QueueJob] = {}
        # Counter for next waiting position
        self._next_position: int = 1

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    async def enqueue(
        self,
        input_type: str,
        input_value: str,
        user_id: Optional[int],
        task_fn: Callable[[str], Coroutine[Any, Any, dict]],
    ) -> QueueJob:
        """
        Add a job to the queue.

        - If all slots are occupied (semaphore value == 0) the request is
          rejected with a ValueError (caller should translate to HTTP 429).
        - Otherwise a QueueItem row is inserted with status='waiting', the
          asyncio background task is spawned, and a QueueJob is returned.

        Requirements: 1.2, 1.3
        """
        # Reject immediately if at capacity (non-blocking peek)
        if self._semaphore._value == 0:  # type: ignore[attr-defined]
            raise ValueError("Queue is full. Try again later.")

        job_id = str(uuid.uuid4())
        position = self._next_position
        self._next_position += 1

        job = QueueJob(
            id=job_id,
            status="waiting",
            position=position,
            result=None,
            error=None,
            user_id=user_id,
            input_type=input_type,
            input_value=input_value,
        )
        self._jobs[job_id] = job

        await self._persist_job(job)

        # Spawn background task – acquires semaphore slot, runs task_fn
        asyncio.create_task(self._run_job(job, task_fn))

        return job

    async def mark_complete(self, job_id: str, result: dict) -> None:
        """Mark a job as done and persist. Requirements: 1.4"""
        if job_id not in self._jobs:
            return
        job = self._jobs[job_id]
        job.status = "done"
        job.result = result
        job.position = None
        await self._update_job_in_db(job)

    async def mark_failed(self, job_id: str, error: str) -> None:
        """Mark a job as failed and persist. Requirements: 1.4"""
        if job_id not in self._jobs:
            return
        job = self._jobs[job_id]
        job.status = "failed"
        job.error = error
        job.position = None
        await self._update_job_in_db(job)

    def get_queue_state(self) -> QueueState:
        """
        Return current queue state (in-memory snapshot).
        Requirements: 1.1, 1.6
        """
        occupied = self._max_slots - self._semaphore._value  # type: ignore[attr-defined]
        active_jobs = [
            j for j in self._jobs.values()
            if j.status in ("waiting", "processing")
        ]
        return QueueState(
            total_capacity=self._max_slots,
            occupied_slots=occupied,
            jobs=active_jobs,
        )

    def get_job(self, job_id: str) -> Optional[QueueJob]:
        return self._jobs.get(job_id)

    async def restore_from_db(self) -> None:
        """
        On startup, reload waiting/processing jobs from DB so that the
        in-memory state reflects any jobs that were in-flight before restart.
        Jobs previously 'processing' are reset to 'failed' since the coroutine
        that was running them is gone.
        Requirements: 5.5
        """
        async with AsyncSessionFactory() as session:
            stmt = select(QueueItem).where(
                QueueItem.status.in_(["waiting", "processing"])
            )
            result = await session.execute(stmt)
            rows: List[QueueItem] = list(result.scalars().all())

        if not rows:
            return

        # Jobs that were 'processing' at restart can never complete – mark failed
        jobs_to_fail: List[QueueItem] = [r for r in rows if r.status == "processing"]
        jobs_to_restore: List[QueueItem] = [r for r in rows if r.status == "waiting"]

        # Fail orphaned processing jobs in DB
        if jobs_to_fail:
            async with AsyncSessionFactory() as session:
                async with session.begin():
                    for row in jobs_to_fail:
                        await session.execute(
                            update(QueueItem)
                            .where(QueueItem.id == row.id)
                            .values(
                                status="failed",
                                error="Server restarted while job was processing",
                                updated_at=datetime.utcnow(),
                            )
                        )
                    # Also restore them in-memory as failed for query purposes
                    for row in jobs_to_fail:
                        self._jobs[row.id] = QueueJob(
                            id=row.id,
                            status="failed",
                            position=None,
                            result=None,
                            error="Server restarted while job was processing",
                            user_id=row.user_id,
                            input_type=row.input_type,
                            input_value=row.input_value,
                        )

        # Restore waiting jobs to in-memory state (they won't auto-run; callers
        # should decide whether to re-enqueue them)
        for row in jobs_to_restore:
            self._jobs[row.id] = QueueJob(
                id=row.id,
                status="waiting",
                position=row.position,
                result=None,
                error=None,
                user_id=row.user_id,
                input_type=row.input_type,
                input_value=row.input_value,
            )
            if row.position and row.position >= self._next_position:
                self._next_position = row.position + 1

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    async def _run_job(
        self,
        job: QueueJob,
        task_fn: Callable[[str], Coroutine[Any, Any, dict]],
    ) -> None:
        """Acquire semaphore, run the task, release on completion."""
        async with self._semaphore:
            job.status = "processing"
            await self._update_job_in_db(job)
            try:
                result = await task_fn(job.input_value)
                await self.mark_complete(job.id, result)
            except Exception as exc:
                await self.mark_failed(job.id, str(exc))

    async def _persist_job(self, job: QueueJob) -> None:
        """Insert a new QueueItem row for the given job."""
        async with AsyncSessionFactory() as session:
            async with session.begin():
                item = QueueItem(
                    id=job.id,
                    user_id=job.user_id,
                    status=job.status,
                    input_type=job.input_type,
                    input_value=job.input_value,
                    position=job.position,
                )
                session.add(item)

    async def _update_job_in_db(self, job: QueueJob) -> None:
        """Update status, result, error, position for an existing QueueItem row."""
        async with AsyncSessionFactory() as session:
            async with session.begin():
                await session.execute(
                    update(QueueItem)
                    .where(QueueItem.id == job.id)
                    .values(
                        status=job.status,
                        result=job.result,
                        error=job.error,
                        position=job.position,
                        updated_at=datetime.utcnow(),
                    )
                )


# Module-level singleton – imported by main.py and other modules
queue_manager = QueueManager()
