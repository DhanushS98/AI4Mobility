# AI4Mobility

**A Multimodal Assistive Platform for Parents Supporting Children with Mobility Difficulties**

Group project A60 · Module 55-708252 — AI Research and Development Project
MSc, Sheffield Hallam University · Team **Deepminds**

---

## What this is

A web platform that takes a written exercise description, separates it into
numbered steps, and presents each step with an illustration, a timer, a spoken
prompt and optional live feedback from the camera on the position being held.

It ships with ten exercise programmes drawn from published NHS paediatric
physiotherapy resources. The description box is editable, so any programme can
be adjusted or replaced with a description of your own and re-converted.

Everything runs in the browser. There is no server, no account system and no
tracking. The only network request is fetching the pose model the first time the
camera is used.

---

## Honesty statement

This section is deliberately first, because a reviewer should not have to hunt
for it.

| Component | Status | Detail |
|---|---|---|
| Ten exercise programmes with sources | **Built** | Lower limb, core and hip stability, glute strengthening, calf control, wrist and hand, Child's Pose, Cat–Cow, Thread the Needle, standing balance and seated upper body. |
| Original description shown beside generated steps | **Built** | Added in response to supervisor feedback. Source text stored verbatim per programme. |
| Rule-based step splitting | **Built** | Deterministic linguistic pipeline. 24 unit tests, all passing. |
| Description-to-steps conversion in the interface | **Built** | The description box on the Practise screen rebuilds the step list from whatever text is entered, whether it came from a programme or was typed by hand. |
| Live pose estimation from the camera | **Built** | MediaPipe Pose Landmarker running on-device, with target joint angles derived from the same pose bank the illustrations are drawn from. Needs an internet connection the first time to fetch the model, and degrades cleanly if the camera or model is unavailable. |
| **LLM-based step splitting** | **NOT built** | An adapter interface exists in `platform/js/splitter.js` and returns `null`. It is not connected to any model. See *Next steps* below for what would be required. |
| Stick-figure illustrations | **Partly** | All 46 poses render, but from hand-authored joint coordinates rather than from captured motion. They double as the reference the pose coach compares against. |
| Read-aloud | **Partly** | Uses the browser's built-in speech synthesis. Nothing is bundled; quality depends on the device. |
| Progress tracking | **Partly** | Per-visit only. No storage, so nothing persists. |
| Personalisation (condition filter, difficulty) | **Built** | Filters the guide by focus area and scales reps and hold times, always displaying the NHS default alongside the adjusted figure. Resting positions such as the 30-minute prone lie are never scaled. |
| Accessibility controls | **Built** | Large text, high contrast, calm/reduced-motion, keyboard navigation, skip link, ARIA labelling. |
| Accounts / therapist dashboard | **NOT built** | No backend of any kind. |
| Clinical or user evaluation | **NOT done** | No child and no clinician has used this. The largest gap in the project. |

This table is kept in the repository and the project report rather than in the
interface, so that what a parent sees stays focused on the exercises.

---

## Is the step splitter an LLM?

**No.** It is a rule-based linguistic engine, implemented in
[`platform/js/splitter.js`](platform/js/splitter.js). The pipeline is:

1. **Normalise** — unify quotes, dashes and whitespace.
2. **Detect explicit structure** — if the author already numbered or bulleted
   their steps, that structure is preserved and never re-split.
3. **Segment** — sentence segmentation with abbreviation and decimal protection.
4. **Split compounds** — break on connectives (`then`, `next`, `after that`,
   `;`) *only* when both halves independently read as instructions. This is what
   stops "lift your leg and keep it level" collapsing into two useless fragments.
5. **Classify** — each fragment becomes `action`, `position`, `hold`, `reps`,
   `safety` or `context`. Safety lines are pulled out and displayed separately
   rather than presented as steps to perform.
6. **Extract parameters** — hold durations and repetition counts, including word
   numerals ("ten times") and ranges ("hold for 5 to 10 seconds" → 8 s).
7. **Score** — a per-step and overall confidence, surfaced in the interface.

It is fully deterministic, inspectable, and runs offline.

### Why not an LLM?

An LLM would handle messier, more conversational descriptions better, and that
is the obvious next step. It was not done here because doing it *properly*
requires four things this project does not have:

1. A server-side proxy holding the API key — the platform is a static page, so a
   key placed in it would be public.
2. A schema-constrained prompt and validation of the returned JSON, with the
   rule-based splitter retained as the fallback path.
3. A rate limiting and cost story.
4. **A clinical safety review.** A model can invent an instruction that was not
   in the source description. That is a materially different risk from a rule
   that can only ever rearrange text the parent supplied. It is also why the
   interface already displays the original description beside the generated
   steps — that mitigation is in place regardless of which splitter runs.

The adapter seam is at `LLMSplitterAdapter` in `splitter.js`; swapping in a real
implementation is a one-file change.

---

## Repository layout

```
ai4mobility/
├── platform/               the web interface
│   ├── index.html          page structure
│   ├── css/styles.css      interface styles
│   ├── js/splitter.js      step-splitting engine  (rule-based)
│   ├── js/poses.js         stick-figure renderer  (46 poses)
│   ├── js/posecoach.js     live pose estimation and joint-angle feedback
│   ├── js/app.js           application logic
│   ├── js/data.js          AUTO-GENERATED from data/exercises.json
│   └── build.py            regenerates data.js and inlines everything to dist/
├── src/                    Python pipeline used by the notebook
│   ├── splitter.py         Python mirror of the JS splitter
│   ├── data_prep.py        loading, merging, cleaning, scaling, splitting
│   ├── features.py         joint angles and inter-joint distances
│   ├── models.py           Random Forest / Gradient Boosting / MLP comparison
│   └── visualise.py        skeleton drawing and result figures
├── notebooks/
│   └── AI4Mobility.ipynb   full analysis notebook
├── data/
│   └── exercises.json      single source of truth for exercise content
├── tests/
│   ├── test_splitter.js    24 tests for the JS splitter
│   ├── test_posecoach.js   22 tests for the pose-coach angle maths
│   └── test_splitter.py    parity tests for the Python mirror
├── docs/
│   ├── report/             project report
│   ├── presentations/      slide decks
│   └── figures/            generated figures
└── dist/
    └── ai4mobility.html    single-file build, opens with no server
```

---

## Running it

### The platform

No build step is needed to view it:

```bash
git clone <your-repo-url>
cd ai4mobility
python3 -m http.server 8000 --directory platform
# open http://localhost:8000
```

Or open `dist/ai4mobility.html` directly — it is fully self-contained.

To rebuild `dist/` and regenerate `platform/js/data.js` after editing
`data/exercises.json`:

```bash
python3 platform/build.py
```

### The tests

```bash
node tests/test_splitter.js      # 24 tests
node tests/test_posecoach.js     # 22 tests
python3 -m pytest tests/ -q      # Python mirror parity
```

### The notebook

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
jupyter notebook notebooks/AI4Mobility.ipynb
```

The notebook also runs in Google Colab. Where an optional dependency is missing
it prints exactly what would have run rather than failing silently.

---

## Exercise content and sources

| Programme | Source |
|---|---|
| Lower Limb Exercises | [Sheffield Children's NHS Foundation Trust — General lower limb exercises](https://library.sheffieldchildrens.nhs.uk/general-lower-limb-exercises/) |
| Paediatric Physiotherapy (core and hip stability) | [Sheffield Children's NHS Foundation Trust — Core and hip stability exercises](https://library.sheffieldchildrens.nhs.uk/core-and-hip-stability-exercises/) |
| Calf Control *(optional extra)* | [Sheffield Children's NHS Foundation Trust — Calf control exercises](https://library.sheffieldchildrens.nhs.uk/calf-control-exercises/) |
| Thread the Needle | [Yoga Basics — Threading the Needle](https://www.yogabasics.com/asana/threading-the-needle/) |
| Child's Pose | Standard therapeutic resting posture — described from general practice, not copied from a single leaflet |
| Cat–Cow Stretch | Widely used paediatric mobility exercise — described from general practice, not copied from a single leaflet |

Each programme stores its source verbatim in `data/exercises.json` and displays
it in the interface. Where the wording is ours rather than a source's, the
`evidence_label` field says so explicitly.

---

## Next steps

1. **Connect a language model to the splitter** — see the four requirements above.
2. **Validate the pose feedback clinically** — the coach compares four joint
   angles against a hand-authored reference. Those tolerances have not been
   checked by a physiotherapist, and no child has used it. Before any real use
   it needs clinical review and an ethics amendment covering camera use.
3. **Persistence** — a small backend so a child's history survives between
   visits and a physiotherapist can see adherence between appointments.
4. **Evaluate with real families** — nothing here has been tested with a child or
   a clinician. This is the single biggest gap.

---

## Team

| Member | Role |
|---|---|
| Krushna Sai Teja Adhala | Data engineering and pipeline lead |
| Nandi Reddy Shashidhar Reddy | Pose estimation and visualisation lead |
| Ailuri Rupa Sri | Model development and evaluation lead |
| Dhanush Sanjay | Research and documentation lead |

---

## Disclaimer

This is a student project. It is **not** a medical device and **not** a
substitute for professional physiotherapy advice. If a child has been given a
specific programme by a clinician, that programme should be followed. Stop any
exercise that causes pain and seek advice.

## Licence

MIT — see [LICENSE](LICENSE). Exercise content adapted from the NHS and other
sources listed above remains the property of those publishers and is used here
for educational purposes with attribution.
