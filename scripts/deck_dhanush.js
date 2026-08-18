'use strict';
/* AI4Mobility — individual deck: Dhanush Sanjay
   Research and documentation lead. 22 slides, notes on every slide. */

const K = require('./deckkit');

const MEMBER = 'Dhanush Sanjay';
const ROLE = 'Research and documentation lead';
const OUT = '/home/claude/repo/ai4mobility/docs/presentations/AI4Mobility_Deck_Dhanush.pptx';

const pres = K.makeDeck({ member: MEMBER, role: ROLE, deckTitle: 'AI4Mobility — research, sources and honest reporting' });

/* 1 — title */
K.titleSlide(pres, {
  title: 'AI4Mobility',
  standfirst: 'A multimodal assistive platform for parents supporting children with mobility difficulties. This deck covers the problem, the sources, the step splitter, the ethics and the honest register of what is not built.',
  member: MEMBER,
  role: ROLE,
  meta: K.META,
  note: 'Introduce yourself and say that this deck holds the parts of the project that are about evidence and honesty rather than code. State the two claims the deck settles immediately: the step splitter is rule-based rather than a language model, and no child was recorded. Say that the register of unbuilt work is a slide in this deck rather than a footnote in the report.',
});

/* 2 — agenda */
K.bulletSlide(pres, {
  kicker: 'Agenda',
  title: 'What this deck covers',
  subtitle: 'Background, method, evidence, and a register of what has not been built.',
  items: [
    { h: 'Problem and background', t: 'Why parents need this, and where the ten exercise programmes come from.' },
    { h: 'The step splitter', t: 'A seven-stage rule-based pipeline — not a language model — and how well it does.' },
    { h: 'Evidence and ethics', t: 'Synthetic data, the results it supports, and why no children were recorded.' },
    { h: 'The honest register', t: 'Built, partly built and not built, each with a stated next step.' },
  ],
  note: 'Set out the four sections and say that the register at the end is the part the supervisor asked for directly. Mention that every claim in the deck is traceable either to a published NHS source or to a figure in the report. Say the deck deliberately spends as much time on what is missing as on what works.',
});

/* 3 — team */
K.teamSlide(pres, {
  members: K.TEAM,
  highlight: MEMBER,
  subtitle: 'Four members, four defined responsibilities. This deck presents the research and documentation work.',
  note: 'Introduce the team and say what you owned: sourcing the exercise content, documenting the method, the ethics position and the honest register. Explain that documentation work here meant checking claims against the code rather than describing intentions. The peer contribution split shown here is the one agreed for the individual reports.',
});

/* 4 — section 1 */
K.sectionSlide(pres, {
  number: '01',
  title: 'Problem and background',
  summary: 'Home physiotherapy arrives as continuous prose. A parent has to turn it into a sequence of correctly performed movements, unsupervised.',
  note: 'Set the scene without dramatising it: this is a translation problem, not a diagnosis problem. Say that the NHS guidance is thorough and that the difficulty is in its form rather than its content. The platform intervenes at exactly that translation step.',
});

/* 5 — the problem */
K.bulletSlide(pres, {
  kicker: 'The problem',
  title: 'From prose to practice, at home, every day',
  items: [
    { h: 'Who this is for', t: 'Children with cerebral palsy, developmental delay, or recovering from injury, who are prescribed home physiotherapy.' },
    { h: 'What the parent receives', t: 'Thorough but text-heavy guidance: continuous prose describing a whole set of exercises.' },
    { h: 'What the parent has to do with it', t: 'Translate it into a sequence of correctly performed movements, unsupervised, often daily.' },
    { h: 'Where the platform intervenes', t: 'At the translation step: steps, a picture per step, adjustable repetitions and holds, and read-aloud support.' },
    { h: 'What it deliberately does not do', t: 'It does not diagnose, prescribe or replace a physiotherapist, and the source text stays visible throughout.' },
  ],
  note: 'Describe the parent\'s task concretely, because it is the whole justification for the project. Emphasise that the source text is never hidden — the original description is always shown alongside the generated steps. State the boundary clearly: no diagnosis, no prescription, no replacement of clinical contact.',
});

/* 6 — what was built */
K.twoColSlide(pres, {
  kicker: 'What was built',
  title: 'A single self-contained page, with no backend at all',
  subtitle: 'No server, no accounts, no storage, no tracking. The privacy position is a consequence of the architecture.',
  left: {
    title: 'What the platform offers',
    items: [
      'Ten exercise programmes with the original source description always displayed.',
      'An editable description box: Convert to steps rebuilds the step list from any text.',
      'Personalisation by focus area, with difficulty scaling repetitions and holds.',
      'Read this step and Read full guide, using the browser speech interface.',
      'Accessibility: larger text, high contrast, reduced motion, keyboard navigation and ARIA labelling.',
    ],
  },
  right: {
    title: 'What that architecture means',
    items: [
      'Nothing a family types or performs leaves their device.',
      'There is no account to create and no history to leak.',
      'The pose coach runs on-device, so no video is uploaded or recorded.',
      'The trade-off is real: no saved progress and no therapist dashboard.',
    ],
  },
  note: 'Describe the platform in one pass, then make the architectural point: the privacy properties come from having no backend rather than from a policy document. Note that resting positions such as the thirty-minute prone lie are never scaled by the difficulty setting, because scaling a rest is not meaningful. Be honest about the cost of that choice — no saved history and no therapist view.',
});

/* 7 — programmes table */
K.tableSlide(pres, {
  kicker: 'Provenance',
  title: 'Ten programmes, and where each one comes from',
  subtitle: 'Five are sourced from published NHS leaflets. The rest are labelled as general practice.',
  headers: ['Programme', 'Steps', 'Source'],
  rows: [
    ['Lower Limb Exercises', '6', 'Sheffield Children\'s NHS — General lower limb exercises'],
    ['Core and Hip Stability', '7', 'Sheffield Children\'s NHS — Core and hip stability exercises'],
    ['Glute Strengthening', '6', 'Sheffield Children\'s NHS — Glute strengthening'],
    ['Calf Control', '2', 'Sheffield Children\'s NHS — Calf control exercises'],
    ['Wrist and Hand Exercises', '7', 'Sheffield Children\'s NHS — Wrist exercises'],
    ['Thread the Needle', '7', 'Yoga Basics — Threading the Needle'],
    ['Child\'s Pose', '6', 'General practice (labelled as such)'],
    ['Cat–Cow Stretch', '4', 'General practice (labelled as such)'],
    ['Standing Balance', '4', 'General practice (labelled as such)'],
    ['Seated Upper Body', '5', 'General practice (labelled as such)'],
  ],
  colW: [4.1, 1.0, 6.99],
  align: ['left', 'center', 'left'],
  fontSize: 11,
  caption: 'Source URLs are listed in the report and in the About and sources section of the platform itself.',
  note: 'Explain the provenance rule: an exercise either cites a published leaflet or is labelled as general practice, with nothing in between. Point out that the four general-practice programmes are marked in the interface as well as in the report, so a parent can see the difference. Say that the source text is stored verbatim and shown alongside the generated steps, which was a direct response to supervisor feedback.',
});

/* 8 — section 2 */
K.sectionSlide(pres, {
  number: '02',
  title: 'The step splitter',
  summary: 'A rule-based linguistic pipeline that turns a description into steps. No model weights, no network call.',
  note: 'Introduce the splitter as the component that does the translation the parent would otherwise do by hand. Say the answer to the obvious question first: it is not a language model. The rest of the section explains how it works and how well it does.',
});

/* 9 — not an LLM */
K.twoColSlide(pres, {
  kicker: 'Answering the question directly',
  title: 'The splitter is NOT a language model',
  subtitle: 'The supervisor asked whether an LLM splits the exercises into steps. It does not, and the report says so explicitly.',
  left: {
    title: 'What it is',
    items: [
      'A rule-based linguistic splitter, implemented in JavaScript for the platform and mirrored in Python for the notebook.',
      'No model weights are loaded and no network call is made.',
      'Deterministic and inspectable: the same text always produces the same steps.',
      'Verified by 24 JavaScript splitter tests and 41 Python checks including full parity between the two implementations.',
    ],
  },
  right: {
    title: 'What the adapter seam is',
    fill: K.C.tintAccent,
    lineColour: 'F0C9B6',
    items: [
      'An LLMSplitterAdapter exists in both implementations and returns null.',
      'It is not connected to any model or provider.',
      'It is a seam for future work, not a hidden feature.',
      'The rule engine is the only thing that has ever produced a step in this project.',
    ],
  },
  note: 'Answer the supervisor\'s question in one sentence and then evidence it: no weights, no network call, deterministic output, and a parity test suite across two implementations. Be explicit that the adapter seam returns null, because a reader who finds the class name in the code deserves that explanation up front. Mention that 90 tests pass in total across the splitter, the pose coach and the Python pipeline.',
});

/* 10 — seven stages */
K.bulletSlide(pres, {
  kicker: 'Method',
  title: 'A seven-stage rule-based pipeline',
  style: 'dot',
  items: [
    { h: '1. Normalise, then 2. detect existing structure', t: 'Numbered or bulleted lists are preserved and never re-split, because the author already did the splitting.' },
    { h: '3. Segment into sentences', t: 'With abbreviation and decimal protection, so "approx." and "1.5" do not end a sentence.' },
    { h: '4. Split on connectives', t: 'On then, next, after that and semicolons — but only when both halves read as instructions.' },
    { h: '5. Classify each fragment', t: 'As action, position, hold, reps, safety or context. Safety sentences are separated and never shown as steps to perform.' },
    { h: '6. Extract holds and repetitions', t: 'Including word numerals such as "ten times" and ranges such as "5 to 10 seconds", which becomes an 8 second hold.' },
    { h: '7. Score confidence per step', t: 'Low-confidence context fragments are dropped, and the mean confidence is reported in the interface.' },
  ],
  note: 'Walk the stages in order and highlight the two that do the most work: preserving existing structure, and only splitting on a connective when both halves are genuinely instructions. Explain the safety classification, because separating a warning from a step is a safety property rather than a formatting choice. Say that the same seven stages exist in both the JavaScript and the Python implementations and are tested for parity.',
});

/* 11 — splitter evaluation */
K.figureSlide(pres, {
  kicker: 'Figure 11',
  title: 'How well the splitter does, stated plainly',
  image: K.FIG('f11_splitter.png'),
  caption: 'Figure 11 — splitter output against reviewed step counts for the ten programmes.',
  sideTitle: 'The honest result',
  side: [
    'Exact match with the reviewed step list on 2 of 10 programmes.',
    'Mean confidence across all programmes is 0.78.',
    'Mismatches are on multi-exercise NHS leaflets, where one reviewed step covers a whole sub-exercise.',
    'The splitter produces more steps in those cases, not different instructions.',
  ],
  callout: {
    tone: 'accent',
    h: 1.05,
    label: 'Shown, not hidden',
    text: 'The interface displays the confidence and the original source text alongside the steps, so a parent can always see and check what was split.',
  },
  note: 'Give the result without softening it: two exact matches out of ten. Then explain the disagreement, which is a difference in granularity rather than a difference in content — the leaflets cover several sub-exercises and a reviewed step often covers a whole one. Finish on the design response: the confidence score and the original text are shown in the interface rather than hidden behind a clean-looking list.',
});

/* 12 — LLM seam requirements */
K.bulletSlide(pres, {
  kicker: 'Future work',
  title: 'What connecting a language model would require',
  subtitle: 'Four things, none of them optional, before the adapter could be switched on.',
  items: [
    { h: 'A server-side proxy holding the API key', t: 'The platform is a static page, so a key cannot live in the client. That means a backend, which the project deliberately does not have today.' },
    { h: 'A schema-constrained prompt and JSON validation', t: 'With the rule engine kept as the fallback whenever validation fails.' },
    { h: 'Rate limiting', t: 'A public page calling a paid model needs a limit before it is exposed to anyone.' },
    { h: 'A clinical safety review', t: 'A model can invent an instruction that was not in the source text. For physiotherapy instructions given to a child, that is the risk that matters.' },
  ],
  callout: {
    label: 'Status',
    tone: 'primary',
    h: 0.86,
    text: 'LLM-based step splitting is recorded as NOT built. The seam exists, the requirements are documented, and nothing in the platform pretends otherwise.',
  },
  note: 'Present these as a specification rather than a wish list, because the supervisor asked for a clear next step for anything unimplemented. The clinical safety review is the requirement that dominates: a fabricated instruction is a safety failure, not a quality failure. Say that keeping the rule engine as a fallback is what would make the feature safe to attempt at all.',
});

/* 13 — section 3 */
K.sectionSlide(pres, {
  number: '03',
  title: 'Evidence, ethics and honesty',
  summary: 'What the numbers rest on, why no children were recorded, and a register of everything that is not built.',
  note: 'Introduce the final section as the evidence audit. Say that it covers the data the classifier was trained on, the ethics position behind it, and the register of unbuilt work. This is the section that answers the supervisor\'s request for an honest description.',
});

/* 14 — synthetic */
K.twoColSlide(pres, {
  kicker: 'Honest statement',
  title: 'The dataset is synthetic',
  subtitle: 'Seeded, reproducible, and derived from published exercise descriptions — but not recorded video of children.',
  left: {
    title: 'What it licenses us to claim',
    items: [
      'The pipeline is complete, runs end to end, and reproduces exactly under random_state=42.',
      'The classes were constructed from published NHS descriptions, so they differ as the real exercises differ.',
      'The evaluation protocol is sound and would transfer unchanged to recorded data.',
      'The project can describe precisely what it would do with real data.',
    ],
  },
  right: {
    title: 'What it does not license',
    fill: K.C.tintAccent,
    lineColour: 'F0C9B6',
    items: [
      'No claim about accuracy on real children performing real physiotherapy.',
      'No clinical claim, and no claim of readiness for clinical use.',
      'No claim that the platform improves adherence, technique or outcomes.',
      'No comparison against published results on recorded datasets.',
    ],
  },
  note: 'Say the sentence plainly and early: the dataset is synthetic and no child was recorded. Explain that the generator is seeded and derived from published descriptions, which makes it reproducible and defensible, but not evidence about children. Then give the list of claims the project refuses to make, because the refusals are the useful part.',
});

/* 15 — cleaning figure */
K.figureSlide(pres, {
  kicker: 'Figure 3',
  title: 'The evidence trail: every removal is counted',
  image: K.FIG('f03_cleaning.png'),
  caption: 'Figure 3 — 11.3% of raw frames removed, broken down by reason.',
  sideTitle: 'Why this belongs in a documentation deck',
  side: [
    '1,358 raw frames, 153 removed, 1,205 usable.',
    'Every removal is attributed to one of four stated rules.',
    'No landmark is imputed, because occlusion is pose-dependent and filling would manufacture samples for the hardest classes.',
    'A reader can reconstruct the dataset from the report without reading the code.',
  ],
  note: 'Explain why a documentation lead cares about this figure: it is the difference between a reported number and an auditable one. Give the three counts and note that the removals are dominated by frames missing a critical joint. Say that the decision not to impute is recorded with its reasoning, so a reviewer can disagree with it explicitly rather than discover it by accident.',
});

/* 16 — results */
K.tableSlide(pres, {
  kicker: 'Results',
  title: 'The classifier results, in full',
  subtitle: 'Three model families, identical data and identical splits. Measured on synthetic data.',
  headers: K.MODEL_TABLE.headers,
  rows: K.MODEL_TABLE.rows,
  colW: K.MODEL_TABLE.colW,
  highlight: K.MODEL_TABLE.highlight,
  caption: 'Cross-validation is five-fold on the training partition only. The test set was scored once, after all model selection was complete.',
  callout: {
    label: 'How to quote these numbers',
    tone: 'primary',
    h: 0.9,
    text: 'Random Forest is the best model at 0.928 accuracy and 0.935 macro F1, with the smallest generalisation gap at +0.037. Every quotation of these figures must carry the phrase "measured on synthetic data".',
  },
  note: 'Present the table as the reference version of the numbers, since this deck is the documentation view. Point out the generalisation gap column as the reason the Random Forest was selected rather than the accuracy column. Insist on the wording rule: these numbers are always quoted with the synthetic-data qualifier attached.',
});

/* 17 — pose coach figure */
K.figureSlide(pres, {
  kicker: 'Figure 12',
  title: 'The pose coach, and the limit of its authority',
  image: K.FIG('f12_coach_targets.png'),
  caption: 'Figure 12 — target joint angles per pose family, derived from the hand-authored pose bank.',
  sideTitle: 'What is and is not established',
  side: [
    'Targets are derived from the same hand-authored pose bank the illustrations are drawn from.',
    'Four joints are checked: elbow, knee, hip and trunk.',
    'Tolerances of 20 to 24 degrees are engineering judgement, not clinical thresholds.',
    'The coach runs on-device and degrades cleanly if there is no camera, no permission, or no model.',
  ],
  callout: {
    tone: 'accent',
    h: 1.05,
    label: 'Recorded as not validated',
    text: 'Pose coach calibration is listed as NOT VALIDATED. No physiotherapist has reviewed the tolerances or the pose bank they come from.',
  },
  note: 'Explain that the coach is consistent by construction — it checks the position the picture shows — and that consistency is not the same as clinical correctness. Give the tolerance range and immediately classify it as engineering judgement. Note that the graceful degradation behaviour is covered by the pose-coach tests, so the failure paths are tested even though the thresholds are unvalidated.',
});

/* 18 — ethics */
K.bulletSlide(pres, {
  kicker: 'Ethics and safeguarding',
  title: 'Why no children were recorded',
  items: [
    { h: 'Recording children requires approval this project does not have', t: 'Ethical approval, parental consent and safeguarding arrangements would all be needed before a single frame could be captured.' },
    { h: 'A synthetic generator was the honest alternative', t: 'It allows the whole pipeline to be built and tested without asking a child to be filmed for a taught project.' },
    { h: 'The platform stores nothing', t: 'No server, no accounts, no storage, no tracking. Nothing a family types or performs leaves the device.' },
    { h: 'The pose coach never uploads a frame', t: 'Pose estimation runs on-device, and the video element is the only place the image exists.' },
    { h: 'The interface stays inside its competence', t: 'Safety sentences are separated from steps, the source text is always shown, and the platform does not diagnose or prescribe.' },
  ],
  note: 'Give the reasoning in the order a reviewer would ask for it: what would have been required, what we did instead, and what the platform does with data today. Emphasise that the privacy properties are architectural — there is no backend that could store anything. Close on the safety design: warnings are never presented as exercises to perform.',
});

/* 19 — honest register */
K.tableSlide(pres, {
  kicker: 'The honest register',
  title: 'What is not built, and what the next step would be',
  subtitle: 'Requested by the supervisor, and reproduced in the report as its own section.',
  headers: ['Item', 'Status', 'Next step'],
  rows: [
    ['LLM-based step splitting', 'NOT built', 'Server-side key, schema validation, rate limiting, clinical safety review'],
    ['Real recorded dataset', 'NOT obtained', 'Ethical approval, consent and safeguarding, then record a small consented set'],
    ['Temporal / sequence modelling', 'NOT built', 'Add sliding-window features and re-run the same model comparison'],
    ['Clinical validation', 'NOT done', 'Physiotherapist review of step lists, illustrations and coach tolerances'],
    ['User evaluation', 'NOT done', 'Evaluate with families: is the exercise done, and done correctly'],
    ['Accounts, history, therapist view', 'NOT built', 'Requires a backend, which brings data protection obligations with it'],
    ['Generative illustrations', 'NOT built', '46 hand-authored poses stand in for a generative vision model'],
    ['Pose coach calibration', 'NOT validated', '20 to 24 degree tolerances are engineering judgement, not clinical thresholds'],
  ],
  colW: [3.5, 1.9, 6.69],
  align: ['left', 'center', 'left'],
  fontSize: 11,
  note: 'Say that this table exists because the supervisor asked for an honest description with a clear next step for anything unimplemented. Read two or three rows aloud rather than all eight, and let the audience read the rest. Make the point that naming the next step is what turns a limitation into a plan.',
});

/* 20 — limitations */
K.bulletSlide(pres, {
  kicker: 'Limitations',
  title: 'What the evidence cannot support',
  style: 'dot',
  items: [
    { h: 'No result here describes a real child.', t: 'The dataset is synthetic, so every metric is a property of a seeded generator.' },
    { h: 'No clinician has reviewed the content.', t: 'Step lists, illustrations and coach tolerances are unreviewed by a physiotherapist.' },
    { h: 'No family has used the platform.', t: 'Usability, comprehension and adherence are all untested.' },
    { h: 'The splitter agrees exactly with the reviewed lists on 2 of 10 programmes.', t: 'Mean confidence 0.78, with granularity differences on multi-exercise leaflets.' },
    { h: 'There is no backend, so there is no continuity.', t: 'No saved history, no progress over time, and no therapist view of what happened.' },
  ],
  note: 'Deliver these as statements of fact and do not add reassurance to any of them. The splitter figure is the one most likely to be challenged, so give it plainly and refer back to the granularity explanation. Close on the backend limitation, which is a design consequence rather than a defect.',
});

/* 21 — next steps */
K.bulletSlide(pres, {
  kicker: 'Next steps',
  title: 'Future work, in priority order',
  subtitle: 'The five steps recorded in the report, in the order they should be taken.',
  items: [
    { h: '1. Obtain ethical approval and record a consented dataset', t: 'Even 20 participants would let every number in this project be re-derived from reality.' },
    { h: '2. Add temporal features and re-run the comparison', t: 'The confusion structure predicts exactly where the gain would appear.' },
    { h: '3. Have a physiotherapist review the step lists and tolerances', t: 'The cheapest step that changes what the project is allowed to claim.' },
    { h: '4. Connect a language model behind a validating proxy', t: 'Keeping the rule engine as the fallback, with schema validation and a safety review.' },
    { h: '5. Evaluate with families', t: 'Does the platform change whether the exercises get done, and done correctly?' },
  ],
  note: 'Give the order and the reason for it: everything else is worth more once real data exists. Note that step three is the least expensive and disproportionately valuable, because it converts judgement into reviewed content. Finish on step five, which is the only step that tests whether the project achieves what it set out to do.',
});

/* 22 — closing */
K.closingSlide(pres, {
  title: 'Say what was built, say what was not, say what is next',
  points: [
    { h: 'Sourced, not invented', t: 'Ten programmes, five from published Sheffield Children\'s NHS leaflets, the rest labelled as general practice.' },
    { h: 'Rule-based, and said so', t: 'A seven-stage deterministic splitter, no language model, an adapter seam that returns null and is documented as such.' },
    { h: 'Honest by construction', t: 'Synthetic data declared, 2 of 10 exact splitter matches published, eight unbuilt items each with a next step.' },
  ],
  closer: 'A project is more useful when its limits are written down than when they are discovered by the reader.',
  contact: `${MEMBER}  ·  ${ROLE}\nProject A60  ·  Module 55-708252  ·  Sheffield Hallam University  ·  Team Deepminds`,
  note: 'Close by restating the two answers the supervisor asked for directly: no language model, and a written register of unimplemented work with next steps. Offer to walk through the register or the source list in questions. Thank the supervisor for the feedback, which changed both the interface and the shape of the report.',
});

pres.writeFile({ fileName: OUT }).then(() => console.log('written', OUT, 'slides:', pres._n));
