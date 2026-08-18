/* =============================================================================
   AI4Mobility — application logic

   Sections: Personalise · Exercise guide · Live pose coach · About
   No framework and no browser storage. The only network request is the pose
   model, fetched the first time the camera is started.
   ============================================================================= */

(function () {
  'use strict';

  const Splitter = window.AI4MSplitter;
  const Poses = window.AI4MPoses;
  const Coach = window.AI4MCoach;
  const DATA = window.AI4M_DATA;

  /* -------------------------------------------------------------- constants */

  // Which "what are you focusing on?" option each programme family belongs to.
  const FAMILY_TO_CONDITION = {
    'Lower limb': 'lower-limb',
    'Core and hips': 'core-hip',
    'Hips and glutes': 'core-hip',
    'Balance': 'balance',
    'Upper limb': 'upper-limb',
    'Stretch and mobility': 'rotation'
  };

  const DIFFICULTY = {
    beginner: { label: 'Beginner',          holdFactor: 0.6, repsDelta: -3 },
    standard: { label: 'Standard',          holdFactor: 1.0, repsDelta: 0 },
    advanced: { label: 'Building strength', holdFactor: 1.5, repsDelta: +3 }
  };

  // Holds longer than this are a resting position rather than a working hold,
  // so difficulty must not scale them (prone lying is 30 minutes).
  const MAX_SCALED_HOLD = 120;

  /* ------------------------------------------------------------------ state */

  const state = {
    condition: 'all',
    difficulty: 'standard',
    selectedId: DATA.programmes[0].id,
    stepIndex: 0,
    steps: [],
    descText: null,
    edited: false,
    done: new Set(),
    message: null,
    safetyFound: null,
    coachRunning: false
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

  /* ------------------------------------------------------------ dosage maths */

  /** Apply the chosen difficulty to one step, keeping the NHS default alongside. */
  function adjust(step) {
    const d = DIFFICULTY[state.difficulty];
    const out = { hold: step.hold_s || 0, reps: step.reps || 0, changed: false };

    if (out.hold > 0 && out.hold <= MAX_SCALED_HOLD && d.holdFactor !== 1) {
      const scaled = Math.max(3, Math.round(out.hold * d.holdFactor));
      if (scaled !== out.hold) { out.hold = scaled; out.changed = true; }
    }
    if (out.reps > 0 && d.repsDelta !== 0) {
      const shifted = Math.max(3, out.reps + d.repsDelta);
      if (shifted !== out.reps) { out.reps = shifted; out.changed = true; }
    }
    return out;
  }

  function doseLine(step) {
    const a = adjust(step);
    const bits = [];
    if (a.reps) bits.push(a.reps + ' reps');
    if (a.hold) bits.push(formatSeconds(a.hold) + ' hold');
    if (!bits.length) return '';
    let line = bits.join(' · ');
    if (a.changed) {
      const orig = [];
      if (step.reps) orig.push(step.reps + ' reps');
      if (step.hold_s) orig.push(formatSeconds(step.hold_s) + ' hold');
      line += ' (NHS default: ' + orig.join(' · ') + ')';
    }
    return line;
  }

  /* ------------------------------------------------------------- programmes */

  function currentProgramme() {
    return DATA.programmes.find(p => p.id === state.selectedId) || DATA.programmes[0];
  }

  function filteredProgrammes() {
    if (state.condition === 'all') return DATA.programmes;
    return DATA.programmes.filter(p => FAMILY_TO_CONDITION[p.family] === state.condition);
  }

  function renderExerciseList() {
    const list = filteredProgrammes();
    const el = $('#exercise-list');

    if (!list.length) {
      el.innerHTML = '<div class="no-match">No exercises match that focus area yet. ' +
                     'Try "Not sure / general mobility" to see the full guide.</div>';
      return;
    }
    if (!list.find(p => p.id === state.selectedId)) {
      selectProgramme(list[0].id, { silent: true });
    }

    el.innerHTML = list.map(p => `
      <button class="exercise-btn${p.id === state.selectedId ? ' active' : ''}" type="button" data-id="${esc(p.id)}">
        <strong>${esc(p.title)}</strong>
        <span>${esc(p.goal)}</span>
      </button>`).join('');

    $$('.exercise-btn', el).forEach(b =>
      b.addEventListener('click', () => selectProgramme(b.dataset.id)));
  }

  function selectProgramme(id, opts) {
    const p = DATA.programmes.find(x => x.id === id);
    if (!p) return;
    state.selectedId = id;
    state.steps = p.steps.map(s => Object.assign({}, s));
    state.descText = p.original_description;
    state.stepIndex = 0;
    state.edited = false;
    state.done = new Set();
    state.message = null;
    state.safetyFound = null;
    if (!(opts && opts.silent)) {
      renderExerciseList();
      renderViewer();
      syncCoachPose();
    }
  }

  /* ---------------------------------------------------- description → steps */

  function convertDescription() {
    const text = $('#desc-text').value;
    state.descText = text;

    Splitter.splitExercise(text).then(res => {
      if (!res.ok) {
        state.message = {
          kind: 'bad',
          title: 'Unable to separate',
          body: res.reason === 'too_short'
            ? 'The description is too short. Please enter at least a full sentence.'
            : res.reason === 'empty'
              ? 'Enter a description first.'
              : 'No steps could be identified in that description.'
        };
        renderViewer();
        return;
      }

      const source = currentProgramme().steps;
      state.steps = res.steps.map((s, i) => {
        // Keep the programme's title and illustration only where the wording is
        // genuinely unchanged; otherwise the picture would describe a movement
        // the edited text no longer asks for.
        const match = source[i];
        const unchanged = match && flatten(match.text) === flatten(s.text);
        return {
          n: s.n,
          title: unchanged ? match.title : null,
          text: s.text,
          hold_s: s.hold_s,
          reps: s.reps,
          pose: unchanged ? match.pose : guessPose(s.text)
        };
      });

      state.edited = flatten(text) !== flatten(currentProgramme().original_description);
      state.stepIndex = 0;
      state.done = new Set();
      state.safetyFound = res.safety && res.safety.length ? res.safety : null;
      state.message = (res.warnings && res.warnings.length)
        ? { kind: 'warn', title: 'Please review', body: res.warnings.join('<br>') }
        : { kind: 'warn', title: 'Steps rebuilt',
            body: res.steps.length + ' step' + (res.steps.length === 1 ? '' : 's') +
                  ' generated from the description above.' };
      renderViewer();
      syncCoachPose();
    });
  }

  function flatten(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /** Choose a plausible illustration for a step that was written by hand. */
  const POSE_HINTS = [
    [/hands? and knees|four ?point|tabletop|table pose/, 'table'],
    [/round your back|round your spine|towards the ceiling.*chin|\bcat\b/, 'cat'],
    [/drop your (tummy|belly)|\bcow\b/, 'cow'],
    [/slide the .*hand between|underneath your body|thread/, 'thread'],
    [/reach the .*hand up|reach.*towards the ceiling/, 'thread_reach'],
    [/kneel/, 'kneel'],
    [/sit back|onto your heels/, 'sit_heels'],
    [/fold forward|lower your chest towards/, 'fold'],
    [/arms out in front|forehead on the mat|forehead rest/, 'arms_long'],
    [/bridge|lift your hips|raising your bottom|roll your bottom/, 'bridge'],
    [/straighten one leg.*hips level|bridge with leg/, 'bridge_leg_lift'],
    [/lift your thigh|thigh off the floor/, 'thigh_lift'],
    [/clam|top knee/, 'clam'],
    [/on your side\b/, 'clam'],
    [/extend one leg straight behind|leg straight behind/, 'quadruped_leg'],
    [/on your (tummy|front)|prone|on your stomach/, 'prone'],
    [/raise your foot towards the ceiling|knee to a right angle/, 'prone_hip_ext'],
    [/dead bug|arms.*straight above.*legs bent/, 'dead_bug'],
    [/out to the side|abduct/, 'hip_abduct'],
    [/heel towards your bottom|bend your knee/, 'knee_bend'],
    [/squeeze your bottom|glute squeeze/, 'supine_glute'],
    [/push your knee down|quadriceps/, 'supine_quad'],
    [/point your foot|toes up towards|ankle flexion/, 'supine_ankle'],
    [/knee (still and )?bent.*(heel|tip ?toes)|soleus/, 'soleus_raise'],
    [/tip ?toes|heel raise|onto your toes|gastrocnemius/, 'heel_raise'],
    [/heel to toe|heel directly in front|tandem/, 'tandem_stand'],
    [/walk in a straight line/, 'heel_toe_walk'],
    [/one leg|single leg|balanc/, 'one_leg'],
    [/lift your hip towards your shoulder|hip hitch/, 'hip_hitch'],
    [/squat|going to sit|tap.*chair/, 'chair_squat'],
    [/step up|foot on it|onto the step/, 'step_up'],
    [/hands flat against a wall|wall push/, 'wall_push'],
    [/prayer/, 'prayer_stretch'],
    [/push the wrist down|push down the wrist/, 'hand_back_stretch'],
    [/holding the palm|bring the wrist back/, 'palm_stretch'],
    [/wrist from side to side|side to side/, 'wrist_side'],
    [/forearm on a table|wrist up and down|wrist flex/, 'wrist_table'],
    [/elbow into your side|palm to face/, 'forearm_twist'],
    [/shoulders? .*(roll|circle)/, 'shoulder_roll'],
    [/above your head|overhead/, 'seated_reach'],
    [/head (gently )?towards one shoulder|neck/, 'neck_stretch'],
    [/turn your shoulders|look behind/, 'seated_twist'],
    [/sit tall|sitting|in a chair/, 'seated'],
    [/lay on your back|lie on your back|on your back/, 'supine_glute'],
    [/stand/, 'stand']
  ];

  function guessPose(text) {
    const low = String(text || '').toLowerCase();
    for (const [re, key] of POSE_HINTS) {
      if (re.test(low) && Poses.has(key)) return key;
    }
    return 'stand';
  }

  /* ----------------------------------------------------------------- viewer */

  function currentStep() {
    return state.steps[state.stepIndex] || null;
  }

  function renderViewer() {
    const p = currentProgramme();
    const step = currentStep();
    const total = state.steps.length;
    const d = DIFFICULTY[state.difficulty];
    const viewer = $('#viewer');

    const tags = [p.family, p.position]
      .concat(p.source_url ? ['NHS referenced'] : ['General practice'])
      .map(t => `<span class="tag">${esc(t)}</span>`).join('') +
      (state.edited ? '<span class="tag edited">Edited description</span>' : '');

    const stepDose = step ? adjust(step) : null;

    viewer.innerHTML = `
      <div class="viewer-head">
        <div>
          <h3>${esc(p.title)}</h3>
          <div class="source">
            ${p.source_url
              ? `${esc(p.source_name.split(' — ')[0])} — <a href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_name.split(' — ')[1] || 'source')}</a>`
              : esc(p.source_name)}
          </div>
          <div class="tag-row">${tags}</div>
        </div>
      </div>

      <div class="dose">
        <div><b>${total}</b> steps</div>
        <div><b>${p.duration_min}</b> min approx.</div>
        <div><b>${esc(d.label)}</b> level</div>
        ${state.difficulty !== 'standard'
          ? '<div class="adjusted">Reps and holds adjusted from the NHS default</div>' : ''}
      </div>

      <div class="desc-panel">
        <h4>Exercise description</h4>
        <p class="hint">
          This is the original wording. Edit it, or paste in a description of
          your own, then select <strong>Convert to steps</strong> to rebuild the
          guide below from whatever is written here.
        </p>
        <textarea id="desc-text" rows="6" aria-label="Exercise description"></textarea>
        <div class="desc-actions">
          <button class="btn-primary" id="convert-btn" type="button">Convert to steps</button>
          <button class="btn-ghost" id="restore-btn" type="button">Restore original</button>
          <button class="btn-ghost" id="clear-btn" type="button">Clear</button>
        </div>
        ${state.message
          ? `<div class="msg ${state.message.kind}"><strong>${esc(state.message.title)}</strong>${state.message.body}</div>`
          : ''}
        ${state.safetyFound
          ? `<div class="msg bad"><strong>Safety notes found in the description</strong>${state.safetyFound.map(esc).join('<br>')}</div>`
          : ''}
      </div>

      ${step ? `
      <div class="step-area">
        <div id="pose-visual">${Poses.render(step.pose, { title: step.title || step.text })}</div>
        <div class="step-copy">
          <div class="step-index">Step ${step.n} of ${total}</div>
          ${step.title ? `<h4>${esc(step.title)}</h4>` : ''}
          <p id="step-text">${esc(step.text)}${
            stepDose.hold ? ` (hold for ${formatSeconds(stepDose.hold)}` +
              (stepDose.reps ? `, ${stepDose.reps} times)` : ')') :
            (stepDose.reps ? ` (repeat ${stepDose.reps} times)` : '')}</p>
          <div class="step-controls">
            <button class="btn-ghost" id="prev-step" type="button" ${state.stepIndex === 0 ? 'disabled' : ''}>← Previous</button>
            <button class="btn-ghost" id="next-step" type="button" ${state.stepIndex === total - 1 ? 'disabled' : ''}>Next →</button>
            <button class="btn-accent" id="speak-step" type="button">Read this step</button>
            <button class="btn-primary" id="speak-all" type="button">Read full guide</button>
            <div class="step-dots">
              ${state.steps.map((s, i) => `<button type="button" class="${i === state.stepIndex ? 'active' : (state.done.has(s.n) ? 'done' : '')}" data-dot="${i}" aria-label="Go to step ${s.n}"></button>`).join('')}
            </div>
          </div>
          <div class="speech-status" id="speech-status"></div>
        </div>
      </div>` : '<p class="no-match">No steps to show — convert a description above.</p>'}

      <div class="all-steps">
        <h4>All steps</h4>
        <ol class="steplist">
          ${state.steps.map((s, i) => `
            <li class="${i === state.stepIndex ? 'active' : ''}${state.done.has(s.n) ? ' done' : ''}" data-step="${i}">
              <span class="sl-n">${state.done.has(s.n) ? '&check;' : s.n}</span>
              <span>
                <span class="sl-t">${esc(s.title || s.text)}</span>
                ${s.title ? `<span class="sl-d">${esc(s.text.length > 90 ? s.text.slice(0, 90) + '…' : s.text)}</span>` : ''}
                ${doseLine(s) ? `<span class="sl-d"><strong>${esc(doseLine(s))}</strong></span>` : ''}
              </span>
            </li>`).join('')}
        </ol>
      </div>

      <div class="safety-note">
        <strong>Safety</strong>
        ${esc(p.safety)}
      </div>`;

    const box = $('#desc-text');
    box.value = state.descText != null ? state.descText : p.original_description;
    box.addEventListener('input', () => { state.descText = box.value; });

    $('#convert-btn').addEventListener('click', convertDescription);
    $('#clear-btn').addEventListener('click', () => {
      state.descText = ''; box.value = ''; box.focus();
    });
    $('#restore-btn').addEventListener('click', () => selectProgramme(p.id));

    if (step) {
      $('#prev-step').addEventListener('click', () => goToStep(state.stepIndex - 1, true));
      $('#next-step').addEventListener('click', () => {
        state.done.add(step.n);
        goToStep(state.stepIndex + 1);
      });
      $('#speak-step').addEventListener('click', () => speak(stepSentence(step)));
      $('#speak-all').addEventListener('click', () => {
        speak(p.title + '. ' + state.steps.map((s, i) =>
          'Step ' + (i + 1) + '. ' + stepSentence(s)).join(' '));
      });
      $$('[data-dot]').forEach(b =>
        b.addEventListener('click', () => goToStep(parseInt(b.dataset.dot, 10))));
    }

    $$('[data-step]').forEach(li =>
      li.addEventListener('click', () => goToStep(parseInt(li.dataset.step, 10))));
  }

  function stepSentence(step) {
    const a = adjust(step);
    let s = (step.title ? step.title + '. ' : '') + step.text;
    if (a.hold) s += ' Hold for ' + formatSeconds(a.hold) + '.';
    if (a.reps) s += ' Repeat ' + a.reps + ' times.';
    return s;
  }

  function goToStep(i) {
    if (i < 0 || i >= state.steps.length) return;
    state.stepIndex = i;
    renderViewer();
    syncCoachPose();
  }

  /* ---------------------------------------------------------------- speech */

  function speak(text) {
    const statusEl = $('#speech-status');
    if (!('speechSynthesis' in window)) {
      if (statusEl) statusEl.textContent = 'Speech playback is not supported in this browser.';
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.lang = 'en-GB';
    if (statusEl) statusEl.textContent = 'Speaking…';
    utter.onend = () => { if (statusEl) statusEl.textContent = 'Finished.'; };
    utter.onerror = () => { if (statusEl) statusEl.textContent = 'Could not play audio.'; };
    window.speechSynthesis.speak(utter);
  }

  /* ------------------------------------------------------------ pose coach */

  function syncCoachPose() {
    const step = currentStep();
    const title = $('#coach-title');
    const target = $('#coach-target');
    if (title) {
      const name = state.edited ? 'Your description' : currentProgramme().title;
      title.textContent = step
        ? (name + ' — ' + (step.title || 'step ' + step.n))
        : 'Pose coach';
    }
    if (target) {
      const t = step ? Coach.targetAngles(step.pose) : null;
      target.textContent = t
        ? 'Target angles for this step: ' + Object.keys(t)
            .map(k => k + ' ' + Math.round(t[k]) + '°').join(', ') + '.'
        : '';
    }
    if (state.coachRunning && step) Coach.setPose(step.pose);
  }

  function renderCoachUpdate(update) {
    const fb = $('#coach-feedback');
    const angles = $('#coach-angles');
    const placeholder = $('#coach-placeholder');

    if (update.status && update.status !== 'running') {
      if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.textContent = update.message || 'Camera not available.';
      }
      if (fb) { fb.className = 'feedback-box warn'; fb.textContent = update.message || 'Camera not available.'; }
      if (angles) angles.innerHTML = '';
      return;
    }

    if (placeholder) placeholder.style.display = 'none';

    const res = update.result;
    if (!res || !res.ready) {
      if (fb) {
        fb.className = 'feedback-box';
        fb.textContent = update.message || 'Move so your shoulders, hips and knees are visible in frame.';
      }
      if (angles) angles.innerHTML = '';
      return;
    }

    if (fb) {
      fb.className = 'feedback-box ' + (res.score >= 75 ? 'good' : (res.score >= 40 ? '' : 'warn'));
      fb.textContent = res.primaryCue + (update.message ? ' ' + update.message : '');
    }
    if (angles) {
      angles.innerHTML = '<ul class="angles">' + res.items.map(i => `
        <li class="${i.ok ? 'ok' : (i.near ? 'near' : 'off')}">
          <span class="a-name">${esc(i.label)}</span>
          <span class="a-val">${i.measured}° <span style="color:var(--ink-soft)">/ ${i.target}°</span></span>
          <span class="a-hint">${esc(i.hint)}</span>
        </li>`).join('') + '</ul>';
    }
  }

  function startCoach() {
    const startBtn = $('#coach-start'), stopBtn = $('#coach-stop');
    const step = currentStep();
    startBtn.disabled = true;
    $('#coach-feedback').textContent = 'Starting…';

    Coach.start($('#coach-video'), $('#coach-canvas'), step ? step.pose : 'stand', renderCoachUpdate)
      .then(ok => {
        state.coachRunning = ok;
        stopBtn.disabled = !ok;
        startBtn.disabled = ok;
      });
  }

  function stopCoach() {
    Coach.stop();
    state.coachRunning = false;
    $('#coach-start').disabled = false;
    $('#coach-stop').disabled = true;
    const placeholder = $('#coach-placeholder');
    if (placeholder) { placeholder.style.display = 'flex'; placeholder.textContent = 'Camera stopped.'; }
    $('#coach-feedback').className = 'feedback-box';
    $('#coach-feedback').textContent = 'Feedback will appear here once the camera is running.';
    $('#coach-angles').innerHTML = '';
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
    $('#hero-pose').innerHTML = Poses.render('bridge', { title: 'Bridge exercise illustration' });

    $('#condition-select').addEventListener('change', e => {
      state.condition = e.target.value;
      renderExerciseList();
      renderViewer();
      syncCoachPose();
    });
    $('#difficulty-select').addEventListener('change', e => {
      state.difficulty = e.target.value;
      renderViewer();
    });

    $('#coach-start').addEventListener('click', startCoach);
    $('#coach-stop').addEventListener('click', stopCoach);

    initToggles();
    selectProgramme(DATA.programmes[0].id, { silent: true });
    renderExerciseList();
    renderViewer();
    syncCoachPose();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
