"""
AI4Mobility — figures.

Every figure used in the notebook, the report and the presentations is produced
here, so all three tell the same story from the same numbers.

Palette
-------
The categorical palette is the validated default from the project's data-viz
reference: it passes the lightness band, chroma floor, colour-vision-deficiency
separation and normal-vision separation checks on the adjacent pairlist. Because
three of the slots fall below 3:1 contrast against the surface, every chart that
uses them also carries direct labels or a legend — colour is never the only
encoding.

Conventions applied throughout:
  * one y-axis, never two
  * hues assigned in fixed order, never cycled
  * grid and axes recessive; no chartjunk
  * legends below the axes, never overlapping the marks
  * counts and percentages labelled directly where the reader needs the value
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Patch

# ------------------------------------------------------------------- palette

SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"]
INK = "#1c2b3a"
INK_SOFT = "#4b6072"
GRID = "#e7edf1"
RULE = "#c7d4dd"
SURFACE = "#ffffff"

# Single-hue sequential ramp for magnitude (confusion matrices, heatmaps).
SEQ_HUE = "#2a78d6"

FIGDIR = Path(__file__).resolve().parent.parent / "docs" / "figures"

CLASS_LABELS = {
    "childs_pose": "Child's Pose",
    "cat_cow": "Cat–Cow",
    "thread_the_needle": "Thread the Needle",
    "lower_limb": "Lower limb",
    "core_hip_stability": "Core & hip",
    "calf_control": "Calf control",
}


def _style() -> None:
    plt.rcParams.update({
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
        "font.family": "DejaVu Sans",
        "font.size": 10.5,
        "axes.edgecolor": RULE,
        "axes.labelcolor": INK,
        "axes.titlecolor": INK,
        "axes.titlesize": 12.5,
        "axes.titleweight": "bold",
        "axes.labelsize": 10.5,
        "axes.grid": True,
        "axes.axisbelow": True,
        "grid.color": GRID,
        "grid.linewidth": 0.9,
        "xtick.color": INK_SOFT,
        "ytick.color": INK_SOFT,
        "xtick.labelsize": 9.5,
        "ytick.labelsize": 9.5,
        "legend.frameon": False,
        "legend.fontsize": 9.5,
        "figure.dpi": 160,
    })


def _clean(ax, *, hide_x_grid: bool = True, hide_y_grid: bool = False) -> None:
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(RULE)
    ax.spines["bottom"].set_color(RULE)
    ax.xaxis.grid(not hide_x_grid)
    ax.yaxis.grid(not hide_y_grid)


def _save(fig, name: str) -> Path:
    FIGDIR.mkdir(parents=True, exist_ok=True)
    path = FIGDIR / f"{name}.png"
    fig.savefig(path, bbox_inches="tight", pad_inches=0.16)
    plt.close(fig)
    return path


def label(cls: str) -> str:
    return CLASS_LABELS.get(cls, cls.replace("_", " ").title())


# ============================================================ skeleton drawing

# The connection list used by the web platform's stick-figure renderer, mapped
# onto this dataset's landmark names, so the notebook figures and the interface
# draw the same skeleton.
SKELETON = [
    ("head", "neck"),
    ("neck", "sho_l"), ("neck", "sho_r"),
    ("sho_l", "elb_l"), ("elb_l", "wri_l"),
    ("sho_r", "elb_r"), ("elb_r", "wri_r"),
    ("neck", "hip"),
    ("hip", "kne_l"), ("kne_l", "ank_l"),
    ("hip", "kne_r"), ("kne_r", "ank_r"),
]


def draw_skeleton(ax, row, *, colour: str = INK, alpha: float = 1.0,
                  linewidth: float = 2.4, show_joints: bool = True) -> None:
    """Draw one pose row as a stick figure on an existing axis."""
    def pt(joint):
        x, y = row[f"{joint}_x"], row[f"{joint}_y"]
        return (None if np.isnan(x) or np.isnan(y) else (x, y))

    for a, b in SKELETON:
        pa, pb = pt(a), pt(b)
        if pa is None or pb is None:
            continue
        ax.plot([pa[0], pb[0]], [pa[1], pb[1]],
                color=colour, linewidth=linewidth, alpha=alpha,
                solid_capstyle="round", zorder=2)

    if show_joints:
        for joint in ("sho_l", "sho_r", "elb_l", "elb_r", "wri_l", "wri_r",
                      "hip", "kne_l", "kne_r", "ank_l", "ank_r"):
            p = pt(joint)
            if p:
                ax.plot(p[0], p[1], "o", color=SERIES[1], markersize=3.4,
                        alpha=alpha, zorder=3)

    head = pt("head")
    if head:
        ax.plot(head[0], head[1], "o", color=colour, markersize=9,
                alpha=alpha, zorder=3)


def fig_pose_gallery(clean_df, name: str = "f01_pose_gallery"):
    """One representative pose per exercise class — the skeleton drawing output."""
    _style()
    classes = sorted(clean_df["exercise"].unique())
    fig, axes = plt.subplots(2, 3, figsize=(11.4, 7.0))

    for ax, cls in zip(axes.ravel(), classes):
        subset = clean_df[clean_df["exercise"] == cls]
        # The representative frame is the one closest to the class mean, not the
        # first frame — an unrepresentative frame produces a figure that is
        # visually convincing and factually wrong.
        coord_cols = [c for c in subset.columns if c.endswith(("_x", "_y"))]
        centre = subset[coord_cols].mean()
        dist = ((subset[coord_cols] - centre) ** 2).sum(axis=1)
        row = subset.loc[dist.idxmin()]

        draw_skeleton(ax, row)
        ax.set_title(label(cls), fontsize=11.5, pad=8)
        ax.set_xlim(-0.05, 1.05)
        ax.set_ylim(1.15, -0.15)          # y runs downward (image convention)
        ax.set_aspect("equal")
        ax.set_xticks([]); ax.set_yticks([])
        ax.grid(False)
        for s in ax.spines.values():
            s.set_color(GRID)

    for ax in axes.ravel()[len(classes):]:
        ax.axis("off")

    fig.suptitle("Representative pose for each exercise class",
                 fontsize=13.5, fontweight="bold", color=INK, y=0.98)
    fig.text(0.5, 0.015,
             "Frame closest to the class mean. Orange markers are tracked joints; "
             "y increases downward, matching the raw landmark frame.",
             ha="center", fontsize=9, color=INK_SOFT)
    fig.tight_layout(rect=(0, 0.035, 1, 0.955))
    return _save(fig, name)


# ================================================================= EDA figures

def fig_class_balance(clean_df, name: str = "f02_class_balance"):
    """How many usable frames survived cleaning, per class."""
    _style()
    counts = clean_df["exercise"].value_counts().sort_values(ascending=True)
    labels = [label(c) for c in counts.index]

    fig, ax = plt.subplots(figsize=(8.6, 4.4))
    bars = ax.barh(labels, counts.values, color=SERIES[0], height=0.62)
    for b, v in zip(bars, counts.values):
        ax.text(v + max(counts.values) * 0.012, b.get_y() + b.get_height() / 2,
                str(v), va="center", fontsize=10, color=INK, fontweight="bold")

    ax.set_xlabel("Usable frames after cleaning")
    ax.set_xlim(0, max(counts.values) * 1.12)
    ax.set_title("The dataset is not balanced across exercise classes")
    _clean(ax, hide_x_grid=False, hide_y_grid=True)
    fig.text(0.01, -0.04,
             "Class balance is deliberately uneven, matching the reality that some "
             "exercises are recorded more often than others.\nModels are trained with "
             "balanced class weights so the minority classes are not ignored.",
             fontsize=9, color=INK_SOFT)
    return _save(fig, name)


def fig_cleaning_waterfall(drop_reasons: dict, n_raw: int, n_clean: int,
                           name: str = "f03_cleaning"):
    """What was removed during cleaning and why."""
    _style()
    reasons = sorted([(k, v) for k, v in drop_reasons.items() if v > 0],
                     key=lambda kv: kv[1])
    labels = [r[0][0].upper() + r[0][1:] for r in reasons]
    values = [r[1] for r in reasons]
    removed = sum(values)

    fig, (ax1, ax2) = plt.subplots(
        1, 2, figsize=(11.4, 4.4), gridspec_kw={"width_ratios": [1, 1.45]})

    # --- left: retained vs removed, as a share of the raw frames
    ax1.barh([0], [n_clean], color=SERIES[0], height=0.5, label="Retained")
    ax1.barh([0], [removed], left=[n_clean], color=SERIES[1], height=0.5,
             label="Removed")
    ax1.text(n_clean / 2, 0, f"{n_clean:,}\nretained", ha="center", va="center",
             fontsize=10.5, fontweight="bold", color="#ffffff")
    ax1.text(n_clean + removed / 2, -0.42, f"{removed:,} removed",
             ha="center", va="top", fontsize=9.5, fontweight="bold",
             color=INK)
    ax1.set_xlim(0, n_raw * 1.02)
    ax1.set_ylim(-0.8, 0.5)
    ax1.set_yticks([])
    ax1.set_xlabel("Frames")
    ax1.set_title(f"{removed / n_raw * 100:.1f}% of raw frames removed",
                  fontsize=11.5)
    ax1.grid(False)
    for sp in ax1.spines.values():
        sp.set_visible(False)
    ax1.spines["bottom"].set_visible(True)
    ax1.spines["bottom"].set_color(RULE)

    # --- right: why each frame went
    bars = ax2.barh(labels, values, color=SERIES[1], height=0.6)
    for b, v in zip(bars, values):
        ax2.text(v + max(values) * 0.02, b.get_y() + b.get_height() / 2,
                 f"{v:,}", va="center", fontsize=10, fontweight="bold", color=INK)
    ax2.set_xlim(0, max(values) * 1.18)
    ax2.set_xlabel("Frames removed")
    ax2.set_title("Reason for removal", fontsize=11.5)
    _clean(ax2, hide_x_grid=False, hide_y_grid=True)

    fig.suptitle("Cleaning removes frames rather than inventing values",
                 fontsize=13.5, fontweight="bold", color=INK, y=1.02)
    fig.text(0.01, -0.10,
             "No landmark is imputed. Occlusion is far more common in some poses than "
             "others, so filling a missing joint with a column\nmean would manufacture "
             "plausible-looking samples for exactly the classes that are hardest to capture.",
             fontsize=9, color=INK_SOFT)
    fig.tight_layout()
    return _save(fig, name)


def fig_angle_distributions(features_df, name: str = "f04_angle_distributions"):
    """Joint-angle spread by class — which features separate the exercises."""
    _style()
    angle_cols = [c for c in features_df.columns if c.startswith("ang_")][:4]
    classes = sorted(features_df["exercise"].unique())

    fig, axes = plt.subplots(2, 2, figsize=(11.2, 7.2))
    for ax, col in zip(axes.ravel(), angle_cols):
        data = [features_df.loc[features_df["exercise"] == c, col].to_numpy()
                for c in classes]
        bp = ax.boxplot(data, patch_artist=True, widths=0.58,
                        medianprops=dict(color=INK, linewidth=1.6),
                        whiskerprops=dict(color=RULE), capprops=dict(color=RULE),
                        flierprops=dict(marker="o", markersize=2.4,
                                        markerfacecolor=INK_SOFT,
                                        markeredgecolor="none", alpha=0.35))
        for patch, colour in zip(bp["boxes"], SERIES):
            patch.set_facecolor(colour)
            patch.set_alpha(0.80)
            patch.set_edgecolor("#ffffff")
            patch.set_linewidth(1.4)

        pretty = col.replace("ang_", "").replace("_", " → ")
        ax.set_title(f"Angle at {pretty}", fontsize=11)
        ax.set_ylabel("Degrees")
        ax.set_xticks(range(1, len(classes) + 1))
        ax.set_xticklabels([label(c) for c in classes], rotation=28,
                           ha="right", fontsize=8.5)
        _clean(ax)

    fig.suptitle("Joint angles separate some exercise classes far better than others",
                 fontsize=13.5, fontweight="bold", color=INK, y=0.995)
    fig.tight_layout(rect=(0, 0.02, 1, 0.96))
    return _save(fig, name)


def fig_pca(features_df, feature_names, name: str = "f05_pca"):
    """PCA projection — visual separability before any classifier is trained."""
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

    _style()
    X = StandardScaler().fit_transform(features_df[feature_names].to_numpy(float))
    pca = PCA(n_components=2, random_state=42)
    proj = pca.fit_transform(X)
    var = pca.explained_variance_ratio_

    fig, ax = plt.subplots(figsize=(8.8, 6.2))
    for i, cls in enumerate(sorted(features_df["exercise"].unique())):
        mask = (features_df["exercise"] == cls).to_numpy()
        ax.scatter(proj[mask, 0], proj[mask, 1], s=17, alpha=0.70,
                   color=SERIES[i % len(SERIES)], label=label(cls),
                   edgecolors="white", linewidths=0.45)

    ax.set_xlabel(f"Component 1 ({var[0] * 100:.1f}% of variance)")
    ax.set_ylabel(f"Component 2 ({var[1] * 100:.1f}% of variance)")
    ax.set_title("Classes separate only partially in the first two components")
    _clean(ax, hide_x_grid=False)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.13), ncol=3)
    fig.text(0.01, -0.16,
             f"The two components shown account for {var.sum() * 100:.1f}% of the total "
             "variance, so this is an indication of separability,\nnot proof of it. The "
             "overlap between the quadruped-derived classes is visible here and reappears "
             "in the confusion matrices.",
             fontsize=9, color=INK_SOFT)
    return _save(fig, name)


# ============================================================== model figures

def fig_model_comparison(results: dict, name: str = "f06_model_comparison"):
    """Accuracy, macro F1 and cross-validated F1 for each model."""
    _style()
    names = list(results.keys())
    metrics = [
        ("Test accuracy", [results[n].accuracy for n in names], SERIES[0]),
        ("Test macro F1", [results[n].macro_f1 for n in names], SERIES[1]),
        ("Cross-validated macro F1", [results[n].cv_mean for n in names], SERIES[2]),
    ]

    x = np.arange(len(names))
    width = 0.26
    fig, ax = plt.subplots(figsize=(9.4, 5.0))

    for i, (lab, vals, colour) in enumerate(metrics):
        offset = (i - 1) * (width + 0.015)
        bars = ax.bar(x + offset, vals, width, label=lab, color=colour,
                      edgecolor="white", linewidth=1.4)
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.012, f"{v:.3f}",
                    ha="center", fontsize=8.6, color=INK, fontweight="bold")

    # Cross-validation error bars, drawn on the CV series only.
    ax.errorbar(x + (width + 0.015), [results[n].cv_mean for n in names],
                yerr=[results[n].cv_std for n in names], fmt="none",
                ecolor=INK_SOFT, elinewidth=1.2, capsize=4)

    ax.set_xticks(x)
    ax.set_xticklabels(names)
    ax.set_ylabel("Score")
    ax.set_ylim(0, 1.10)
    ax.set_title("The three models perform within a few points of each other")
    _clean(ax)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.10), ncol=3)
    fig.text(0.01, -0.14,
             "Cross-validated scores are five-fold on the training partition only; the "
             "error bar is one standard deviation.\nThe test set was scored once, after "
             "all model selection was complete.",
             fontsize=9, color=INK_SOFT)
    return _save(fig, name)


def fig_overfit_gap(results: dict, name: str = "f07_overfit_gap"):
    """Training minus test accuracy — the honest overfitting signal."""
    _style()
    names = list(results.keys())
    train = [results[n].train_accuracy for n in names]
    test = [results[n].accuracy for n in names]

    x = np.arange(len(names))
    width = 0.34
    fig, ax = plt.subplots(figsize=(9.0, 4.8))

    b1 = ax.bar(x - width / 2 - 0.008, train, width, label="Training accuracy",
                color=SERIES[0], edgecolor="white", linewidth=1.4)
    b2 = ax.bar(x + width / 2 + 0.008, test, width, label="Test accuracy",
                color=SERIES[1], edgecolor="white", linewidth=1.4)

    for bars, vals in ((b1, train), (b2, test)):
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.012, f"{v:.3f}",
                    ha="center", fontsize=9, color=INK, fontweight="bold")

    for i, n in enumerate(names):
        gap = results[n].overfit_gap
        ax.annotate(f"gap {gap:+.3f}", xy=(i, max(train[i], test[i]) + 0.06),
                    ha="center", fontsize=9, color=INK_SOFT, fontweight="bold")

    ax.set_xticks(x); ax.set_xticklabels(names)
    ax.set_ylabel("Accuracy")
    ax.set_ylim(0, 1.16)
    ax.set_title("Training and test accuracy, with the generalisation gap")
    _clean(ax)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.10), ncol=2)
    fig.text(0.01, -0.13,
             "Random Forest depth was constrained deliberately. Left unrestricted it fits "
             "the training data almost perfectly\nand generalises worse, with nothing in "
             "the output to signal that anything went wrong.",
             fontsize=9, color=INK_SOFT)
    return _save(fig, name)


def fig_confusion(result, name: str = "f08_confusion"):
    """Confusion matrix for one model, on a single-hue sequential ramp."""
    _style()
    cm = result.confusion
    labels = [label(c) for c in result.class_names]
    norm = cm / np.maximum(cm.sum(axis=1, keepdims=True), 1)

    fig, ax = plt.subplots(figsize=(8.0, 6.6))
    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list("seq", ["#ffffff", SEQ_HUE])
    im = ax.imshow(norm, cmap=cmap, vmin=0, vmax=1)

    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            if cm[i, j] == 0:
                continue
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                    fontsize=10, fontweight="bold",
                    color="#ffffff" if norm[i, j] > 0.55 else INK)

    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=32, ha="right", fontsize=9)
    ax.set_yticklabels(labels, fontsize=9)
    ax.set_xlabel("Predicted class")
    ax.set_ylabel("True class")
    ax.set_title(f"{result.name}: where the errors actually fall")
    ax.grid(False)
    for s in ax.spines.values():
        s.set_visible(False)

    cbar = fig.colorbar(im, ax=ax, fraction=0.042, pad=0.03)
    cbar.set_label("Proportion of the true class", fontsize=9.5, color=INK_SOFT)
    cbar.outline.set_visible(False)

    fig.text(0.01, -0.02,
             "Cell values are frame counts; shading is the proportion of each true class. "
             "Confusions concentrate between exercises\nperformed in similar body "
             "positions, which a single accuracy figure conceals entirely.",
             fontsize=9, color=INK_SOFT)
    return _save(fig, name)


def fig_per_class_f1(results: dict, name: str = "f09_per_class_f1"):
    """Per-class F1 for every model — the classes a headline figure hides."""
    _style()
    names = list(results.keys())
    classes = results[names[0]].class_names
    labels = [label(c) for c in classes]

    x = np.arange(len(classes))
    width = 0.26
    fig, ax = plt.subplots(figsize=(10.4, 5.2))

    for i, n in enumerate(names):
        vals = [results[n].per_class[c]["f1"] for c in classes]
        ax.bar(x + (i - 1) * (width + 0.015), vals, width, label=n,
               color=SERIES[i], edgecolor="white", linewidth=1.3)

    ax.axhline(0.90, color=INK_SOFT, linestyle="--", linewidth=1.1, zorder=1)
    ax.text(len(classes) - 0.4, 0.905, "0.90", fontsize=8.6, color=INK_SOFT)

    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=24, ha="right", fontsize=9)
    ax.set_ylabel("F1 score")
    ax.set_ylim(0, 1.10)
    ax.set_title("Per-class F1: the weakest classes are the same for every model")
    _clean(ax)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.20), ncol=3)
    fig.text(0.01, -0.26,
             "For a system that gives feedback to a parent about a child's movement, a "
             "class the model quietly gets wrong\nmatters more than a slightly lower "
             "overall accuracy.",
             fontsize=9, color=INK_SOFT)
    return _save(fig, name)


def fig_feature_importance(model: Any, feature_names: list, top: int = 14,
                           name: str = "f10_feature_importance"):
    """Which engineered features the tree-based model actually relies on."""
    _style()
    if not hasattr(model, "feature_importances_"):
        return None

    order = np.argsort(model.feature_importances_)[::-1][:top][::-1]
    vals = model.feature_importances_[order]
    names_ = [feature_names[i] for i in order]

    def family_colour(n):
        if n.startswith("ang_"):
            return SERIES[1]
        if n.startswith("dist_"):
            return SERIES[2]
        if n.startswith("n_"):
            return SERIES[0]
        return SERIES[3]

    def pretty(n):
        if n.startswith("ang_"):
            return "angle at " + n[4:].replace("_", " → ")
        if n.startswith("dist_"):
            return "distance " + n[5:].replace("_", "–")
        if n.startswith("n_"):
            return "position " + n[2:].replace("_", " ")
        return n.replace("_", " ")

    fig, ax = plt.subplots(figsize=(9.6, 6.0))
    bars = ax.barh(range(len(vals)), vals,
                   color=[family_colour(n) for n in names_], height=0.66)
    for b, v in zip(bars, vals):
        ax.text(v + max(vals) * 0.015, b.get_y() + b.get_height() / 2,
                f"{v:.3f}", va="center", fontsize=8.8, color=INK)

    ax.set_yticks(range(len(vals)))
    ax.set_yticklabels([pretty(n) for n in names_], fontsize=9)
    ax.set_xlabel("Importance")
    ax.set_xlim(0, max(vals) * 1.16)
    # The title and legend are derived from the data, so they cannot contradict
    # the bars: only families actually present are listed, and the headline
    # names whichever family carries the most total importance.
    FAMILY = [("ang_", "Joint angles", SERIES[1]),
              ("dist_", "Inter-joint distances", SERIES[2]),
              ("n_", "Normalised positions", SERIES[0])]
    totals = {}
    for prefix, lab_, colour in FAMILY:
        totals[lab_] = float(sum(v for n, v in
                                 zip(feature_names, model.feature_importances_)
                                 if n.startswith(prefix)))
    totals["Detector quality"] = float(sum(
        v for n, v in zip(feature_names, model.feature_importances_)
        if not n.startswith(("ang_", "dist_", "n_"))))
    lead = max(totals, key=totals.get)
    share = totals[lead] / max(sum(totals.values()), 1e-9)

    ax.set_title(f"{lead} carry {share * 100:.0f}% of the total importance")
    _clean(ax, hide_x_grid=False, hide_y_grid=True)

    present = {family_colour(n) for n in names_}
    handles = [Patch(facecolor=c, label=f"{lab_} ({totals[lab_] * 100:.0f}% of total)")
               for _, lab_, c in FAMILY if c in present]
    if SERIES[3] in present:
        handles.append(Patch(facecolor=SERIES[3],
                             label=f"Detector quality ({totals['Detector quality'] * 100:.0f}% of total)"))
    ax.legend(handles=handles, loc="lower right", ncol=1)

    fig.text(0.01, -0.05,
             f"Only the top {top} features are shown, coloured by family. Totals in the "
             "legend are over all "
             f"{len(feature_names)} features, not just those plotted.",
             fontsize=9, color=INK_SOFT)
    return _save(fig, name)


# ========================================================== platform figures

def fig_splitter_performance(name: str = "f11_splitter"):
    """How the step splitter behaves on the project's own source descriptions."""
    import json
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from src.splitter import split_exercise_text

    _style()
    data = json.loads((Path(__file__).resolve().parent.parent /
                       "data" / "exercises.json").read_text(encoding="utf-8"))

    names, produced, expected, confidences = [], [], [], []
    for p in data["programmes"]:
        res = split_exercise_text(p["original_description"])
        names.append(p["title"])
        produced.append(len(res.steps))
        expected.append(len(p["steps"]))
        confidences.append(res.confidence)

    order = np.argsort(expected)
    names = [names[i] for i in order]
    produced = [produced[i] for i in order]
    expected = [expected[i] for i in order]
    confidences = [confidences[i] for i in order]

    y = np.arange(len(names))
    height = 0.36
    fig, ax = plt.subplots(figsize=(10.0, 6.0))

    b1 = ax.barh(y + height / 2 + 0.01, expected, height,
                 label="Steps in the reviewed programme", color=SERIES[0])
    b2 = ax.barh(y - height / 2 - 0.01, produced, height,
                 label="Steps the splitter produced", color=SERIES[1])

    for bars, vals in ((b1, expected), (b2, produced)):
        for b, v in zip(bars, vals):
            ax.text(v + 0.12, b.get_y() + b.get_height() / 2, str(v),
                    va="center", fontsize=9, color=INK, fontweight="bold")

    ax.set_yticks(y)
    ax.set_yticklabels(names, fontsize=9.5)
    ax.set_xlabel("Number of steps")
    ax.set_xlim(0, max(max(expected), max(produced)) * 1.16)
    ax.set_title("Splitter output against the hand-reviewed step list")
    _clean(ax, hide_x_grid=False, hide_y_grid=True)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.11), ncol=2)

    exact = sum(1 for p, e in zip(produced, expected) if p == e)
    fig.text(0.01, -0.15,
             f"Exact match on {exact} of {len(names)} programmes; mean confidence "
             f"{np.mean(confidences):.2f}.\nWhere the counts differ, the splitter has "
             "separated a sentence the reviewers chose to keep together, or vice versa — "
             "both are shown\nin the interface so the difference is visible rather than hidden.",
             fontsize=9, color=INK_SOFT)
    return _save(fig, name)


def fig_coach_targets(name: str = "f12_coach_targets"):
    """Target joint angles the pose coach compares against, by pose family."""
    _style()
    import json
    import subprocess

    root = Path(__file__).resolve().parent.parent
    script = (
        "global.window=global;"
        "require(process.argv[1]);"
        "const C=require(process.argv[2]);"
        "const keys=['stand','one_leg','table','cow','cat','bridge','clam',"
        "'prone','supine_glute','kneel','seated','heel_raise'];"
        "const out={};keys.forEach(k=>{out[k]=C.targetAngles(k)});"
        "console.log(JSON.stringify(out));"
    )
    try:
        proc = subprocess.run(
            ["node", "-e", script,
             str(root / "platform" / "js" / "poses.js"),
             str(root / "platform" / "js" / "posecoach.js")],
            capture_output=True, text=True, timeout=30, check=True)
        targets = json.loads(proc.stdout)
    except Exception:
        return None

    joints = ["elbow", "knee", "hip", "trunk"]
    poses = [k for k in targets if targets[k]]
    pretty = {
        "stand": "Standing", "one_leg": "One leg", "table": "Four point",
        "cow": "Cow", "cat": "Cat", "bridge": "Bridge", "clam": "Clam",
        "prone": "Prone", "supine_glute": "Supine", "kneel": "Kneeling",
        "seated": "Seated", "heel_raise": "Heel raise",
    }

    x = np.arange(len(poses))
    width = 0.2
    fig, ax = plt.subplots(figsize=(11.4, 5.4))

    for i, j in enumerate(joints):
        vals = [targets[p].get(j, np.nan) for p in poses]
        ax.bar(x + (i - 1.5) * (width + 0.01), vals, width, label=j.capitalize(),
               color=SERIES[i], edgecolor="white", linewidth=1.1)

    ax.set_xticks(x)
    ax.set_xticklabels([pretty.get(p, p) for p in poses], rotation=26,
                       ha="right", fontsize=9)
    ax.set_ylabel("Target angle (degrees)")
    ax.set_ylim(0, 200)
    ax.set_title("Target joint angles the live coach compares against")
    _clean(ax)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.22), ncol=4)
    fig.text(0.01, -0.28,
             "Derived from the same hand-authored pose bank the illustrations are drawn "
             "from, so the coach checks the child against\nexactly the position the picture "
             "shows. Tolerances are 20–24° per joint and have not been clinically validated.",
             fontsize=9, color=INK_SOFT)
    return _save(fig, name)


# =================================================================== pipeline

def build_all(dataset, results, features_df=None) -> dict:
    """Produce every figure and return a mapping of name to path."""
    from .features import build_feature_table

    out: dict[str, Optional[Path]] = {}
    feats = features_df if features_df is not None else build_feature_table(dataset.clean)

    out["pose_gallery"] = fig_pose_gallery(dataset.clean)
    out["class_balance"] = fig_class_balance(dataset.clean)
    out["cleaning"] = fig_cleaning_waterfall(
        dataset.drop_reasons, len(dataset.raw), len(dataset.clean))
    out["angles"] = fig_angle_distributions(feats)
    out["pca"] = fig_pca(feats, dataset.feature_names)
    out["comparison"] = fig_model_comparison(results)
    out["overfit"] = fig_overfit_gap(results)

    best = max(results.values(), key=lambda r: r.macro_f1)
    out["confusion"] = fig_confusion(best)
    out["per_class"] = fig_per_class_f1(results)

    from .models import build_models
    rf = build_models()["Random Forest"]
    rf.fit(dataset.X_train, dataset.y_train)
    out["importance"] = fig_feature_importance(rf, dataset.feature_names)

    out["splitter"] = fig_splitter_performance()
    out["coach"] = fig_coach_targets()

    return {k: v for k, v in out.items() if v is not None}


if __name__ == "__main__":  # pragma: no cover
    from .data_prep import prepare
    from .models import run_comparison

    ds = prepare()
    res = run_comparison(ds)
    paths = build_all(ds, res)
    for k, v in paths.items():
        print(f"  {k:16s} {v.name}")
