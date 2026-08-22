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
}
