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
    difficulty_rating: float | None = None  # no-mod difficulty, None if mods applied


class PlaystyleDistribution(BaseModel):
    label: str
    average_probability: float


class DominantPlaystyle(BaseModel):
    label: str
    average_probability: float
    beatmaps_analyzed: int
    distribution: list[PlaystyleDistribution]
    avg_difficulty: float | None = None  # avg no-mod difficulty from play history


# --------------------------------------------------------------------------- #
# osu! API helpers                                                              #
# --------------------------------------------------------------------------- #

DIFF_CHANGING_MODS = {"DT", "NC", "HT", "HR", "EZ", "FL", "DA", "CL"}


def _parse_scores(scores: list) -> List[BeatmapScore]:
    result = []
    for score in scores:
        beatmap = score.get("beatmap") or {}
        beatmap_id = beatmap.get("id")
        if beatmap_id is None:
            continue
        mods = score.get("mods") or []
        has_diff_mod = any(
            (m if isinstance(m, str) else m.get("acronym", "")).upper() in DIFF_CHANGING_MODS
            for m in mods
        )
        diff = beatmap.get("difficulty_rating") if not has_diff_mod else None
        result.append(BeatmapScore(beatmap_id=str(beatmap_id), difficulty_rating=diff))
    return result


async def fetch_top_plays(user_id: int, token: str, limit: int = 50) -> List[BeatmapScore]:
    """
    Fetch the user's top plays from osu! API.
    Returns a list of BeatmapScore containing beatmap_id and no-mod difficulty.
    Requirements: 3.1, 3.2
    """
    url = f"{OSU_API_BASE}/users/{user_id}/scores/best"
    params = {"limit": limit, "mode": "osu"}
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params, headers=headers)

    if resp.status_code != 200:
        raise ValueError(f"osu! API error {resp.status_code}: {resp.text}")

    return _parse_scores(resp.json())


async def fetch_recent_plays(user_id: int, token: str, limit: int = 50) -> List[BeatmapScore]:
    """
    Fetch the user's recent plays from osu! API.
    Returns a list of BeatmapScore containing beatmap_id and no-mod difficulty.
    Requirements: 3.1, 3.2
    """
    url = f"{OSU_API_BASE}/users/{user_id}/scores/recent"
    params = {"limit": limit, "mode": "osu", "include_fails": 1}
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params, headers=headers)

    if resp.status_code != 200:
        raise ValueError(f"osu! API error {resp.status_code}: {resp.text}")

    return _parse_scores(resp.json())


# --------------------------------------------------------------------------- #
# Dominant playstyle calculation                                                #
# --------------------------------------------------------------------------- #

def calculate_dominant_playstyle(
    predictions: List[dict],
    plays: List[BeatmapScore] | None = None,
) -> DominantPlaystyle:
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
    distribution = [
        PlaystyleDistribution(label=lbl, average_probability=round(avg, 4))
        for lbl, avg in sorted(averages.items(), key=lambda x: x[1], reverse=True)
    ]

    # Avg no-mod difficulty from play history (exclude mods-affected plays)
    avg_difficulty: float | None = None
    if plays:
        diffs = [p.difficulty_rating for p in plays if p.difficulty_rating is not None]
        if diffs:
            avg_difficulty = round(sum(diffs) / len(diffs), 2)

    return DominantPlaystyle(
        label=dominant_label,
        average_probability=round(averages[dominant_label], 4),
        beatmaps_analyzed=n,
        distribution=distribution,
        avg_difficulty=avg_difficulty,
    )
