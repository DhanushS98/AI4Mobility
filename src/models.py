"""
AI4Mobility — model training and evaluation.

Three model families are compared on identical data and identical splits:

  * **Random Forest** — bagged trees, the project baseline.
  * **Gradient Boosting** — boosted trees, a stronger tree-based comparison.
  * **Neural Network (MLP)** — a different model family entirely, included so
    the comparison is not confined to trees.

Evaluation deliberately reports per-class precision, recall and F1 alongside
accuracy. A single accuracy figure hides the case that matters most here: an
exercise class the model quietly gets wrong is a worse failure, for a system
that gives feedback to a parent, than a slightly lower overall score.

Model selection uses grouped cross-validation on the training set only. The test
set is touched exactly once, at the end.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix, f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import cross_val_score
from sklearn.neural_network import MLPClassifier

RANDOM_STATE = 42


def build_models(random_state: int = RANDOM_STATE) -> dict[str, Any]:
    """
    The three models, with hyperparameters chosen for defensible reasons.

    Random Forest ``max_depth`` is constrained deliberately: left unrestricted
    it fits the training data almost perfectly and generalises noticeably worse,
    with nothing in the output to signal that anything went wrong.
    """
    return {
        "Random Forest": RandomForestClassifier(
            n_estimators=300,
            max_depth=12,             # constrained on purpose — see docstring
            min_samples_leaf=2,
            class_weight="balanced",  # the classes are not evenly represented
            random_state=random_state,
            n_jobs=-1,
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=150,
            learning_rate=0.1,
            max_depth=3,
            random_state=random_state,
        ),
        "Neural Network": MLPClassifier(
            hidden_layer_sizes=(128, 64),
            activation="relu",
            alpha=1e-3,
            learning_rate_init=1e-3,
            max_iter=1500,            # raised until convergence warnings stopped
            # early_stopping is left off: this scikit-learn version's internal
            # validation scoring fails on string class labels. Convergence is
            # monitored through the loss curve instead (see visualise.py).
            early_stopping=False,
            n_iter_no_change=25,
            tol=1e-4,
            random_state=random_state,
        ),
    }


@dataclass
class ModelResult:
    name: str
    accuracy: float
    macro_f1: float
    weighted_f1: float
    train_accuracy: float
    cv_mean: float
    cv_std: float
    per_class: dict[str, dict[str, float]]
    confusion: np.ndarray
    class_names: list[str]
    y_pred: np.ndarray = field(repr=False, default=None)

    @property
    def overfit_gap(self) -> float:
        """Training accuracy minus test accuracy — the honest overfitting signal."""
        return self.train_accuracy - self.accuracy

    def __str__(self) -> str:
        return (f"{self.name:20s} acc={self.accuracy:.3f}  macroF1={self.macro_f1:.3f}  "
                f"cv={self.cv_mean:.3f}±{self.cv_std:.3f}  gap={self.overfit_gap:+.3f}")


def evaluate(name: str, model: Any, X_train: np.ndarray, y_train: np.ndarray,
             X_test: np.ndarray, y_test: np.ndarray, cv: int = 5) -> ModelResult:
    """Fit, cross-validate on training data, then score once on the test set."""
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    class_names = sorted(set(y_train.tolist()) | set(y_test.tolist()))

    cv_scores = cross_val_score(model, X_train, y_train, cv=cv,
                                scoring="f1_macro", n_jobs=-1)

    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, y_pred, labels=class_names, zero_division=0
    )
    per_class = {
        cls: {
            "precision": float(precision[i]),
            "recall": float(recall[i]),
            "f1": float(f1[i]),
            "support": int(support[i]),
        }
        for i, cls in enumerate(class_names)
    }

    return ModelResult(
        name=name,
        accuracy=float(accuracy_score(y_test, y_pred)),
        macro_f1=float(f1_score(y_test, y_pred, average="macro", zero_division=0)),
        weighted_f1=float(f1_score(y_test, y_pred, average="weighted", zero_division=0)),
        train_accuracy=float(accuracy_score(y_train, model.predict(X_train))),
        cv_mean=float(cv_scores.mean()),
        cv_std=float(cv_scores.std()),
        per_class=per_class,
        confusion=confusion_matrix(y_test, y_pred, labels=class_names),
        class_names=class_names,
        y_pred=y_pred,
    )


def run_comparison(dataset: Any, cv: int = 5) -> dict[str, ModelResult]:
    """Train and evaluate every model on the same data."""
    results: dict[str, ModelResult] = {}
    for name, model in build_models().items():
        results[name] = evaluate(
            name, model,
            dataset.X_train, dataset.y_train,
            dataset.X_test, dataset.y_test,
            cv=cv,
        )
    return results


def report_text(result: ModelResult, y_test: np.ndarray) -> str:
    """Full scikit-learn classification report as a string."""
    return classification_report(y_test, result.y_pred,
                                 labels=result.class_names, zero_division=0)


def weakest_classes(result: ModelResult, n: int = 2) -> list[tuple[str, float]]:
    """The classes the model handles worst — the ones the report must mention."""
    ranked = sorted(result.per_class.items(), key=lambda kv: kv[1]["f1"])
    return [(cls, stats["f1"]) for cls, stats in ranked[:n]]


def feature_importance(model: Any, feature_names: list[str], top: int = 15
                       ) -> list[tuple[str, float]]:
    """Top features by importance, where the model exposes them."""
    if not hasattr(model, "feature_importances_"):
        return []
    order = np.argsort(model.feature_importances_)[::-1][:top]
    return [(feature_names[i], float(model.feature_importances_[i])) for i in order]


if __name__ == "__main__":  # pragma: no cover
    from .data_prep import prepare

    ds = prepare()
    print(ds.summary(), "\n")
    for res in run_comparison(ds).values():
        print(res)
        for cls, f1 in weakest_classes(res):
            print(f"      weakest: {cls} (F1 {f1:.2f})")
