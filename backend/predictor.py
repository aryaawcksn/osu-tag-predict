import re
import math
import os
import joblib
import numpy as np
import requests
import slider
from tensorflow.keras.models import load_model

N_TIMESTEPS = 1500
N_FEATURES = 17
THRESHOLD = 0.1
MAX_OBJECTS = 5000  # hard cap before feature extraction

_model = None
_mlb = None
_app_token: str | None = None


def _get_app_token() -> str | None:
    global _app_token
    if _app_token:
        return _app_token
    client_id = os.environ.get("OSU_CLIENT_ID", "")
    client_secret = os.environ.get("OSU_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return None
    try:
        resp = requests.post(
            "https://osu.ppy.sh/oauth/token",
            json={"client_id": client_id, "client_secret": client_secret,
                  "grant_type": "client_credentials", "scope": "public"},
            timeout=10,
        )
        if resp.status_code == 200:
            _app_token = resp.json().get("access_token")
            return _app_token
    except Exception:
        pass
    return None


def fetch_beatmap_metadata(beatmap_id: str) -> dict:
    """Fetch beatmap metadata from osu! API. Returns empty dict on failure."""
    global _app_token
    token = _get_app_token()
    if not token:
        return {}

    def _call(tok: str):
        try:
            return requests.get(
                f"https://osu.ppy.sh/api/v2/beatmaps/{beatmap_id}",
                headers={"Authorization": f"Bearer {tok}"},
                timeout=10,
            )
        except Exception:
            return None

    resp = _call(token)
    if resp is None:
        return {}
    if resp.status_code == 401:
        _app_token = None
        token = _get_app_token()
        if not token:
            return {}
        resp = _call(token)
    if resp is None or resp.status_code != 200:
        return {}

    data = resp.json()
    bset = data.get("beatmapset") or {}
    covers = bset.get("covers", {})
    return {
        "title": bset.get("title"),
        "artist": bset.get("artist"),
        "version": data.get("version"),
        "difficulty_rating": data.get("difficulty_rating"),
        "status": data.get("status"),
        "cover_url": covers.get("cover"),
        "card_url": covers.get("card"),
        "list_url": covers.get("list"),
        "beatmapset_id": str(bset["id"]) if bset.get("id") is not None else None,
        "play_count": data.get("playcount"),
        "favourite_count": bset.get("favourite_count"),
        "ranked_date": bset.get("ranked_date"),
        "submitted_date": bset.get("submitted_date"),
        "creator": bset.get("creator"),
    }


def load_artifacts(model_path: str, mlb_path: str):
    global _model, _mlb
    _model = load_model(model_path)
    _mlb = joblib.load(mlb_path)


def parse_beatmap_id(link: str) -> str | None:
    link = link.strip()
    m = re.search(r'#(?:osu|taiko|fruits|mania)/(\d+)', link)
    if m:
        return m.group(1)
    m = re.search(r'/beatmaps/(\d+)', link)
    if m:
        return m.group(1)
    m = re.search(r'/osu/(\d+)', link)
    if m:
        return m.group(1)
    if link.isdigit():
        return link
    return None


def download_osu(beatmap_id: str, save_dir: str = "/tmp") -> str | None:
    url = f"https://osu.ppy.sh/osu/{beatmap_id}"
    try:
        resp = requests.get(url, timeout=15, stream=True)
        if resp.status_code != 200:
            return None
        # Cap download size at 250KB to avoid huge beatmaps
        MAX_BYTES = 250 * 1024
        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=65536):
            total += len(chunk)
            if total > MAX_BYTES:
                return None
            chunks.append(chunk)
        content = b"".join(chunks).decode("utf-8", errors="replace")
        if not content.strip():
            return None
        path = os.path.join(save_dir, f"{beatmap_id}.osu")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path
    except Exception:
        return None


def _patch_osu_file(file_path: str) -> None:
    """Inject missing optional fields that slider library requires but model doesn't use."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    modified = False
    if "PreviewTime" not in content:
        content = content.replace("[General]", "[General]\nPreviewTime:0", 1)
        modified = True
    if modified:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)


def parse_osu_file(file_path: str) -> dict | None:
    data = {
        "HP": 5.0, "CS": 4.0, "OD": 5.0, "AR": 5.0,
        "SliderMultiplier": 1.4, "SliderTickRate": 1.0,
        "BPM": 120.0, "hit_objects": [], "timing_points": [],
    }
    try:
        _patch_osu_file(file_path)
        bm = slider.Beatmap.from_path(file_path)
        hit_objects = list(bm.hit_objects())
        if not hit_objects or hit_objects[-1].time.total_seconds() * 1000 > 600000:
            return None
        # Hard cap: truncate at MAX_OBJECTS to avoid OOM/slow processing
        hit_objects = hit_objects[:MAX_OBJECTS]

        data["HP"] = float(bm.hp_drain_rate)
        data["CS"] = float(bm.circle_size)
        data["OD"] = float(bm.overall_difficulty)
        data["AR"] = float(bm.approach_rate)
        data["SliderMultiplier"] = float(bm.slider_multiplier)
        data["SliderTickRate"] = float(bm.slider_tick_rate)

        for tp in bm.timing_points:
            data["timing_points"].append({
                "time": float(tp.offset.total_seconds() * 1000),
                "beat_len": float(tp.ms_per_beat),
                "uninherited": 1 if tp.parent is None else 0,
            })

        for obj in hit_objects:
            t_ms = obj.time.total_seconds() * 1000
            t = int(round(t_ms))
            x, y = int(round(obj.position.x)), int(round(obj.position.y))
            obj_type = "C"
            slider_len = 0.0; slider_repeat = 1; slider_sv = 1.0
            slider_duration = 0.0; slider_complexity = 1.0; slider_ctrl_count = 0
            end_time = t; end_x, end_y = x, y; body_points = [(x, y)]

            # CEK NAMA CLASS SECARA DYNAMICAL (AMMAN DARI DEPRECATION)
            class_name = obj.__class__.__name__

            if class_name == "Slider":
                obj_type = "S"
                end_t_ms = obj.end_time.total_seconds() * 1000
                end_time = int(round(end_t_ms))
                slider_duration = float(end_t_ms - t_ms)
                slider_len = float(obj.length)
                slider_repeat = int(obj.repeat)
                base_sv = data["SliderMultiplier"]; sv_mult = 1.0
                for tp in reversed(data["timing_points"]):
                    if tp["time"] <= t_ms:
                        if tp["beat_len"] < 0:
                            sv_mult = -100.0 / tp["beat_len"]
                        break
                slider_sv = round(base_sv * sv_mult, 4)
                try:
                    if hasattr(obj, "curve") and obj.curve is not None:
                        n_samples = max(10, int(slider_len / 10))
                        curve_pts = [obj.curve(i / n_samples) for i in range(n_samples + 1)]
                        body_points = [(int(round(p.x)), int(round(p.y))) for p in curve_pts]
                        slider_ctrl_count = len(getattr(obj.curve, "points", []))
                    if body_points:
                        end_x, end_y = (x, y) if slider_repeat % 2 == 0 else body_points[-1]
                    straight_dist = max(math.hypot(end_x - x, end_y - y), 1.0)
                    slider_complexity = round(slider_len / straight_dist, 3)
                except Exception:
                    end_x, end_y = x, y
                    slider_complexity = 1.0; slider_ctrl_count = 0

            elif class_name == "Spinner":
                obj_type = "SP"
                end_t_ms = obj.end_time.total_seconds() * 1000
                end_time = int(round(end_t_ms))
                slider_duration = float(end_t_ms - t_ms)

            data["hit_objects"].append({
                "type": obj_type, "x": x, "y": y,
                "time": t, "end_x": end_x, "end_y": end_y, "end_time": end_time,
                "slider_length": slider_len, "slider_repeat": slider_repeat,
                "slider_velocity": slider_sv, "slider_duration": slider_duration,
                "slider_complexity": slider_complexity, "slider_control_count": slider_ctrl_count,
                "body_points": body_points,
            })

        for tp in data["timing_points"]:
            if tp["uninherited"] == 1 and tp["beat_len"] > 0:
                data["BPM"] = 60000 / tp["beat_len"]
                break
        return data
    except Exception:
        return None


def extract_features(data: dict) -> np.ndarray:
    objs = data["hit_objects"]
    if len(objs) < 3:
        raise ValueError("Hit objects terlalu sedikit (< 3).")

    AR = data["AR"]
    AR_ms = 1800 - 120 * AR if AR < 5 else 1200 - 150 * (AR - 5)
    bpm = data.get("BPM", 120)
    beat_length = 60000 / bpm if bpm > 0 else 500
    CS = data["CS"]; r = 54.4 - 4.48 * CS; diameter = 2 * r
    stack_window_ms = beat_length * 2
    pattern_map = {"C": 1, "S": 2, "SP": 3}
    f_pat,f_dist,f_time,f_rat,f_ang,f_turn,f_vel,f_d_rat,f_snap,f_rhythm,f_var,f_vis,f_vd,f_s_vel,f_s_comp,f_s_ctrl = ([] for _ in range(16))
    recent_distances = []; left_visible = 0
    snap_grid = [1, 1/2, 1/3, 1/4, 1/6, 1/8, 1/12, 1/16]

    for i, curr in enumerate(objs):
        f_pat.append(pattern_map.get(curr["type"], 0))
        if i == 0:
            for lst, v in zip([f_dist,f_time,f_rat,f_vel,f_ang,f_turn,f_d_rat,f_snap,f_rhythm,f_var,f_vis,f_vd], [0,0,0,0,0,0,1,0,1,0,1,0]):
                lst.append(float(v))
            f_s_vel.append(curr.get("slider_velocity", 1.0))
            f_s_comp.append(curr.get("slider_complexity", 1.0))
            f_s_ctrl.append(curr.get("slider_control_count", 0))
            continue

        prev = objs[i - 1]
        dt = curr["time"] - prev["time"]
        if curr["type"] == "SP" or prev["type"] == "SP":
            dist = 0.0; f_rat.append(0.0)
        else:
            tail_x = prev.get("end_x", prev["x"]); tail_y = prev.get("end_y", prev["y"])
            raw_dist = math.hypot(curr["x"] - tail_x, curr["y"] - tail_y)
            is_stacked = (raw_dist < r) and (dt <= stack_window_ms)
            if is_stacked:
                dist = 0.0; f_rat.append(0.0)
            else:
                dist = raw_dist; f_rat.append(dist / diameter)

        f_dist.append(dist); f_time.append(dt)
        f_vel.append(dist / dt if dt > 0 else 0.0)
        ang = math.degrees(math.atan2(curr["y"] - prev.get("end_y", prev["y"]), curr["x"] - prev.get("end_x", prev["x"])))
        f_ang.append(ang)

        if i >= 2:
            turn = abs(ang - f_ang[-2])
            if turn > 180: turn = 360 - turn
            f_turn.append(turn)
            prev_dt = max(objs[i-1]["time"] - objs[i-2]["time"], 1)
            f_rhythm.append(dt / prev_dt)
        else:
            f_turn.append(0.0); f_rhythm.append(1.0)

        if curr["type"] == "S":
            f_s_vel.append(curr.get("slider_velocity", 1.0))
            f_s_comp.append(curr.get("slider_complexity", 1.0))
            f_s_ctrl.append(curr.get("slider_control_count", 0))
        else:
            f_s_vel.append(1.0); f_s_comp.append(1.0); f_s_ctrl.append(0)

        while left_visible < i and curr["time"] - objs[left_visible]["time"] > AR_ms:
            left_visible += 1
        right_visible = i
        while right_visible + 1 < len(objs) and objs[right_visible + 1]["time"] - curr["time"] < AR_ms:
            right_visible += 1
        f_vis.append(right_visible - left_visible + 1)

        visible_indices = [j for j in range(left_visible, right_visible + 1) if objs[j]["type"] != "SP"]
        if len(visible_indices) > 1 and curr["type"] != "SP":
            overlap_thresh = 2.0 * diameter
            confuse_pairs = 0; total_pairs = 0
            n_vis = len(visible_indices)
            for va in range(n_vis):
                for vb in range(va + 1, n_vis):
                    ja, jb = visible_indices[va], visible_indices[vb]
                    if abs(ja - jb) <= 1:
                        continue
                    oa, ob = objs[ja], objs[jb]
                    d = math.hypot(oa["x"] - ob["x"], oa["y"] - ob["y"])
                    if d < overlap_thresh:
                        confuse_pairs += 1
                    total_pairs += 1
            vd = round(confuse_pairs / total_pairs, 3) if total_pairs > 0 else 0.0
        else:
            vd = 0.0
        f_vd.append(vd)

        recent_distances.append(dist)
        if len(recent_distances) > 4: recent_distances.pop(0)
        avg_recent = max(np.mean(recent_distances), 1.0)
        f_d_rat.append(dist / avg_recent)
        f_var.append(np.std(recent_distances) if len(recent_distances) >= 4 else 0.0)
        snap = dt / beat_length if beat_length > 0 else 0
        f_snap.append(min(snap_grid, key=lambda x: abs(x - snap)))

    def a(l): return np.array(l, dtype=np.float32)
    LOG_2000 = np.log1p(2000.0); LOG_10000 = np.log1p(10000.0)
    LOG_50 = np.log1p(50.0); LOG_10 = np.log1p(10.0); LOG2_9 = np.log2(9.0)
    seq_len = min(len(objs), N_TIMESTEPS)

    features = np.column_stack([
        a(f_pat)[:seq_len],
        np.minimum(a(f_dist)[:seq_len] / 512.0, 1.0),
        np.clip(a(f_rat)[:seq_len], 0.0, 5.0) / 5.0,
        np.log1p(np.clip(a(f_time)[:seq_len], 0, None)) / LOG_2000,
        np.minimum(a(f_vel)[:seq_len] / 3.0, 1.0),
        (a(f_ang)[:seq_len] + 180.0) / 360.0,
        np.clip(a(f_turn)[:seq_len] / 180.0, 0.0, 1.0),
        np.log1p(a(f_d_rat)[:seq_len]) / LOG_10,
        a(f_snap)[:seq_len],
        np.log2(np.clip(a(f_rhythm)[:seq_len], 0, None) + 1) / LOG2_9,
        np.log1p(a(f_var)[:seq_len]) / LOG_10000,
        np.log1p(a(f_vis)[:seq_len]) / LOG_50,
        np.clip(a(f_vd)[:seq_len], 0.0, 1.0),
        np.minimum(a(f_s_vel)[:seq_len] / 3.0, 1.0),
        np.minimum(a(f_s_comp)[:seq_len] / 5.0, 1.0),
        np.log1p(a(f_s_ctrl)[:seq_len]) / LOG_50,
        np.ones(seq_len, dtype=np.float32),
    ])

    X = np.zeros((N_TIMESTEPS, N_FEATURES), dtype=np.float32)
    X[:seq_len] = features[:seq_len]
    return X[np.newaxis, ...]


def predict_from_file(file_path: str) -> dict:
    data = parse_osu_file(file_path)
    if data is None:
        raise ValueError("Gagal parse file .osu (durasi > 10 menit atau file rusak).")

    X = extract_features(data)
    probs = _model.predict(X, verbose=0)[0]
    labels = [
        {"label": lbl, "probability": round(float(p), 4)}
        for lbl, p in sorted(zip(_mlb.classes_, probs), key=lambda x: x[1], reverse=True)
    ]
    predicted = [l for l in labels if l["probability"] >= THRESHOLD]

    return {
        "bpm": round(data["BPM"], 1),
        "ar": data["AR"],
        "cs": data["CS"],
        "od": data["OD"],
        "object_count": len(data["hit_objects"]),
        "predicted_labels": predicted,
        "all_labels": labels,
    }


def predict_from_link(link: str) -> dict:
    beatmap_id = parse_beatmap_id(link)
    if beatmap_id is None:
        raise ValueError(f"Tidak bisa ekstrak beatmap ID dari: {link}")

    file_path = download_osu(beatmap_id)
    if file_path is None:
        raise ValueError(f"Gagal download beatmap ID {beatmap_id}.")

    result = predict_from_file(file_path)
    result["beatmap_id"] = beatmap_id
    result.update(fetch_beatmap_metadata(beatmap_id))
    return result
