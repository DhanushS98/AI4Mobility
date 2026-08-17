"""
AI4Mobility — dataset construction, cleaning, scaling and splitting.

HONEST STATEMENT ABOUT THE DATA
-------------------------------
This module generates a **synthetic** pose dataset. It is not recorded video of
children and it is not a public dataset download. Every figure and every
accuracy number produced downstream is therefore a property of *this generator*,
not evidence about real children performing real exercises.

Why synthetic:
  * Recording children performing physiotherapy exercises requires ethical
    approval, parental consent and safeguarding arrangements that this project
    does not have.
  * No public paediatric physiotherapy pose dataset with the six exercise
    classes used here was available.

What is honest about it:
  * The generator is seeded, so every result in the notebook and report is
    exactly reproducible.
  * The class-conditional joint configurations are derived from the published
    NHS descriptions of each exercise (see data/exercises.json), so the classes
    differ in the ways the real exercises differ.
  * Realistic degradations are injected deliberately — landmark dropout from
    occlusion, per-subject body proportion variation, and measurement jitter —
    because a generator without them produces implausibly perfect accuracy.
  * Class balance is deliberately uneven, matching the reality that some
    exercises are recorded more often than others.

To swap in real data, replace :func:`build_raw_frames` with a loader and keep
the rest of the pipeline unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

RANDOM_STATE = 42

# The 13 landmarks the pipeline tracks, matching the connection list used by the
# stick-figure renderer in the web platform.
LANDMARKS = [
    "head", "neck", "sho_l", "sho_r", "elb_l", "elb_r", "wri_l", "wri_r",
    "hip", "kne_l", "kne_r", "ank_l", "ank_r",
]

# Six exercise classes, matching the six programmes in the platform.
CLASSES = [
    "childs_pose",
    "cat_cow",
    "thread_the_needle",
    "lower_limb",
    "core_hip_stability",
    "calf_control",
]

# Deliberately uneven — mirrors real recording practice.
CLASS_COUNTS = {
    "childs_pose": 210,
    "cat_cow": 240,
    "thread_the_needle": 165,
    "lower_limb": 300,
    "core_hip_stability": 275,
    "calf_control": 150,
}

# Canonical joint positions per class, in a normalised 0-1 frame with y running
# downward (image convention). Derived from the pose bank in platform/js/poses.js
# so the two halves of the project describe the same movements.
_CANONICAL: dict[str, dict[str, tuple[float, float]]] = {
    "childs_pose": {
        "head": (.42, .86), "neck": (.47, .84), "sho_l": (.52, .83), "sho_r": (.52, .85),
        "elb_l": (.37, .88), "elb_r": (.37, .90), "wri_l": (.23, .91), "wri_r": (.23, .93),
        "hip": (.69, .79), "kne_l": (.57, .91), "kne_r": (.55, .92),
        "ank_l": (.71, .92), "ank_r": (.69, .93),
    },
    "cat_cow": {
        "head": (.30, .52), "neck": (.35, .56), "sho_l": (.39, .59), "sho_r": (.39, .61),
        "elb_l": (.39, .72), "elb_r": (.42, .72), "wri_l": (.39, .87), "wri_r": (.42, .87),
        "hip": (.64, .60), "kne_l": (.64, .75), "kne_r": (.66, .75),
        "ank_l": (.64, .87), "ank_r": (.66, .87),
    },
    "thread_the_needle": {
        "head": (.33, .84), "neck": (.39, .81), "sho_l": (.45, .79), "sho_r": (.45, .81),
        "elb_l": (.36, .88), "elb_r": (.48, .80), "wri_l": (.22, .90), "wri_r": (.49, .89),
        "hip": (.68, .64), "kne_l": (.68, .77), "kne_r": (.71, .77),
        "ank_l": (.68, .89), "ank_r": (.71, .89),
    },
    "lower_limb": {
        "head": (.25, .75), "neck": (.30, .75), "sho_l": (.35, .74), "sho_r": (.35, .76),
        "elb_l": (.42, .67), "elb_r": (.42, .69), "wri_l": (.50, .69), "wri_r": (.50, .71),
        "hip": (.55, .75), "kne_l": (.67, .75), "kne_r": (.67, .79),
        "ank_l": (.80, .75), "ank_r": (.80, .79),
    },
    "core_hip_stability": {
        "head": (.25, .80), "neck": (.30, .80), "sho_l": (.35, .79), "sho_r": (.35, .81),
        "elb_l": (.39, .84), "elb_r": (.39, .86), "wri_l": (.47, .86), "wri_r": (.47, .88),
        "hip": (.55, .61), "kne_l": (.68, .67), "kne_r": (.71, .67),
        "ank_l": (.68, .85), "ank_r": (.71, .85),
    },
    "calf_control": {
        "head": (.50, .13), "neck": (.50, .21), "sho_l": (.48, .27), "sho_r": (.52, .27),
        "elb_l": (.46, .40), "elb_r": (.54, .40), "wri_l": (.45, .55), "wri_r": (.55, .55),
        "hip": (.50, .52), "kne_l": (.48, .68), "kne_r": (.52, .68),
        "ank_l": (.47, .81), "ank_r": (.53, .81),
    },
}

# Exercise families that genuinely resemble each other. A frame from one is
# occasionally labelled as another during annotation, because at some phases of
# the movement they look alike. Modelling this matters: without it the task is
# artificially easy and the reported accuracy is not believable.
CONFUSABLE_FAMILIES = [
    ["cat_cow", "thread_the_needle", "childs_pose"],   # all quadruped-derived
    ["lower_limb", "core_hip_stability"],              # both performed lying down
]
LABEL_NOISE_RATE = 0.06

# Joints most often lost to occlusion, and roughly how often.
_OCCLUSION_PRONE = {
    "wri_l": .10, "wri_r": .10, "elb_l": .06, "elb_r": .06,
    "ank_l": .05, "ank_r": .05, "kne_l": .03, "kne_r": .03,
}


@dataclass
class Dataset:
    """Everything downstream code needs, in one object."""
    X_train: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_test: np.ndarray
    feature_names: list[str]
    class_names: list[str]
    scaler: object
    raw: pd.DataFrame
    clean: pd.DataFrame
    n_dropped: int
    drop_reasons: dict[str, int]

    def summary(self) -> str:
        return (
            f"train {self.X_train.shape}  test {self.X_test.shape}  "
            f"{len(self.feature_names)} features  {len(self.class_names)} classes  "
            f"{self.n_dropped} rows dropped in cleaning"
        )


# ------------------------------------------------------------------ generation

def build_raw_frames(random_state: int = RANDOM_STATE) -> pd.DataFrame:
    """
    Produce the raw landmark table, one row per recorded frame.

    Replace this function with a real loader to swap in genuine data — the rest
    of the pipeline reads only the returned DataFrame.
    """
    rng = np.random.default_rng(random_state)
    rows: list[dict[str, float | str | int]] = []
    subject_id = 0

    for cls in CLASSES:
        n = CLASS_COUNTS[cls]
        canon = _CANONICAL[cls]

        # Frames are grouped into short takes by the same "subject", so body
        # proportion variation is correlated within a take rather than i.i.d.
        take_size = 15
        for start in range(0, n, take_size):
            subject_id += 1
            count = min(take_size, n - start)

            # Per-subject body proportions: limb length and overall scale.
            scale = rng.normal(1.0, 0.105)
            stretch_y = rng.normal(1.0, 0.090)
            offset_x = rng.normal(0.0, 0.030)
            offset_y = rng.normal(0.0, 0.026)

            for _ in range(count):
                row: dict[str, float | str | int] = {
                    "subject_id": subject_id,
                    "exercise": cls,
                }
                # Within-take movement phase — the exercise is being performed,
                # so joints oscillate around the canonical position.
                phase = rng.uniform(0, 1)
                for name, (cx, cy) in canon.items():
                    # Movement amplitude through the exercise. Large enough that
                    # poses within a family genuinely overlap at some phases,
                    # which is what makes the classification task non-trivial.
                    amp = 0.085 if name in ("wri_l", "wri_r", "kne_l", "kne_r",
                                            "ank_l", "ank_r") else 0.048
                    x = (cx - 0.5) * scale + 0.5 + offset_x
                    y = (cy - 0.5) * scale * stretch_y + 0.5 + offset_y
                    x += amp * np.sin(2 * np.pi * phase)
                    y += amp * 0.6 * np.cos(2 * np.pi * phase)
                    # Measurement jitter from the landmark detector.
                    x += rng.normal(0, 0.026)
                    y += rng.normal(0, 0.026)

                    # Occlusion dropout — missing, not zero.
                    if rng.random() < _OCCLUSION_PRONE.get(name, 0.008):
                        x = np.nan
                        y = np.nan

                    row[f"{name}_x"] = x
                    row[f"{name}_y"] = y

                # Detector confidence, lower where landmarks went missing.
                missing = sum(1 for k in row if k.endswith("_x") and pd.isna(row[k]))
                row["detector_confidence"] = float(
                    np.clip(rng.normal(0.88 - 0.075 * missing, 0.095), 0.20, 0.999)
                )
                rows.append(row)

    df = pd.DataFrame(rows)

    # --- annotation label noise within confusable families -----------------
    df["true_exercise"] = df["exercise"]
    for family in CONFUSABLE_FAMILIES:
        in_family = df.index[df["exercise"].isin(family)].to_numpy()
        n_flip = int(round(len(in_family) * LABEL_NOISE_RATE))
        if n_flip:
            flip_idx = rng.choice(in_family, size=n_flip, replace=False)
            for i in flip_idx:
                alternatives = [c for c in family if c != df.at[i, "exercise"]]
                df.at[i, "exercise"] = str(rng.choice(alternatives))

    # A small number of exact duplicate frames, as happens when a recording is
    # accidentally processed twice.
    dupes = df.sample(n=18, random_state=random_state)
    df = pd.concat([df, dupes], ignore_index=True)

    return df.sample(frac=1.0, random_state=random_state).reset_index(drop=True)


# -------------------------------------------------------------------- cleaning

CRITICAL_JOINTS = ["hip", "neck", "sho_l", "sho_r", "kne_l", "kne_r"]


def clean_frames(df: pd.DataFrame, min_confidence: float = 0.55
                 ) -> tuple[pd.DataFrame, int, dict[str, int]]:
    """
    Remove rows that cannot support a trustworthy feature vector.

    Deliberately does NOT impute missing landmarks. Landmarks go missing through
    occlusion, and occlusion is far more common in some poses than others, so
    filling with a column mean would manufacture plausible-looking samples for
    exactly the classes that are hardest to capture.
    """
    before = len(df)
    reasons: dict[str, int] = {}

    n = len(df)
    df = df.drop_duplicates()
    reasons["exact duplicate frames"] = n - len(df)

    n = len(df)
    critical_cols = [f"{j}_{ax}" for j in CRITICAL_JOINTS for ax in ("x", "y")]
    df = df.dropna(subset=critical_cols)
    reasons["missing a critical joint"] = n - len(df)

    n = len(df)
    df = df[df["detector_confidence"] >= min_confidence]
    reasons[f"detector confidence below {min_confidence}"] = n - len(df)

    n = len(df)
    coord_cols = [c for c in df.columns if c.endswith(("_x", "_y"))]
    in_frame = df[coord_cols].apply(
        lambda col: col.between(-0.35, 1.35) | col.isna()
    ).all(axis=1)
    df = df[in_frame]
    reasons["coordinates outside the frame"] = n - len(df)

    return df.reset_index(drop=True), before - len(df), reasons


# ------------------------------------------------------------- split and scale

def prepare(random_state: int = RANDOM_STATE, test_size: float = 0.25) -> Dataset:
    """Run the whole pipeline and return a ready-to-model :class:`Dataset`."""
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler

    from .features import build_feature_table

    raw = build_raw_frames(random_state)
    clean, n_dropped, reasons = clean_frames(raw)

    features = build_feature_table(clean)
    feature_names = [c for c in features.columns
                     if c not in ("exercise", "subject_id")]

    X = features[feature_names].to_numpy(dtype=float)
    y = features["exercise"].to_numpy()
    groups = features["subject_id"].to_numpy()

    # Split by SUBJECT, not by frame. Frames from the same take are highly
    # correlated, so a random frame-level split would put near-duplicate frames
    # on both sides and inflate the test score.
    unique_subjects = np.unique(groups)
    train_subj, test_subj = train_test_split(
        unique_subjects, test_size=test_size, random_state=random_state
    )
    train_mask = np.isin(groups, train_subj)

    X_train, X_test = X[train_mask], X[~train_mask]
    y_train, y_test = y[train_mask], y[~train_mask]

    # Fit the scaler on TRAINING data only, then apply to test. Fitting before
    # splitting leaks test statistics into training.
    scaler = StandardScaler().fit(X_train)
    X_train = scaler.transform(X_train)
    X_test = scaler.transform(X_test)

    return Dataset(
        X_train=X_train, X_test=X_test, y_train=y_train, y_test=y_test,
        feature_names=feature_names, class_names=sorted(set(y.tolist())),
        scaler=scaler, raw=raw, clean=clean,
        n_dropped=n_dropped, drop_reasons=reasons,
    )


if __name__ == "__main__":  # pragma: no cover
    ds = prepare()
    print(ds.summary())
    for reason, count in ds.drop_reasons.items():
        print(f"  dropped {count:4d}  {reason}")
