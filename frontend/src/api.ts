import { PredictResult, QueueState, QueueJob, CurrentUser, DominantPlaystyle, BeatmapRecord } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Queue submission response
export interface SubmitResponse {
  job_id: string;
  position: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

// Submit beatmap link for prediction — returns job_id and position (Requirements 1.2)
export async function predictFromLink(url: string): Promise<SubmitResponse> {
  const res = await fetch(`${BASE_URL}/predict/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  });
  return handleResponse<SubmitResponse>(res);
}

// Submit .osu file upload for prediction — returns job_id and position (Requirements 1.2)
export async function predictFromUpload(file: File): Promise<SubmitResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/predict/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return handleResponse<SubmitResponse>(res);
}

// Get current queue state (Requirements 1.1, 1.6)
export async function getQueueState(): Promise<QueueState> {
  const res = await fetch(`${BASE_URL}/queue/state`, { credentials: "include" });
  return handleResponse<QueueState>(res);
}

// Get single job result by id (Requirements 1.6)
export async function getJobResult(jobId: string): Promise<QueueJob> {
  const res = await fetch(`${BASE_URL}/queue/job/${jobId}`, { credentials: "include" });
  return handleResponse<QueueJob>(res);
}

// Poll job until done or failed, resolving with full PredictResult (Requirements 1.6)
export async function pollJobResult(jobId: string): Promise<PredictResult> {
  const INTERVAL_MS = 1000;
  const MAX_ATTEMPTS = 120; // 2 minutes max

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const job = await getJobResult(jobId);
    if (job.status === "done") {
      return job.result as PredictResult;
    }
    if (job.status === "failed") {
      throw new Error(job.error ?? "Prediction failed");
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
  throw new Error("Prediction timed out");
}

// Get current authenticated user info (Requirements 2.4)
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const res = await fetch(`${BASE_URL}/auth/me`, { credentials: "include" });
  if (res.status === 401) return null;
  return handleResponse<CurrentUser>(res);
}

// Log out current user (Requirements 2.5)
export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

// Fetch dominant playstyle from play history analysis (Requirements 3.1, 3.2)
export async function getPlaystyleAnalysis(
  source: "top" | "recent"
): Promise<DominantPlaystyle> {
  const res = await fetch(`${BASE_URL}/analysis/playstyle?source=${source}`, {
    credentials: "include",
  });
  return handleResponse<DominantPlaystyle>(res);
}

// Get beatmap recommendations for a given playstyle (Requirements 4.1, 4.6)
export async function getRecommendations(
  playstyle: string
): Promise<{ recommendations: BeatmapRecord[]; message?: string }> {
  const res = await fetch(
    `${BASE_URL}/recommend?playstyle=${encodeURIComponent(playstyle)}`,
    { credentials: "include" }
  );
  return handleResponse<{ recommendations: BeatmapRecord[]; message?: string }>(res);
}
