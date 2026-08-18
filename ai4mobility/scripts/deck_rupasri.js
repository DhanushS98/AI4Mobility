'use strict';
/* AI4Mobility — individual deck: Ailuri Rupa Sri
   Model development and evaluation lead. 22 slides, notes on every slide. */

const K = require('./deckkit');

const MEMBER = 'Ailuri Rupa Sri';
const ROLE = 'Model development and evaluation lead';
const OUT = '/home/claude/repo/ai4mobility/docs/presentations/AI4Mobility_Deck_RupaSri.pptx';

const pres = K.makeDeck({ member: MEMBER, role: ROLE, deckTitle: 'AI4Mobility — modelling and evaluation' });

/* 1 — title */
K.titleSlide(pres, {
  title: 'AI4Mobility',
  standfirst: 'A multimodal assistive platform for parents supporting children with mobility difficulties. This deck covers the classifier: three model families, how they were chosen, and how they were judged.',
  member: MEMBER,
  role: ROLE,
  meta: K.META,
  note: 'Introduce yourself and say that this deck is about the modelling and, more importantly, about the evaluation protocol around it. State the headline early: three models, all within half a point of each other, and the interesting differences are in generalisation rather than accuracy. Say plainly that every figure is measured on synthetic data.',
});

/* 2 — agenda */
K.bulletSlide(pres, {
  kicker: 'Agenda',
  title: 'What this deck covers',
  subtitle: 'Models, protocol, results, and the parts of the result that deserve caution.',
  items: [
    { h: 'The data I was given', t: 'Synthetic, subject-split, 45 features — and what that permits me to claim.' },
    { h: 'Three model families', t: 'Why three rather than one, and the hyperparameter choices behind each.' },
    { h: 'The evaluation protocol', t: 'Five-fold cross-validation on training data only, and a test set scored once.' },
    { h: 'Results in detail', t: 'Per-class precision, recall and F1; the generalisation gap; confusions; feature importance.' },
    { h: 'Limitations and next steps', t: 'What the comparison cannot settle, and what would settle it.' },
  ],
  note: 'Walk the five sections briefly and flag that results occupy the largest share of the deck. Point out that per-class metrics come before headline accuracy on purpose. Say that the limitations section names things the numbers cannot decide, rather than listing generic caveats.',
});

/* 3 — team */
K.teamSlide(pres, {
  members: K.TEAM,
  highlight: MEMBER,
  subtitle: 'Four members, four defined responsibilities. This deck presents the modelling and evaluation work.',
  note: 'Introduce the team and say what you owned: model selection, hyperparameters, the evaluation protocol and the results analysis. Make the dependency explicit — the split and the features arrived from the data workstream, and the protocol was agreed before any model was fitted. The peer contribution split shown here is the one agreed for the individual reports.',
});

/* 4 — synthetic statement */
K.twoColSlide(pres, {
  kicker: 'Honest statement',
  title: 'The dataset is synthetic',
  subtitle: 'Every accuracy figure in this deck is a property of a seeded generator, not evidence about children.',
  left: {
    title: 'What the results license us to claim',
    items: [
      'The three model families were compared fairly, on identical data and identical splits.',
      'The evaluation protocol is sound and would transfer unchanged to a recorded dataset.',
      'The differences between models are real differences on this data.',
      'The error structure matches the structure deliberately built into the generator.',
    ],
  },
  right: {
    title: 'What they do not license',
    fill: K.C.tintAccent,
    lineColour: 'F0C9B6',
    items: [
      'No claim that 0.928 accuracy would hold on real children.',
      'No clinical claim, and no claim of diagnostic value.',
      'No comparison against published results on recorded datasets.',
      'No claim that the model is ready to give feedback unsupervised.',
    ],
  },
  note: 'Open the modelling section with the caveat rather than closing with it, so no number in the deck is heard without it. Explain that a synthetic dataset still supports a genuine comparison, because all three models see exactly the same data and the same splits. Then name what it cannot support, particularly any claim about readiness for use.',
});

/* 5 — section 1 */
K.sectionSlide(pres, {
  number: '01',
  title: 'Three model families',
  summary: 'Bagged trees, boosted trees and a neural network — chosen so the comparison is not confined to one kind of model.',
  note: 'Frame this section as a design decision rather than a survey. Say that a single model would have left us unable to tell a data property from a model property. The three families were fitted on identical inputs so any difference is attributable.',
});

/* 6 — why three */
K.bulletSlide(pres, {
  kicker: 'Design decision',
  title: 'Why three models, not one',
  items: [
    { h: 'A single model cannot tell you what is data and what is method', t: 'When all three families agree on which classes are weak, the weakness belongs to the data rather than to an algorithm.' },
    { h: 'Random Forest: bagged trees, the project baseline', t: 'Handles mixed feature scales, exposes feature importance, and is straightforward to constrain.' },
    { h: 'Gradient Boosting: a stronger tree-based comparison', t: 'Tests whether a more aggressive tree method buys anything on this feature table.' },
    { h: 'Neural Network (MLP): a different family entirely', t: 'Included so the comparison is not confined to trees, and so a non-tree view of the same features is available.' },
  ],
  callout: {
    label: 'The finding this design produced',
    tone: 'primary',
    h: 0.9,
    text: 'All three models name lower_limb and thread_the_needle as their weakest classes. That agreement is the evidence that the limit is in the data, not in the choice of algorithm.',
  },
  note: 'Explain that the purpose of three models is attribution, not a competition for the highest number. The agreement across families on the weakest classes is the single most useful result in this deck. Note that trees and a neural network see the same 45 features, so nothing in the comparison depends on different preprocessing.',
});

/* 7 — hyperparameters */
K.tableSlide(pres, {
  kicker: 'Hyperparameters',
  title: 'Every choice has a stated reason',
  subtitle: 'Settings were fixed before the test set was touched, and none was tuned against it.',
  headers: ['Model', 'Settings', 'Why'],
  rows: [
    ['Random Forest', 'n_estimators=300, max_depth=12, min_samples_leaf=2, class_weight="balanced"', 'Depth constrained on purpose; balanced weights because the classes are unevenly represented'],
    ['Gradient Boosting', 'n_estimators=150, learning_rate=0.1, max_depth=3', 'Shallow trees with a moderate rate — the standard defensive setting for a boosted ensemble'],
    ['Neural Network (MLP)', 'hidden_layer_sizes=(128, 64), alpha=1e-3, max_iter=1500', 'Two hidden layers for 45 features; iterations raised until convergence warnings stopped'],
  ],
  colW: [2.5, 4.6, 4.99],
  align: ['left', 'left', 'left'],
  fontSize: 11.5,
  caption: 'All three models share random_state=42, so every result in the report reproduces exactly.',
  callout: {
    label: 'One setting that needed explaining',
    tone: 'primary',
    text: 'Early stopping is left off for the MLP, because this scikit-learn version\u2019s internal validation scoring fails on string class labels. Convergence is monitored through the loss curve instead.',
  },
  note: 'Take each row and give the reason rather than reading the settings aloud. Stress that these were fixed before the test set was scored, so none of them was tuned to the number being reported. Mention that the MLP\'s iteration ceiling was raised until convergence warnings stopped, and convergence was then monitored through the loss curve.',
});

/* 8 — constrained depth */
K.twoColSlide(pres, {
  kicker: 'The most deliberate choice',
  title: 'Random Forest max_depth was constrained to 12',
  subtitle: 'The unconstrained forest scores better on training data and worse where it matters.',
  left: {
    title: 'What unconstrained depth does',
    fill: K.C.tintAccent,
    lineColour: 'F0C9B6',
    items: [
      'Training accuracy rises to approximately 1.000.',
      'Generalisation gets noticeably worse.',
      'Nothing in the output signals that anything went wrong.',
      'The failure is invisible unless train and test accuracy are reported together.',
    ],
  },
  right: {
    title: 'What the constraint bought',
    items: [
      'Training accuracy 0.965 rather than near-perfect memorisation.',
      'Test accuracy 0.928 and macro F1 0.935.',
      'A generalisation gap of +0.037, against +0.077 for both other models.',
      'A model whose training score is a believable description of what it learned.',
    ],
  },
  callout: {
    label: 'The principle',
    tone: 'primary',
    h: 0.82,
    text: 'A perfect training score is a warning, not an achievement. Constraining depth costs a little training accuracy and buys a model that behaves the same way on data it has not seen.',
  },
  note: 'Explain that the constraint was applied deliberately and that the unconstrained behaviour was checked rather than assumed. The important number is the gap: +0.037 for the constrained forest against +0.077 for the two models that reach a perfect training score. Say that this is why the report leads on the gap rather than on accuracy alone.',
});

/* 9 — section 2 */
K.sectionSlide(pres, {
  number: '02',
  title: 'The evaluation protocol',
  summary: 'Cross-validation on training data only, a test set scored once, and per-class metrics reported alongside accuracy.',
  note: 'Introduce the protocol as the part of the work that decides whether any number is worth quoting. Say that it was agreed and written down before models were fitted. The two rules that matter are where cross-validation runs and how often the test set is touched.',
});

/* 10 — protocol */
K.bulletSlide(pres, {
  kicker: 'Protocol',
  title: 'Five-fold cross-validation, then one test score',
  items: [
    { h: 'Cross-validation runs on the training partition only', t: 'Five folds, scored on macro F1, used for every model selection decision.' },
    { h: 'The test set was scored exactly once', t: 'After all model selection was complete. It was never used to choose a setting.' },
    { h: 'The split is by subject, not by frame', t: '577 training frames and 195 test frames, with whole subjects on one side or the other.' },
    { h: 'The scaler is fitted on training data only', t: 'Fitting before splitting would leak test statistics into training, and nothing in the metrics would show it.' },
    { h: 'Identical inputs for all three models', t: 'Same features, same splits, same seed, so differences are attributable to the model.' },
  ],
  callout: {
    label: 'Why this is stated so prominently',
    tone: 'primary',
    h: 0.86,
    text: 'Cross-validated macro F1 of 0.955 for the Random Forest sits above its test score of 0.935. Reporting both is what makes the difference between the two visible rather than hidden.',
  },
  note: 'Walk the five rules and note that each one exists to stop a specific way of accidentally inflating a score. The test set being scored once is the rule that is easiest to break and hardest to detect afterwards. Point out that the cross-validation score is higher than the test score, and that publishing both is the honest choice.',
});

/* 11 — per-class metrics */
K.twoColSlide(pres, {
  kicker: 'Reporting',
  title: 'Per-class metrics, not headline accuracy',
  subtitle: 'One number for a six-class problem hides the failure that would matter most to a parent.',
  left: {
    title: 'What accuracy alone hides',
    items: [
      'A class that is quietly wrong is worse than a slightly lower overall score.',
      'The largest class can carry the headline while a small class fails.',
      'calf_control has a test support of only 14 frames — its perfect score needs that caveat attached.',
      'Accuracy says nothing about which mistakes are being made.',
    ],
  },
  right: {
    title: 'What we report instead',
    items: [
      'Precision, recall and F1 for every class, with support.',
      'Macro F1 alongside accuracy, so small classes count equally.',
      'Train accuracy and test accuracy together, so the gap is visible.',
      'The full confusion matrix, so the shape of the errors is inspectable.',
    ],
  },
  note: 'Make the argument from the application: this system gives feedback to a parent, so an exercise class that is quietly misread is a worse failure than a slightly lower average. Explain that macro F1 weights every class equally, which is why it is the selection metric. Flag the small support for calf_control now, before its perfect score appears in the next section.',
});

/* 12 — section 3 */
K.sectionSlide(pres, {
  number: '03',
  title: 'Results',
  summary: 'Three models within half a point of each other on accuracy, and a clear difference in how well they generalise.',
  note: 'Signal that the numbers are about to arrive and that they should be read as a comparison rather than a score. The interesting story is in the gap column and in the per-class breakdown. Remind the audience once more that this is synthetic data.',
});

/* 13 — model comparison */
K.tableSlide(pres, {
  kicker: 'Model comparison',
  title: 'Random Forest wins narrowly, and generalises best',
  subtitle: 'Three model families, identical data and identical splits. Measured on synthetic data.',
  headers: K.MODEL_TABLE.headers,
  rows: K.MODEL_TABLE.rows,
  colW: K.MODEL_TABLE.colW,
  highlight: K.MODEL_TABLE.highlight,
  caption: 'Cross-validation is five-fold on the training partition only. The test set was scored once, after all model selection was complete.',
  callout: {
    label: 'How the winner was chosen',
    tone: 'primary',
    h: 0.9,
    text: 'Random Forest leads on macro F1 at 0.935 by a small margin, and on the generalisation gap by a large one: +0.037 against +0.077 for both alternatives.',
  },
  note: 'Read the accuracy column first and point out that 0.928 against 0.923 is not a meaningful separation on 195 test frames. Then move to the gap column, where the difference is substantial and consistent. Say that the Random Forest was selected on macro F1 and on the gap together, not on accuracy alone.',
});

/* 14 — f06 */
K.figureSlide(pres, {
  kicker: 'Figure 6',
  title: 'The three models perform within a few points of each other',
  image: K.FIG('f06_model_comparison.png'),
  caption: 'Figure 6 — test accuracy, test macro F1 and cross-validated macro F1 for the three models.',
  sideTitle: 'What the bars show',
  side: [
    'Test accuracy differs by half a percentage point across the three families.',
    'Cross-validated macro F1 is higher than the test score for every model.',
    'The error bar is one standard deviation across the five folds.',
    'On a comparison this close, the tie-breaker has to be something other than accuracy.',
  ],
  note: 'Use the figure to show visually how small the accuracy differences are, which is the argument for looking elsewhere for a decision. Explain the error bars and note that the Random Forest has both the highest cross-validated score and the widest cross-validation lead. Say that the test set was scored once and after all selection, which the figure caption repeats.',
});

/* 15 — f07 overfit gap */
K.figureSlide(pres, {
  kicker: 'Figure 7',
  title: 'The generalisation gap is the honest tie-breaker',
  image: K.FIG('f07_overfit_gap.png'),
  caption: 'Figure 7 — train against test accuracy, with the gap annotated for each model.',
  sideTitle: 'Reading the gap',
  side: [
    'Gradient Boosting and the MLP both reach 1.000 training accuracy.',
    'Both carry a +0.077 gap between training and test.',
    'The constrained Random Forest trains to 0.965 and carries +0.037.',
    'A model that memorises its training data will fail quietly on a new subject.',
  ],
  callout: {
    tone: 'accent',
    h: 0.95,
    label: 'Why this is visible at all',
    text: 'The subject-level split is what makes the gap meaningful. On a frame-level split all three gaps would have looked smaller and none of them would have meant anything.',
  },
  note: 'Point at the two bars that reach a perfect training score and say plainly that this is memorisation, not skill. Explain that the gap is only interpretable because whole subjects were held out, so the test frames are genuinely unseen. Say that this figure, more than the accuracy table, is what selected the final model.',
});

/* 16 — f09 per class */
K.figureSlide(pres, {
  kicker: 'Figure 9',
  title: 'Per-class F1 for all three models',
  image: K.FIG('f09_per_class_f1.png'),
  caption: 'Figure 9 — per-class F1 across the three model families.',
  sideTitle: 'Consistent, not coincidental',
  side: [
    'lower_limb and thread_the_needle are the weakest classes for every model.',
    'lower_limb sits at F1 approximately 0.89 to 0.90 depending on the model.',
    'thread_the_needle sits at F1 approximately 0.90 for all three.',
    'calf_control reaches 1.00 for all three, on a test support of 14 frames.',
  ],
  note: 'Draw attention to the fact that the same two classes are weakest for all three families, which points at the data rather than the algorithm. Explain that these are precisely the classes the generator was built to make confusable. Add the caveat about calf_control: a perfect score on 14 frames is not a strong result, it is a small sample.',
});

/* 17 — RF per class table */
K.tableSlide(pres, {
  kicker: 'Random Forest, per class',
  title: 'Precision, recall and F1 for every class',
  subtitle: 'The selected model, scored once on 195 held-out test frames.',
  headers: ['Class', 'Precision', 'Recall', 'F1', 'Support'],
  rows: [
    ['calf_control', '1.000', '1.000', '1.000', '14'],
    ['cat_cow', '0.971', '0.917', '0.943', '36'],
    ['childs_pose', '0.875', '1.000', '0.933', '28'],
    ['core_hip_stability', '0.927', '0.927', '0.927', '55'],
    ['lower_limb', '0.900', '0.900', '0.900', '40'],
    ['thread_the_needle', '0.950', '0.864', '0.905', '22'],
  ],
  colW: [3.49, 2.15, 2.15, 2.15, 2.15],
  highlight: [4, 5],
  caption: 'Macro F1 0.935, test accuracy 0.928. Measured on synthetic data.',
  note: 'Take the two highlighted rows first, since they are the classes that limit the model. Point at thread_the_needle, where precision is 0.950 but recall is 0.864 — the model misses it rather than over-predicting it. Then contrast childs_pose, where recall is perfect and precision is the lowest in the table, which means it is being over-predicted.',
});

/* 18 — confusion */
K.figureSlide(pres, {
  kicker: 'Figure 8',
  title: 'The errors have a shape, and it is the expected one',
  image: K.FIG('f08_confusion.png'),
  caption: 'Figure 8 — Random Forest confusion matrix on the held-out test set.',
  sideTitle: 'What the matrix says',
  side: [
    'Confusions concentrate between exercises performed in similar body positions.',
    'The quadruped-derived classes are confused with each other.',
    'The two lying-down classes are confused with each other.',
    'This structure was deliberately built into the generator, and it also appears in the PCA projection.',
  ],
  callout: {
    tone: 'primary',
    h: 0.95,
    label: 'Why this is reassuring',
    text: 'The errors are where a frame-level model should struggle: positions that look alike at a single instant. That is an argument for temporal features, not for a different classifier.',
  },
  note: 'Read the off-diagonal cells as a pattern rather than as individual mistakes, because the pattern is what carries the argument. The model is failing on frames that genuinely look alike at one instant, which is exactly the limitation of frame-level features. Say that this is the strongest evidence for the temporal modelling next step.',
});

/* 19 — feature importance */
K.figureSlide(pres, {
  kicker: 'Figure 10',
  title: 'Normalised positions carry the model',
  image: K.FIG('f10_feature_importance.png'),
  caption: 'Figure 10 — top 14 features by Random Forest importance, coloured by family.',
  sideTitle: 'The share by family',
  side: [
    'Normalised positions carry 77% of total importance.',
    'Inter-joint distances carry 14%.',
    'Angles contribute, but they do not dominate.',
    'The most useful features describe where the body is, once position and body size are normalised away.',
  ],
  callout: {
    tone: 'accent',
    h: 1.0,
    label: 'A correction we make explicitly',
    text: 'It is tempting to say the model works because it measures joint angles. It does not. Positions at 77% and distances at 14% are the load-bearing families.',
  },
  note: 'Give the two numbers first — 77 per cent for positions and 14 per cent for distances — and then say the sentence that must not be said: angles do not dominate. Explain why the intuition is wrong: once coordinates are hip-centred and divided by torso length, position already encodes most of the pose. Note that this is also a caution about reading feature importance as a causal statement.',
});

/* 20 — limitations */
K.bulletSlide(pres, {
  kicker: 'Limitations',
  title: 'What this comparison cannot settle',
  style: 'dot',
  items: [
    { h: 'The data is synthetic.', t: 'Every score describes a seeded generator, not children performing physiotherapy.' },
    { h: 'The test set is small.', t: '195 frames in total, and calf_control has a support of 14 — its per-class figures are fragile.' },
    { h: 'Half a point of accuracy is not a real separation.', t: 'The model choice rests on macro F1 and the generalisation gap, not on the accuracy column.' },
    { h: 'No temporal modelling.', t: 'Frame-level features only, so the remaining confusions are the ones a movement-over-time model should resolve.' },
    { h: 'No clinical validation.', t: 'No physiotherapist has reviewed the class definitions the model is trained to distinguish.' },
  ],
  note: 'State the synthetic caveat once more, because it governs every other item. Be specific about the small test set rather than describing it as a general limitation. Close on the absence of temporal modelling, which is both the largest limitation and the clearest next step.',
});

/* 21 — next steps */
K.bulletSlide(pres, {
  kicker: 'Next steps',
  title: 'What would move the modelling forward',
  subtitle: 'Ordered by expected effect on the numbers that currently limit the system.',
  items: [
    { h: 'Add temporal features over a sliding window', t: 'Velocity and phase across frames, then re-run this comparison unchanged. The confusion structure predicts exactly where the gain should appear.' },
    { h: 'Re-derive everything from a consented recorded dataset', t: 'Even 20 participants would replace every synthetic figure in this deck with a measured one.' },
    { h: 'Report calibrated confidence, not just a class', t: 'A system that gives feedback to a parent should be able to say when it is unsure.' },
    { h: 'Have a physiotherapist review the class definitions', t: 'The six classes come from published exercise text, and a clinical review would test whether they are the right six.' },
  ],
  note: 'Lead with temporal features, because the confusion analysis makes a specific prediction about where they would help. Explain that the second step would change the status of every number rather than the numbers themselves. Mention calibrated confidence as the change that would most improve safety in real use.',
});

/* 22 — closing */
K.closingSlide(pres, {
  title: 'A comparison built to be believed, not to look good',
  points: [
    { h: 'Three families, one protocol', t: 'Identical data, identical splits, five-fold cross-validation on training only, and a test set scored exactly once.' },
    { h: 'Selected on the right criteria', t: 'Random Forest at 0.935 macro F1 with a +0.037 gap, chosen over two models that memorised their training data.' },
    { h: 'Reported without decoration', t: 'Per-class precision, recall and F1; the weakest classes named; positions at 77% of importance, not angles.' },
  ],
  closer: 'The number worth defending is not the highest one. It is the one produced by a protocol that could have embarrassed us.',
  contact: `${MEMBER}  ·  ${ROLE}\nProject A60  ·  Module 55-708252  ·  Sheffield Hallam University  ·  Team Deepminds`,
  note: 'Close on the three points and repeat that all results are measured on synthetic data. Offer to walk through the per-class table or the cross-validation setup in questions. Thank the supervisor for the request for an explicitly honest description, which shaped how the results are presented here.',
});

pres.writeFile({ fileName: OUT }).then(() => console.log('written', OUT, 'slides:', pres._n));
