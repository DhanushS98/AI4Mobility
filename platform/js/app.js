/* =============================================================================
   AI4Mobility — application logic
   -----------------------------------------------------------------------------
   Tabs: Exercises · Session · Add your own · What's real
   No build step, no framework, no network calls, no browser storage.
   State lives in memory for the duration of the visit.
   ============================================================================= */

(function () {
  'use strict';

  const Splitter = window.AI4MSplitter;
  const Poses = window.AI4MPoses;
  const DATA = window.AI4M_DATA;

  /* ------------------------------------------------------------------ state */

  const state = {
    tab: 'library',
    programme: null,
    stepIndex: 0,
    running: false,
    remaining: 0,
    ticker: null,
    completed: {},          // programmeId -> Set of step numbers done this visit
    custom: null,           // last split result from the builder
    speak: false
  };

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ------------------------------------------------------------------- tabs */

  function showTab(name, opts) {
    const focusHeading = !(opts && opts.silent);
    state.tab = name;
    $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('.panel').forEach(p => { p.hidden = p.id !== 'panel-' + name; });
    if (focusHeading) {
      const h = $('#panel-' + name + ' h1, #panel-' + name + ' h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------------------------------------------------------------- library */

  function isNHS(p) { return !!p.source_url && /(^|\.)nhs\.uk/.test(p.source_url); }

  function difficultyDots(n) {
    let out = '<span class="dots" aria-label="Difficulty ' + n + ' of 3">';
    for (let i = 1; i <= 3; i++) out += '<span class="dot' + (i <= n ? ' on' : '') + '"></span>';
    return out + '</span>';
  }

  function renderLibrary() {
    const host = $('#library-grid');
    host.innerHTML = DATA.programmes.map(p => {
      const done = state.completed[p.id] ? state.completed[p.id].size : 0;
      const total = p.steps.length;
      return `
      <button class="ecard" data-id="${esc(p.id)}" type="button">
        <div class="ecard-top">
          <div class="ecard-icon c-${esc(p.colour)}" aria-hidden="true">${p.icon}</div>
          <div>
            <h3>${esc(p.title)}</h3>
            <div class="ecard-fam">${esc(p.family)}</div>
          </div>
        </div>
        <p class="ecard-goal">${esc(p.why_kids_like_it)}</p>
        <div class="ecard-meta">
          <span class="pill">${total} step${total === 1 ? '' : 's'}</span>
          <span class="pill">${p.duration_min} min</span>
          ${p.source_url ? `<span class="pill src">${isNHS(p) ? 'NHS source' : 'Cited source'}</span>` : ''}
          ${p.optional ? '<span class="pill opt">Extra</span>' : ''}
        </div>
        <div class="row spread">
          ${difficultyDots(p.difficulty)}
          <span class="small muted">${done}/${total} done</span>
        </div>
      </button>`;
    }).join('');

    $$('.ecard', host).forEach(btn => {
      btn.addEventListener('click', () => openProgramme(btn.dataset.id));
    });
  }

  /* ---------------------------------------------------------------- session */

  function openProgramme(id) {
    const p = DATA.programmes.find(x => x.id === id);
    if (!p) return;
    state.programme = p;
    state.stepIndex = 0;
    stopTimer();
    if (!state.completed[id]) state.completed[id] = new Set();
    renderSession();
    showTab('session');
  }

  function currentStep() {
    if (!state.programme) return null;
    return state.programme.steps[state.stepIndex] || null;
  }

  function renderSession() {
    const p = state.programme;
    const host = $('#panel-session');

    if (!p) {
      host.innerHTML = `<div class="card empty">
        <h2>No exercise chosen yet</h2>
        <p>Pick one from the Exercises tab to get started.</p>
        <button class="btn btn-primary" type="button" data-goto="library">See the exercises</button>
      </div>`;
      $('[data-goto]', host).addEventListener('click', () => showTab('library'));
      return;
    }

    const step = currentStep();
    const total = p.steps.length;
    const doneSet = state.completed[p.id];
    const pct = Math.round((doneSet.size / total) * 100);
    const stars = Math.min(3, Math.floor((doneSet.size / total) * 3 + 0.0001));

    host.innerHTML = `
      <div class="row spread mb">
        <button class="btn btn-ghost btn-sm" type="button" id="back-lib">← All exercises</button>
        <div class="stars" role="img" aria-label="${stars} of 3 stars earned">
          ${[1,2,3].map(i => `<span class="star${i <= stars ? ' on' : ''}">⭐</span>`).join('')}
        </div>
      </div>

      <div class="session">
        <div>
          <div class="card stagewrap">
            <div class="row spread" style="margin-bottom:6px">
              <span class="stepline">Step ${step.n} of ${total}</span>
              <span class="stepline">${esc(p.title)}</span>
            </div>
            <div id="stage">${Poses.render(step.pose, { title: step.text })}</div>
            <p class="steptext">${esc(step.text)}</p>
            ${step.cue ? `<p class="stepcue">${esc(step.cue)}</p>` : ''}

            <div id="timerbox">${renderTimerBox(step)}</div>

            <div class="controls">
              <button class="btn" type="button" id="prev" ${state.stepIndex === 0 ? 'disabled' : ''}>← Back</button>
              ${(step.hold_s > 0)
                ? `<button class="btn btn-go" type="button" id="play">${state.running ? '⏸ Pause' : '▶ Start hold'}</button>`
                : ''}
              <button class="btn btn-primary" type="button" id="next">
                ${state.stepIndex === total - 1 ? 'Finish ✓' : 'Done — next →'}
              </button>
              <button class="chip" type="button" id="say" aria-pressed="${state.speak}">🔊 Read aloud</button>
            </div>
          </div>

          <div class="card">
            <h2>📋 The original description</h2>
            <div class="orig">
              <h3>✏️ Exactly as it was written</h3>
              <p>${esc(p.original_description)}</p>
              <div class="src">
                ${p.source_url
                  ? `Source: <a href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_name)}</a>`
                  : `Source: ${esc(p.source_name)}`}
                <br>${esc(p.evidence_label)}
              </div>
            </div>
            <p class="small muted mt">
              The steps above were produced from this description by the step-splitting
              engine and then checked by hand. Both are shown so you can compare them.
            </p>
          </div>

          <div class="card">
            <div class="safety">
              <strong>⚠️ Staying safe</strong>
              ${esc(p.safety)}
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <h2>🎯 Your progress</h2>
            <div class="bar"><i style="width:${pct}%"></i></div>
            <p class="small muted">${doneSet.size} of ${total} steps done this visit.</p>
            <ol class="rail">
              ${p.steps.map((s, i) => `
                <li class="${doneSet.has(s.n) ? 'done' : ''}${i === state.stepIndex ? ' now' : ''}">
                  <span class="rail-n">${doneSet.has(s.n) ? '✓' : s.n}</span>
                  <span>
                    <span class="rail-t">${esc(s.text.length > 92 ? s.text.slice(0, 92) + '…' : s.text)}</span>
                    ${(s.hold_s || s.reps) ? `<span class="rail-p">${s.reps ? s.reps + '×' : ''}${(s.reps && s.hold_s) ? ' · ' : ''}${s.hold_s ? formatSeconds(s.hold_s) + ' hold' : ''}</span>` : ''}
                  </span>
                </li>`).join('')}
            </ol>
            <div class="row mt">
              <button class="btn btn-ghost btn-sm" type="button" id="reset">Start over</button>
            </div>
          </div>

          <div class="card">
            <h2>ℹ️ About this one</h2>
            <p class="small">${esc(p.goal)}</p>
            <p class="small muted">
              ${esc(p.also_called ? 'Also called: ' + p.also_called : '')}
            </p>
          </div>
        </div>
      </div>`;

    $('#back-lib').addEventListener('click', () => { stopTimer(); showTab('library'); });
    $('#prev').addEventListener('click', prevStep);
    $('#next').addEventListener('click', nextStep);
    $('#reset').addEventListener('click', () => {
      state.completed[p.id] = new Set();
      state.stepIndex = 0; stopTimer(); renderSession();
    });
    const play = $('#play');
    if (play) play.addEventListener('click', toggleTimer);
    $('#say').addEventListener('click', toggleSpeech);

    if (state.speak) speak(step.text + (step.cue ? '. ' + step.cue : ''));
  }

  function renderTimerBox(step) {
    if (step.hold_s > 0) {
      const shown = state.running || state.remaining ? state.remaining : step.hold_s;
      return `<div class="timer${step.hold_s > 300 ? ' small' : ''}" aria-live="polite">${formatSeconds(shown)}</div>
              <div class="timer-label">${state.running ? 'holding' : 'hold for'}${step.reps ? ' · ' + step.reps + ' times' : ''}</div>`;
    }
    if (step.reps) {
      return `<div class="timer">${step.reps}×</div><div class="timer-label">repeat this many times</div>`;
    }
    return `<div class="timer-label">take your time</div>`;
  }

  function formatSeconds(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60), r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }

  /* ------------------------------------------------------------------ timer */

  function toggleTimer() {
    const step = currentStep();
    if (!step || !step.hold_s) return;
    if (state.running) { stopTimer(); }
    else {
      if (!state.remaining) state.remaining = step.hold_s;
      state.running = true;
      state.ticker = setInterval(tick, 1000);
    }
    refreshTimer();
  }

  function stopTimer() {
    state.running = false;
    if (state.ticker) { clearInterval(state.ticker); state.ticker = null; }
  }

  function tick() {
    state.remaining -= 1;
    if (state.remaining <= 0) {
      stopTimer();
      state.remaining = 0;
      refreshTimer();
      if (state.speak) speak('Well done.');
      return;
    }
    refreshTimer();
  }

  function refreshTimer() {
    const step = currentStep();
    const box = $('#timerbox');
    if (box && step) box.innerHTML = renderTimerBox(step);
    const play = $('#play');
    if (play) play.textContent = state.running ? '⏸ Pause' : (state.remaining ? '▶ Resume' : '▶ Start hold');
  }

  /* -------------------------------------------------------------- stepping */

  function nextStep() {
    const p = state.programme;
    const step = currentStep();
    if (!p || !step) return;
    state.completed[p.id].add(step.n);
    stopTimer();
    state.remaining = 0;
    if (state.stepIndex < p.steps.length - 1) state.stepIndex += 1;
    renderSession();
  }

  function prevStep() {
    if (state.stepIndex > 0) state.stepIndex -= 1;
    stopTimer(); state.remaining = 0;
    renderSession();
  }

  /* ---------------------------------------------------------------- speech */

  function toggleSpeech() {
    state.speak = !state.speak;
    const b = $('#say');
    if (b) b.setAttribute('aria-pressed', String(state.speak));
    if (state.speak) {
      const s = currentStep();
      if (s) speak(s.text + (s.cue ? '. ' + s.cue : ''));
    } else if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  function speak(text) {
    if (!window.speechSynthesis || !state.speak) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92; u.pitch = 1.05; u.lang = 'en-GB';
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is optional; never block the interface */ }
  }

  /* --------------------------------------------------------------- builder */

  function renderBuilderResult(res) {
    const host = $('#builder-out');
    if (!res) {
      host.innerHTML = `<div class="empty">
        <p style="font-size:2.4rem;margin:0">✏️</p>
        <p>Paste or type an exercise description on the left, then press
        <strong>Split it into steps</strong>.</p></div>`;
      return;
    }
    if (!res.ok) {
      const why = res.reason === 'too_short'
        ? 'That is too short to split. Try writing at least a full sentence.'
        : res.reason === 'empty'
          ? 'Nothing to split yet — the box is empty.'
          : 'No steps could be found in that text.';
      host.innerHTML = `<div class="warnbox"><strong>Could not split that</strong><br>${esc(why)}</div>`;
      return;
    }

    const c = res.confidence;
    const cls = c >= 0.7 ? 'hi' : c >= 0.5 ? 'mid' : 'lo';
    const word = c >= 0.7 ? 'Good confidence' : c >= 0.5 ? 'Moderate confidence' : 'Low confidence';

    host.innerHTML = `
      <div class="row spread mb">
        <h3 style="margin:0">${res.steps.length} step${res.steps.length === 1 ? '' : 's'} found</h3>
        <span class="conf ${cls}">${word} · ${Math.round(c * 100)}%</span>
      </div>

      <ol class="rail">
        ${res.steps.map(s => `
          <li>
            <span class="rail-n">${s.n}</span>
            <span>
              <span class="rail-t">${esc(s.text)}</span>
              <span class="rail-p">
                ${esc(s.kind)}${s.reps ? ' · ' + s.reps + '×' : ''}${s.hold_s ? ' · ' + formatSeconds(s.hold_s) + ' hold' : ''}
                · ${Math.round(s.confidence * 100)}% sure
              </span>
            </span>
          </li>`).join('')}
      </ol>

      ${res.safety.length ? `<div class="safety mt"><strong>⚠️ Safety lines found (kept separate from the steps)</strong>
        ${res.safety.map(s => esc(s)).join('<br>')}</div>` : ''}

      ${res.warnings && res.warnings.length ? `<div class="warnbox">
        <strong>Worth checking</strong>
        <ul>${res.warnings.map(w => '<li>' + esc(w) + '</li>').join('')}</ul>
      </div>` : ''}

      <div class="method">
        Method used: <strong>${esc(res.method)}</strong>.
        ${res.method === 'rule-based'
          ? 'Sentence segmentation, then connective splitting, then classification — all deterministic, no language model involved.'
          : res.method.indexOf('explicit') === 0
            ? 'Your text was already numbered or bulleted, so that structure was kept exactly as written rather than re-split.'
            : ''}
      </div>`;
  }

  function runSplit() {
    const text = $('#builder-in').value;
    Splitter.splitExercise(text).then(res => {
      state.custom = res;
      renderBuilderResult(res);
      $('#builder-out').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  /* ------------------------------------------------------------- honesty */

  const HONESTY = [
    ['Exercise library with the five required programmes', 'built',
     'Child\'s Pose, Cat–Cow, Thread the Needle, the NHS lower limb guide and the paediatric core and hip stability set are all present, with a sixth optional extra.'],
    ['Original description shown beside the generated steps', 'built',
     'Added directly in response to supervisor feedback. Every programme stores its source text verbatim and displays it under the steps.'],
    ['Manual description entry', 'built',
     'The "Add your own" tab accepts any free-text description and runs it through the same splitter.'],
    ['Rule-based step splitting', 'built',
     'Sentence segmentation, connective splitting, classification, and extraction of hold times and repetition counts. 24 unit tests pass.'],
    ['LLM-based step splitting', 'not',
     'NOT implemented. An adapter interface exists in splitter.js and returns null. Doing this properly needs a server-side API key, a proxy endpoint, schema validation of the response, and a clinical-safety review — none of which are done.'],
    ['Stick-figure pose pictures', 'part',
     'All 27 poses are drawn, but from hand-authored joint coordinates, not from a pose estimation model. They use the same skeleton connection list as the notebook figures.'],
    ['Live camera pose feedback', 'not',
     'NOT implemented in this interface. The notebook contains MediaPipe landmark extraction on recorded data. Real-time feedback on a child would need camera consent handling, on-device processing and an ethics amendment.'],
    ['Read-aloud of the steps', 'part',
     'Uses the browser\'s built-in speech synthesis where available. Voice quality and language coverage depend entirely on the device — nothing is bundled with the platform.'],
    ['Progress and stars', 'part',
     'Progress is tracked for the current visit only. Nothing is saved between visits because no storage or account system was built.'],
    ['Accessibility controls', 'built',
     'Large text, high contrast and calm (reduced motion) modes, keyboard navigation, visible focus, skip link and ARIA labelling throughout.'],
    ['Accounts, saved history, therapist dashboard', 'not',
     'NOT implemented. There is no backend, no database and no login. Everything is client-side.'],
    ['Clinical validation with children', 'not',
     'NOT done. No child has used this. The exercise content is adapted from published NHS sources but the platform itself has had no clinical or user evaluation.']
  ];

  function renderHonesty() {
    const counts = { built: 0, part: 0, not: 0 };
    HONESTY.forEach(r => counts[r[1]]++);
    $('#honesty-counts').innerHTML = `
      <div class="hstat"><b>${counts.built}</b><span>Built</span></div>
      <div class="hstat"><b>${counts.part}</b><span>Partly</span></div>
      <div class="hstat"><b>${counts.not}</b><span>Not built</span></div>`;

    $('#honesty-body').innerHTML = HONESTY.map(([name, tag, detail]) => `
      <tr>
        <td><strong>${esc(name)}</strong></td>
        <td><span class="tag ${tag}">${tag === 'built' ? 'Built' : tag === 'part' ? 'Partly' : 'Not built'}</span></td>
        <td>${esc(detail)}</td>
      </tr>`).join('');
  }

  /* ------------------------------------------------------------------ init */

  function initToggles() {
    const map = { 'toggle-text': 'big-text', 'toggle-contrast': 'high-contrast', 'toggle-calm': 'calm-mode' };
    Object.keys(map).forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const on = document.documentElement.classList.toggle(map[id]);
        btn.setAttribute('aria-pressed', String(on));
      });
    });
  }

  function initStats() {
    const totalSteps = DATA.programmes.reduce((a, p) => a + p.steps.length, 0);
    const withSource = DATA.programmes.filter(isNHS).length;
    $('#stat-progs').textContent = DATA.programmes.length;
    $('#stat-steps').textContent = totalSteps;
    $('#stat-src').textContent = withSource;
  }

  function init() {
    $$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('#split-btn').addEventListener('click', runSplit);
    $('#clear-btn').addEventListener('click', () => {
      $('#builder-in').value = '';
      state.custom = null;
      renderBuilderResult(null);
      $('#builder-in').focus();
    });
    $$('[data-sample]').forEach(b => b.addEventListener('click', () => {
      $('#builder-in').value = b.dataset.sample;
      runSplit();
    }));

    initToggles();
    initStats();
    renderLibrary();
    renderSession();
    renderBuilderResult(null);
    renderHonesty();
    showTab('library', { silent: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
