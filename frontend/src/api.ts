import { PredictResult } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function predictFromLink(url: string): Promise<PredictResult> {
  const res = await fetch(`${BASE_URL}/predict/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

export async function predictFromUpload(file: File): Promise<PredictResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/predict/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}
