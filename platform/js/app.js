/* =============================================================================
   AI4Mobility — application logic
   Tabs: Programmes · Current session · Add a programme
   No framework, no network requests, no browser storage. Session state is held
   in memory for the duration of the visit.
   ============================================================================= */

(function () {
  'use strict';

  const Splitter = window.AI4MSplitter;
  const Poses = window.AI4MPoses;
  const DATA = window.AI4M_DATA;

  /* ------------------------------------------------------------------ state */

  const state = {
    tab: 'library',
    filter: 'All',
    programme: null,
    stepIndex: 0,
    running: false,
    remaining: 0,
    ticker: null,
    completed: {},
    speak: false
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

  /* ------------------------------------------------------------------- tabs */

  function showTab(name, opts) {
    state.tab = name;
    $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('.panel').forEach(p => { p.hidden = p.id !== 'panel-' + name; });
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

    host.innerHTML = list.map(p => {
      const done = state.completed[p.id] ? state.completed[p.id].size : 0;
      const total = p.steps.length;
      const preview = Poses.render(p.steps[0].pose, { animate: false, title: '' });
      return `
      <button class="ecard" data-id="${esc(p.id)}" type="button">
        <div class="ecard-fig" aria-hidden="true">${preview}</div>
        <div>
          <h3>${esc(p.title)}</h3>
          <div class="ecard-sub">${esc(p.subtitle)}</div>
        </div>
        <p class="ecard-goal">${esc(p.goal)}</p>
        <div class="ecard-meta">
          <span class="pill">${total} step${total === 1 ? '' : 's'}</span>
          <span class="pill">${p.duration_min} min</span>
          <span class="pill">${esc(p.position)}</span>
          ${p.source_url ? '<span class="pill src">Referenced</span>' : ''}
        </div>
        <div class="row spread">
          ${levelBars(p.difficulty)}
          <span class="small muted">${done ? done + ' of ' + total + ' complete' : ''}</span>
        </div>
      </button>`;
    }).join('');

    $$('.ecard', host).forEach(b => b.addEventListener('click', () => openProgramme(b.dataset.id)));
  }

  /* ---------------------------------------------------------------- session */

  function openProgramme(id) {
    const p = DATA.programmes.find(x => x.id === id);
    if (!p) return;
    state.programme = p;
    state.stepIndex = 0;
    state.remaining = 0;
    stopTimer();
    if (!state.completed[id]) state.completed[id] = new Set();
    renderSession();
    showTab('session');
  }

  function currentStep() {
    return state.programme ? (state.programme.steps[state.stepIndex] || null) : null;
  }

  function renderSession() {
    const p = state.programme;
    const host = $('#panel-session');

    if (!p) {
      host.innerHTML = `<div class="card empty">
        <p>No programme selected.</p>
        <p><button class="btn btn-primary" type="button" data-goto>Browse the programmes</button></p>
      </div>`;
      $('[data-goto]', host).addEventListener('click', () => showTab('library'));
      return;
    }

    const step = currentStep();
    const total = p.steps.length;
    const doneSet = state.completed[p.id];
    const pct = Math.round((doneSet.size / total) * 100);

    host.innerHTML = `
      <div class="row spread" style="margin-bottom:18px">
        <button class="btn btn-sm" type="button" id="back-lib">All programmes</button>
        <span class="small muted">${esc(p.title)} · ${doneSet.size} of ${total} complete</span>
      </div>

      <div class="session">
        <div>
          <div class="card stagewrap">
            <div class="stagehead">
              <span>Step ${step.n} of ${total}</span>
              <span>${esc(p.family)}</span>
            </div>

            ${Poses.render(step.pose, { title: step.title || step.text })}

            <p class="steptitle">${esc(step.title || ('Step ' + step.n))}</p>
            <p class="steptext">${esc(step.text)}</p>

            <div class="dose${state.running ? ' running' : ''}" id="dosebox">${renderDose(step)}</div>

            <div class="controls">
              <button class="btn" type="button" id="prev" ${state.stepIndex === 0 ? 'disabled' : ''}>Previous</button>
              ${step.hold_s > 0
                ? `<button class="btn" type="button" id="play">${state.running ? 'Pause' : (state.remaining ? 'Resume' : 'Start timer')}</button>`
                : ''}
              <button class="btn btn-primary" type="button" id="next">
                ${state.stepIndex === total - 1 ? 'Complete programme' : 'Next step'}
              </button>
              <button class="chip" type="button" id="say" aria-pressed="${state.speak}">Read aloud</button>
            </div>
          </div>

          <div class="card">
            <h2>Original description</h2>
            <div class="orig">
              <p>${esc(p.original_description)}</p>
              <div class="src">
                ${p.source_url
                  ? `Source: <a href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_name)}</a>`
                  : `Source: ${esc(p.source_name)}`}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="notice alert">
              <strong>Safety</strong>
              ${esc(p.safety)}
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <h2>Programme steps</h2>
            <div class="bar"><i style="width:${pct}%"></i></div>
            <ol class="rail">
              ${p.steps.map((s, i) => `
                <li class="${doneSet.has(s.n) ? 'done' : ''}${i === state.stepIndex ? ' now' : ''}">
                  <span class="rail-n">${doneSet.has(s.n) ? '&check;' : s.n}</span>
                  <span>
                    <span class="rail-t">${esc(s.title || s.text.slice(0, 58))}</span>
                    <span class="rail-p">${doseLine(s) || '&nbsp;'}</span>
                  </span>
                </li>`).join('')}
            </ol>
            <div class="row mt">
              <button class="btn btn-sm" type="button" id="reset">Reset progress</button>
            </div>
          </div>

          <div class="card">
            <h2>About this programme</h2>
            <p class="small">${esc(p.goal)}</p>
            <p class="small muted" style="margin-top:10px">
              Position: ${esc(p.position)} &middot; Approx. ${p.duration_min} minutes
            </p>
          </div>
        </div>
      </div>`;

    $('#back-lib').addEventListener('click', () => { stopTimer(); showTab('library'); });
    $('#prev').addEventListener('click', prevStep);
    $('#next').addEventListener('click', nextStep);
    $('#reset').addEventListener('click', () => {
      state.completed[p.id] = new Set();
      state.stepIndex = 0; state.remaining = 0; stopTimer(); renderSession();
    });
    const play = $('#play');
    if (play) play.addEventListener('click', toggleTimer);
    $('#say').addEventListener('click', toggleSpeech);

    if (state.speak) speak((step.title ? step.title + '. ' : '') + step.text);
  }

  function doseLine(s) {
    const bits = [];
    if (s.reps) bits.push(s.reps + ' repetitions');
    if (s.hold_s) bits.push(formatSeconds(s.hold_s) + ' hold');
    return bits.join(' · ');
  }

  function renderDose(step) {
    const cells = [];
    if (step.reps) {
      cells.push(`<div><b>${step.reps}</b><span>Repetitions</span></div>`);
    }
    if (step.hold_s > 0) {
      const shown = (state.running || state.remaining) ? state.remaining : step.hold_s;
      cells.push(`<div aria-live="polite"><b>${formatSeconds(shown)}</b><span>${state.running ? 'Remaining' : 'Hold'}</span></div>`);
    }
    if (!cells.length) {
      cells.push('<div><b>&mdash;</b><span>No set count</span></div>');
    }
    return cells.join('');
  }

  /* ------------------------------------------------------------------ timer */

  function toggleTimer() {
    const step = currentStep();
    if (!step || !step.hold_s) return;
    if (state.running) {
      stopTimer();
    } else {
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
    const step = currentStep();
    const box = $('#dosebox');
    if (box && step) {
      box.innerHTML = renderDose(step);
      box.className = 'dose' + (state.running ? ' running' : '');
    }
    const play = $('#play');
    if (play) play.textContent = state.running ? 'Pause' : (state.remaining ? 'Resume' : 'Start timer');
  }

  /* -------------------------------------------------------------- stepping */

  function nextStep() {
    const p = state.programme, step = currentStep();
    if (!p || !step) return;
    state.completed[p.id].add(step.n);
    stopTimer();
    state.remaining = 0;
    if (state.stepIndex < p.steps.length - 1) state.stepIndex += 1;
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

  /* --------------------------------------------------------------- builder */

  function renderBuilderResult(res) {
    const host = $('#builder-out');

    if (!res) {
      host.innerHTML = '<div class="empty">Enter a description on the left, then select ' +
                       '<strong>Separate into steps</strong>.</div>';
      return;
    }

    if (!res.ok) {
      const why = res.reason === 'too_short'
        ? 'The description is too short to separate. Please enter at least a full sentence.'
        : res.reason === 'empty'
          ? 'Nothing has been entered yet.'
          : 'No steps could be identified in that description.';
      host.innerHTML = `<div class="notice"><strong>Unable to separate</strong>${esc(why)}</div>`;
      return;
    }

    host.innerHTML = `
      <h2>${res.steps.length} step${res.steps.length === 1 ? '' : 's'}</h2>
      <ol class="rail">
        ${res.steps.map(s => `
          <li>
            <span class="rail-n">${s.n}</span>
            <span>
              <span class="rail-t">${esc(s.text)}</span>
              ${doseLine(s) ? `<span class="rail-p">${doseLine(s)}</span>` : ''}
            </span>
          </li>`).join('')}
      </ol>

      ${res.safety.length ? `<div class="notice alert mt"><strong>Safety notes identified</strong>
        ${res.safety.map(s => esc(s)).join('<br>')}</div>` : ''}

      ${res.warnings && res.warnings.length ? `<div class="notice mt"><strong>Please review</strong>
        ${res.warnings.map(w => esc(w)).join('<br>')}</div>` : ''}`;
  }

  function runSplit() {
    Splitter.splitExercise($('#builder-in').value).then(renderBuilderResult);
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
    $('#split-btn').addEventListener('click', runSplit);
    $('#clear-btn').addEventListener('click', () => {
      $('#builder-in').value = '';
      renderBuilderResult(null);
      $('#builder-in').focus();
    });
    $$('[data-sample]').forEach(b => b.addEventListener('click', () => {
      $('#builder-in').value = b.dataset.sample;
      runSplit();
    }));

    initToggles();
    renderFilters();
    renderLibrary();
    renderSession();
    renderBuilderResult(null);
    showTab('library', { silent: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
