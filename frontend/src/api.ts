import { PredictResult, QueueState, QueueJob, CurrentUser, DominantPlaystyle, BeatmapRecord } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Session token storage (cross-domain cookie fallback)
const SESSION_KEY = "osu_session_token";

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { "X-Session-Token": token } : {};
}

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

// Submit beatmap link for prediction (Requirements 1.2)
export async function predictFromLink(url: string): Promise<SubmitResponse> {
  const res = await fetch(`${BASE_URL}/predict/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ url }),
  });
  return handleResponse<SubmitResponse>(res);
}

// Submit .osu file upload for prediction (Requirements 1.2)
export async function predictFromUpload(file: File): Promise<SubmitResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/predict/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    credentials: "include",
    body: form,
  });
  return handleResponse<SubmitResponse>(res);
}

// Get current queue state (Requirements 1.1, 1.6)
export async function getQueueState(): Promise<QueueState> {
  const res = await fetch(`${BASE_URL}/queue/state`, {
    headers: { ...authHeaders() },
    credentials: "include",
  });
  return handleResponse<QueueState>(res);
}

// Get single job result by id (Requirements 1.6)
export async function getJobResult(jobId: string): Promise<QueueJob> {
  const res = await fetch(`${BASE_URL}/queue/job/${jobId}`, {
    headers: { ...authHeaders() },
    credentials: "include",
  });
  return handleResponse<QueueJob>(res);
}

// Poll job until done or failed (Requirements 1.6)
export async function pollJobResult(jobId: string): Promise<PredictResult> {
  const INTERVAL_MS = 1000;
  const MAX_ATTEMPTS = 120;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const job = await getJobResult(jobId);
    if (job.status === "done") return job.result as PredictResult;
    if (job.status === "failed") throw new Error(job.error ?? "Prediction failed");
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
  throw new Error("Prediction timed out");
}

// Get current authenticated user info (Requirements 2.4)
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { ...authHeaders() },
    credentials: "include",
  });
  if (res.status === 401) return null;
  return handleResponse<CurrentUser>(res);
}

// Log out current user (Requirements 2.5)
export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    headers: { ...authHeaders() },
    credentials: "include",
  });
}

// Fetch dominant playstyle from play history analysis (Requirements 3.1, 3.2)
export async function getPlaystyleAnalysis(source: "top" | "recent"): Promise<DominantPlaystyle> {
  const res = await fetch(`${BASE_URL}/analysis/playstyle?source=${source}`, {
    headers: { ...authHeaders() },
    credentials: "include",
  });
  return handleResponse<DominantPlaystyle>(res);
}

// Get beatmap recommendations for a given playstyle (Requirements 4.1, 4.6)
export async function getRecommendations(
  playstyle: string,
  minStars?: number,
  maxStars?: number,
  status?: string,
  offset = 0,
): Promise<{ recommendations: BeatmapRecord[]; has_more: boolean; message?: string }> {
  const params = new URLSearchParams({ playstyle, offset: String(offset) });
  if (minStars != null) params.set("min_stars", String(minStars));
  if (maxStars != null) params.set("max_stars", String(maxStars));
  if (status) params.set("status", status);
  const res = await fetch(`${BASE_URL}/recommend?${params}`,
    { headers: { ...authHeaders() }, credentials: "include" }
  );
  return handleResponse<{ recommendations: BeatmapRecord[]; has_more: boolean; message?: string }>(res);
}

export async function hideBeatmap(beatmapId: string): Promise<void> {
  await fetch(`${BASE_URL}/hidden/${beatmapId}`, {
    method: "POST", headers: { ...authHeaders() }, credentials: "include",
  });
}

export async function unhideBeatmap(beatmapId: string): Promise<void> {
  await fetch(`${BASE_URL}/hidden/${beatmapId}`, {
    method: "DELETE", headers: { ...authHeaders() }, credentials: "include",
  });
}

export async function hideBeatmapset(beatmapsetId: string): Promise<void> {
  await fetch(`${BASE_URL}/hidden/set/${beatmapsetId}`, {
    method: "POST", headers: { ...authHeaders() }, credentials: "include",
  });
}

export async function unhideBeatmapset(beatmapsetId: string): Promise<void> {
  await fetch(`${BASE_URL}/hidden/set/${beatmapsetId}`, {
    method: "DELETE", headers: { ...authHeaders() }, credentials: "include",
  });
}

export async function multiUnhide(beatmapIds: string[], beatmapsetIds: string[]): Promise<void> {
  await fetch(`${BASE_URL}/hidden/multi-unhide`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ beatmap_ids: beatmapIds, beatmapset_ids: beatmapsetIds }),
  });
}

export async function getHiddenBeatmaps(): Promise<{ hidden: BeatmapRecord[]; hidden_sets: string[] }> {
  const res = await fetch(`${BASE_URL}/hidden`, {
    headers: { ...authHeaders() }, credentials: "include",
  });
  return handleResponse<{ hidden: BeatmapRecord[]; hidden_sets: string[] }>(res);
}

export async function getStats(): Promise<{ total_users: number; total_beatmaps: number }> {
  const res = await fetch(`${BASE_URL}/stats`);
  return handleResponse<{ total_users: number; total_beatmaps: number }>(res);
}

// Get beatmaps by multiple tags
export async function getBeatmapsByTags(
  tags: string[],
  minStars?: number,
  maxStars?: number,
  offset = 0,
  status?: string,
  yearFrom?: number,
  yearTo?: number,
): Promise<{ beatmaps: BeatmapRecord[]; tags: string[]; has_more: boolean }> {
  const params = new URLSearchParams({ tags: tags.join(","), offset: String(offset) });
  if (minStars != null) params.set("min_stars", String(minStars));
  if (maxStars != null) params.set("max_stars", String(maxStars));
  if (status) params.set("status", status);
  if (yearFrom != null) params.set("year_from", String(yearFrom));
  if (yearTo != null) params.set("year_to", String(yearTo));
  const res = await fetch(`${BASE_URL}/beatmaps/by-tags?${params}`,
    { headers: { ...authHeaders() }, credentials: "include" }
  );
  return handleResponse<{ beatmaps: BeatmapRecord[]; tags: string[]; has_more: boolean }>(res);
}
