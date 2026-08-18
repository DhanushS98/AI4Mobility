# AI4Mobility — project brief

Reference document for anyone writing the report or the presentations. Every
fact here is verified against the code and the generated results. Do not invent
numbers; if something is not here, say it is not measured.

---

## 1. Identity

- **Project**: A60 — *AI4Mobility: A Multimodal Assistive Platform for Parents Supporting Children with Mobility Difficulties*
- **Module**: 55-708252, AI Research and Development Project
- **Institution**: Sheffield Hallam University, MSc
- **Team name**: Deepminds
- **Supervisor**: Alejandro

| Member | Role |
|---|---|
| Krushna Sai Teja Adhala | Data engineering and pipeline lead |
| Nandi Reddy Shashidhar Reddy | Pose estimation and visualisation lead |
| Ailuri Rupa Sri | Model development and evaluation lead |
| Dhanush Sanjay | Research and documentation lead |

Peer contribution split used in the individual reports: Krushna 28%,
Rupa Sri 26%, Shashidhar 24%, Dhanush 22%.

---

## 2. The problem

Children with cerebral palsy, developmental delay, or recovering from injury are
prescribed home physiotherapy. NHS guidance is thorough but text-heavy: a parent
receives continuous prose and must translate it into a sequence of correctly
performed movements, unsupervised, often daily. The platform intervenes at that
translation step.

---

## 3. What was built

### 3.1 The web platform (`platform/`, built to `dist/ai4mobility.html`)

A single self-contained HTML file. No server, no accounts, no storage, no
tracking. Sections: hero, Why this exists, Personalise, Exercise guide, Live pose
coach, About and sources.

**Ten exercise programmes**, 5 sourced from published NHS leaflets:

| Programme | Steps | Source |
|---|---|---|
| Lower Limb Exercises | 6 | Sheffield Children's NHS — General lower limb exercises |
| Core and Hip Stability | 7 | Sheffield Children's NHS — Core and hip stability exercises |
| Glute Strengthening | 6 | Sheffield Children's NHS — Glute strengthening |
| Calf Control | 2 | Sheffield Children's NHS — Calf control exercises |
| Wrist and Hand Exercises | 7 | Sheffield Children's NHS — Wrist exercises |
| Thread the Needle | 7 | Yoga Basics — Threading the Needle |
| Child's Pose | 6 | General practice (labelled as such) |
| Cat–Cow Stretch | 4 | General practice (labelled as such) |
| Standing Balance | 4 | General practice (labelled as such) |
| Seated Upper Body | 5 | General practice (labelled as such) |

Source URLs:
- https://library.sheffieldchildrens.nhs.uk/general-lower-limb-exercises/
- https://library.sheffieldchildrens.nhs.uk/core-and-hip-stability-exercises/
- https://library.sheffieldchildrens.nhs.uk/glute-strengthening/
- https://library.sheffieldchildrens.nhs.uk/calf-control-exercises/
- https://library.sheffieldchildrens.nhs.uk/wrist-exercises/
- https://www.yogabasics.com/asana/threading-the-needle/

**Features**
- Editable description box; **Convert to steps** rebuilds the step list from any text
- Original source description always displayed (added in direct response to supervisor feedback)
- 46 hand-authored stick-figure poses, with props (chair, wall, step, table)
- Personalisation: filter by focus area; difficulty scales reps and holds, always showing the NHS default alongside; resting positions (the 30-minute prone lie) are never scaled
- Read this step / Read full guide via the Web Speech API
- Live pose coach (see 3.3)
- Accessibility: larger text, high contrast, reduced motion, keyboard navigation, skip link, ARIA labelling

### 3.2 Step splitter (`platform/js/splitter.js`, `src/splitter.py`)

**Rule-based, NOT a language model.** No weights, no network call. Pipeline:
normalise → detect existing numbered/bulleted structure (preserved, never
re-split) → sentence segmentation with abbreviation/decimal protection → split on
connectives (`then`, `next`, `after that`, `;`) only when both halves read as
instructions → classify each fragment as action / position / hold / reps / safety
/ context → extract hold seconds and repetition counts including word numerals
("ten times") and ranges ("5 to 10 seconds" → 8 s) → score confidence per step.

Safety sentences are separated out and never presented as steps to perform.

An `LLMSplitterAdapter` seam exists in both implementations and returns `null`.
It is **not connected to any model.** Implementing it needs: a server-side proxy
holding the API key (the platform is a static page); a schema-constrained prompt
and JSON validation with the rule engine as fallback; rate limiting; and a
clinical safety review, because a model can invent an instruction that was not in
the source text.

### 3.3 Pose coach (`platform/js/posecoach.js`)

MediaPipe Pose Landmarker, running on-device. Mirrored skeleton overlay drawn on
a canvas. Compares four joint angles — elbow, knee, hip, trunk — against targets
**derived from the same hand-authored pose bank the illustrations are drawn
from**, so the child is checked against exactly the position the picture shows.
Tolerances 20–24° per joint. Reports one plain-English cue plus a per-joint
measured-vs-target breakdown. Degrades cleanly if the model cannot be fetched,
the browser has no camera, or permission is refused.

### 3.4 The classifier (`src/`)

See section 4.

---

## 4. Results — USE THESE NUMBERS EXACTLY

### 4.1 Dataset

**Synthetic, seeded (random_state=42).** Not recorded video of children, not a
public dataset. Every number below describes the generator, not children.

- Raw frames: **1,358**
- Removed in cleaning: **153 (11.3%)** — 130 missing a critical joint, 18 exact duplicate frames, 5 detector confidence below 0.55, 0 coordinates outside the frame
- Usable frames: **1,205**
- Features: **45** — 26 normalised coordinates, 9 joint angles, 9 inter-joint distances, 1 detector quality
- Train / test: **577 / 195**, split **by subject**, not by frame
- Classes: 6 — calf_control, cat_cow, childs_pose, core_hip_stability, lower_limb, thread_the_needle
- Requested frames per class: lower_limb 300, core_hip_stability 275, cat_cow 240, childs_pose 210, thread_the_needle 165, calf_control 150
- Annotation label noise: **6%** within confusable families (quadruped-derived classes; lying-down classes)
- **No landmark is imputed** — occlusion is pose-dependent, so mean-filling would manufacture samples for exactly the hardest classes

### 4.2 Model comparison

| Model | Test accuracy | Test macro F1 | CV macro F1 (5-fold, train only) | Train accuracy | Generalisation gap |
|---|---|---|---|---|---|
| **Random Forest** | **0.928** | **0.935** | 0.955 ± 0.017 | 0.965 | +0.037 |
| Gradient Boosting | 0.923 | 0.931 | 0.939 ± 0.016 | 1.000 | +0.077 |
| Neural Network (MLP) | 0.923 | 0.932 | 0.939 ± 0.019 | 1.000 | +0.077 |

**Best model: Random Forest** — narrowly, on macro F1, and with by far the
smallest generalisation gap. Its `max_depth` was constrained to 12 deliberately;
unrestricted it reaches ~1.000 training accuracy and generalises worse.

The test set was scored **once**, after all model selection was complete.

### 4.3 Weakest classes

Consistent across all three models: **lower_limb (F1 ≈ 0.89–0.90)** and
**thread_the_needle (F1 ≈ 0.90)**. Confusions concentrate between exercises
performed in similar body positions — quadruped-derived classes with each other,
and the two lying-down classes with each other. This structure was deliberately
built into the generator and also appears in the PCA projection.

### 4.4 Other verified numbers

- PCA: first two components account for **52.3%** of total variance — an indication of separability, not proof
- Feature importance: **normalised positions carry 77%** of total importance, inter-joint distances 14%. (Do NOT claim angles dominate — they do not.)
- Splitter vs reviewed step lists: exact match on **2 of 10** programmes. Mean confidence **0.78**. The mismatches are on multi-exercise NHS leaflets where one reviewed "step" covers a whole sub-exercise, so the splitter produces more steps. This is shown in the interface rather than hidden.
- Tests: **24** JS splitter tests, **25** pose-coach tests, **41** Python checks including full JS↔Python parity — **90 total, all passing**

---

## 5. Figures (`docs/figures/`)

| File | Shows |
|---|---|
| f01_pose_gallery.png | Representative pose per class (frame closest to class mean) |
| f02_class_balance.png | Usable frames per class after cleaning |
| f03_cleaning.png | 11.3% removed, and the reason for each removal |
| f04_angle_distributions.png | Joint-angle boxplots by class |
| f05_pca.png | PCA projection, 52.3% variance in two components |
| f06_model_comparison.png | Accuracy / macro F1 / CV F1 for the three models |
| f07_overfit_gap.png | Train vs test accuracy with the gap annotated |
| f08_confusion.png | Random Forest confusion matrix |
| f09_per_class_f1.png | Per-class F1 for all three models |
| f10_feature_importance.png | Top 14 features by importance, coloured by family |
| f11_splitter.png | Splitter output vs reviewed step counts |
| f12_coach_targets.png | Target joint angles per pose family |

---

## 6. Honesty register — what is NOT built

State these plainly. The supervisor explicitly asked for an honest description
with clear next steps for anything unimplemented.

| Item | Status | Detail |
|---|---|---|
| LLM-based step splitting | **NOT built** | Adapter seam returns null. Needs server-side key, schema validation, rate limiting, clinical safety review. |
| Real recorded dataset | **NOT obtained** | Synthetic only. Needs ethical approval, consent, safeguarding. |
| Temporal / sequence modelling | **NOT built** | Frame-level features only. The remaining confusions are precisely what a movement-over-time model would be expected to resolve. |
| Clinical validation | **NOT done** | No physiotherapist has reviewed the step lists, illustrations or coach tolerances. |
| User evaluation | **NOT done** | No child has used the platform. |
| Accounts, saved history, therapist dashboard | **NOT built** | No backend at all. |
| Generative illustrations | **NOT built** | 46 poses are hand-authored, a stand-in for a generative vision model. |
| Pose coach calibration | **NOT validated** | 20–24° tolerances are engineering judgement, not clinical thresholds. |

---

## 7. Supervisor feedback and how it was addressed

Alejandro's email asked for five things:

1. **"Are you submitting a report with it?"** → Yes, plus source code.
2. **"Add the original exercise description"** → Done. Every programme stores its source text verbatim and displays it in the interface.
3. **"Add a text box for the person to add the description manually"** → Done. The description box is editable and drives the step list.
4. **"Are you using an LLM to split the exercise in steps?"** → No. Rule-based, documented above. The report must say this explicitly.
5. **"Make an honest description in the report — if something is not implemented, describe it clearly and say what the next step would be"** → Section 6 above.

---

## 8. Next steps (in priority order)

1. Obtain ethical approval and record a small consented dataset — even 20 participants would let every number be re-derived from reality.
2. Add temporal features over a sliding window and re-run the comparison; the confusion structure predicts where the gain appears.
3. Have a physiotherapist review the generated step lists and the coach tolerances.
4. Connect a language model to the splitter behind a validating proxy, keeping the rule engine as fallback.
5. Evaluate with families: does the platform change whether the exercises get done, and done correctly?

---

## 9. Writing rules

- British English throughout.
- Never claim a result the numbers do not support. Where evidence is weak, say so.
- Label every result as **measured on synthetic data** where that applies.
- Do not use the words "revolutionary", "cutting-edge", "seamless", "leverage".
- No emoji in the report or the slides.
- Figures are referenced as "Figure N" and every one must be discussed in the text, not just placed.
