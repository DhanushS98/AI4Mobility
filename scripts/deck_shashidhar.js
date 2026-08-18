'use strict';
/* AI4Mobility — individual deck: Nandi Reddy Shashidhar Reddy
   Pose estimation and visualisation lead. 22 slides, notes on every slide. */

const K = require('./deckkit');

const MEMBER = 'Nandi Reddy Shashidhar Reddy';
const ROLE = 'Pose estimation and visualisation lead';
const OUT = '/home/claude/repo/ai4mobility/docs/presentations/AI4Mobility_Deck_Shashidhar.pptx';

const pres = K.makeDeck({ member: MEMBER, role: ROLE, deckTitle: 'AI4Mobility — pose estimation and visualisation' });

/* 1 — title */
K.titleSlide(pres, {
  title: 'AI4Mobility',
  standfirst: 'A multimodal assistive platform for parents supporting children with mobility difficulties. This deck covers how the body is drawn, explored and compared against a reference position.',
  member: MEMBER,
  role: ROLE,
  meta: K.META,
  note: 'Introduce yourself and say which layer of the project this deck covers: everything visual, from the stick figures in the interface to the live camera coach. Make the boundary clear at the start — the illustrations are hand-authored and the classifier data is synthetic, so nothing here is a detection result on real children. Say that the through-line of the deck is a single skeleton definition shared by every component.',
});

/* 2 — agenda */
K.bulletSlide(pres, {
  kicker: 'Agenda',
  title: 'What this deck covers',
  subtitle: 'From one connection list to a live camera coach, with the caveats attached.',
  items: [
    { h: 'Drawing the body', t: 'The skeleton connection list, the 46-pose illustration library, and the coordinate bug that shaped both.' },
    { h: 'Exploring the data', t: 'Angle distributions, the PCA projection, and what 52.3% of variance does and does not prove.' },
    { h: 'The live pose coach', t: 'On-device pose estimation, four joint checks, and where the target angles come from.' },
    { h: 'Results and limits', t: 'The model comparison, plus an honest account of what is not validated.' },
  ],
  note: 'Set out the three sections and the order they run in. Emphasise that the PCA slide and the tolerance slide are the two places where it would be easy to overclaim, so both carry explicit caveats. Say the deck ends with limitations rather than starting with them, but that nothing is hidden.',
});

/* 3 — team */
K.teamSlide(pres, {
  members: K.TEAM,
  highlight: MEMBER,
  subtitle: 'Four members, four defined responsibilities. This deck presents the pose estimation and visualisation work.',
  note: 'Name each member and their responsibility, then say what you owned: the renderer, the pose library, the exploratory figures and the live coach. Point out the dependency in both directions — the pose bank feeds the coach, and the shared skeleton definition feeds the notebook figures. The peer contribution split shown here is the one agreed for the individual reports.',
});

/* 4 — section 1 */
K.sectionSlide(pres, {
  number: '01',
  title: 'Drawing the body',
  summary: 'One connection list, 46 hand-authored poses, and the coordinate convention that had to be right before anything else could be.',
  note: 'Frame this section around consistency: the interface, the notebook figures and the coach all describe the same skeleton. Say that getting this wrong early would have produced figures that looked convincing and were geometrically false. The coordinate bug at the end of the section is the concrete example of that risk.',
});

/* 5 — skeleton */
K.twoColSlide(pres, {
  kicker: 'The skeleton',
  title: 'One connection list, used everywhere',
  subtitle: 'Thirteen landmarks, joined the same way in the notebook figures and in the platform illustrations.',
  left: {
    title: 'The connections',
    items: [
      'Head to neck, then neck to each shoulder.',
      'Shoulder to elbow to wrist, on each side.',
      'Neck to hip as the trunk segment.',
      'Hip to knee to ankle, on each side.',
      'The platform renderer extends the same list to feet and hands so the illustrations read clearly.',
    ],
  },
  right: {
    title: 'Why it is shared',
    items: [
      'A figure in the report and a figure in the interface describe the same body.',
      'The classifier features are computed at the same joints the drawing connects.',
      'The coach checks angles at vertices that already exist in the drawing.',
      'One definition means one place to correct if a joint is wrong.',
    ],
  },
  note: 'Walk the connection list from head to ankle so the audience can picture it, then explain why sharing it matters more than the list itself. Point out that the classifier angle features are computed at these same vertices, so the drawing and the model are talking about the same joints. Note that the renderer adds feet and hands purely for legibility in the illustrations.',
});

/* 6 — pose library */
K.bulletSlide(pres, {
  kicker: 'Illustration library',
  title: '46 hand-authored stick-figure poses',
  items: [
    { h: 'Every step in every programme has a picture', t: 'Poses cover lying, kneeling, quadruped, seated and standing positions across the ten programmes.' },
    { h: 'Props are drawn where the exercise needs them', t: 'Chair, wall, step and table, so the picture matches the instruction rather than a generic figure.' },
    { h: 'Drawn as inline SVG in the browser', t: 'No image files to load, so the illustrations scale with the accessibility settings and reduced-motion preference.' },
    { h: 'Hand-authored joint coordinates', t: 'They are not the output of a pose estimation model, and the code says so in its own header comment.' },
  ],
  callout: {
    label: 'What this stands in for',
    tone: 'accent',
    h: 0.92,
    text: 'Generative illustration is NOT built. The 46 poses are a hand-authored stand-in for a generative vision model, and the register in the report records it as such.',
  },
  note: 'Explain that a picture per step was the single most requested thing when parents read a text instruction, so the library covers every step rather than a sample. Be explicit that these are hand-authored coordinates rather than model output, because the visual quality invites the opposite assumption. Close by naming generative illustration as unbuilt work rather than implying it exists.',
});

/* 7 — pose gallery figure */
K.figureSlide(pres, {
  kicker: 'Figure 1',
  title: 'The same skeleton, drawn from the data',
  image: K.FIG('f01_pose_gallery.png'),
  caption: 'Figure 1 — one representative frame per class, drawn with the shared connection list.',
  sideTitle: 'How to read it',
  side: [
    'Each panel is the frame closest to that class mean, not the first frame available.',
    'Orange markers are tracked joints; the larger dark marker is the head.',
    'y increases downward, matching the raw landmark frame rather than a mathematical axis.',
    'The quadruped-derived classes look alike here, and the confusion analysis later says the same thing numerically.',
  ],
  note: 'Explain the representative-frame choice: picking the first frame would have produced a tidier and less truthful figure. Point at the standing calf-control panel and the flatter quadruped panels and note how much visual structure separates them. Say that this figure is drawn by the same code path as the interface illustrations, which is why the visual language matches.',
});

/* 8 — coordinate inversion */
K.twoColSlide(pres, {
  kicker: 'A bug worth describing',
  title: 'The image-coordinate inversion problem',
  subtitle: 'Landmark data uses the image convention, where y increases downward. Plotting libraries do not.',
  left: {
    title: 'The symptom, and how it surfaced',
    fill: K.C.tintAccent,
    lineColour: 'F0C9B6',
    items: [
      'Drawn on a standard axis, every pose came out vertically mirrored.',
      'It was caught in visual review of the pose gallery: the standing class rendered head-down against the floor.',
      'The lying and quadruped classes looked merely unusual, not obviously wrong — the failure was silent for four of six classes.',
      'No metric would have caught it: the features are computed from coordinates, not from the picture.',
    ],
  },
  right: {
    title: 'The fix, and what it changed',
    items: [
      'The plotting axis is inverted so the drawing matches the image frame.',
      'The same convention is stated in the generator, the notebook renderer and the platform renderer.',
      'The platform draws in a viewBox where y increases downward, with the floor at a fixed line.',
      'Every later figure inherits the convention rather than repeating the correction.',
    ],
  },
  note: 'Tell this as a short story, because it is the clearest example of why figures need to be reviewed by eye rather than accepted because the code ran. Emphasise that only the standing class made the error obvious, so a dataset without a standing pose would have shipped the bug. The fix is one axis-limit line, but the lesson is that the convention now appears in the comments of all three components.',
});

/* 9 — section 2 */
K.sectionSlide(pres, {
  number: '02',
  title: 'Exploring the data',
  summary: 'Angle distributions, a two-component projection and a confusion matrix — read carefully, not optimistically.',
  note: 'Introduce exploratory visualisation as the stage where a project decides what it believes. Say that each figure here is followed by an explicit statement of what it does not establish. Remind the audience that the dataset underneath every figure in this section is synthetic.',
});

/* 10 — synthetic statement */
K.twoColSlide(pres, {
  kicker: 'Honest statement',
  title: 'The dataset is synthetic',
  subtitle: 'It is not recorded video of children and it is not a public dataset. Every figure in this deck describes the generator.',
  left: {
    title: 'What the figures license us to claim',
    items: [
      'The visualisation pipeline works and is reproducible under random_state=42.',
      'The classes are separable in the way the generator constructed them to be.',
      'The exploratory findings agree with the model results, which is a consistency check on the method.',
      'The same figures would be produced, unchanged, from a recorded dataset.',
    ],
  },
  right: {
    title: 'What they do not license',
    fill: K.C.tintAccent,
    lineColour: 'F0C9B6',
    items: [
      'No claim that a real child\'s pose would separate this cleanly.',
      'No claim that the live coach has been validated on anyone.',
      'No clinical claim about posture or technique.',
      'No claim that the illustrations have been reviewed by a physiotherapist.',
    ],
  },
  note: 'State it plainly: every figure in this deck is drawn from synthetic, seeded data. Give the useful half — the visual pipeline, the conventions and the review discipline all transfer to real recordings unchanged. Then name the specific overclaims this deck refuses to make, including anything about the coach being validated.',
});

/* 11 — angle distributions */
K.figureSlide(pres, {
  kicker: 'Figure 4',
  title: 'Angles separate some classes far better than others',
  image: K.FIG('f04_angle_distributions.png'),
  caption: 'Figure 4 — joint-angle distributions by class.',
  sideTitle: 'What the boxplots say',
  side: [
    'Elbow and shoulder angles separate the standing and quadruped groups clearly.',
    'Within the quadruped group the distributions overlap heavily.',
    'Angles are recorded as missing rather than zero when a segment is degenerate.',
    'This is the first place the later confusion structure becomes visible.',
  ],
  callout: {
    tone: 'accent',
    h: 0.95,
    label: 'Keep this in proportion',
    text: 'Angles are informative but they do not dominate the model: normalised positions carry 77% of feature importance.',
  },
  note: 'Point out the joints where the boxes are well separated and the joints where they sit on top of each other. Explain that this overlap is deliberate — the generator was built so that classes in the same body position genuinely resemble each other at some movement phases. Add the caveat that the importance analysis puts positions well ahead of angles, so this figure should not be read as evidence that angles carry the model.',
});

/* 12 — PCA */
K.figureSlide(pres, {
  kicker: 'Figure 5',
  title: 'PCA: 52.3% of variance in two components',
  image: K.FIG('f05_pca.png'),
  caption: 'Figure 5 — PCA projection of the feature table, coloured by class.',
  sideTitle: 'Reading it correctly',
  side: [
    'Two components account for 52.3% of total variance.',
    'Classes form visible groups, and the groups that touch are the ones performed in similar body positions.',
    'Just under half the variance is not shown at all in this view.',
    'A projection that separates classes is encouraging; it is not a measurement of accuracy.',
  ],
  callout: {
    tone: 'accent',
    h: 1.12,
    label: 'An indication, not proof',
    text: 'This figure indicates separability. It does not prove it. The evidence for separability is the held-out test score, not the projection.',
  },
  note: 'Give the number first — 52.3 per cent of variance in two components — and then immediately say what it is not. A projection can look convincing while the remaining variance carries the information that actually distinguishes the hard classes. Say that the honest use of this figure is to predict where confusions will appear, which it does correctly.',
});

/* 13 — confusion */
K.figureSlide(pres, {
  kicker: 'Figure 8',
  title: 'The confusions land where the projection said they would',
  image: K.FIG('f08_confusion.png'),
  caption: 'Figure 8 — Random Forest confusion matrix on the held-out test set.',
  sideTitle: 'The pattern',
  side: [
    'Errors concentrate between exercises performed in similar body positions.',
    'Quadruped-derived classes are confused with each other; the two lying-down classes with each other.',
    'lower_limb and thread_the_needle are the weakest classes across all three models, at F1 near 0.90.',
    'The structure was built into the generator deliberately, so finding it is a check that the pipeline measures what we intended.',
  ],
  note: 'Connect this figure back to the PCA slide: the groups that touched in the projection are the pairs that get confused here. Say that this is a designed property of the dataset, and that reproducing it is a sanity check rather than a discovery. Note that the same weak classes appear for all three models, which points at the data rather than at any one algorithm.',
});

/* 14 — section 3 */
K.sectionSlide(pres, {
  number: '03',
  title: 'The live pose coach',
  summary: 'On-device pose estimation, four joint checks, and targets taken from the same pose bank the illustrations use.',
  note: 'Introduce the coach as the component that closes the loop between the picture and the child. Say up front that it runs entirely on the device and that no frame is uploaded or stored. Flag that the section ends with an honest statement about the tolerances.',
});

/* 15 — how the coach works */
K.bulletSlide(pres, {
  kicker: 'How it works',
  title: 'Four joints, checked against the picture on screen',
  items: [
    { h: 'MediaPipe Pose Landmarker, running on-device', t: 'The video element is the only place the image exists. No frame is uploaded and no recording is made.' },
    { h: 'A mirrored skeleton overlay', t: 'Drawn on a canvas over the video, so the child sees themselves the way a mirror would show them.' },
    { h: 'Elbow, knee, hip and trunk angles', t: 'Each is compared against a target for the pose the parent has selected.' },
    { h: 'One plain-English cue, plus the detail', t: 'A single cue to act on, with a per-joint measured-against-target breakdown underneath for the parent.' },
    { h: 'It degrades cleanly', t: 'If the model cannot be fetched, the browser has no camera, or permission is refused, the coach says so and the rest of the interface keeps working.' },
  ],
  note: 'Walk through the chain from camera to cue in one pass, keeping the privacy property prominent: nothing leaves the device. Explain the choice to surface one cue rather than four corrections at once, because a parent cannot act on four at the same time. Finish on graceful degradation, which was tested as part of the pose-coach test suite.',
});

/* 16 — coach targets figure */
K.figureSlide(pres, {
  kicker: 'Figure 12',
  title: 'Target joint angles per pose family',
  image: K.FIG('f12_coach_targets.png'),
  caption: 'Figure 12 — target joint angles by pose family, derived from the hand-authored pose bank.',
  sideTitle: 'Where the targets come from',
  side: [
    'Each target is computed from the joint coordinates of the pose the illustration draws.',
    'Different pose families give genuinely different target profiles, which is why one global threshold would not work.',
    'The trunk and hip targets carry most of the difference between lying, kneeling and standing families.',
    'The figure is drawn from the same bank the interface renders, so it cannot drift out of step.',
  ],
  note: 'Use the figure to show that the four checked joints behave differently across pose families, which is the argument against a single global tolerance. Explain that the targets are computed rather than typed in, so a corrected illustration updates the coach automatically. Note that this figure is a description of the pose bank, not a measurement taken from any person.',
});

/* 17 — same source of truth */
K.twoColSlide(pres, {
  kicker: 'One source of truth',
  title: 'The coach checks the position the picture shows',
  subtitle: 'Target angles are derived from the same hand-authored pose bank the illustrations are drawn from.',
  left: {
    title: 'How the derivation works',
    items: [
      'The pose bank stores joint coordinates for every illustrated pose.',
      'For a selected pose, the angle at each checked vertex is computed from those coordinates.',
      'Pose aliases are followed, so a flow position resolves to the pose it is drawn as.',
      'Results are cached per pose, so the derivation happens once rather than every frame.',
    ],
  },
  right: {
    title: 'Why it matters',
    items: [
      'The child is checked against exactly the position the picture shows them.',
      'There is no second set of numbers to maintain or to fall out of step.',
      'Correcting an illustration corrects the coach at the same time.',
      'It also bounds the claim: the coach is only as right as the hand-authored pose.',
    ],
  },
  note: 'Explain the derivation in one pass — coordinates in the bank, angles computed at the checked vertices, cached per pose. The design point is that there is exactly one description of each position in the whole platform. Then close the loop honestly: this makes the coach consistent with the illustration, not correct in a clinical sense, because the illustration itself has not been reviewed by a physiotherapist.',
});

/* 18 — tolerances */
K.bulletSlide(pres, {
  kicker: 'Honest statement',
  title: 'The tolerances are engineering judgement',
  subtitle: 'Twenty to twenty-four degrees per joint, chosen so the coach is usable — not derived from clinical evidence.',
  style: 'dot',
  items: [
    { h: 'Tolerances of 20 to 24 degrees per joint, set per checked joint.', t: 'Tighter values made the coach reject positions a parent would call correct; looser values accepted positions that were visibly wrong.' },
    { h: 'That is a usability judgement, not a clinical threshold.', t: 'No physiotherapist has reviewed these numbers, and no calibration study has been run.' },
    { h: 'The coach reports measured against target rather than pass or fail alone.', t: 'A parent can see how far off a joint is, instead of being told only that something is wrong.' },
  ],
  callout: {
    label: 'Recorded as not validated',
    tone: 'accent',
    h: 1.0,
    text: 'Pose coach calibration is listed as NOT VALIDATED in the project register. The next step is a physiotherapist review of both the tolerances and the pose bank they are derived from.',
  },
  note: 'Say the number and then immediately say what kind of number it is: a usability setting arrived at by testing, not a clinical threshold. Explain that reporting measured-against-target keeps the parent in charge of the judgement rather than the software. Close by pointing at the register entry, so the audience hears it as a documented limitation rather than an admission.',
});

/* 19 — results */
K.tableSlide(pres, {
  kicker: 'Results',
  title: 'Where the visual findings meet the model results',
  subtitle: 'Three model families, identical data and identical splits. Measured on synthetic data.',
  headers: K.MODEL_TABLE.headers,
  rows: K.MODEL_TABLE.rows,
  colW: K.MODEL_TABLE.colW,
  highlight: K.MODEL_TABLE.highlight,
  caption: 'Cross-validation is five-fold on the training partition only. The test set was scored once, after all model selection was complete.',
  callout: {
    label: 'The visual agreement',
    tone: 'primary',
    h: 0.9,
    text: 'Random Forest leads on macro F1 at 0.935 with the smallest generalisation gap at +0.037. Its weakest classes are the ones the PCA projection and the angle boxplots both flagged.',
  },
  note: 'Give the headline numbers, then make the point that matters for this deck: the exploratory figures predicted the weak classes before any model was trained. Say that the three models agree with each other and with the visualisation, which is a consistency argument rather than a performance claim. Repeat that these figures are measured on synthetic data.',
});

/* 20 — limitations */
K.bulletSlide(pres, {
  kicker: 'Limitations',
  title: 'What the visual work does not establish',
  style: 'dot',
  items: [
    { h: 'The illustrations are hand-authored, not generated.', t: 'Generative illustration is not built; 46 poses are a stand-in for it.' },
    { h: 'No physiotherapist has reviewed the poses or the tolerances.', t: 'Clinical validation is not done, and neither the pose bank nor the coach thresholds have been checked by a clinician.' },
    { h: 'The coach has not been used by a child.', t: 'User evaluation is not done. Every judgement about usability is the team\'s own.' },
    { h: 'PCA shows 52.3% of variance, not the whole picture.', t: 'Just under half the variance is outside the projection, so the separation shown is partial.' },
    { h: 'Everything visual rests on synthetic frames.', t: 'The figures describe the generator, and would need redrawing from recorded data before any external claim.' },
  ],
  note: 'Deliver these as facts and resist softening the first two. The point about PCA is worth repeating because it is the figure most likely to be misread as proof. End on the synthetic caveat so the audience carries it into the next slide.',
});

/* 21 — next steps */
K.bulletSlide(pres, {
  kicker: 'Next steps',
  title: 'What would strengthen this work',
  subtitle: 'Ordered by how much each one would change what we are allowed to say.',
  items: [
    { h: 'Have a physiotherapist review the pose bank and the tolerances', t: 'This converts engineering judgement into a reviewed reference, and it improves the coach and the illustrations at once.' },
    { h: 'Record a small consented dataset', t: 'Redraw every exploratory figure from real landmarks and see whether the class structure survives.' },
    { h: 'Add temporal features and re-run the projection', t: 'Movement over time is exactly what separates the classes that currently overlap in the projection.' },
    { h: 'Evaluate the coach with families', t: 'Measure whether the cue is understood and acted on, which no figure in this deck can tell us.' },
  ],
  note: 'Lead with the physiotherapist review, because it is the cheapest step that changes the strength of the claims. Explain that a recorded dataset would let every figure in this deck be redrawn without changing any code. Close on user evaluation, which is the only way to learn whether a cue is actually usable.',
});

/* 22 — closing */
K.closingSlide(pres, {
  title: 'One skeleton, one pose bank, one honest set of caveats',
  points: [
    { h: 'Consistent by construction', t: 'The notebook figures, the 46 illustrations and the live coach all describe the same body using the same connection list.' },
    { h: 'Reviewed by eye, not just by code', t: 'The coordinate inversion was only ever going to be caught by looking, and it changed how every later figure is checked.' },
    { h: 'Careful with the claims', t: '52.3% of variance is an indication of separability; 20 to 24 degree tolerances are judgement, not clinical thresholds.' },
  ],
  closer: 'A picture that is consistent with the data is useful. A picture that is mistaken for evidence is not.',
  contact: `${MEMBER}  ·  ${ROLE}\nProject A60  ·  Module 55-708252  ·  Sheffield Hallam University  ·  Team Deepminds`,
  note: 'Close on the three points and repeat the two caveats one final time, because they are the sentences most likely to be quoted back. Offer to demonstrate the live coach or walk through the pose bank in questions. Thank the supervisor for pushing the team towards an explicit honest description, which is why the tolerance slide exists at all.',
});

pres.writeFile({ fileName: OUT }).then(() => console.log('written', OUT, 'slides:', pres._n));
