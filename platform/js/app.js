/* =============================================================================
   AI4Mobility — application logic

   Two views:
     Programmes — the exercise library
     Practise   — an editable description box that drives a step list, an
                  illustrated step-by-step view, and the live pose coach

   No framework, no network requests other than the optional pose model, and no
   browser storage. Session state is held in memory for the visit.
   ============================================================================= */

(function () {
  'use strict';

  const Splitter = window.AI4MSplitter;
  const Poses = window.AI4MPoses;
  const Coach = window.AI4MCoach;
  const DATA = window.AI4M_DATA;

  /* ------------------------------------------------------------------ state */

  const state = {
    tab: 'library',
    filter: 'All',
    programme: null,     // the loaded programme, or null for a custom description
    steps: [],           // the step list currently being practised
    stepIndex: 0,
    edited: false,       // true once the description no longer matches the source
    running: false,
    remaining: 0,
    ticker: null,
    done: new Set(),
    speak: false,
    coachOn: false,
    coachState: null
  };

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatSeconds(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60), r = s % 60;
    return r ? m + 'm ' + r + 's' : m + 'm';
  }

  function doseLine(s) {
    const bits = [];
    if (s.reps) bits.push(s.reps + ' repetitions');
    if (s.hold_s) bits.push(formatSeconds(s.hold_s) + ' hold');
    return bits.join(' · ');
  }

  /* ------------------------------------------------------------------- tabs */

  function showTab(name, opts) {
    state.tab = name;
    $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('.panel').forEach(p => { p.hidden = p.id !== 'panel-' + name; });
    if (name !== 'session') stopCoach();
    if (!(opts && opts.silent)) {
      const h = $('#panel-' + name + ' h1, #panel-' + name + ' h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------- library */

  function levelBars(n) {
    let out = '<span class="level" aria-label="Level ' + n + ' of 3">';
    for (let i = 1; i <= 3; i++) out += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return out + '</span>';
  }

  function families() {
    const set = [];
    DATA.programmes.forEach(p => { if (set.indexOf(p.family) === -1) set.push(p.family); });
    return ['All'].concat(set.sort());
  }

  function renderFilters() {
    const host = $('#filters');
    host.innerHTML = '<span class="lbl">Area</span>' + families().map(f =>
      `<button class="chip" type="button" data-fam="${esc(f)}" aria-pressed="${f === state.filter}">${esc(f)}</button>`
    ).join('');
    $$('[data-fam]', host).forEach(b => b.addEventListener('click', () => {
      state.filter = b.dataset.fam;
      renderFilters();
      renderLibrary();
    }));
  }

  function renderLibrary() {
    const host = $('#library-grid');
    const list = DATA.programmes.filter(p => state.filter === 'All' || p.family === state.filter);

    host.innerHTML = list.map(p => `
      <button class="ecard" data-id="${esc(p.id)}" type="button">
        <div class="ecard-fig" aria-hidden="true">${Poses.render(p.steps[0].pose, { animate: false, title: '' })}</div>
        <div>
          <h3>${esc(p.title)}</h3>
          <div class="ecard-sub">${esc(p.subtitle)}</div>
        </div>
        <p class="ecard-goal">${esc(p.goal)}</p>
        <div class="ecard-meta">
          <span class="pill">${p.steps.length} steps</span>
          <span class="pill">${p.duration_min} min</span>
          <span class="pill">${esc(p.position)}</span>
          ${p.source_url ? '<span class="pill src">Referenced</span>' : ''}
        </div>
        <div class="row spread">
          ${levelBars(p.difficulty)}
        </div>
      </button>`).join('');

    $$('.ecard', host).forEach(b => b.addEventListener('click', () => loadProgramme(b.dataset.id)));
  }

  /* --------------------------------------------------------------- loading */

  function loadProgramme(id) {
    const p = DATA.programmes.find(x => x.id === id);
    if (!p) return;
    state.programme = p;
    state.steps = p.steps.map(s => Object.assign({}, s));
    state.stepIndex = 0;
    state.edited = false;
    state.done = new Set();
    state.remaining = 0;
    stopTimer();
    renderSession();
    showTab('session');
    const box = $('#desc-in');
    if (box) box.value = p.original_description;
  }

  /**
   * Convert whatever is in the description box into the practised step list.
   * This is the same conversion whether the text came from a programme or was
   * typed by hand.
   */
  function convertDescription() {
    const text = $('#desc-in').value;
    Splitter.splitExercise(text).then(res => {
      if (!res.ok) {
        state.convertError = res.reason === 'too_short'
          ? 'The description is too short to separate. Please enter at least a full sentence.'
          : res.reason === 'empty'
            ? 'Enter a description first.'
            : 'No steps could be identified in that description.';
        renderSession();
        return;
      }
      state.convertError = null;
      state.convertWarnings = res.warnings || [];
      state.convertSafety = res.safety || [];

      // Keep the illustration where the wording still matches the source step.
      const source = state.programme ? state.programme.steps : [];
      state.steps = res.steps.map((s, i) => {
        // Only carry the programme's title and illustration across when the
        // wording is genuinely unchanged. Otherwise the picture would describe
        // a movement the edited text no longer asks for.
        const match = source[i];
        const unchanged = match && normalise(match.text) === normalise(s.text);
        return {
          n: s.n,
          title: unchanged ? match.title : null,
          text: s.text,
          hold_s: s.hold_s,
          reps: s.reps,
          pose: unchanged ? match.pose : guessPose(s.text)
        };
      });
      state.edited = !state.programme ||
        normalise(text) !== normalise(state.programme.original_description);
      state.stepIndex = 0;
      state.done = new Set();
      state.remaining = 0;
      stopTimer();
      renderSession();
    });
  }

  function normalise(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /** Pick a plausible illustration for a step written by hand. */
  const POSE_HINTS = [
    [/\bhands? and knees|four ?point|table\b/, 'table'],
    [/\bround your back|arch.*ceiling|cat\b/, 'cat'],
    [/\bdrop your tummy|cow\b/, 'cow'],
    [/\bkneel/, 'kneel'],
    [/\bsit back|onto your heels/, 'sit_heels'],
    [/\bfold forward/, 'fold'],
    [/\bbridge|lift your hips|raising your bottom/, 'bridge'],
    [/\bclam|top knee/, 'clam'],
    [/\bon your side\b/, 'clam'],
    [/\bon your (tummy|front)|prone|stomach/, 'prone'],
    [/\bdead bug/, 'dead_bug'],
    [/\bhip.*(out to the side|abduct)/, 'hip_abduct'],
    [/\bheel towards your bottom|bend your knee/, 'knee_bend'],
    [/\bsqueeze your bottom|glute/, 'supine_glute'],
    [/\bpush your knee down|quadriceps/, 'supine_quad'],
    [/\bpoint your foot|toes up towards|ankle/, 'supine_ankle'],
    [/\btip ?toes|heel raise|onto your toes/, 'heel_raise'],
    [/\bone leg|single leg|balanc/, 'one_leg'],
    [/\bheel to toe|tandem/, 'tandem_stand'],
    [/\bsquat|sit on the chair/, 'chair_squat'],
    [/\bstep up|onto the step/, 'step_up'],
    [/\bwall\b/, 'wall_push'],
    [/\bprayer/, 'prayer_stretch'],
    [/\bwrist/, 'wrist_table'],
    [/\belbow into your side|palm to face/, 'forearm_twist'],
    [/\bshoulder.*(roll|circle)/, 'shoulder_roll'],
    [/\breach.*above your head|overhead/, 'seated_reach'],
    [/\bneck\b/, 'neck_stretch'],
    [/\bturn your shoulders|look behind/, 'seated_twist'],
    [/\bsit tall|sitting/, 'seated'],
    [/\breach the .*hand up|towards the ceiling/, 'thread_reach'],
    [/\bslide the .*hand between|thread/, 'thread'],
    [/\bstand/, 'stand']
  ];

  function guessPose(text) {
    const low = String(text || '').toLowerCase();
    for (const [re, key] of POSE_HINTS) {
      if (re.test(low) && Poses.has(key)) return key;
    }
    return 'stand';
  }

  /* ---------------------------------------------------------------- session */

  function currentStep() {
    return state.steps[state.stepIndex] || null;
  }

  function renderSession() {
    const host = $('#panel-session');
    const p = state.programme;

    if (!state.steps.length && !p) {
      host.innerHTML = `<div class="card empty">
        <p>No programme loaded.</p>
        <p><button class="btn btn-primary" type="button" data-goto>Browse the programmes</button></p>
      </div>`;
      $('[data-goto]', host).addEventListener('click', () => showTab('library'));
      return;
    }

    const step = currentStep();
    const total = state.steps.length;
    const pct = total ? Math.round((state.done.size / total) * 100) : 0;

    host.innerHTML = `
      <div class="row spread" style="margin-bottom:16px">
        <button class="btn btn-sm" type="button" id="back-lib">All programmes</button>
        <span class="small muted">
          ${p ? esc(p.title) : 'Custom description'}${state.edited ? ' · edited' : ''}
        </span>
      </div>

      <div class="card" style="margin-bottom:16px">
        <h2>Exercise description</h2>
        <p class="hint">
          Edit this text, or paste in a description of your own. Selecting
          <strong>Convert to steps</strong> rebuilds the step list below from
          whatever is written here.
        </p>
        <textarea id="desc-in" rows="5"></textarea>
        <div class="row mt">
          <button class="btn btn-primary" type="button" id="convert">Convert to steps</button>
          ${p ? '<button class="btn" type="button" id="restore">Restore original</button>' : ''}
          <button class="btn" type="button" id="clear-desc">Clear</button>
          ${p && p.source_url
            ? `<span class="small muted">Source: <a href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_name)}</a></span>`
            : (p ? `<span class="small muted">Source: ${esc(p.source_name)}</span>` : '')}
        </div>
        ${state.convertError ? `<div class="notice mt"><strong>Unable to separate</strong>${esc(state.convertError)}</div>` : ''}
        ${(state.convertWarnings && state.convertWarnings.length)
          ? `<div class="notice mt"><strong>Please review</strong>${state.convertWarnings.map(esc).join('<br>')}</div>` : ''}
        ${(state.convertSafety && state.convertSafety.length)
          ? `<div class="notice alert mt"><strong>Safety notes found in the description</strong>${state.convertSafety.map(esc).join('<br>')}</div>` : ''}
      </div>

      <div class="session">
        <div>
          <div class="card stagewrap">
            <div class="stagehead">
              <span>Step ${step ? step.n : 0} of ${total}</span>
              <span>${p ? esc(p.family) : 'Custom'}</span>
            </div>

            ${step ? Poses.render(step.pose, { title: step.title || step.text }) : ''}

            ${step && step.title ? `<p class="steptitle">${esc(step.title)}</p>` : ''}
            <p class="steptext">${step ? esc(step.text) : 'No steps yet.'}</p>

            <div class="dose${state.running ? ' running' : ''}" id="dosebox">${step ? renderDose(step) : ''}</div>

            <div class="controls">
              <button class="btn" type="button" id="prev" ${state.stepIndex === 0 ? 'disabled' : ''}>Previous</button>
              ${step && step.hold_s > 0
                ? `<button class="btn" type="button" id="play">${state.running ? 'Pause' : (state.remaining ? 'Resume' : 'Start timer')}</button>`
                : ''}
              <button class="btn btn-primary" type="button" id="next" ${total ? '' : 'disabled'}>
                ${state.stepIndex === total - 1 ? 'Finish' : 'Next step'}
              </button>
              <button class="chip" type="button" id="say" aria-pressed="${state.speak}">Read aloud</button>
            </div>
          </div>

          <div class="card">
            <h2>Pose feedback</h2>
            <div class="coach">
              <div class="videowrap" id="videowrap" ${state.coachOn ? '' : 'hidden'}>
                <video id="coach-video" playsinline muted></video>
                <canvas id="coach-canvas"></canvas>
              </div>
              <div id="coach-panel">${renderCoachPanel()}</div>
              <div class="row mt">
                <button class="btn ${state.coachOn ? '' : 'btn-primary'}" type="button" id="coach-toggle">
                  ${state.coachOn ? 'Turn camera off' : 'Turn camera on'}
                </button>
                <span class="small muted">Runs on this device. Nothing is uploaded or recorded.</span>
              </div>
            </div>
          </div>

          ${p ? `<div class="card">
            <div class="notice alert"><strong>Safety</strong>${esc(p.safety)}</div>
          </div>` : ''}
        </div>

        <div>
          <div class="card">
            <h2>Steps</h2>
            <div class="bar"><i style="width:${pct}%"></i></div>
            <ol class="rail">
              ${state.steps.map((s, i) => `
                <li class="${state.done.has(s.n) ? 'done' : ''}${i === state.stepIndex ? ' now' : ''}" data-step="${i}">
                  <span class="rail-n">${state.done.has(s.n) ? '&check;' : s.n}</span>
                  <span>
                    <span class="rail-t">${esc(s.title || s.text)}</span>
                    ${s.title ? `<span class="rail-p">${esc(s.text.length > 74 ? s.text.slice(0, 74) + '…' : s.text)}</span>` : ''}
                    ${doseLine(s) ? `<span class="rail-p"><strong>${doseLine(s)}</strong></span>` : ''}
                  </span>
                </li>`).join('')}
            </ol>
            <div class="row mt">
              <button class="btn btn-sm" type="button" id="reset">Reset progress</button>
            </div>
          </div>

          ${p ? `<div class="card">
            <h2>About this programme</h2>
            <p class="small">${esc(p.goal)}</p>
            <p class="small muted" style="margin-top:10px">
              Position: ${esc(p.position)} &middot; Approx. ${p.duration_min} minutes
            </p>
          </div>` : ''}
        </div>
      </div>`;

    // restore the description text after the re-render
    const box = $('#desc-in');
    if (box) box.value = state.descText != null
      ? state.descText
      : (p ? p.original_description : '');
    if (box) box.addEventListener('input', () => { state.descText = box.value; });

    $('#back-lib').addEventListener('click', () => { stopCoach(); stopTimer(); showTab('library'); });
    $('#convert').addEventListener('click', convertDescription);
    $('#clear-desc').addEventListener('click', () => {
      state.descText = '';
      $('#desc-in').value = '';
      $('#desc-in').focus();
    });
    const restore = $('#restore');
    if (restore) restore.addEventListener('click', () => {
      state.descText = p.original_description;
      state.steps = p.steps.map(s => Object.assign({}, s));
      state.edited = false;
      state.stepIndex = 0;
      state.done = new Set();
      state.convertError = state.convertWarnings = state.convertSafety = null;
      stopTimer();
      renderSession();
    });

    $('#prev').addEventListener('click', prevStep);
    $('#next').addEventListener('click', nextStep);
    $('#reset').addEventListener('click', () => {
      state.done = new Set(); state.stepIndex = 0; state.remaining = 0;
      stopTimer(); renderSession();
    });
    const play = $('#play');
    if (play) play.addEventListener('click', toggleTimer);
    $('#say').addEventListener('click', toggleSpeech);
    $('#coach-toggle').addEventListener('click', toggleCoach);

    $$('[data-step]').forEach(li => li.addEventListener('click', () => {
      state.stepIndex = parseInt(li.dataset.step, 10);
      state.remaining = 0; stopTimer(); renderSession();
    }));

    if (state.coachOn && Coach.running && step) Coach.setPose(step.pose);
    if (state.speak && step) speak((step.title ? step.title + '. ' : '') + step.text);
  }

  function renderDose(step) {
    const cells = [];
    if (step.reps) cells.push(`<div><b>${step.reps}</b><span>Repetitions</span></div>`);
    if (step.hold_s > 0) {
      const shown = (state.running || state.remaining) ? state.remaining : step.hold_s;
      cells.push(`<div aria-live="polite"><b>${formatSeconds(shown)}</b><span>${state.running ? 'Remaining' : 'Hold'}</span></div>`);
    }
    if (!cells.length) cells.push('<div><b>&mdash;</b><span>No set count</span></div>');
    return cells.join('');
  }

  /* ------------------------------------------------------------ pose coach */

  function renderCoachPanel() {
    if (!state.coachOn) {
      return `<p class="small muted">
        Turning the camera on shows your position beside the illustration and
        compares the main joint angles with the target for the current step.
      </p>`;
    }

    const cs = state.coachState;
    if (!cs) return '<p class="small muted">Starting…</p>';

    if (cs.status && cs.status !== 'running') {
      return `<div class="notice"><strong>Camera</strong>${esc(cs.message || 'Not available.')}</div>`;
    }

    const res = cs.result;
    if (!res || !res.ready) {
      return `<p class="small muted">${esc(cs.message || 'Looking for a person in view…')}</p>`;
    }

    return `
      <div class="matchbar">
        <b>${res.score}%</b>
        <span>joints within range</span>
      </div>
      ${cs.message ? `<p class="small muted">${esc(cs.message)}</p>` : ''}
      <ul class="angles">
        ${res.items.map(i => `
          <li class="${i.ok ? 'ok' : (i.near ? 'near' : 'off')}">
            <span class="a-name">${esc(i.label)}</span>
            <span class="a-val">${i.measured}° <span class="muted">/ ${i.target}°</span></span>
            <span class="a-hint">${esc(i.hint)}</span>
          </li>`).join('')}
      </ul>
      <p class="small muted" style="margin-top:10px">
        Angles are compared with the illustrated position and are a guide only.
      </p>`;
  }

  function refreshCoachPanel() {
    const el = $('#coach-panel');
    if (el) el.innerHTML = renderCoachPanel();
  }

  function toggleCoach() {
    if (state.coachOn) { stopCoach(); renderSession(); return; }
    state.coachOn = true;
    state.coachState = { status: 'loading', message: 'Starting…', result: null };
    renderSession();

    const step = currentStep();
    Coach.start($('#coach-video'), $('#coach-canvas'), step ? step.pose : 'stand', update => {
      state.coachState = update;
      refreshCoachPanel();
    }).then(ok => {
      if (!ok) {
        const wrap = $('#videowrap');
        if (wrap) wrap.hidden = true;
      }
    });
  }

  function stopCoach() {
    if (!state.coachOn) return;
    state.coachOn = false;
    state.coachState = null;
    try { Coach.stop(); } catch (e) { /* nothing to stop */ }
  }

  /* ------------------------------------------------------------------ timer */

  function toggleTimer() {
    const step = currentStep();
    if (!step || !step.hold_s) return;
    if (state.running) stopTimer();
    else {
      if (!state.remaining) state.remaining = step.hold_s;
      state.running = true;
      state.ticker = setInterval(tick, 1000);
    }
    refreshDose();
  }

  function stopTimer() {
    state.running = false;
    if (state.ticker) { clearInterval(state.ticker); state.ticker = null; }
  }

  function tick() {
    state.remaining -= 1;
    if (state.remaining <= 0) {
      state.remaining = 0;
      stopTimer();
      refreshDose();
      if (state.speak) speak('Hold complete.');
      return;
    }
    refreshDose();
  }

  function refreshDose() {
    const step = currentStep(), box = $('#dosebox');
    if (box && step) {
      box.innerHTML = renderDose(step);
      box.className = 'dose' + (state.running ? ' running' : '');
    }
    const play = $('#play');
    if (play) play.textContent = state.running ? 'Pause' : (state.remaining ? 'Resume' : 'Start timer');
  }

  /* -------------------------------------------------------------- stepping */

  function nextStep() {
    const step = currentStep();
    if (!step) return;
    state.done.add(step.n);
    stopTimer();
    state.remaining = 0;
    if (state.stepIndex < state.steps.length - 1) state.stepIndex += 1;
    renderSession();
  }

  function prevStep() {
    if (state.stepIndex > 0) state.stepIndex -= 1;
    stopTimer();
    state.remaining = 0;
    renderSession();
  }

  /* ---------------------------------------------------------------- speech */

  function toggleSpeech() {
    state.speak = !state.speak;
    const b = $('#say');
    if (b) b.setAttribute('aria-pressed', String(state.speak));
    if (state.speak) {
      const s = currentStep();
      if (s) speak((s.title ? s.title + '. ' : '') + s.text);
    } else if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  function speak(text) {
    if (!window.speechSynthesis || !state.speak) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.94; u.lang = 'en-GB';
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is optional and must never block the interface */ }
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

  function init() {
    $$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    initToggles();
    renderFilters();
    renderLibrary();
    renderSession();
    showTab('library', { silent: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
