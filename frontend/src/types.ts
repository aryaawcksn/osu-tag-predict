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
  avatar_url?: string;
}

// Analysis types
export interface PlaystyleDistribution {
  label: string;
  average_probability: number;
}

export interface DominantPlaystyle {
  label: string;
  average_probability: number;
  beatmaps_analyzed: number;
  distribution: PlaystyleDistribution[];
  avg_difficulty?: number;
}

export interface LabelResult {
  label: string;
  probability: number;
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
  // osu! metadata (present when predicted from link)
  title?: string;
  artist?: string;
  version?: string;
  difficulty_rating?: number;
  status?: string;
  cover_url?: string;
  card_url?: string;
  play_count?: number;
  favourite_count?: number;
  ranked_date?: string;
  submitted_date?: string;
  creator?: string;
}

// Beatmap recommendation record (Requirements 4.2)
export interface BeatmapRecord {
  beatmap_id: string;
  bpm: number | null;
  ar: number | null;
  cs: number | null;
  od: number | null;
  object_count: number | null;
  title: string | null;
  artist: string | null;
  version: string | null;
  difficulty_rating: number | null;
  status: string | null;
  cover_url: string | null;
  card_url: string | null;
  list_url: string | null;
  labels: LabelResult[];
}
