"""
AI4Mobility — feature engineering.

Turns raw landmark coordinates into a feature table the classifiers can use.

Three families of feature, and the reason for each:

1. **Normalised coordinates** — raw x/y after translating to a hip-centred
   origin and dividing by torso length. Without this, the model learns where the
   child stood in the frame and how tall they are, not what they were doing.

2. **Joint angles** — the angle at a joint formed by its two neighbouring
   segments. Angles are invariant to translation, scale *and* the child's body
   proportions, which is exactly what an exercise classifier should key on.

3. **Inter-joint distances** — normalised distances between joint pairs that
   distinguish the exercise classes (wrist-to-ankle separates Child's Pose from
   Thread the Needle; knee-to-hip separates lying from kneeling positions).

Frame-level features only. No temporal windowing, because the dataset is
constructed as independent frames rather than continuous sequences — a real
deployment would add velocity and phase features across a sliding window.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Joints whose angle is informative, as (a, vertex, b) triples.
ANGLE_TRIPLES: list[tuple[str, str, str]] = [
    ("neck", "sho_l", "elb_l"),
    ("neck", "sho_r", "elb_r"),
    ("sho_l", "elb_l", "wri_l"),
    ("sho_r", "elb_r", "wri_r"),
    ("neck", "hip", "kne_l"),
    ("neck", "hip", "kne_r"),
    ("hip", "kne_l", "ank_l"),
    ("hip", "kne_r", "ank_r"),
    ("head", "neck", "hip"),
]

# Joint pairs whose separation distinguishes the exercise classes.
DISTANCE_PAIRS: list[tuple[str, str]] = [
    ("wri_l", "ank_l"),
    ("wri_r", "ank_r"),
    ("head", "hip"),
    ("head", "kne_l"),
    ("hip", "ank_l"),
    ("sho_l", "kne_l"),
    ("wri_l", "wri_r"),
    ("kne_l", "kne_r"),
    ("neck", "ank_r"),
]

CORE_JOINTS = [
    "head", "neck", "sho_l", "sho_r", "elb_l", "elb_r",
    "wri_l", "wri_r", "hip", "kne_l", "kne_r", "ank_l", "ank_r",
]


def _xy(df: pd.DataFrame, joint: str) -> np.ndarray:
    return df[[f"{joint}_x", f"{joint}_y"]].to_numpy(dtype=float)


def torso_length(df: pd.DataFrame) -> np.ndarray:
    """Neck-to-hip distance, used as the per-sample scale normaliser."""
    d = np.linalg.norm(_xy(df, "neck") - _xy(df, "hip"), axis=1)
    # Guard against a degenerate torso producing a division blow-up.
    return np.where(d < 1e-3, np.nan, d)


def joint_angle(a: np.ndarray, vertex: np.ndarray, b: np.ndarray) -> np.ndarray:
    """
    Angle at ``vertex`` between segments vertex->a and vertex->b, in degrees.

    Returns NaN where either segment has near-zero length, rather than a
    meaningless 0 that the model would treat as a real measurement.
    """
    v1 = a - vertex
    v2 = b - vertex
    n1 = np.linalg.norm(v1, axis=1)
    n2 = np.linalg.norm(v2, axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        cos = np.einsum("ij,ij->i", v1, v2) / (n1 * n2)
    cos = np.clip(cos, -1.0, 1.0)
    ang = np.degrees(np.arccos(cos))
    return np.where((n1 < 1e-6) | (n2 < 1e-6), np.nan, ang)


def build_feature_table(df: pd.DataFrame) -> pd.DataFrame:
    """Build the full feature table from a cleaned landmark DataFrame."""
    out = pd.DataFrame(index=df.index)
    out["exercise"] = df["exercise"].to_numpy()
    out["subject_id"] = df["subject_id"].to_numpy()

    hip = _xy(df, "hip")
    scale = torso_length(df)

    # --- 1. hip-centred, torso-normalised coordinates -----------------------
    for joint in CORE_JOINTS:
        p = (_xy(df, joint) - hip) / scale[:, None]
        out[f"n_{joint}_x"] = p[:, 0]
        out[f"n_{joint}_y"] = p[:, 1]

    # --- 2. joint angles ----------------------------------------------------
    for a, vertex, b in ANGLE_TRIPLES:
        out[f"ang_{vertex}_{a}_{b}"] = joint_angle(_xy(df, a), _xy(df, vertex), _xy(df, b))

    # --- 3. normalised inter-joint distances --------------------------------
    for j1, j2 in DISTANCE_PAIRS:
        d = np.linalg.norm(_xy(df, j1) - _xy(df, j2), axis=1) / scale
        out[f"dist_{j1}_{j2}"] = d

    # --- detector confidence carries real signal about frame quality --------
    out["detector_confidence"] = df["detector_confidence"].to_numpy()

    # Features can still be NaN where an optional landmark was occluded. Those
    # columns are dropped only if they are mostly empty; otherwise the rows with
    # NaNs are removed, so no value is ever invented.
    mostly_empty = [c for c in out.columns
                    if c not in ("exercise", "subject_id")
                    and out[c].isna().mean() > 0.35]
    out = out.drop(columns=mostly_empty)
    out = out.dropna().reset_index(drop=True)

    return out


def feature_families(feature_names: list[str]) -> dict[str, list[str]]:
    """Group feature names by family, for reporting and plots."""
    fam: dict[str, list[str]] = {
        "Normalised coordinates": [],
        "Joint angles": [],
        "Inter-joint distances": [],
        "Detector quality": [],
    }
    for name in feature_names:
        if name.startswith("n_"):
            fam["Normalised coordinates"].append(name)
        elif name.startswith("ang_"):
            fam["Joint angles"].append(name)
        elif name.startswith("dist_"):
            fam["Inter-joint distances"].append(name)
        else:
            fam["Detector quality"].append(name)
    return {k: v for k, v in fam.items() if v}


if __name__ == "__main__":  # pragma: no cover
    from .data_prep import build_raw_frames, clean_frames

    raw = build_raw_frames()
    clean, dropped, _ = clean_frames(raw)
    table = build_feature_table(clean)
    print(f"{len(table)} samples, {table.shape[1] - 2} features")
    for family, cols in feature_families(
            [c for c in table.columns if c not in ("exercise", "subject_id")]).items():
        print(f"  {family:26s} {len(cols)}")
