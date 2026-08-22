import { PredictResult, QueueState, QueueJob, CurrentUser, DominantPlaystyle, BeatmapRecord } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "session_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

export async function predictFromLink(url: string): Promise<SubmitResponse> {
  const res = await fetch(`${BASE_URL}/predict/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ url }),
  });
  return handleResponse<SubmitResponse>(res);
}

export async function predictFromUpload(file: File): Promise<SubmitResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/predict/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });
  return handleResponse<SubmitResponse>(res);
}

export async function getQueueState(): Promise<QueueState> {
  const res = await fetch(`${BASE_URL}/queue/state`, { headers: authHeaders() });
  return handleResponse<QueueState>(res);
}

export async function getJobResult(jobId: string): Promise<QueueJob> {
  const res = await fetch(`${BASE_URL}/queue/job/${jobId}`, { headers: authHeaders() });
  return handleResponse<QueueJob>(res);
}

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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = getStoredToken();
  if (!token) return null;
  const res = await fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() });
  if (res.status === 401) {
    clearStoredToken();
    return null;
  }
  return handleResponse<CurrentUser>(res);
}

export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
  });
  clearStoredToken();
}

export async function getPlaystyleAnalysis(source: "top" | "recent"): Promise<DominantPlaystyle> {
  const res = await fetch(`${BASE_URL}/analysis/playstyle?source=${source}`, {
    headers: authHeaders(),
  });
  return handleResponse<DominantPlaystyle>(res);
}

export async function getRecommendations(
  playstyle: string
): Promise<{ recommendations: BeatmapRecord[]; message?: string }> {
  const res = await fetch(
    `${BASE_URL}/recommend?playstyle=${encodeURIComponent(playstyle)}`,
    { headers: authHeaders() }
  );
  return handleResponse<{ recommendations: BeatmapRecord[]; message?: string }>(res);
}
