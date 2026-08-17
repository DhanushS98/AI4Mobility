"""
AI4Mobility — Exercise Step Splitter (Python mirror).

A faithful port of ``platform/js/splitter.js`` so the notebook can run the same
splitting logic that the web interface uses, and so both can be tested against
the same expectations.

HONEST STATEMENT OF METHOD
--------------------------
This is a RULE-BASED linguistic splitter. It is not a large language model. No
model weights are loaded and no network call is made. Everything here is
deterministic and inspectable.

An LLM adapter seam is provided at the bottom (``LLMSplitterAdapter``). It is a
stub that returns ``None``; it is not connected to any provider. See the module
docstring there for exactly what implementing it would require.

Usage
-----
    from src.splitter import split_exercise

    result = split_exercise(
        "Lay on your back with your leg straight. Point your foot and toes "
        "down, then slowly pull your foot up towards your knee. Repeat 10 times."
    )
    for step in result.steps:
        print(step.n, step.text, step.reps, step.hold_s)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

__all__ = [
    "Step", "SplitResult", "split_exercise", "split_exercise_text",
    "LLMSplitterAdapter",
]

# --------------------------------------------------------------------- lexicon

ACTION_VERBS = {
    "lie", "lay", "sit", "stand", "kneel", "start", "begin", "come", "get",
    "place", "put", "position", "rest", "set",
    "bend", "straighten", "extend", "flex", "stretch", "reach", "raise",
    "lift", "lower", "drop", "push", "pull", "press", "squeeze", "tighten",
    "relax", "release", "hold", "keep", "maintain",
    "move", "slide", "bring", "take", "turn", "rotate", "twist", "roll",
    "point", "tuck", "curl", "round", "arch", "fold", "open", "close",
    "breathe", "inhale", "exhale",
    "repeat", "return", "continue", "swap", "switch", "change",
    "walk", "step", "rise", "stay", "pause", "stop", "avoid", "ensure", "make",
}

POSITION_MARKERS = (
    "starting position", "start position", "position:", "starting:",
    "begin in", "start in", "from a", "in the position",
)

SAFETY_MARKERS = (
    "stop if", "seek advice", "do not", "don't", "avoid", "caution",
    "if pain", "if it hurts", "should not", "never ", "consult",
    "healthcare professional", "physiotherapist", "contraindic",
)

SPLIT_CONNECTIVES = (
    ", then ", " then ", ", and then ", " and then ",
    ", next ", " next, ", ", after that ", " after that ",
    ", followed by ", "; ",
)

ABBREVIATIONS = (
    "e.g.", "i.e.", "etc.", "approx.", "dr.", "mr.", "mrs.", "ms.",
    "st.", "no.", "vs.", "fig.", "sec.", "min.", "reps.",
)

NUM_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "fifteen": 15, "twenty": 20, "thirty": 30, "sixty": 60,
}


# --------------------------------------------------------------- data classes

@dataclass
class Step:
    n: int
    text: str
    kind: str
    hold_s: int = 0
    reps: Optional[int] = None
    confidence: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SplitResult:
    ok: bool
    reason: str
    method: str
    steps: list[Step] = field(default_factory=list)
    safety: list[str] = field(default_factory=list)
    confidence: float = 0.0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["steps"] = [s.to_dict() for s in self.steps]
        return d

    def __len__(self) -> int:
        return len(self.steps)


# ------------------------------------------------------------------ normalise

def normalise(text: Optional[str]) -> str:
    if not isinstance(text, str):
        return ""
    out = text.replace("\r\n", "\n").replace("\r", "\n")
    out = out.replace("‘", "'").replace("’", "'")
    out = out.replace("“", '"').replace("”", '"')
    out = re.sub(r"[–—]", "-", out)
    out = out.replace(" ", " ")
    out = re.sub(r"\s*&\s*", " and ", out)
    out = re.sub(r"[ \t]+", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


# ------------------------------------------------------- explicit list detect

_NUMBERED = re.compile(r"^(\d{1,2})\s*[.)\]:-]\s+(.{3,})$")
_BULLETED = re.compile(r"^[-*•‣◦⁃]\s+(.{3,})$")


def detect_explicit(text: str) -> Optional[tuple[list[str], str]]:
    """Preserve a list the author already numbered or bulleted."""
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if len(lines) < 2:
        return None

    numbered, bulleted = [], []
    for ln in lines:
        m = _NUMBERED.match(ln)
        if m:
            numbered.append(m.group(2).strip())
        m = _BULLETED.match(ln)
        if m:
            bulleted.append(m.group(1).strip())

    if len(numbered) >= 2 and len(numbered) >= len(lines) * 0.6:
        return numbered, "numbered"
    if len(bulleted) >= 2 and len(bulleted) >= len(lines) * 0.6:
        return bulleted, "bulleted"
    return None


# --------------------------------------------------------------- segmentation

def segment(text: str) -> list[str]:
    working = re.sub(r"\b(\d+)\.(\d+)", r"\1<DEC>\2", text)
    for i, abbr in enumerate(ABBREVIATIONS):
        working = re.sub(re.escape(abbr), f"<ABBR{i}>", working, flags=re.IGNORECASE)

    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])|\n+", working)

    out: list[str] = []
    for part in parts:
        s = part.strip()
        if not s:
            continue
        s = s.replace("<DEC>", ".")
        for i, abbr in enumerate(ABBREVIATIONS):
            s = s.replace(f"<ABBR{i}>", abbr)
        s = s.strip()
        if len(s) > 2:
            out.append(s)
    return out


# ------------------------------------------------------------- compound split

def _words(fragment: str) -> list[str]:
    return [w for w in re.split(r"[^a-z']+", fragment.strip().lower()) if w]


def starts_with_action(fragment: str) -> bool:
    ws = _words(fragment)
    if not ws:
        return False
    if ws[0] in ACTION_VERBS:
        return True
    # allow one leading adverb: "Slowly lift ..."
    return len(ws) > 1 and ws[0].endswith("ly") and ws[1] in ACTION_VERBS


def split_compound(sentence: str) -> list[str]:
    low = sentence.lower()
    for conn in SPLIT_CONNECTIVES:
        idx = low.find(conn)
        if idx > 8:
            left = sentence[:idx].strip().rstrip(",;").strip()
            right = sentence[idx + len(conn):].strip()
            if len(left) > 8 and len(right) > 8 and starts_with_action(right):
                return [left] + split_compound(right)
    return [sentence]


# ------------------------------------------------------------------- classify

def classify(fragment: str) -> str:
    low = fragment.lower()
    if any(m in low for m in SAFETY_MARKERS):
        return "safety"
    if any(m in low for m in POSITION_MARKERS):
        return "position"
    if re.match(r"^(hold|keep|maintain|stay)\b", low):
        return "hold"
    if re.match(r"^(repeat|do this|perform)\b", low) or re.search(r"\brepeat\s+\d+\s+times\b", low):
        return "reps"
    if starts_with_action(fragment):
        return "action"
    if re.match(r"^(lie|lay|sit|stand|kneel|start|begin)\b", low):
        return "position"
    return "context"


# ----------------------------------------------------------------- parameters

def _to_number(token: Optional[str]) -> Optional[int]:
    if token is None:
        return None
    t = str(token).strip().lower()
    if t.isdigit():
        return int(t)
    return NUM_WORDS.get(t)


_RE_HOLD = re.compile(
    r"hold(?:ing)?(?:\s+(?:it|this|the position))?\s+(?:for\s+)?"
    r"(\d+|[a-z]+)(?:\s*(?:-|to)\s*(\d+|[a-z]+))?\s*(?:seconds?|secs?|s)\b"
)
_RE_MIN = re.compile(r"(?:for\s+)?(\d+|[a-z]+)\s*(?:minutes?|mins?)\b")
_RE_REPS = re.compile(r"(\d+|[a-z]+)\s*(?:times|reps|repetitions)\b")
_RE_X = re.compile(r"\bx\s*(\d{1,3})\b")


def extract_params(fragment: str) -> dict[str, Optional[int]]:
    low = fragment.lower()
    params: dict[str, Optional[int]] = {"hold_s": None, "reps": None, "minutes": None}

    m = _RE_HOLD.search(low)
    if m:
        a, b = _to_number(m.group(1)), _to_number(m.group(2))
        if a is not None:
            params["hold_s"] = round((a + b) / 2) if b is not None else a

    m = _RE_MIN.search(low)
    if m:
        a = _to_number(m.group(1))
        if a is not None:
            params["minutes"] = a

    m = _RE_REPS.search(low)
    if m:
        a = _to_number(m.group(1))
        if a is not None and a <= 100:
            params["reps"] = a
    if params["reps"] is None:
        m = _RE_X.search(low)
        if m:
            params["reps"] = int(m.group(1))

    return params


# -------------------------------------------------------------------- scoring

def score_step(fragment: str, kind: str) -> float:
    s = 0.4
    if kind == "action":
        s += 0.35
    elif kind == "position":
        s += 0.25
    elif kind in ("hold", "reps"):
        s += 0.20

    n_words = len(fragment.split())
    if 4 <= n_words <= 28:
        s += 0.15
    elif n_words > 40:
        s -= 0.20

    if re.search(r"\b(your|the)\b", fragment.lower()):
        s += 0.05
    if re.search(r"[,;]\s*(and|then)\b", fragment, flags=re.IGNORECASE):
        s -= 0.10

    return max(0.05, min(0.99, s))


# ------------------------------------------------------------------- assemble

def _sentence_case(s: str) -> str:
    t = s.strip()
    if not t:
        return t
    out = t[0].upper() + t[1:]
    if not re.search(r"[.!?]$", out):
        out += "."
    return out


def _build_warnings(steps: list[Step], confidence: float) -> list[str]:
    w: list[str] = []
    if len(steps) == 1:
        w.append("Only one step was found. If the description has more, try "
                 "putting each instruction on its own line.")
    if len(steps) > 15:
        w.append("That produced a lot of steps. Check whether some should be merged.")
    if confidence < 0.55 and steps:
        w.append("Low confidence — please read the steps and correct anything "
                 "that looks wrong.")
    long_ones = sum(1 for s in steps if len(s.text.split()) > 35)
    if long_ones:
        w.append(f"{long_ones} step(s) are quite long and may still contain "
                 f"more than one instruction.")
    return w


def split_exercise_text(raw_text: Optional[str], keep_safety: bool = True,
                        min_confidence: float = 0.35) -> SplitResult:
    """Split a free-text exercise description into ordered steps."""
    text = normalise(raw_text)

    if not text:
        return SplitResult(False, "empty", "none")
    if len(text.split()) < 4:
        return SplitResult(False, "too_short", "none")

    explicit = detect_explicit(text)
    if explicit:
        fragments, kind = explicit
        method = f"explicit-{kind}"
    else:
        fragments = []
        for sentence in segment(text):
            fragments.extend(split_compound(sentence))
        method = "rule-based"

    safety: list[str] = []
    steps: list[Step] = []

    for frag in fragments:
        clean = frag.strip(" ,;:-\t").strip()
        if len(clean) < 4:
            continue

        kind = classify(clean)
        if kind == "safety":
            if keep_safety:
                safety.append(_sentence_case(clean))
            continue

        conf = score_step(clean, kind)
        if kind == "context" and conf < min_confidence:
            continue

        params = extract_params(clean)
        hold = params["hold_s"] or ((params["minutes"] or 0) * 60)
        steps.append(Step(
            n=0,
            text=_sentence_case(clean),
            kind=kind,
            hold_s=int(hold),
            reps=params["reps"],
            confidence=round(conf, 2),
        ))

    for i, s in enumerate(steps):
        s.n = i + 1

    confidence = round(sum(s.confidence for s in steps) / len(steps), 2) if steps else 0.0

    return SplitResult(
        ok=bool(steps),
        reason="ok" if steps else "no_steps_found",
        method=method,
        steps=steps,
        safety=safety,
        confidence=confidence,
        warnings=_build_warnings(steps, confidence),
    )


# --------------------------------------------------------------- LLM adapter

class LLMSplitterAdapter:
    """
    STUB — NOT IMPLEMENTED.

    The seam where a language model would replace the rule-based splitter. It is
    deliberately left unimplemented rather than faked.

    Implementing it requires:
      1. A provider and an API key held server-side.
      2. A backend endpoint proxying the request so the key never reaches the
         client, with rate limiting.
      3. A schema-constrained prompt returning an ordered array of
         ``{text, hold_s, reps}``.
      4. Validation of the returned JSON before display, with this rule-based
         splitter kept as the fallback on validation failure.
      5. A clinical safety review: a model may invent an instruction that was
         not present in the source description. This is why the interface shows
         the original text beside the generated steps.

    Until those are done, ``split`` returns ``None``.
    """

    available: bool = False
    reason: str = ("Not implemented. No model, no API key, no backend endpoint. "
                   "See the class docstring.")

    @staticmethod
    def split(raw_text: str) -> Optional[SplitResult]:  # noqa: ARG004
        return None


def split_exercise(raw_text: Optional[str], **kwargs: Any) -> SplitResult:
    """Public entry point: try the LLM adapter, fall back to the rules."""
    if LLMSplitterAdapter.available:
        try:
            via_llm = LLMSplitterAdapter.split(raw_text or "")
            if via_llm and via_llm.steps:
                via_llm.method = "llm"
                return via_llm
        except Exception:  # noqa: BLE001 — never let the optional path break the fallback
            pass
    return split_exercise_text(raw_text, **kwargs)


if __name__ == "__main__":  # pragma: no cover
    demo = ("Lay on your back with your leg straight. Point your foot and toes "
            "down to the floor or bed, then slowly pull your foot and toes up "
            "towards your knee. Repeat 10 times. Stop if pain becomes worse.")
    res = split_exercise(demo)
    print(f"method={res.method}  confidence={res.confidence}")
    for s in res.steps:
        extra = []
        if s.reps:
            extra.append(f"{s.reps}x")
        if s.hold_s:
            extra.append(f"{s.hold_s}s hold")
        print(f"  {s.n}. [{s.kind}] {s.text}" + (f"   ({', '.join(extra)})" if extra else ""))
    for w in res.safety:
        print(f"  ! safety: {w}")
