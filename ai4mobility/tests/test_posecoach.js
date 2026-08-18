/* Tests for the pose coach's angle maths. Run: node tests/test_posecoach.js */
const path = require('path');
const root = path.join(__dirname, '..', 'platform', 'js');

// posecoach.js reads window.AI4MPoses, so load the pose bank onto a shared global first.
global.window = global;
require(path.join(root, 'poses.js'));
const Coach = require(path.join(root, 'posecoach.js'));

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); }
}

console.log('\nPose coach tests\n' + '='.repeat(60));

/* --------------------------------------- target angles from the pose bank */

const stand = Coach.targetAngles('stand');
check('target angles derived for "stand"', stand && Object.keys(stand).length >= 3, stand);
check('standing knee is close to straight', stand.knee > 150, stand.knee);

const bridge = Coach.targetAngles('bridge');
check('target angles derived for "bridge"', bridge && bridge.knee != null, bridge);
check('bridge knee is more bent than standing', bridge.knee < stand.knee,
      { bridge: bridge.knee, stand: stand.knee });

const table = Coach.targetAngles('table');
check('four point kneeling hip is near a right angle',
      table.hip > 55 && table.hip < 125, table.hip);

check('an unknown pose key returns null', Coach.targetAngles('not_a_pose') === null);

// aliased poses must resolve to their target
const flow = Coach.targetAngles('flow');
const cow = Coach.targetAngles('cow');
check('aliased pose "flow" resolves to "cow"',
      JSON.stringify(flow) === JSON.stringify(cow), { flow, cow });

/* ------------------------------------------ measured angles from landmarks */

// A synthetic upright figure in MediaPipe's normalised coordinate space.
function upright() {
  const lm = [];
  for (let i = 0; i < 33; i++) lm[i] = { x: 0.5, y: 0.5, visibility: 0.0 };
  const set = (i, x, y) => { lm[i] = { x, y, visibility: 0.95 }; };
  set(0,  0.50, 0.10);   // nose
  set(11, 0.45, 0.25); set(12, 0.55, 0.25);   // shoulders
  set(13, 0.44, 0.42); set(14, 0.56, 0.42);   // elbows
  set(15, 0.43, 0.58); set(16, 0.57, 0.58);   // wrists
  set(23, 0.47, 0.55); set(24, 0.53, 0.55);   // hips
  set(25, 0.47, 0.75); set(26, 0.53, 0.75);   // knees
  set(27, 0.47, 0.95); set(28, 0.53, 0.95);   // ankles
  return lm;
}

const m = Coach.measuredAngles(upright());
check('measured angles produced', m && m.knee != null && m.hip != null, m);
check('upright knee reads near straight', m.knee > 165, m.knee);
check('upright hip reads near straight', m.hip > 165, m.hip);
check('coverage is complete for a fully visible figure', m._coverage === 1, m._coverage);

// Hide the legs; coverage must drop and the knee angle must disappear.
const partial = upright();
[25, 26, 27, 28].forEach(i => { partial[i].visibility = 0.05; });
const mp = Coach.measuredAngles(partial);
check('hidden legs lower the coverage score', mp._coverage < 1, mp._coverage);
check('hidden legs remove the knee angle', mp.knee === undefined, mp.knee);

/* ------------------------------------------------------------- comparison */

const cmp = Coach.compare('stand', m);
check('comparison is ready', cmp.ready === true);
check('comparison scores an upright figure against "stand" highly',
      cmp.score >= 50, cmp.score);
check('every item carries a target and a measurement',
      cmp.items.every(i => typeof i.target === 'number' && typeof i.measured === 'number'));
check('every item carries a hint', cmp.items.every(i => typeof i.hint === 'string' && i.hint.length));

const cmpBridge = Coach.compare('bridge', m);
check('an upright figure scores lower against "bridge" than against "stand"',
      cmpBridge.score < cmp.score, { bridge: cmpBridge.score, stand: cmp.score });

check('comparison against an unknown pose is not ready',
      Coach.compare('not_a_pose', m).ready === false);
check('comparison with no measurement is not ready',
      Coach.compare('stand', null).ready === false);

/* ------------------------------------------------------- graceful degrade */

check('coach reports camera support as a boolean', typeof Coach.supported === 'boolean');
check('coach is not running before start', Coach.running === false);

/* ------------------------------------------------------------ primary cue */

check('a matching pose produces an encouraging cue',
      /hold the position/i.test(Coach.compare('stand', m).primaryCue),
      Coach.compare('stand', m).primaryCue);
check('a mismatched pose produces a correction naming a joint',
      /(bending|straightening)/i.test(cmpBridge.primaryCue), cmpBridge.primaryCue);
check('the cue names the joint that is furthest out',
      /elbow|knee|hip|trunk/i.test(cmpBridge.primaryCue), cmpBridge.primaryCue);

console.log('='.repeat(60));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
