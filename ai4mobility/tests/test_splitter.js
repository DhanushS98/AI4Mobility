/* Tests for the step splitter. Run with: node tests/test_splitter.js */
const path = require('path');
const S = require(path.join(__dirname, '..', 'platform', 'js', 'splitter.js'));

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); }
}

console.log('\nStep splitter tests\n' + '='.repeat(60));

/* ------------------------------------------------ 1. NHS lower limb prose */
const nhs = "Lay on your back with your leg straight. Point your foot and toes down to the floor or bed, then slowly pull your foot and toes up towards your knee. Repeat 10 times.";
let r = S.splitExerciseText(nhs);
check('NHS prose produces >= 3 steps', r.steps.length >= 3, 'got ' + r.steps.length);
check('NHS prose splits on "then"', r.steps.some(s => /pull your foot/i.test(s.text)));
check('NHS prose extracts reps = 10', r.steps.some(s => s.reps === 10),
      JSON.stringify(r.steps.map(s => s.reps)));
check('NHS prose method is rule-based', r.method === 'rule-based', r.method);

/* ---------------------------------------------------- 2. hold extraction */
r = S.splitExerciseText("Squeeze your bottom firmly together, hold for 5 seconds then relax. Repeat 10 times.");
check('hold_s = 5 extracted', r.steps.some(s => s.hold_s === 5),
      JSON.stringify(r.steps.map(s => s.hold_s)));

r = S.splitExerciseText("Stand on one leg and hold for 5 to 10 seconds.");
check('hold range 5-10 averages to 7 or 8', r.steps.some(s => s.hold_s === 7 || s.hold_s === 8),
      JSON.stringify(r.steps.map(s => s.hold_s)));

/* ------------------------------------------------------ 3. word numerals */
r = S.splitExerciseText("Bend your knee slowly. Repeat ten times.");
check('word numeral "ten" -> 10', r.steps.some(s => s.reps === 10),
      JSON.stringify(r.steps.map(s => s.reps)));

/* -------------------------------------------------- 4. minutes to seconds */
r = S.splitExerciseText("Lay on your tummy with your hips level. Lie for 30 minutes.");
check('30 minutes -> 1800 seconds', r.steps.some(s => s.hold_s === 1800),
      JSON.stringify(r.steps.map(s => s.hold_s)));

/* --------------------------------------------- 5. already-numbered input */
const numbered = "1. Kneel on the floor.\n2. Sit back onto your heels.\n3. Fold forward and rest.\n4. Hold for 20 seconds.";
r = S.splitExerciseText(numbered);
check('numbered list detected', r.method === 'explicit-numbered', r.method);
check('numbered list keeps exactly 4 steps', r.steps.length === 4, 'got ' + r.steps.length);
check('numbered list is not re-split', !r.steps.some(s => s.text.split(/\s+/).length < 3));

/* ---------------------------------------------------- 6. bulleted input */
r = S.splitExerciseText("- Lie on your side.\n- Lift your top knee.\n- Lower it back down.");
check('bulleted list detected', r.method === 'explicit-bulleted', r.method);
check('bulleted list keeps 3 steps', r.steps.length === 3, 'got ' + r.steps.length);

/* ----------------------------------------------- 7. safety is separated */
r = S.splitExerciseText("Bend your knee towards your bottom. Stop if pain becomes worse and seek advice from a healthcare professional.");
check('safety line pulled out of steps', r.safety.length >= 1, JSON.stringify(r.safety));
check('safety line not left in steps', !r.steps.some(s => /seek advice/i.test(s.text)));

/* -------------------------------- 8. does NOT over-split short compounds */
r = S.splitExerciseText("Lift your leg and keep it level.");
check('short "and" compound stays as one step', r.steps.length === 1, 'got ' + r.steps.length);

/* ----------------------------------------------------- 9. guard clauses */
check('empty input rejected', S.splitExerciseText('').ok === false);
check('null input rejected', S.splitExerciseText(null).ok === false);
check('too-short input rejected', S.splitExerciseText('Bend knee').ok === false);

/* ---------------------------------------------- 10. confidence behaviour */
r = S.splitExerciseText(nhs);
check('confidence in [0,1]', r.confidence > 0 && r.confidence <= 1, String(r.confidence));
check('every step carries a confidence', r.steps.every(s => typeof s.confidence === 'number'));

/* ------------------------------------------------- 11. LLM adapter stub */
check('LLM adapter reports unavailable', S.LLMSplitterAdapter.available === false);
S.LLMSplitterAdapter.split().then(v => {
  check('LLM adapter returns null', v === null);

  /* ---------------------------------- 12. async entry falls back to rules */
  return S.splitExercise(nhs);
}).then(res => {
  check('splitExercise falls back to rule-based', res.method === 'rule-based', res.method);

  console.log('='.repeat(60));
  console.log(`  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
});
