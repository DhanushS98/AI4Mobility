"""
Tests for the Python step splitter, mirroring tests/test_splitter.js.

The two implementations must agree, because the notebook analysis and the web
interface both report step counts and confidences to the reader.

Run with:  python3 -m pytest tests/ -q
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.splitter import (  # noqa: E402
    LLMSplitterAdapter, classify, extract_params, split_exercise,
    split_exercise_text, starts_with_action,
)

NHS = ("Lay on your back with your leg straight. Point your foot and toes down "
       "to the floor or bed, then slowly pull your foot and toes up towards "
       "your knee. Repeat 10 times.")


# ------------------------------------------------------------- basic splitting

def test_nhs_prose_produces_multiple_steps():
    r = split_exercise_text(NHS)
    assert r.ok
    assert len(r.steps) >= 3
    assert r.method == "rule-based"


def test_splits_on_then_connective():
    r = split_exercise_text(NHS)
    assert any("pull your foot" in s.text.lower() for s in r.steps)


def test_does_not_oversplit_short_and_compound():
    r = split_exercise_text("Lift your leg and keep it level.")
    assert len(r.steps) == 1


# ------------------------------------------------------------ parameter pulls

@pytest.mark.parametrize("text,expected", [
    ("Squeeze your bottom firmly together, hold for 5 seconds then relax.", 5),
    ("Stand on one leg and hold for 5 to 10 seconds.", 8),
    ("Push your knee down and hold for five seconds.", 5),
])
def test_hold_seconds_extracted(text, expected):
    r = split_exercise_text(text)
    assert expected in [s.hold_s for s in r.steps], [s.hold_s for s in r.steps]


@pytest.mark.parametrize("text,expected", [
    ("Bend your knee slowly. Repeat 10 times.", 10),
    ("Bend your knee slowly. Repeat ten times.", 10),
    ("Bend your knee slowly. Do this x12.", 12),
])
def test_reps_extracted(text, expected):
    r = split_exercise_text(text)
    assert expected in [s.reps for s in r.steps], [s.reps for s in r.steps]


def test_minutes_become_seconds():
    r = split_exercise_text("Lay on your tummy with your hips level. Lie for 30 minutes.")
    assert 1800 in [s.hold_s for s in r.steps]


def test_extract_params_directly():
    p = extract_params("hold for 5 seconds and repeat 10 times")
    assert p["hold_s"] == 5
    assert p["reps"] == 10


# --------------------------------------------------------- explicit structure

def test_numbered_list_is_preserved():
    text = ("1. Kneel on the floor.\n2. Sit back onto your heels.\n"
            "3. Fold forward and rest.\n4. Hold for 20 seconds.")
    r = split_exercise_text(text)
    assert r.method == "explicit-numbered"
    assert len(r.steps) == 4


def test_bulleted_list_is_preserved():
    text = "- Lie on your side.\n- Lift your top knee.\n- Lower it back down."
    r = split_exercise_text(text)
    assert r.method == "explicit-bulleted"
    assert len(r.steps) == 3


# ------------------------------------------------------------------- safety

def test_safety_is_separated_from_steps():
    r = split_exercise_text(
        "Bend your knee towards your bottom. Stop if pain becomes worse and "
        "seek advice from a healthcare professional."
    )
    assert len(r.safety) >= 1
    assert not any("seek advice" in s.text.lower() for s in r.steps)


# ----------------------------------------------------------- classification

@pytest.mark.parametrize("text,kind", [
    ("Lift your leg out to the side.", "action"),
    ("Hold for 5 seconds.", "hold"),
    ("Repeat 10 times.", "reps"),
    ("Stop if pain becomes worse.", "safety"),
])
def test_classify(text, kind):
    assert classify(text) == kind


def test_starts_with_action_allows_leading_adverb():
    assert starts_with_action("Slowly lift your knee")
    assert not starts_with_action("The knee should be level")


# ------------------------------------------------------------ guard clauses

@pytest.mark.parametrize("bad", ["", None, "   ", "Bend knee"])
def test_bad_input_rejected(bad):
    assert split_exercise_text(bad).ok is False


# ---------------------------------------------------------------- confidence

def test_confidence_in_range_and_per_step():
    r = split_exercise_text(NHS)
    assert 0 < r.confidence <= 1
    assert all(0 < s.confidence <= 1 for s in r.steps)


def test_result_serialises_to_json():
    r = split_exercise_text(NHS)
    json.dumps(r.to_dict())  # must not raise


# --------------------------------------------------------------- LLM adapter

def test_llm_adapter_is_honestly_unavailable():
    assert LLMSplitterAdapter.available is False
    assert LLMSplitterAdapter.split("anything") is None


def test_entry_point_falls_back_to_rules():
    assert split_exercise(NHS).method == "rule-based"


# ------------------------------------------------- parity with the JS version

@pytest.mark.skipif(not (ROOT / "platform" / "js" / "splitter.js").exists(),
                    reason="JS splitter not present")
def test_parity_with_javascript_implementation():
    """The Python and JavaScript splitters must agree on the same input."""
    script = (
        "const S=require(process.argv[1]);"
        "const r=S.splitExerciseText(process.argv[2]);"
        "console.log(JSON.stringify({method:r.method,confidence:r.confidence,"
        "n:r.steps.length,texts:r.steps.map(s=>s.text),"
        "reps:r.steps.map(s=>s.reps),hold:r.steps.map(s=>s.hold_s),"
        "safety:r.safety}));"
    )
    try:
        out = subprocess.run(
            ["node", "-e", script, str(ROOT / "platform" / "js" / "splitter.js"), NHS],
            capture_output=True, text=True, timeout=30, check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        pytest.skip(f"node unavailable: {exc}")

    js = json.loads(out.stdout)
    py = split_exercise_text(NHS)

    assert js["method"] == py.method
    assert js["n"] == len(py.steps)
    assert js["texts"] == [s.text for s in py.steps]
    assert js["reps"] == [s.reps for s in py.steps]
    assert js["hold"] == [s.hold_s for s in py.steps]
    assert js["safety"] == py.safety
    assert abs(js["confidence"] - py.confidence) < 0.01
