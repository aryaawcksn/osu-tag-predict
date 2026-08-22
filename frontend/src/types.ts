// Queue types (Requirements 1.1, 1.6)
export interface QueueJob {
  id: string;
  status: "waiting" | "processing" | "done" | "failed";
  position?: number;
  result?: unknown;
  error?: string;
}

export interface QueueState {
  total_capacity: number;
  occupied_slots: number;
  jobs: QueueJob[];
}

// Auth types (Requirements 2.4)
export interface CurrentUser {
  osu_id: number;
  username: string;
}

// Analysis types
export interface DominantPlaystyle {
  label: string;
  average_probability: number;
  beatmaps_analyzed: number;
}

export interface LabelResult {
  label: string;
  probability: number;
}

// Beatmap recommendation record (Requirements 4.2)
export interface BeatmapRecord {
  beatmap_id: string;
  bpm: number | null;
  ar: number | null;
  cs: number | null;
  od: number | null;
  object_count: number | null;
  labels: LabelResult[];
}

export interface PredictResult {
  bpm: number;
  ar: number;
  cs: number;
  od: number;
  object_count: number;
  predicted_labels: LabelResult[];
  all_labels: LabelResult[];
  beatmap_id?: string;
  filename?: string;
}
