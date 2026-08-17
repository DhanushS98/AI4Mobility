/* =============================================================================
   AI4Mobility — Pose Coach
   -----------------------------------------------------------------------------
   Live pose estimation from the webcam using MediaPipe Pose Landmarker.

   The target joint angles are derived from the SAME hand-authored pose bank the
   stick figures are drawn from (poses.js), so the reference the coach compares
   against is exactly the reference the illustration shows.

   Everything runs on the device. No frame is uploaded anywhere and no recording
   is made — the video element is the only place the image exists.

   Degrades cleanly: if the model cannot be fetched, or the browser has no
   camera, or permission is refused, the coach reports that plainly and the rest
   of the interface continues to work.
   ============================================================================= */

(function (global) {
  'use strict';

  const Poses = global.AI4MPoses;

  // MediaPipe Pose Landmarker indices we use.
  const L = {
    nose: 0,
    shoulderL: 11, shoulderR: 12,
    elbowL: 13, elbowR: 14,
    wristL: 15, wristR: 16,
    hipL: 23, hipR: 24,
    kneeL: 25, kneeR: 26,
    ankleL: 27, ankleR: 28
  };

  const MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

  // Bones to draw on the overlay.
  const DRAW_PAIRS = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28]
  ];

  /* ------------------------------------------------------- angle utilities */

  function angleAt(a, v, b) {
    if (!a || !v || !b) return null;
    const v1x = a.x - v.x, v1y = a.y - v.y;
    const v2x = b.x - v.x, v2y = b.y - v.y;
    const n1 = Math.hypot(v1x, v1y), n2 = Math.hypot(v2x, v2y);
    if (n1 < 1e-6 || n2 < 1e-6) return null;
    let c = (v1x * v2x + v1y * v2y) / (n1 * n2);
    c = Math.max(-1, Math.min(1, c));
    return Math.acos(c) * 180 / Math.PI;
  }

  function mid(p, q) {
    return (p && q) ? { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } : null;
  }

  /* --------------------------------------- target angles from the pose bank */

  // Joints the coach checks, described in terms of the pose-bank joint names.
  const CHECKS = [
    { key: 'elbow', label: 'Elbow',  triple: ['sho', 'elb', 'wri'],  tol: 22 },
    { key: 'knee',  label: 'Knee',   triple: ['hip', 'kne', 'ank'],  tol: 20 },
    { key: 'hip',   label: 'Hip',    triple: ['sho', 'hip', 'kne'],  tol: 22 },
    { key: 'trunk', label: 'Trunk',  triple: ['head', 'sho', 'hip'], tol: 24 }
  ];

  const _targetCache = {};

  function targetAngles(poseKey) {
    if (_targetCache[poseKey]) return _targetCache[poseKey];
    const bank = Poses && Poses._bank ? Poses._bank[poseKey] : null;
    let pose = bank;
    // follow aliases (e.g. flow -> cow)
    let guard = 0;
    while (pose && pose.alias && guard++ < 4) pose = Poses._bank[pose.alias];
    if (!pose || !pose.j) return (_targetCache[poseKey] = null);

    const j = pose.j;
    const pt = name => (j[name] ? { x: j[name][0], y: j[name][1] } : null);

    const out = {};
    CHECKS.forEach(c => {
      const a = pt(c.triple[0]), v = pt(c.triple[1]), b = pt(c.triple[2]);
      const ang = angleAt(a, v, b);
      if (ang != null) out[c.key] = ang;
    });
    return (_targetCache[poseKey] = out);
  }

  /* -------------------------------------- measured angles from the landmarks */

  function measuredAngles(lm) {
    const g = i => (lm[i] && (lm[i].visibility == null || lm[i].visibility > 0.4)) ? lm[i] : null;

    const shoulder = mid(g(L.shoulderL), g(L.shoulderR));
    const hip = mid(g(L.hipL), g(L.hipR));
    const knee = mid(g(L.kneeL), g(L.kneeR));
    const ankle = mid(g(L.ankleL), g(L.ankleR));
    const elbow = g(L.elbowL) || g(L.elbowR);
    const wrist = g(L.wristL) || g(L.wristR);
    const head = g(L.nose);

    const out = {};
    const e = angleAt(shoulder, elbow, wrist);
    if (e != null) out.elbow = e;
    const k = angleAt(hip, knee, ankle);
    if (k != null) out.knee = k;
    const h = angleAt(shoulder, hip, knee);
    if (h != null) out.hip = h;
    const t = angleAt(head, shoulder, hip);
    if (t != null) out.trunk = t;

    // A crude but useful signal: how much of the body is actually visible.
    const seen = [L.shoulderL, L.shoulderR, L.hipL, L.hipR, L.kneeL, L.kneeR]
      .filter(i => g(i)).length;
    out._coverage = seen / 6;
    return out;
  }

  /* ----------------------------------------------------------- the feedback */

  function compare(poseKey, measured) {
    const target = targetAngles(poseKey);
    if (!target || !measured) return { ready: false, items: [], score: null };

    const items = [];
    CHECKS.forEach(c => {
      if (target[c.key] == null || measured[c.key] == null) return;
      const diff = measured[c.key] - target[c.key];
      const off = Math.abs(diff);
      items.push({
        key: c.key,
        label: c.label,
        target: Math.round(target[c.key]),
        measured: Math.round(measured[c.key]),
        diff: Math.round(diff),
        ok: off <= c.tol,
        near: off > c.tol && off <= c.tol * 1.8,
        hint: off <= c.tol
          ? 'Good'
          : (diff > 0 ? 'Try bending a little more' : 'Try straightening a little more')
      });
    });

    const matched = items.filter(i => i.ok).length;
    const score = items.length ? Math.round((matched / items.length) * 100) : null;

    // A single sentence for the main feedback box: praise when everything is in
    // range, otherwise the correction for whichever joint is furthest out.
    let primaryCue;
    if (!items.length) {
      primaryCue = 'Move so more of the body is in view.';
    } else if (matched === items.length) {
      primaryCue = 'That looks right — hold the position steady.';
    } else {
      const worst = items.slice().sort((a, b) =>
        Math.abs(b.diff) - Math.abs(a.diff))[0];
      primaryCue = worst.hint + ' at the ' + worst.label.toLowerCase() + '.';
    }

    return { ready: items.length > 0, items, score, primaryCue };
  }

  /* --------------------------------------------------------------- runtime */

  const coach = {
    supported: typeof navigator !== 'undefined' &&
               !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    running: false,
    landmarker: null,
    stream: null,
    raf: null,
    video: null,
    canvas: null,
    onUpdate: null,
    poseKey: null,
    status: 'idle',
    message: ''
  };

  function setStatus(status, message) {
    coach.status = status;
    coach.message = message || '';
    if (coach.onUpdate) coach.onUpdate({ status, message, result: null });
  }

  async function loadLandmarker() {
    if (coach.landmarker) return coach.landmarker;
    setStatus('loading', 'Loading the pose model…');
    const vision = await import(/* webpackIgnore: true */ VISION_CDN + '/vision_bundle.mjs');
    const fileset = await vision.FilesetResolver.forVisionTasks(VISION_CDN + '/wasm');
    coach.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1
    });
    return coach.landmarker;
  }

  async function start(videoEl, canvasEl, poseKey, onUpdate) {
    coach.video = videoEl;
    coach.canvas = canvasEl;
    coach.poseKey = poseKey;
    coach.onUpdate = onUpdate;

    if (!coach.supported) {
      setStatus('unsupported', 'This browser cannot open a camera.');
      return false;
    }

    try {
      await loadLandmarker();
    } catch (err) {
      setStatus('error', 'The pose model could not be loaded. An internet connection is needed the first time.');
      return false;
    }

    try {
      setStatus('loading', 'Waiting for camera permission…');
      coach.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
    } catch (err) {
      setStatus('denied', 'Camera permission was not given, so the coach cannot run.');
      return false;
    }

    videoEl.srcObject = coach.stream;
    await videoEl.play();

    coach.running = true;
    setStatus('running', '');
    loop();
    return true;
  }

  function stop() {
    coach.running = false;
    if (coach.raf) { cancelAnimationFrame(coach.raf); coach.raf = null; }
    if (coach.stream) {
      coach.stream.getTracks().forEach(t => t.stop());
      coach.stream = null;
    }
    if (coach.video) coach.video.srcObject = null;
    setStatus('idle', '');
  }

  function setPose(poseKey) { coach.poseKey = poseKey; }

  let lastTs = -1;

  function loop() {
    if (!coach.running) return;
    const v = coach.video, c = coach.canvas;

    if (v && v.readyState >= 2 && coach.landmarker) {
      const ts = performance.now();
      if (ts !== lastTs) {
        lastTs = ts;
        let res = null;
        try {
          res = coach.landmarker.detectForVideo(v, ts);
        } catch (e) { /* a dropped frame must not kill the loop */ }

        if (c) {
          const ctx = c.getContext('2d');
          c.width = v.videoWidth || 640;
          c.height = v.videoHeight || 480;
          ctx.clearRect(0, 0, c.width, c.height);

          if (res && res.landmarks && res.landmarks.length) {
            drawSkeleton(ctx, res.landmarks[0], c.width, c.height);
            const measured = measuredAngles(res.landmarks[0]);
            const comparison = compare(coach.poseKey, measured);
            if (coach.onUpdate) {
              coach.onUpdate({
                status: 'running',
                message: measured._coverage < 0.7
                  ? 'Step back so more of the body is in view.'
                  : '',
                result: comparison
              });
            }
          } else if (coach.onUpdate) {
            coach.onUpdate({ status: 'running', message: 'No person detected yet.', result: null });
          }
        }
      }
    }
    coach.raf = requestAnimationFrame(loop);
  }

  function drawSkeleton(ctx, lm, w, h) {
    ctx.save();
    // Mirror, so the picture behaves like a mirror rather than a video of you.
    ctx.translate(w, 0);
    ctx.scale(-1, 1);

    ctx.lineWidth = Math.max(3, w / 160);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1f6f8b';
    DRAW_PAIRS.forEach(([a, b]) => {
      const p = lm[a], q = lm[b];
      if (!p || !q) return;
      if ((p.visibility != null && p.visibility < 0.4) ||
          (q.visibility != null && q.visibility < 0.4)) return;
      ctx.beginPath();
      ctx.moveTo(p.x * w, p.y * h);
      ctx.lineTo(q.x * w, q.y * h);
      ctx.stroke();
    });

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#16202b';
    ctx.lineWidth = Math.max(2, w / 300);
    Object.values(L).forEach(i => {
      const p = lm[i];
      if (!p || (p.visibility != null && p.visibility < 0.4)) return;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, Math.max(3.5, w / 130), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  const api = {
    start, stop, setPose, compare, measuredAngles, targetAngles,
    get running() { return coach.running; },
    get supported() { return coach.supported; },
    get status() { return coach.status; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AI4MCoach = api;

})(typeof window !== 'undefined' ? window : globalThis);
