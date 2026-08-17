/* =============================================================================
   AI4Mobility — Exercise Step Splitter
   -----------------------------------------------------------------------------
   Takes a free-text exercise description and splits it into ordered, actionable
   steps.

   HONEST STATEMENT OF METHOD (this matters — see docs/report):
   This is a RULE-BASED linguistic splitter. It is NOT a large language model.
   No model weights are loaded and no network call is made. Everything below is
   deterministic, inspectable and runs offline in the browser.

   An LLM adapter interface is defined at the bottom of this file
   (`LLMSplitterAdapter`). It is a STUB: it is not connected to any provider and
   returns null. It exists so the swap is a one-file change, and so the report
   can describe exactly what would be required. Do not present it as working.

   Pipeline
   --------
     1. normalise()        clean whitespace, unify quotes/dashes, expand "&"
     2. detectExplicit()   if the author already numbered or bulleted the steps,
                           trust that and stop — never re-split a numbered list
     3. segment()          sentence segmentation with abbreviation protection
     4. splitCompound()    break sentences on coordinating connectives, but only
                           when BOTH sides look like instructions
     5. classify()         label each fragment: action | position | hold | reps |
                           safety | context
     6. extractParams()    pull hold seconds and repetition counts out of text
     7. score()            per-step confidence + an overall confidence
     8. assemble()         drop non-instructional fragments, order, renumber
   ============================================================================= */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- lexicon */

  // Verbs that begin an instruction. Ordered roughly by frequency in the NHS
  // and physiotherapy leaflets used as source material.
  const ACTION_VERBS = [
    'lie', 'lay', 'sit', 'stand', 'kneel', 'start', 'begin', 'come', 'get',
    'place', 'put', 'position', 'rest', 'set',
    'bend', 'straighten', 'extend', 'flex', 'stretch', 'reach', 'raise',
    'lift', 'lower', 'drop', 'push', 'pull', 'press', 'squeeze', 'tighten',
    'relax', 'release', 'hold', 'keep', 'maintain',
    'move', 'slide', 'bring', 'take', 'turn', 'rotate', 'twist', 'roll',
    'point', 'tuck', 'curl', 'round', 'arch', 'fold', 'open', 'close',
    'breathe', 'inhale', 'exhale',
    'repeat', 'return', 'continue', 'swap', 'switch', 'change',
    'walk', 'step', 'rise', 'stay', 'pause', 'stop', 'avoid', 'ensure', 'make'
  ];

  // Phrases that mark a resting/starting position rather than a movement.
  const POSITION_MARKERS = [
    'starting position', 'start position', 'position:', 'starting:',
    'begin in', 'start in', 'from a', 'in the position'
  ];

  // Phrases that mark safety guidance rather than a step to perform.
  const SAFETY_MARKERS = [
    'stop if', 'seek advice', 'do not', "don't", 'avoid', 'caution',
    'if pain', 'if it hurts', 'should not', 'never ', 'consult',
    'healthcare professional', 'physiotherapist', 'contraindic'
  ];

  // Coordinators we are willing to split a sentence on.
  const SPLIT_CONNECTIVES = [
    ', then ', ' then ', ', and then ', ' and then ',
    ', next ', ' next, ', ', after that ', ' after that ',
    ', followed by ', '; '
  ];

  // Abbreviations that must not end a sentence.
  const ABBREVIATIONS = [
    'e.g.', 'i.e.', 'etc.', 'approx.', 'dr.', 'mr.', 'mrs.', 'ms.',
    'st.', 'no.', 'vs.', 'fig.', 'sec.', 'min.', 'reps.'
  ];

  /* -------------------------------------------------------------- normalise */

  function normalise(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/ /g, ' ')
      .replace(/\s*&\s*/g, ' and ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /* --------------------------------------------------- explicit list detect */

  // If the author has already numbered or bulleted their steps, splitting again
  // does more harm than good. Detect and preserve that structure.
  function detectExplicit(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return null;

    const NUMBERED = /^(\d{1,2})\s*[.)\]:-]\s+(.{3,})$/;
    const BULLETED = /^[-*•‣◦⁃]\s+(.{3,})$/;

    const numbered = [];
    const bulleted = [];
    lines.forEach(l => {
      const n = l.match(NUMBERED);
      if (n) numbered.push(n[2].trim());
      const b = l.match(BULLETED);
      if (b) bulleted.push(b[1].trim());
    });

    // Require the marked lines to be the clear majority of the input.
    if (numbered.length >= 2 && numbered.length >= lines.length * 0.6) {
      return { items: numbered, kind: 'numbered' };
    }
    if (bulleted.length >= 2 && bulleted.length >= lines.length * 0.6) {
      return { items: bulleted, kind: 'bulleted' };
    }
    return null;
  }

  /* ---------------------------------------------------------- segmentation */

  function segment(text) {
    const protectedText = text.replace(/\b(\d+)\.(\d+)/g, '$1<DEC>$2');
    let working = protectedText;
    ABBREVIATIONS.forEach((abbr, i) => {
      const re = new RegExp(abbr.replace(/\./g, '\\.'), 'gi');
      working = working.replace(re, `<ABBR${i}>`);
    });

    const parts = working
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])|\n+/)
      .map(s => s.trim())
      .filter(Boolean);

    return parts.map(s => {
      let out = s.replace(/<DEC>/g, '.');
      ABBREVIATIONS.forEach((abbr, i) => {
        out = out.replace(new RegExp(`<ABBR${i}>`, 'g'), abbr);
      });
      return out.trim();
    }).filter(s => s.length > 2);
  }

  /* ------------------------------------------------------- compound split */

  function startsWithAction(fragment) {
    const first = fragment.trim().toLowerCase().split(/[^a-z']+/).filter(Boolean)[0];
    if (!first) return false;
    if (ACTION_VERBS.includes(first)) return true;
    // "Slowly lift ..." — allow one leading adverb.
    const words = fragment.trim().toLowerCase().split(/[^a-z']+/).filter(Boolean);
    if (words.length > 1 && /ly$/.test(words[0]) && ACTION_VERBS.includes(words[1])) return true;
    return false;
  }

  function splitCompound(sentence) {
    // Try each connective; only accept the split if the right-hand side reads
    // as its own instruction. This is what stops "lift your leg and hold it
    // level" from becoming two useless fragments.
    for (const conn of SPLIT_CONNECTIVES) {
      const idx = sentence.toLowerCase().indexOf(conn);
      if (idx > 8) {
        const left = sentence.slice(0, idx).trim().replace(/[,;]$/, '');
        const right = sentence.slice(idx + conn.length).trim();
        if (left.length > 8 && right.length > 8 && startsWithAction(right)) {
          return [left, ...splitCompound(right)];
        }
      }
    }
    return [sentence];
  }

  /* ------------------------------------------------------------- classify */

  function classify(fragment) {
    const low = fragment.toLowerCase();

    if (SAFETY_MARKERS.some(m => low.includes(m))) return 'safety';
    if (POSITION_MARKERS.some(m => low.includes(m))) return 'position';
    if (/^(hold|keep|maintain|stay)\b/.test(low)) return 'hold';
    if (/^(repeat|do this|perform)\b/.test(low) || /\brepeat\s+\d+\s+times\b/.test(low)) return 'reps';
    if (startsWithAction(fragment)) return 'action';
    if (/^(lie|lay|sit|stand|kneel|start|begin)\b/.test(low)) return 'position';
    return 'context';
  }

  /* --------------------------------------------------------- parameters */

  const NUM_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15,
    twenty: 20, thirty: 30, sixty: 60
  };

  function toNumber(token) {
    if (token == null) return null;
    const t = String(token).toLowerCase().trim();
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    if (NUM_WORDS[t] != null) return NUM_WORDS[t];
    return null;
  }

  function extractParams(fragment) {
    const low = fragment.toLowerCase();
    const params = { hold_s: null, reps: null, minutes: null };

    // hold for 5 seconds / hold for five seconds / hold 5-10 seconds
    let m = low.match(/hold(?:ing)?(?:\s+(?:it|this|the position))?\s+(?:for\s+)?(\d+|[a-z]+)(?:\s*(?:-|to)\s*(\d+|[a-z]+))?\s*(?:seconds?|secs?|s)\b/);
    if (m) {
      const a = toNumber(m[1]);
      const b = toNumber(m[2]);
      if (a != null) params.hold_s = b != null ? Math.round((a + b) / 2) : a;
    }

    // lie for 30 minutes
    m = low.match(/(?:for\s+)?(\d+|[a-z]+)\s*(?:minutes?|mins?)\b/);
    if (m) {
      const a = toNumber(m[1]);
      if (a != null) params.minutes = a;
    }

    // repeat 10 times / do this ten times / 10 repetitions / x10
    m = low.match(/(\d+|[a-z]+)\s*(?:times|reps|repetitions)\b/);
    if (m) {
      const a = toNumber(m[1]);
      if (a != null && a <= 100) params.reps = a;
    }
    if (params.reps == null) {
      m = low.match(/\bx\s*(\d{1,3})\b/);
      if (m) params.reps = parseInt(m[1], 10);
    }

    return params;
  }

  /* ------------------------------------------------------------- scoring */

  function scoreStep(fragment, kind) {
    let s = 0.4;
    if (kind === 'action') s += 0.35;
    else if (kind === 'position') s += 0.25;
    else if (kind === 'hold' || kind === 'reps') s += 0.2;

    const words = fragment.split(/\s+/).length;
    if (words >= 4 && words <= 28) s += 0.15;      // sensible instruction length
    else if (words > 40) s -= 0.2;                  // probably still compound

    if (/\b(your|the)\b/.test(fragment.toLowerCase())) s += 0.05;  // addresses a body part
    if (/[,;]\s*(and|then)\b/i.test(fragment)) s -= 0.1;           // unsplit compound

    return Math.max(0.05, Math.min(0.99, s));
  }

  /* ------------------------------------------------------------- assemble */

  function splitExerciseText(rawText, options) {
    const opts = Object.assign({ keepSafety: true, minConfidence: 0.35 }, options || {});
    const text = normalise(rawText);

    if (!text) {
      return { ok: false, reason: 'empty', steps: [], safety: [], confidence: 0, method: 'none' };
    }
    if (text.split(/\s+/).length < 4) {
      return { ok: false, reason: 'too_short', steps: [], safety: [], confidence: 0, method: 'none' };
    }

    let fragments;
    let method;

    const explicit = detectExplicit(text);
    if (explicit) {
      fragments = explicit.items;
      method = 'explicit-' + explicit.kind;
    } else {
      fragments = [];
      segment(text).forEach(sentence => {
        splitCompound(sentence).forEach(f => fragments.push(f));
      });
      method = 'rule-based';
    }

    const safety = [];
    const steps = [];

    fragments.forEach(frag => {
      const clean = frag.replace(/^[,;:\-\s]+/, '').replace(/[,;:\s]+$/, '').trim();
      if (clean.length < 4) return;

      const kind = classify(clean);
      if (kind === 'safety') {
        if (opts.keepSafety) safety.push(sentenceCase(clean));
        return;
      }

      const conf = scoreStep(clean, kind);
      if (kind === 'context' && conf < opts.minConfidence) return;

      const params = extractParams(clean);
      steps.push({
        n: 0,
        text: sentenceCase(clean),
        kind: kind,
        hold_s: params.hold_s || (params.minutes ? params.minutes * 60 : 0),
        reps: params.reps || null,
        confidence: Math.round(conf * 100) / 100
      });
    });

    steps.forEach((s, i) => { s.n = i + 1; });

    const confidence = steps.length
      ? Math.round((steps.reduce((a, s) => a + s.confidence, 0) / steps.length) * 100) / 100
      : 0;

    return {
      ok: steps.length > 0,
      reason: steps.length ? 'ok' : 'no_steps_found',
      method: method,
      steps: steps,
      safety: safety,
      confidence: confidence,
      warnings: buildWarnings(steps, confidence)
    };
  }

  function buildWarnings(steps, confidence) {
    const w = [];
    if (steps.length === 1) {
      w.push('Only one step was found. If the description has more, try putting each instruction on its own line.');
    }
    if (steps.length > 15) {
      w.push('That produced a lot of steps. Check whether some should be merged.');
    }
    if (confidence < 0.55 && steps.length) {
      w.push('Low confidence — please read the steps and correct anything that looks wrong.');
    }
    const longOnes = steps.filter(s => s.text.split(/\s+/).length > 35).length;
    if (longOnes) {
      w.push(longOnes + ' step(s) are quite long and may still contain more than one instruction.');
    }
    return w;
  }

  function sentenceCase(s) {
    const t = s.trim();
    if (!t) return t;
    let out = t.charAt(0).toUpperCase() + t.slice(1);
    if (!/[.!?]$/.test(out)) out += '.';
    return out;
  }

  /* --------------------------------------------------------- LLM adapter */

  /**
   * STUB — NOT IMPLEMENTED.
   *
   * This is the seam where a language model would replace the rule-based
   * splitter. It is deliberately left unimplemented rather than faked.
   *
   * To implement it you would need to:
   *   1. Choose a provider and hold an API key server-side (never in this file —
   *      the platform is a static page and any key here would be public).
   *   2. Add a small backend endpoint that proxies the request, so the key stays
   *      on the server and requests can be rate-limited.
   *   3. Send the description with a schema-constrained prompt asking for an
   *      ordered array of {text, hold_s, reps}.
   *   4. Validate the returned JSON against that schema before display, and keep
   *      the rule-based splitter as the fallback when validation fails.
   *   5. Review the clinical-safety implications: a model may invent an
   *      instruction that was not in the source description. Any LLM output
   *      shown to a parent would need the original text displayed beside it,
   *      which is why the interface already does that.
   *
   * Until those five things are done, this returns null and the caller falls
   * back to splitExerciseText().
   */
  const LLMSplitterAdapter = {
    available: false,
    reason: 'Not implemented. No model, no API key, no backend endpoint. See comments in splitter.js.',
    async split(/* rawText */) {
      return null;
    }
  };

  /** Public entry point. Tries the LLM adapter, falls back to rules. */
  async function splitExercise(rawText, options) {
    if (LLMSplitterAdapter.available) {
      try {
        const viaLLM = await LLMSplitterAdapter.split(rawText);
        if (viaLLM && Array.isArray(viaLLM.steps) && viaLLM.steps.length) {
          return Object.assign({ method: 'llm' }, viaLLM);
        }
      } catch (e) {
        /* fall through to rules */
      }
    }
    return splitExerciseText(rawText, options);
  }

  const api = {
    splitExercise,
    splitExerciseText,
    LLMSplitterAdapter,
    _internal: { normalise, segment, splitCompound, classify, extractParams, detectExplicit, scoreStep }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AI4MSplitter = api;

})(typeof window !== 'undefined' ? window : globalThis);
