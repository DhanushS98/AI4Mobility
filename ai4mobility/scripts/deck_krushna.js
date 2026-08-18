'use strict';
/* AI4Mobility — individual deck: Krushna Sai Teja Adhala
   Data engineering and pipeline lead. 22 slides, speaker notes on every slide. */

const K = require('./deckkit');

const MEMBER = 'Krushna Sai Teja Adhala';
const ROLE = 'Data engineering and pipeline lead';
const OUT = '/home/claude/repo/ai4mobility/docs/presentations/AI4Mobility_Deck_Krushna.pptx';

const pres = K.makeDeck({ member: MEMBER, role: ROLE, deckTitle: 'AI4Mobility — data and pipeline' });

/* 1 — title */
K.titleSlide(pres, {
  title: 'AI4Mobility',
  standfirst: 'A multimodal assistive platform for parents supporting children with mobility difficulties. This deck covers the data: how it was constructed, cleaned, described and split.',
  member: MEMBER,
  role: ROLE,
  meta: K.META,
  note: 'Introduce yourself and the project title, then set the boundary of this deck straight away: it is about the data layer, not the models or the interface. Say the headline honestly in the first minute — the dataset is synthetic and seeded, so everything downstream describes the generator rather than real children. Promise that the pipeline is written so a real recording can be dropped in without changing anything else.',
});

/* 2 — agenda */
K.bulletSlide(pres, {
  kicker: 'Agenda',
  title: 'What this deck covers',
  subtitle: 'Four sections, ending with the numbers the pipeline makes possible.',
  items: [
    { h: 'The dataset', t: 'What it is, why it is synthetic, and what that does and does not license us to claim.' },
    { h: 'Cleaning', t: 'Four rules, 153 frames removed, and the deliberate decision to impute nothing.' },
    { h: 'Features', t: 'A four-stage pipeline and 45 features in three families.' },
    { h: 'Split, scaling and results', t: 'Subject-level split, a scaler fitted on training data only, and the model comparison.' },
    { h: 'Limitations and next steps', t: 'What the data layer cannot support, and what would fix it.' },
  ],
  note: 'Walk through the four sections in ten seconds each so the audience knows where the honesty statement sits. Point out that limitations are a named section rather than an afterthought at the end. Mention that every number in this deck comes from a seeded run that can be reproduced exactly.',
});

/* 3 — team */
K.teamSlide(pres, {
  members: K.TEAM,
  highlight: MEMBER,
  subtitle: 'Four members, four defined responsibilities. This deck presents the data engineering work.',
  note: 'Name each member and their responsibility briefly, then say which parts of the work you owned. The peer contribution split shown here is the one agreed for the individual reports. Make clear that the four workstreams share one dataset definition, which is why the split and cleaning rules had to be settled early.',
});

/* 4 — section 1 */
K.sectionSlide(pres, {
  number: '01',
  title: 'The dataset',
  summary: '1,358 raw frames from a seeded generator, six exercise classes, and an honest account of what that means.',
  note: 'Signal a change of gear: this section is the part of the project most likely to be challenged in a viva, so it is placed first. Tell the audience you would rather explain the synthetic data yourself than have it discovered. Preview the three numbers that follow: raw frames, removed frames, usable frames.',
});

/* 5 — synthetic statement */
K.twoColSlide(pres, {
  kicker: 'Honest statement',
  title: 'The dataset is synthetic',
  subtitle: 'It is not recorded video of children and it is not a public dataset. Every number describes the generator.',
  left: {
    title: 'What this licenses us to claim',
    items: [
      'The pipeline runs end to end and is reproducible under random_state=42.',
      'The models separate six classes that were constructed to differ as the real exercises differ.',
      'The evaluation protocol is sound and would transfer unchanged to real data.',
      'The confusion structure behaves as designed, which is evidence the pipeline measures what we intended.',
    ],
  },
  right: {
    title: 'What it does not license',
    fill: K.C.tintAccent,
    lineColour: 'F0C9B6',
    items: [
      'No claim about accuracy on real children performing real physiotherapy.',
      'No clinical claim of any kind.',
      'No claim that the platform improves adherence or technique.',
      'No comparison against published results on recorded datasets.',
    ],
  },
  note: 'Say this line without hedging: the dataset is synthetic and seeded, so accuracy figures are properties of the generator. Then give the audience the useful half — the pipeline, the split discipline and the evaluation protocol are real work that transfers to real data unchanged. Close by saying that swapping in a recorded dataset means replacing one function, build_raw_frames, and nothing else.',
});

/* 6 — why synthetic */
K.bulletSlide(pres, {
  kicker: 'Justification',
  title: 'Why synthetic, and what is honest about it',
  items: [
    { h: 'Recording children needs approval we do not have', t: 'Ethical approval, parental consent and safeguarding arrangements were out of reach for a taught project of this length.' },
    { h: 'No public dataset covers these six classes', t: 'No paediatric physiotherapy pose dataset with our exercise classes was available to download.' },
    { h: 'The generator is seeded', t: 'random_state=42, so every figure and every metric in the report reproduces exactly.' },
    { h: 'Class configurations come from the NHS descriptions', t: 'Joint positions are derived from the published exercise text, so the classes differ in the ways the real exercises differ.' },
    { h: 'Degradations are injected on purpose', t: 'Occlusion dropout, per-subject body proportions and measurement jitter, because a clean generator gives implausible accuracy.' },
  ],
  note: 'Give the two reasons for the decision first, so it reads as a considered choice rather than a shortcut. Then explain the three things that keep it honest: seeding, NHS-derived class geometry, and deliberate degradation. Note that annotation label noise of six per cent was added within confusable families for the same reason.',
});

/* 7 — dataset at a glance */
K.statSlide(pres, {
  kicker: 'At a glance',
  title: 'The dataset in four numbers',
  stats: [
    { value: '1,358', label: 'Raw frames', sub: 'Before any cleaning' },
    { value: '153', label: 'Removed in cleaning', sub: '11.3% of the raw set' },
    { value: '1,205', label: 'Usable frames', sub: 'Carried into feature building' },
    { value: '45', label: 'Features', sub: 'Across three families plus quality' },
  ],
  items: [
    { h: 'Six classes: calf_control, cat_cow, childs_pose, core_hip_stability, lower_limb, thread_the_needle.' },
    { h: 'Requested frames per class range from 300 (lower_limb) down to 150 (calf_control).' },
    { h: 'Annotation label noise of 6% was injected within confusable families.' },
  ],
  note: 'Read the four numbers slowly; they are the spine of the whole data section. Point out that 11.3 per cent removal is high enough to be worth explaining and that the next slides do exactly that. Mention that the class counts are deliberately uneven because real recording practice is uneven.',
});

/* 8 — class balance figure */
K.figureSlide(pres, {
  kicker: 'Figure 2',
  title: 'Six classes, deliberately unbalanced',
  image: K.FIG('f02_class_balance.png'),
  caption: 'Figure 2 — usable frames per class after cleaning.',
  sideTitle: 'Why not balance them',
  side: [
    'Requested counts: lower_limb 300, core_hip_stability 275, cat_cow 240, childs_pose 210, thread_the_needle 165, calf_control 150.',
    'Some exercises really are recorded more often than others, so an even set would be the unrealistic choice.',
    'Imbalance is handled in the model rather than in the data, using class_weight="balanced".',
    'Macro F1 is reported alongside accuracy so small classes cannot be hidden by large ones.',
  ],
  note: 'Explain that the imbalance is a design decision, not an accident of generation. Say where it is compensated: balanced class weights in the Random Forest and macro F1 in the reporting, both of which stop the largest class carrying the score. Note that calf_control ends up with the smallest test support, 14 frames, which is worth remembering when reading its per-class scores.',
});

/* 9 — section 2 */
K.sectionSlide(pres, {
  number: '02',
  title: 'Cleaning, and what we refused to do',
  summary: 'Four rules, 153 frames removed, and no imputation anywhere in the pipeline.',
  note: 'Introduce cleaning as the place where quiet mistakes are usually made. Say that the interesting decision in this section is a negative one — nothing is filled in. Promise the reasoning, not just the counts.',
});

/* 10 — cleaning rules table */
K.tableSlide(pres, {
  kicker: 'Cleaning',
  title: 'Four rules, applied in order',
  subtitle: 'Each rule is auditable and each removal is counted and reported.',
  headers: ['Rule', 'What it removes', 'Frames removed'],
  rows: [
    ['Exact duplicates', 'Identical rows, as when a recording is processed twice', '18'],
    ['Missing a critical joint', 'Any frame missing hip, neck, either shoulder or either knee', '130'],
    ['Detector confidence below 0.55', 'Frames the landmark detector was not confident about', '5'],
    ['Coordinates outside the frame', 'Landmarks outside the permitted bounds', '0'],
    ['Total', '11.3% of 1,358 raw frames', '153'],
  ],
  colW: [3.6, 6.29, 2.2],
  align: ['left', 'left', 'center'],
  highlight: [4],
  caption: 'Order matters: duplicates are removed first, so a duplicated bad frame is not counted twice.',
  callout: {
    label: 'Why the zero is reported',
    tone: 'primary',
    h: 0.86,
    text: 'The out-of-frame rule removed nothing. It is still listed, because a check that finds no problems is evidence the data is well-formed, not a reason to hide the check.',
  },
  note: 'Take the rules in order and explain that ordering changes the counts, so it is fixed and documented. The dominant cause is a missing critical joint at 130 frames, which is occlusion rather than a coding fault. Point at the zero row and say a passing check is still worth publishing.',
});

/* 11 — cleaning figure */
K.figureSlide(pres, {
  kicker: 'Figure 3',
  title: 'What was removed, and why',
  image: K.FIG('f03_cleaning.png'),
  caption: 'Figure 3 — 11.3% of raw frames removed, broken down by reason.',
  note: 'Use the figure to show that removal is dominated by one cause rather than spread evenly, which is what you would expect from occlusion. Say that the 1,205 surviving frames are the only ones that reach feature building. Add that publishing the reason for every removal is what makes the eleven per cent defensible rather than alarming.',
});

/* 12 — no imputation */
K.twoColSlide(pres, {
  kicker: 'A deliberate omission',
  title: 'No landmark is imputed',
  subtitle: 'Mean-filling would have been easy, faster and quietly wrong.',
  left: {
    title: 'The reasoning',
    items: [
      'Landmarks go missing through occlusion, not at random.',
      'Occlusion is pose-dependent: wrists and elbows disappear far more often in the quadruped poses.',
      'A column mean would therefore manufacture samples for exactly the hardest classes.',
      'Those invented samples would look plausible and would raise the reported score.',
    ],
  },
  right: {
    title: 'What we do instead',
    items: [
      'Frames missing a critical joint are removed, and the removal is counted.',
      'Feature columns more than 35% empty are dropped rather than filled.',
      'Remaining rows with any missing value are dropped, so no value is ever invented.',
      'Detector confidence is kept as a feature, so frame quality stays visible to the model.',
    ],
  },
  note: 'This is the slide to linger on, because it is the clearest example of a decision made against our own interest. Explain that imputing would have raised accuracy while removing the model\'s ability to fail honestly on the hardest poses. Note that keeping detector confidence as a feature means the model can learn that a poor frame is a poor frame.',
});

/* 13 — pipeline */
K.bulletSlide(pres, {
  kicker: 'Architecture',
  title: 'The pipeline runs in four stages',
  subtitle: 'Each stage has one responsibility and hands a tabular artefact to the next.',
  items: [
    { h: 'Generate', t: 'build_raw_frames produces one row per frame from the seeded class-conditional generator. Replace this one function to swap in real data.' },
    { h: 'Clean', t: 'clean_frames applies the four rules and returns the surviving frames plus the removal counts.' },
    { h: 'Engineer features', t: 'build_feature_table produces 45 features in three families from 13 landmarks.' },
    { h: 'Split and scale', t: 'Subject-level train/test split, then a StandardScaler fitted on the training partition only.' },
  ],
  callout: {
    label: 'The point of the seam',
    tone: 'primary',
    h: 0.9,
    text: 'Only the first stage knows the data is synthetic. Everything after it reads a plain landmark table, so a recorded dataset can be substituted without touching cleaning, features, splitting or modelling.',
  },
  note: 'Describe each stage in a sentence and stress that the boundaries are real function boundaries, not a diagram drawn after the fact. The generate stage is the only one that would change if we obtained real recordings. That property is what makes the honest account of synthetic data more than an apology.',
});

/* 14 — feature families */
K.tableSlide(pres, {
  kicker: 'Feature engineering',
  title: '45 features in three families, plus a quality signal',
  subtitle: 'Each family is included for a stated reason, not because it was available.',
  headers: ['Family', 'Count', 'Why it is included'],
  rows: [
    ['Normalised coordinates', '26', 'Hip-centred and divided by torso length, so the model learns the pose rather than where the child stood or how tall they are'],
    ['Joint angles', '9', 'Invariant to translation, scale and body proportion — what an exercise classifier should key on'],
    ['Inter-joint distances', '9', 'Separations that distinguish classes, such as wrist-to-ankle for Child\'s Pose against Thread the Needle'],
    ['Detector quality', '1', 'Detector confidence, retained so frame quality stays visible instead of being silently averaged away'],
  ],
  colW: [3.0, 0.95, 8.14],
  align: ['left', 'center', 'left'],
  caption: 'Frame-level features only. No temporal windowing, because the dataset is built as independent frames rather than continuous sequences.',
  callout: {
    label: 'Where the 26 comes from',
    tone: 'primary',
    text: 'Thirteen tracked landmarks, each with an x and a y, translated to a hip-centred origin and divided by torso length. Angles are returned as missing rather than zero when a segment is degenerate, so no invented value enters the table.',
  },
  note: 'Take each family and give the one-line justification rather than listing column names. Emphasise that normalisation is what stops the model keying on position in the frame or on the height of the subject. Flag the absence of temporal features here, because it returns as the strongest next step later in the deck.',
});

/* 15 — pose gallery figure */
K.figureSlide(pres, {
  kicker: 'Figure 1',
  title: 'Thirteen landmarks, one representative frame per class',
  image: K.FIG('f01_pose_gallery.png'),
  caption: 'Figure 1 — the frame closest to each class mean, drawn with the shared skeleton connection list.',
  sideTitle: 'What the figure shows',
  side: [
    'The pipeline tracks 13 landmarks: head, neck, shoulders, elbows, wrists, hip, knees and ankles.',
    'The representative frame is the one closest to the class mean, not the first frame — an unrepresentative frame makes a convincing and wrong figure.',
    'The four quadruped-derived classes look alike here, which is why the confusion structure later is not a surprise.',
    'y increases downward, matching the raw landmark frame.',
  ],
  note: 'Explain the choice of representative frame, because picking the first frame would have produced a prettier and less truthful figure. Draw attention to how similar the quadruped-derived classes look, and say that this visual similarity is the same thing the confusion matrix later measures. Mention that the drawing uses the same connection list as the web platform, so both halves of the project describe one skeleton.',
});

/* 16 — angle distributions figure */
K.figureSlide(pres, {
  kicker: 'Figure 4',
  title: 'Joint angles carry class structure',
  image: K.FIG('f04_angle_distributions.png'),
  caption: 'Figure 4 — joint-angle distributions by class, from the nine angle features.',
  sideTitle: 'Reading this honestly',
  side: [
    'Nine angles are computed at anatomically meaningful vertices, such as hip–knee–ankle.',
    'Angles are returned as missing rather than zero when a segment is degenerate, so no meaningless value enters the table.',
    'Classes separate on some angles and overlap on others, which is the expected picture.',
    'Overlap between quadruped-derived classes is visible here and consistent with the later confusion analysis.',
  ],
  callout: {
    tone: 'accent',
    h: 1.0,
    label: 'Do not overstate this',
    text: 'Angles help, but they do not dominate. Feature importance puts normalised positions at 77% and distances at 14%.',
  },
  note: 'Use this figure to show that the angle family behaves sensibly, with separation on some joints and overlap on others. Point out the deliberate choice to return a missing value rather than zero when an angle cannot be computed, since a zero would be read by the model as a real measurement. Then pre-empt the obvious overstatement: the importance analysis shows positions carry far more weight than angles.',
});

/* 17 — section 3 */
K.sectionSlide(pres, {
  number: '03',
  title: 'Splitting, scaling and results',
  summary: 'The two decisions that decide whether a reported score means anything at all.',
  note: 'Frame this section as the difference between a number and a trustworthy number. Say that both decisions here are about preventing information leaking from test to training. These are the parts of the work that transfer unchanged to a real dataset.',
});

/* 18 — split and scaler */
K.twoColSlide(pres, {
  kicker: 'Leakage control',
  title: 'Split by subject, scale on training only',
  subtitle: '577 training frames and 195 test frames, partitioned by subject rather than by frame.',
  left: {
    title: 'The subject-level split',
    items: [
      'Frames are generated in short takes of up to 15, sharing one subject\'s body proportions.',
      'Whole subjects go to training or to test — never both.',
      'A random frame-level split would put near-duplicate frames on both sides.',
      'That silently inflates the test score, and nothing in the output would signal it.',
    ],
  },
  right: {
    title: 'The scaler',
    items: [
      'StandardScaler is fitted on the training partition only.',
      'The fitted scaler is then applied to the test partition.',
      'Fitting before splitting leaks test means and variances into training.',
      'The leak is small, undetectable in the metrics, and would make every later comparison unsound.',
    ],
  },
  callout: {
    label: 'The honest version',
    tone: 'primary',
    h: 0.82,
    text: 'A frame-level split would have produced a higher number. It would also have been a measurement of memorisation rather than generalisation.',
  },
  note: 'Explain that frames within a take are highly correlated because they share body proportions and a movement phase. A frame-level split therefore tests the model on frames that are near-copies of ones it trained on. Make the same point about the scaler: fitting before the split is a leak that never announces itself, so it has to be prevented by discipline rather than caught by a metric.',
});

/* 19 — results */
K.tableSlide(pres, {
  kicker: 'Results',
  title: 'What this pipeline supports',
  subtitle: 'Three model families, identical data and identical splits. Measured on synthetic data.',
  headers: K.MODEL_TABLE.headers,
  rows: K.MODEL_TABLE.rows,
  colW: K.MODEL_TABLE.colW,
  highlight: K.MODEL_TABLE.highlight,
  caption: 'Cross-validation is five-fold on the training partition only. The test set was scored once, after all model selection was complete.',
  callout: {
    label: 'Reading the table',
    tone: 'primary',
    h: 0.9,
    text: 'Random Forest wins narrowly on macro F1 and decisively on the generalisation gap: +0.037 against +0.077 for both alternatives. The gap is a pipeline property as much as a model property.',
  },
  note: 'Give the headline first: the three models sit within half a point of each other on test accuracy, so the interesting column is the gap. Explain that the two models reaching 1.000 training accuracy are memorising the training partition, which the subject-level split makes visible. Finish by repeating that these figures are measured on synthetic data.',
});

/* 20 — limitations */
K.bulletSlide(pres, {
  kicker: 'Limitations',
  title: 'What the data layer cannot support',
  style: 'dot',
  items: [
    { h: 'The data is synthetic', t: 'No claim about real children follows from any figure in this deck.' },
    { h: 'Frame-level only', t: 'There are no temporal features, so movement quality over time is not modelled at all.' },
    { h: 'Small test partition', t: '195 frames, and calf_control has a test support of only 14 — per-class figures for it are fragile.' },
    { h: 'Subjects are synthetic takes', t: 'They stand in for people; they do not carry real between-person variation.' },
    { h: 'No clinical review of the class definitions', t: 'The six classes come from published exercise text, not from a physiotherapist\'s judgement.' },
  ],
  note: 'Deliver these as facts rather than apologies, and do not soften the first one. The small test support for calf_control is worth naming because it scores a perfect 1.00 F1 and that deserves a caveat. Say plainly that no physiotherapist has reviewed the class definitions.',
});

/* 21 — next steps */
K.bulletSlide(pres, {
  kicker: 'Next steps',
  title: 'What would move the data layer forward',
  subtitle: 'In priority order, and each one is achievable rather than aspirational.',
  items: [
    { h: 'Record a small consented dataset', t: 'Even 20 participants, with ethical approval and safeguarding in place, would let every number be re-derived from reality.' },
    { h: 'Add temporal features over a sliding window', t: 'Velocity and phase across frames, then re-run the same comparison on the same splits.' },
    { h: 'Keep the split discipline unchanged', t: 'A real dataset makes subject-level splitting more important, not less, since takes become recording sessions.' },
    { h: 'Report cleaning counts for real data too', t: 'The removal table becomes a data-quality instrument once frames come from a camera rather than a generator.' },
  ],
  note: 'Present the recorded dataset as the single change that would upgrade every other claim in the project. Explain that temporal features are the second priority because the remaining confusions are exactly the ones a movement-over-time model should resolve. Close by saying the pipeline is already built to accept both changes without restructuring.',
});

/* 22 — closing */
K.closingSlide(pres, {
  title: 'A pipeline built so the data can be replaced',
  points: [
    { h: 'Honest about the source', t: '1,358 synthetic frames, seeded and reproducible, described as a generator rather than as evidence about children.' },
    { h: 'Disciplined in the middle', t: '153 frames removed with reasons published, nothing imputed, 45 features in three justified families.' },
    { h: 'Trustworthy at the end', t: 'Subject-level split, scaler fitted on training only, test set scored once — 0.928 accuracy with a +0.037 gap.' },
  ],
  closer: 'The most useful thing this deck can leave behind is a method that survives contact with real data.',
  contact: `${MEMBER}  ·  ${ROLE}\nProject A60  ·  Module 55-708252  ·  Sheffield Hallam University  ·  Team Deepminds`,
  note: 'Close on the three-part summary and repeat the synthetic caveat one final time so it is the last thing the audience hears about the data. Offer to walk through the cleaning table or the split code in questions. Thank the supervisor for the direct question about honest reporting, which shaped how this section is written.',
});

pres.writeFile({ fileName: OUT }).then(() => console.log('written', OUT, 'slides:', pres._n));
