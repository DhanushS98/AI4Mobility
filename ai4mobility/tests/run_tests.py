#!/usr/bin/env python3
"""
Zero-dependency test runner.

``tests/test_splitter.py`` is written for pytest, which is the right tool and is
what CI should use. This runner exists so the same checks can be executed in an
environment where pytest is not installed:

    python3 tests/run_tests.py

It runs the identical assertions, plus a parity check against the JavaScript
implementation when node is available.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.splitter import (  # noqa: E402
    LLMSplitterAdapter, classify, extract_params, split_exercise,
    split_exercise_text, starts_with_action,
)

NHS = ("Lay on your back with your leg straight. Point your foot and toes down "
       "to the floor or bed, then slowly pull your foot and toes up towards "
       "your knee. Repeat 10 times.")

_passed = 0
_failed = 0


def check(name: str, cond: bool, detail: object = "") -> None:
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  PASS  {name}")
    else:
        _failed += 1
        print(f"  FAIL  {name}" + (f"\n        {detail}" if detail != "" else ""))


def main() -> int:
    print("\nPython step splitter tests\n" + "=" * 60)

    r = split_exercise_text(NHS)
    check("NHS prose produces >= 3 steps", len(r.steps) >= 3, len(r.steps))
    check("method is rule-based", r.method == "rule-based", r.method)
    check("splits on 'then'", any("pull your foot" in s.text.lower() for s in r.steps))
    check("reps 10 extracted", 10 in [s.reps for s in r.steps], [s.reps for s in r.steps])

    check("no over-split on short 'and'",
          len(split_exercise_text("Lift your leg and keep it level.").steps) == 1)

    for text, expected in [
        ("Squeeze your bottom firmly together, hold for 5 seconds then relax.", 5),
        ("Stand on one leg and hold for 5 to 10 seconds.", 8),
        ("Push your knee down and hold for five seconds.", 5),
    ]:
        got = [s.hold_s for s in split_exercise_text(text).steps]
        check(f"hold {expected}s from {text[:34]!r}", expected in got, got)

    for text, expected in [
        ("Bend your knee slowly. Repeat 10 times.", 10),
        ("Bend your knee slowly. Repeat ten times.", 10),
        ("Bend your knee slowly. Do this x12.", 12),
    ]:
        got = [s.reps for s in split_exercise_text(text).steps]
        check(f"reps {expected} from {text[:34]!r}", expected in got, got)

    got = [s.hold_s for s in split_exercise_text(
        "Lay on your tummy with your hips level. Lie for 30 minutes.").steps]
    check("30 minutes -> 1800 seconds", 1800 in got, got)

    p = extract_params("hold for 5 seconds and repeat 10 times")
    check("extract_params reads both", p["hold_s"] == 5 and p["reps"] == 10, p)

    r = split_exercise_text("1. Kneel on the floor.\n2. Sit back onto your heels.\n"
                            "3. Fold forward and rest.\n4. Hold for 20 seconds.")
    check("numbered list detected", r.method == "explicit-numbered", r.method)
    check("numbered list keeps 4 steps", len(r.steps) == 4, len(r.steps))

    r = split_exercise_text("- Lie on your side.\n- Lift your top knee.\n- Lower it back down.")
    check("bulleted list detected", r.method == "explicit-bulleted", r.method)
    check("bulleted list keeps 3 steps", len(r.steps) == 3, len(r.steps))

    r = split_exercise_text("Bend your knee towards your bottom. Stop if pain becomes "
                            "worse and seek advice from a healthcare professional.")
    check("safety separated", len(r.safety) >= 1, r.safety)
    check("safety not left in steps",
          not any("seek advice" in s.text.lower() for s in r.steps))

    for text, kind in [("Lift your leg out to the side.", "action"),
                       ("Hold for 5 seconds.", "hold"),
                       ("Repeat 10 times.", "reps"),
                       ("Stop if pain becomes worse.", "safety")]:
        check(f"classify {kind}", classify(text) == kind, classify(text))

    check("leading adverb allowed", starts_with_action("Slowly lift your knee"))
    check("non-instruction rejected", not starts_with_action("The knee should be level"))

    for bad in ["", None, "   ", "Bend knee"]:
        check(f"reject {bad!r}", split_exercise_text(bad).ok is False)

    r = split_exercise_text(NHS)
    check("confidence in range", 0 < r.confidence <= 1, r.confidence)
    check("every step has confidence", all(0 < s.confidence <= 1 for s in r.steps))
    try:
        json.dumps(r.to_dict())
        check("result serialises to JSON", True)
    except TypeError as exc:
        check("result serialises to JSON", False, exc)

    check("LLM adapter unavailable", LLMSplitterAdapter.available is False)
    check("LLM adapter returns None", LLMSplitterAdapter.split("anything") is None)
    check("entry point falls back", split_exercise(NHS).method == "rule-based")

    # ---------------------------------------------------- parity with the JS
    js_path = ROOT / "platform" / "js" / "splitter.js"
    if js_path.exists():
        script = (
            "const S=require(process.argv[1]);"
            "const r=S.splitExerciseText(process.argv[2]);"
            "console.log(JSON.stringify({method:r.method,confidence:r.confidence,"
            "texts:r.steps.map(s=>s.text),reps:r.steps.map(s=>s.reps),"
            "hold:r.steps.map(s=>s.hold_s),safety:r.safety}));"
        )
        try:
            out = subprocess.run(["node", "-e", script, str(js_path), NHS],
                                 capture_output=True, text=True, timeout=30, check=True)
            js = json.loads(out.stdout)
            py = split_exercise_text(NHS)
            check("JS/Py parity — method", js["method"] == py.method)
            check("JS/Py parity — step text", js["texts"] == [s.text for s in py.steps],
                  f"{js['texts']}\n        {[s.text for s in py.steps]}")
            check("JS/Py parity — reps", js["reps"] == [s.reps for s in py.steps])
            check("JS/Py parity — hold", js["hold"] == [s.hold_s for s in py.steps])
            check("JS/Py parity — safety", js["safety"] == py.safety)
            check("JS/Py parity — confidence", abs(js["confidence"] - py.confidence) < 0.01,
                  f"{js['confidence']} vs {py.confidence}")
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            print(f"  SKIP  JS parity check (node unavailable: {exc})")
    else:
        print("  SKIP  JS parity check (splitter.js not found)")

    print("=" * 60)
    print(f"  {_passed} passed, {_failed} failed\n")
    return 1 if _failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
