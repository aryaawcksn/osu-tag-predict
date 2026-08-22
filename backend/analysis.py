"""
AnalysisService: fetch play history from osu! API and calculate dominant playstyle.

Functions:
  fetch_top_plays(user_id, token, limit=20)    — fetch top scores from osu! API
  fetch_recent_plays(user_id, token, limit=20) — fetch recent scores from osu! API
  calculate_dominant_playstyle(predictions)    — return label with highest avg probability

Requirements: 3.1, 3.2, 3.4
"""

from typing import List, Optional

import httpx
from pydantic import BaseModel

OSU_API_BASE = "https://osu.ppy.sh/api/v2"


# --------------------------------------------------------------------------- #
# Pydantic models                                                               #
# --------------------------------------------------------------------------- #

class BeatmapScore(BaseModel):
    beatmap_id: str


class DominantPlaystyle(BaseModel):
    label: str
    average_probability: float
    beatmaps_analyzed: int


# --------------------------------------------------------------------------- #
# osu! API helpers                                                              #
# --------------------------------------------------------------------------- #

async def fetch_top_plays(user_id: int, token: str, limit: int = 20) -> List[BeatmapScore]:
    """
    Fetch the user's top plays from osu! API.
    Returns a list of BeatmapScore containing beatmap_id strings.
    Requirements: 3.1, 3.2
    """
    url = f"{OSU_API_BASE}/users/{user_id}/scores/best"
    params = {"limit": limit, "mode": "osu"}
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params, headers=headers)

    if resp.status_code != 200:
        raise ValueError(f"osu! API error {resp.status_code}: {resp.text}")

    scores = resp.json()
    result = []
    for score in scores:
        beatmap = score.get("beatmap") or {}
        beatmap_id = beatmap.get("id")
        if beatmap_id is not None:
            result.append(BeatmapScore(beatmap_id=str(beatmap_id)))
    return result


async def fetch_recent_plays(user_id: int, token: str, limit: int = 20) -> List[BeatmapScore]:
    """
    Fetch the user's recent plays from osu! API.
    Returns a list of BeatmapScore containing beatmap_id strings.
    Requirements: 3.1, 3.2
    """
    url = f"{OSU_API_BASE}/users/{user_id}/scores/recent"
    params = {"limit": limit, "mode": "osu", "include_fails": 1}
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params, headers=headers)

    if resp.status_code != 200:
        raise ValueError(f"osu! API error {resp.status_code}: {resp.text}")

    scores = resp.json()
    result = []
    for score in scores:
        beatmap = score.get("beatmap") or {}
        beatmap_id = beatmap.get("id")
        if beatmap_id is not None:
            result.append(BeatmapScore(beatmap_id=str(beatmap_id)))
    return result


# --------------------------------------------------------------------------- #
# Dominant playstyle calculation                                                #
# --------------------------------------------------------------------------- #

def calculate_dominant_playstyle(predictions: List[dict]) -> DominantPlaystyle:
    """
    Given a list of prediction result dicts (each with 'all_labels' or
    'predicted_labels' key containing [{'label': str, 'probability': float}]),
    compute the dominant playstyle as the label with the highest average
    probability across all predictions.

    Uses 'all_labels' if present (covers all labels including sub-threshold ones),
    falls back to 'predicted_labels'.

    Requirements: 3.4
    """
    if not predictions:
        raise ValueError("No predictions provided")

    # Accumulate sum of probabilities per label
    label_sums: dict[str, float] = {}
    label_counts: dict[str, int] = {}

    for pred in predictions:
        labels = pred.get("all_labels") or pred.get("predicted_labels") or []
        for entry in labels:
            lbl = entry["label"]
            prob = float(entry["probability"])
            label_sums[lbl] = label_sums.get(lbl, 0.0) + prob
            label_counts[lbl] = label_counts.get(lbl, 0) + 1

    if not label_sums:
        raise ValueError("No label data found in predictions")

    # Average over the number of predictions (not just occurrences) so that
    # labels absent from some predictions are penalised by the lower average.
    n = len(predictions)
    averages = {lbl: label_sums[lbl] / n for lbl in label_sums}

    dominant_label = max(averages, key=lambda l: averages[l])

    return DominantPlaystyle(
        label=dominant_label,
        average_probability=round(averages[dominant_label], 4),
        beatmaps_analyzed=n,
    )
