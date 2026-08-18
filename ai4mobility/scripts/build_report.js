/* =============================================================================
   AI4Mobility — project report generator
   -----------------------------------------------------------------------------
   Builds docs/report/AI4Mobility_Project_Report.docx from the verified figures
   in docs/figures/ and the numbers in docs/BRIEF.md / docs/results.json.

   Every number in this document comes from those two files. Nothing is invented.

   Run:  node scripts/build_report.js
   A second pass picks up /tmp/toc_pages.json (written by the build helper after
   a first PDF render) so the table of contents carries real page numbers.
   ============================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const DOCX = '/home/claude/.npm-global/lib/node_modules/docx';
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel,
  ImageRun, LevelFormat, PageBreak, PageNumber, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} = require(DOCX);

const ROOT = path.resolve(__dirname, '..');
const FIGDIR = path.join(ROOT, 'docs', 'figures');
const OUT = path.join(ROOT, 'docs', 'report', 'AI4Mobility_Project_Report.docx');

const results = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'results.json'), 'utf8'));

/* ------------------------------------------------------------------ layout */

const CONTENT_DXA = 9026;          // A4 (11906) minus 1440 dxa margins each side
const ACCENT = '1F3864';
const SUBTLE = 'EAEEF5';
const RULE = 'B4BFD4';

let listInstance = 100;
const nextInstance = () => ++listInstance;

/* ------------------------------------------------------------------ helpers */

// Minimal inline markup: **bold** and *italic*.
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...base }));
    } else {
      out.push(new TextRun({ text: tok.slice(1, -1), italics: true, ...base }));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

function P(text, opts = {}) {
  const { size = 22, spacing = { before: 0, after: 140, line: 300 },
    align = AlignmentType.JUSTIFIED, italics = false, indent, keepNext = false,
    color, bold = false } = opts;
  return new Paragraph({
    children: runs(text, { size, italics, color, bold }),
    spacing, alignment: align, indent, keepNext,
  });
}

function H1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 30, color: ACCENT })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
  });
}

function H2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 25, color: ACCENT })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    keepNext: true,
  });
}

function H3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    keepNext: true,
  });
}

function bullets(items) {
  const inst = nextInstance();
  return items.map((t) => new Paragraph({
    children: runs(t, { size: 22 }),
    numbering: { reference: 'a4m-bullet', level: 0, instance: inst },
    spacing: { before: 0, after: 80, line: 290 },
    alignment: AlignmentType.JUSTIFIED,
  }));
}

function numbered(items) {
  const inst = nextInstance();
  return items.map((t) => new Paragraph({
    children: runs(t, { size: 22 }),
    numbering: { reference: 'a4m-number', level: 0, instance: inst },
    spacing: { before: 0, after: 80, line: 290 },
    alignment: AlignmentType.JUSTIFIED,
  }));
}

function cell(text, { widthDxa, bold = false, shade = null, align = AlignmentType.LEFT,
  size = 19, italics = false } = {}) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    verticalAlign: VerticalAlign.CENTER,
    children: String(text).split('\n').map((line) => new Paragraph({
      children: runs(line, { size, bold, italics }),
      alignment: align,
      spacing: { before: 0, after: 0, line: 260 },
    })),
  });
}

/**
 * Table with dual widths (columnWidths on the table, width on every cell),
 * both in DXA as required for correct rendering outside Word.
 */
function table(headers, rows, weights, opts = {}) {
  const { headAlign = AlignmentType.LEFT, bodyAlign = null, size = 19 } = opts;
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.round((w / total) * CONTENT_DXA));
  widths[widths.length - 1] = CONTENT_DXA - widths.slice(0, -1).reduce((a, b) => a + b, 0);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, {
      widthDxa: widths[i], bold: true, shade: SUBTLE,
      align: i === 0 ? AlignmentType.LEFT : headAlign, size,
    })),
  });

  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((c, i) => cell(c, {
      widthDxa: widths[i],
      shade: ri % 2 === 1 ? 'F7F9FC' : null,
      align: i === 0 ? AlignmentType.LEFT : (bodyAlign || AlignmentType.LEFT),
      size,
      bold: typeof c === 'string' && c.startsWith('**') && c.endsWith('**') ? false : false,
    })),
  }));

  return new Table({
    columnWidths: widths,
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    rows: [headerRow, ...bodyRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: RULE },
    },
  });
}

function caption(text) {
  return new Paragraph({
    children: runs(text, { size: 18, italics: false, color: '444444' }),
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 220 },
  });
}

function tableCaption(text) {
  return new Paragraph({
    children: runs(text, { size: 18, color: '444444' }),
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 200 },
  });
}

const MM_PX = 96 / 25.4;
const figSizes = {}; // filled lazily

function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Embed a figure at a fixed width in millimetres, preserving aspect ratio. */
function figure(fileName, number, captionText, widthMm = 150) {
  const file = path.join(FIGDIR, fileName);
  const { w, h } = figSizes[fileName] || (figSizes[fileName] = pngSize(file));
  const wpx = Math.round(widthMm * MM_PX);
  const hpx = Math.round(wpx * (h / w));
  return [
    new Paragraph({
      children: [new ImageRun({
        type: 'png',
        data: fs.readFileSync(file),
        transformation: { width: wpx, height: hpx },
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 40 },
      keepNext: true,
    }),
    caption(`**Figure ${number}.** ${captionText}`),
  ];
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function quoteBox(lines) {
  return new Table({
    columnWidths: [CONTENT_DXA],
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_DXA, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: SUBTLE, color: 'auto' },
        margins: { top: 140, bottom: 140, left: 180, right: 180 },
        children: lines.map((l) => new Paragraph({
          children: runs(l, { size: 21 }),
          spacing: { before: 0, after: 70, line: 290 },
          alignment: AlignmentType.JUSTIFIED,
        })),
      })],
    })],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
  });
}

function spacer(after = 160) {
  return new Paragraph({ children: [new TextRun({ text: '', size: 12 })], spacing: { after } });
}

/* ------------------------------------------------------------- title page */

function titlePage() {
  const t = (text, opts = {}) => new Paragraph({
    children: runs(text, { size: opts.size || 22, bold: opts.bold, color: opts.color }),
    alignment: AlignmentType.CENTER,
    spacing: { before: opts.before || 0, after: opts.after || 120 },
  });

  return [
    spacer(600),
    t('Sheffield Hallam University', { size: 26, bold: true, color: ACCENT }),
    t('MSc — Department of Computing', { size: 22 }),
    t('Module 55-708252: AI Research and Development Project', { size: 22, after: 500 }),
    new Paragraph({
      children: [new TextRun({ text: '', size: 12 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 4 } },
      spacing: { after: 320 },
    }),
    t('Group Project A60', { size: 24, bold: true, after: 200 }),
    t('AI4Mobility', { size: 48, bold: true, color: ACCENT, after: 160 }),
    t('A Multimodal Assistive Platform for Parents Supporting Children with Mobility Difficulties',
      { size: 28, after: 320 }),
    new Paragraph({
      children: [new TextRun({ text: '', size: 12 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 4 } },
      spacing: { after: 400 },
    }),
    t('Team Deepminds', { size: 26, bold: true, after: 240 }),
    table(
      ['Member', 'Role'],
      [
        ['Krushna Sai Teja Adhala', 'Data engineering and pipeline lead'],
        ['Nandi Reddy Shashidhar Reddy', 'Pose estimation and visualisation lead'],
        ['Ailuri Rupa Sri', 'Model development and evaluation lead'],
        ['Dhanush Sanjay', 'Research and documentation lead'],
      ],
      [40, 60], { size: 21 },
    ),
    spacer(320),
    t('Supervisor: Alejandro', { size: 22, after: 100 }),
    t('Submitted: August 2026', { size: 22, after: 400 }),
    new Paragraph({
      children: runs('This is a student project. It is not a medical device and not a substitute for professional physiotherapy advice. All quantitative results reported here were measured on a synthetic dataset.',
        { size: 18, italics: true, color: '555555' }),
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
    }),
  ];
}

/* --------------------------------------------------- table of contents data */

const TOC = [
  ['Abstract', 1],
  ['1  Introduction', 1],
  ['1.1  Background and problem statement', 2],
  ['1.2  Aim', 2],
  ['1.3  Objectives', 2],
  ['1.4  Research questions', 2],
  ['1.5  Scope, and what this report does not claim', 2],
  ['1.6  Structure of this report', 2],
  ['2  Literature and background', 1],
  ['2.1  The status of this survey', 2],
  ['2.2  Adherence to home physiotherapy programmes', 2],
  ['2.3  Accessibility of written clinical guidance', 2],
  ['2.4  Pose estimation in rehabilitation', 2],
  ['2.5  Turning instructional text into steps', 2],
  ['2.6  Why a rule-based splitter rather than a language model', 2],
  ['2.7  The gap this project addresses', 2],
  ['3  Methodology', 1],
  ['3.1  Overview of the pipeline', 2],
  ['3.2  Step 1 — dataset construction', 2],
  ['3.3  Step 2 — cleaning', 2],
  ['3.4  Step 3 — why nothing is imputed', 2],
  ['3.5  Step 4 — feature engineering', 2],
  ['3.6  Step 5 — exploratory structure check', 2],
  ['3.7  Step 6 — the subject-level split', 2],
  ['3.8  Step 7 — scaling fitted on training data only', 2],
  ['3.9  Step 8 — model choice and hyperparameters', 2],
  ['3.10  Step 9 — evaluation protocol', 2],
  ['3.11  Reproducibility and testing', 2],
  ['4  The platform', 1],
  ['4.1  Architecture', 2],
  ['4.2  The ten programmes and their sources', 2],
  ['4.3  The step-splitting engine', 2],
  ['4.4  The LLM adapter seam', 2],
  ['4.5  The illustration system', 2],
  ['4.6  The pose coach', 2],
  ['4.7  Personalisation', 2],
  ['4.8  Accessibility', 2],
  ['4.9  Privacy by construction', 2],
  ['5  Results', 1],
  ['5.1  Model comparison', 2],
  ['5.2  Overfitting and the generalisation gap', 2],
  ['5.3  Confusion analysis', 2],
  ['5.4  Per-class performance', 2],
  ['5.5  Feature importance', 2],
  ['5.6  Step splitter evaluation', 2],
  ['5.7  Pose coach target angles', 2],
  ['5.8  Test suite', 2],
  ['6  Discussion', 1],
  ['7  Honest implementation status', 1],
  ['8  Ethics and safeguarding', 1],
  ['9  Limitations', 1],
  ['10  Conclusions and future work', 1],
  ['References', 1],
  ['Appendix A  Repository structure and how to run everything', 1],
  ['Appendix B  Full per-class metrics for all three models', 1],
];

function tocParagraphs(pageMap) {
  return TOC.map(([title, level]) => {
    const page = pageMap[title] != null ? String(pageMap[title]) : '';
    return new Paragraph({
      children: [
        new TextRun({ text: title, size: level === 1 ? 22 : 21, bold: level === 1 }),
        new TextRun({ text: '\t' + page, size: level === 1 ? 22 : 21, bold: level === 1 }),
      ],
      tabStops: [{ type: 'right', position: CONTENT_DXA - 60, leader: 'dot' }],
      indent: { left: level === 1 ? 0 : 340 },
      spacing: { before: level === 1 ? 120 : 0, after: 40, line: 280 },
    });
  });
}

/* ------------------------------------------------------------------ content */

function buildBody(pageMap) {
  const c = [];
  const push = (...items) => items.forEach((i) => c.push(...(Array.isArray(i) ? i : [i])));

  /* ---------------------------------------------------------- Abstract */
  push(H1('Abstract'));
  push(P('Children with cerebral palsy, developmental delay or recovery from injury are routinely prescribed home physiotherapy. The guidance that accompanies those prescriptions is thorough but text-heavy: a parent receives continuous prose and must translate it, unsupervised and often daily, into a sequence of correctly performed movements. This project, AI4Mobility, addresses that translation step. It delivers a self-contained web platform that takes a written exercise description, separates it into ordered steps, and presents each step with a stick-figure illustration, a timer, a spoken prompt and optional live feedback on the position being held from the device camera. Ten programmes are shipped, five of them taken from published Sheffield Children’s NHS leaflets and one from a published yoga reference, with the original source description displayed verbatim beside every generated step list. The step splitter is a rule-based linguistic engine, not a language model; an adapter seam for a model exists but is deliberately unimplemented, and the report states plainly what connecting one would require. Alongside the platform, a six-class exercise-pose classifier was built to test whether frame-level skeletal features can distinguish exercise types. Because recording children requires ethical approval, consent and safeguarding that this project does not have, the classifier was trained on a seeded synthetic dataset of 1,358 raw frames, reduced to 1,205 after cleaning and 45 engineered features. Split by subject rather than by frame, a Random Forest reached 0.928 test accuracy and 0.935 macro F1 with a generalisation gap of +0.037, ahead of Gradient Boosting and a multilayer perceptron. Every accuracy figure in this report is a property of that generator, not evidence about real children. The report closes with an explicit register of what is built, what is partly built and what is not built at all, each with the next step required.'));
  push(P('**Keywords:** paediatric physiotherapy, home exercise adherence, pose estimation, rule-based text segmentation, accessible interface design, synthetic data.'));

  /* ------------------------------------------------------ 1 Introduction */
  push(pageBreak(), H1('1  Introduction'));

  push(H2('1.1  Background and problem statement'));
  push(P('A paediatric physiotherapist sees a child intermittently. Between appointments the therapy happens at home, delivered by a parent or carer who has no clinical training, working from a leaflet. The leaflets themselves are good: the Sheffield Children’s NHS Foundation Trust materials used as source content in this project are clear, illustrated in places, and written for a lay reader. They are nevertheless continuous prose. A single paragraph may contain a starting position, two distinct movements, a hold duration, a repetition count and a safety caveat, and the parent has to hold all of that in mind while also managing a child who may not want to do the exercise at all.'));
  push(P('The failure mode is not that parents cannot read. It is that prose is a poor interface for a timed, sequential, physical task performed under distraction. The parent must decide where one step ends and the next begins, remember how long a position is meant to be held, and judge whether the child’s position is roughly right. Each of those three decisions is a place where a piece of software can help without pretending to be a clinician.'));
  push(P('AI4Mobility was built around that observation. The platform does not diagnose, does not prescribe and does not replace the leaflet. It restates the leaflet’s own words in a form that is easier to follow: numbered steps, one on screen at a time, with a picture of the position, a timer for holds, a spoken prompt, and — where the family chooses to use the camera — an indication of whether the four joint angles the platform tracks are near the position the picture shows. The original description is always visible beside the generated steps, so a parent can check the transformation rather than trust it.'));

  push(H2('1.2  Aim'));
  push(quoteBox([
    'To design, build and honestly evaluate an assistive platform that converts written paediatric physiotherapy guidance into an accessible, step-by-step, multimodal format for parents at home, and to establish through a controlled machine-learning study whether frame-level skeletal features are sufficient to distinguish exercise types — while stating precisely which claims the available evidence supports and which it does not.',
  ]));

  push(H2('1.3  Objectives'));
  push(P('The aim was decomposed into seven objectives, each of which maps onto a section of this report.'));
  push(numbered([
    'Review the problem space — home physiotherapy adherence, the accessibility of written clinical guidance, pose estimation in rehabilitation, and the segmentation of instructional text — at a level appropriate to a taught postgraduate project.',
    'Assemble a corpus of ten exercise programmes from published sources, storing each source description verbatim and labelling its provenance.',
    'Design and implement a deterministic, inspectable engine that segments a free-text exercise description into ordered, actionable steps with extracted hold durations and repetition counts.',
    'Build a browser-only interface that presents those steps multimodally — illustration, text, timer and speech — and that meets recognised accessibility expectations.',
    'Implement on-device pose estimation that compares a child’s measured joint angles against targets derived from the same reference the illustrations are drawn from.',
    'Construct a reproducible machine-learning pipeline — dataset, cleaning, feature engineering, splitting, scaling, model comparison — and evaluate three model families on identical data under an honest protocol.',
    'Produce an explicit register of what has and has not been implemented, with the concrete next step for every gap.',
  ]));

  push(H2('1.4  Research questions'));
  push(numbered([
    '**RQ1.** Can a deterministic rule-based engine segment published paediatric physiotherapy descriptions into step lists that agree with a human-reviewed segmentation, and where does it disagree?',
    '**RQ2.** Are frame-level skeletal features — normalised positions, joint angles and inter-joint distances — sufficient to distinguish six exercise classes, or does the residual error concentrate in a way that indicates a missing modelling ingredient?',
    '**RQ3.** Which model family generalises best on this task, judged not on headline accuracy alone but on macro F1, per-class behaviour and the gap between training and test performance?',
    '**RQ4.** Which feature families actually carry the discriminative signal, and does that match the intuition that drove the feature design?',
    '**RQ5.** What would be required, technically and ethically, to move each unimplemented component of the platform from a stub to something safe to put in front of a family?',
  ]));

  push(H2('1.5  Scope, and what this report does not claim'));
  push(P('Three boundaries are stated at the outset because they qualify everything that follows.'));
  push(bullets([
    '**The dataset is synthetic.** No child was recorded. The classifier was trained and tested on a seeded generator described in Section 3.2. Every accuracy, F1 and confusion figure in this report is a property of that generator. It is evidence that the pipeline is correctly constructed and that the feature design behaves as intended; it is not evidence about real children performing real exercises.',
    '**The step splitter is rule-based, not a language model.** No model weights are loaded and no network request is made by the splitter. This is stated here, in the abstract, in Section 4.3 and in the honesty register in Section 7, because the supervisor asked the question directly.',
    '**Nothing has been clinically or user-validated.** No physiotherapist has reviewed the generated step lists, the illustrations or the pose-coach tolerances, and no child has used the platform. That is the single largest gap in the project and is treated as such rather than mentioned in passing.',
  ]));

  push(H2('1.6  Structure of this report'));
  push(P('Section 2 surveys the background. Section 3 sets out the methodology in the detail requested — each step of the data pipeline, why it is done that way, and what the alternative would have cost. Section 4 describes the platform, including a stage-by-stage account of the step-splitting engine. Section 5 presents the results, with every figure discussed. Section 6 interprets them. Section 7 is the honest implementation register. Sections 8 to 10 cover ethics, limitations and conclusions, followed by references and two appendices.'));

  /* ------------------------------------------- 2 Literature and background */
  push(pageBreak(), H1('2  Literature and background'));

  push(H2('2.1  The status of this survey'));
  push(P('This is a student literature survey conducted within a taught postgraduate module, not a systematic review. It was assembled by reading a small number of accessible sources and the published NHS materials that supply the platform’s exercise content. It has no protocol, no formal search strategy, no inclusion criteria and no quality appraisal, and it makes no claim to completeness. Where a statement below reflects general professional understanding rather than a specific source that was read for this project, that is said explicitly and the statement carries no citation. Those uncited statements should be treated as motivation for the design, not as evidence.'));

  push(H2('2.2  Adherence to home physiotherapy programmes'));
  push(P('The clinical value of a home exercise programme depends on it being done, and done approximately correctly. This is the recurring theme in the professional discussion around paediatric rehabilitation, and it is why guidance such as the NICE guideline on cerebral palsy in under-25s (NICE, 2017) frames physiotherapy as an ongoing, family-delivered activity rather than a clinic-only intervention. The specific barriers most often described — time pressure, competing demands on a parent’s attention, uncertainty about whether the movement is being performed correctly, and the loss of confidence that follows from that uncertainty — are stated here from general understanding rather than from a measured study read for this project, and are therefore uncited.'));
  push(P('The design consequence taken from this is narrow and defensible. If uncertainty about correctness is a barrier, then any intervention that reduces it — a picture of the target position, a timer that removes the need to count, a plain-language cue when a joint angle is far from the reference — is worth building even in the absence of a measured effect size. Whether it changes adherence is an empirical question that this project has not answered and cannot answer without the family evaluation described in Section 10.'));

  push(H2('2.3  Accessibility of written clinical guidance'));
  push(P('Patient information leaflets are written to be readable, but readability and usability are different properties. A leaflet is optimised for being read once, in a clinic, by an adult who is not simultaneously supervising a child. A home exercise session is a different context: intermittent attention, hands occupied, and a need to know one thing at a time. The Web Content Accessibility Guidelines (W3C, 2023) provide the standard vocabulary for the interface-level part of this problem — sufficient contrast, resizable text, keyboard operability, motion reduction and programmatically determinable structure — and the platform implements those directly, as described in Section 4.8.'));
  push(P('What WCAG does not address is the structural transformation from prose into steps, which is the specific contribution of this project. A leaflet that is perfectly accessible as a document is still a wall of prose when what is needed is step three of seven, held for ten seconds, repeated five times.'));

  push(H2('2.4  Pose estimation in rehabilitation'));
  push(P('Markerless human pose estimation has moved within a few years from research systems requiring dedicated hardware to models that run on a laptop or phone in real time. BlazePose (Bazarevsky et al., 2020), the architecture underlying the MediaPipe Pose Landmarker used in this project (Google, 2023), produces 33 body landmarks per frame at interactive rates from a single RGB camera and executes in the browser through WebAssembly. That combination — no specialist hardware, no upload of video — is what makes camera-based feedback plausible in a domestic setting where sending footage of a child to a server would be an unacceptable design.'));
  push(P('Applications of pose estimation to rehabilitation described in the wider literature generally follow one of two patterns: classify what exercise is being performed, or score how well a known exercise is being performed. This project does both, in separate components. The classifier in Section 3 addresses the first, in an offline study on synthetic data. The pose coach in Section 4.6 addresses the second, using explicit joint-angle comparison rather than a learned quality model, because an explicit comparison can be inspected and explained to a parent whereas a learned score cannot. The general observation that pose-based rehabilitation systems tend to struggle with occlusion and with movements that differ mainly in timing rather than in static configuration is stated from general understanding and is uncited; it is, however, exactly the pattern the results in Section 5 reproduce.'));

  push(H2('2.5  Turning instructional text into steps'));
  push(P('Segmenting procedural text into discrete actionable steps is a long-standing natural-language processing problem, familiar from recipe parsing, assembly instructions and task-oriented dialogue. The difficulty is that procedural prose mixes several kinds of clause — setup, action, constraint, duration, count and warning — within single sentences, and that naive sentence splitting produces fragments that are either too coarse (two movements in one step) or too fine (“lift your leg” and “keep it level” separated into two steps, of which the second is meaningless alone).'));
  push(P('Two broad approaches exist. A rule-based approach encodes the linguistic cues explicitly: an instruction lexicon, connective handling, numeral extraction, clause classification. A learned approach, today usually a large language model, handles messier input and requires no lexicon, but produces output that cannot be traced to a rule and may contain content not present in the input. This project implements the first and documents precisely what the second would require, for the reasons in the next subsection.'));

  push(H2('2.6  Why a rule-based splitter rather than a language model'));
  push(P('The decision was made on risk grounds rather than on capability grounds. A language model would handle conversational or badly punctuated descriptions better than the rule engine does, and connecting one is the obvious next step. It was not done here because doing it properly requires four things this project does not have.'));
  push(numbered([
    'A server-side proxy holding the API key. The platform is a static page; a key placed in it would be public.',
    'A schema-constrained prompt and validation of the returned JSON against that schema, with the rule engine retained as the fallback whenever validation fails.',
    'Rate limiting and a cost model, since a static page invites unbounded use.',
    'A clinical safety review. A model can invent an instruction that was not in the source description. That is a materially different class of risk from a rule that can only ever rearrange text the parent supplied, and it is the reason the interface already displays the original description beside the generated steps — a mitigation that applies regardless of which splitter runs.',
  ]));
  push(P('The fourth point is decisive in a paediatric physiotherapy context. An invented instruction is not a formatting error; it is a physical instruction given to a child with a mobility difficulty by a parent who has been given no reason to doubt it. The rule engine has a bounded failure mode: at worst it segments badly, and the parent can see that it has, because the original text is on screen.'));

  push(H2('2.7  The gap this project addresses'));
  push(P('Three strands — the accessibility of clinical guidance, camera-based movement feedback, and procedural text segmentation — exist independently. What is not readily available to a parent is a single artefact that combines them: something that takes the leaflet they were actually given, restates it as steps without altering its content, illustrates each step, and offers optional feedback on position, entirely on their own device with no account and no data leaving it. AI4Mobility is a student-scale attempt at that artefact, and the honest register in Section 7 records exactly how far it got.'));

  /* -------------------------------------------------------- 3 Methodology */
  push(pageBreak(), H1('3  Methodology'));
  push(P('This section describes each step of the machine-learning pipeline in the order it executes, states why the step is performed that way, and names the alternative that was rejected and the cost of choosing it. The pipeline is implemented in `src/data_prep.py`, `src/features.py` and `src/models.py` and is driven end-to-end by the analysis notebook.'));

  push(H2('3.1  Overview of the pipeline'));
  push(P('Nine steps run in a fixed order. Every step after the first is deterministic given its input, and the first is seeded, so the entire chain reproduces exactly.'));
  push(table(
    ['#', 'Step', 'What it produces', 'Where'],
    [
      ['1', 'Dataset construction', '1,358 raw landmark frames', 'data_prep.build_raw_frames'],
      ['2', 'Cleaning', '1,205 usable frames, 153 removed', 'data_prep.clean_frames'],
      ['3', 'No imputation', 'rows dropped, never filled', 'data_prep.clean_frames'],
      ['4', 'Feature engineering', '45 features in three families plus quality', 'features.build_feature_table'],
      ['5', 'Structure check', 'PCA projection, 52.3% in two components', 'visualise.py'],
      ['6', 'Subject-level split', '577 training / 195 test samples', 'data_prep.prepare'],
      ['7', 'Scaling', 'StandardScaler fitted on training only', 'data_prep.prepare'],
      ['8', 'Model comparison', 'three fitted models', 'models.run_comparison'],
      ['9', 'Evaluation', 'accuracy, macro F1, per-class, confusion', 'models.evaluate'],
    ],
    [6, 26, 42, 26],
  ));
  push(tableCaption('**Table 1.** The nine pipeline steps, their outputs and their implementation sites.'));

  push(H2('3.2  Step 1 — dataset construction'));
  push(P('**The dataset is synthetic and seeded, with `random_state = 42`.** It is not recorded video of children and it is not a public dataset download. This is stated first because it conditions the interpretation of every number that follows.'));
  push(P('Two reasons drove the decision. First, recording children performing physiotherapy exercises requires ethical approval, parental consent and safeguarding arrangements that a taught postgraduate project running over a single semester does not have; Section 8 sets out that position in full. Second, no public paediatric physiotherapy pose dataset covering the six exercise classes used here was available, and substituting an adult fitness dataset would have introduced a different and less honest mismatch — adult body proportions, adult movement ranges and exercises that are not the prescribed ones.'));
  push(P('The generator was therefore written to be defensible on its own terms rather than to flatter the results. It works as follows.'));
  push(H3('Canonical configurations'));
  push(P('Each of the six classes has a canonical set of 13 landmark positions in a normalised frame — head, neck, both shoulders, elbows and wrists, the hip centre, both knees and both ankles. These configurations are taken from the same hand-authored pose bank the platform’s stick figures are drawn from, which is itself derived from the published NHS descriptions in `data/exercises.json`. The consequence is that the two halves of the project describe the same movements: the classes differ from each other in the ways the real exercises differ, not in arbitrary ways chosen to make classification easy.'));
  push(H3('Subjects and takes'));
  push(P('Frames are not generated independently. They are grouped into takes of fifteen frames, each take belonging to one synthetic subject. Per subject the generator draws an overall body scale, a vertical stretch factor and a positional offset, so body-proportion variation is correlated within a take rather than independent across frames. This mirrors real recording practice, where a session yields a run of frames from the same child, and it is what makes the subject-level split in Section 3.7 necessary rather than decorative.'));
  push(H3('Movement, jitter and occlusion'));
  push(P('Within a take, each frame is assigned a phase in the movement cycle, and joints oscillate around the canonical position with an amplitude that is larger for the extremities — wrists, knees, ankles — than for the trunk. The amplitude was chosen deliberately large enough that poses within a family genuinely overlap at some phases of the movement. A generator without that overlap produces a task that is trivially separable and an accuracy figure that nobody should believe. Independent Gaussian jitter is then added to every coordinate to represent landmark detector noise, and landmarks are dropped entirely, as missing values rather than zeros, at joint-specific rates: roughly ten per cent for wrists, six per cent for elbows, five per cent for ankles, three per cent for knees and well under one per cent elsewhere. A per-frame detector confidence is drawn from a distribution whose mean falls as more landmarks go missing, which is how a real landmark detector behaves.'));
  push(H3('Annotation label noise'));
  push(P('Six per cent of frames within each confusable family are relabelled to another member of that family. Two families are defined: the quadruped-derived classes — Cat–Cow, Thread the Needle and Child’s Pose — and the two classes performed lying down, the lower limb and core and hip stability programmes. This represents genuine annotation ambiguity: at some phases of the movement these exercises look alike, and a human annotator labelling still frames would make exactly these mistakes. Including it caps the achievable accuracy below 100% for principled reasons and makes the reported figures plausible.'));
  push(H3('Deliberate class imbalance'));
  push(P('The requested frame counts are uneven — lower limb 300, core and hip stability 275, Cat–Cow 240, Child’s Pose 210, Thread the Needle 165, calf control 150 — because in practice some exercises are recorded more often than others. Balanced class weighting in the Random Forest is the response to this, not a rebalanced dataset.'));
  push(P('The generator produces **1,358 raw frames** in total, which includes eighteen deliberately duplicated frames representing a recording accidentally processed twice. Figure 1 shows the representative frame for each class — the frame closest to its class mean — rendered with the same skeleton drawing code the platform uses.'));
  push(figure('f01_pose_gallery.png', 1,
    'Representative pose for each of the six exercise classes, taken as the frame closest to the class mean. The quadruped-derived classes (Cat–Cow, Thread the Needle, Child’s Pose) are visibly similar to one another, as are the two lying-down classes, which is the structure the label noise and the later confusions reflect. Synthetic data.', 150));
  push(P('Figure 1 is worth reading before any accuracy figure. The visual similarity between the three quadruped-derived poses is not an artefact of the drawing: the trunk is roughly horizontal, the hips are above the knees and the shoulders above the wrists in all three, and the classes are separated mainly by the arm configuration and the head position. The same is true of the two lying-down classes. A classifier working from a single frame has to key on exactly those differences, and the confusion structure in Section 5.3 shows that it does, imperfectly.'));
  push(P('Figure 2 shows the class balance after cleaning, which is what the models actually see.'));
  push(figure('f02_class_balance.png', 2,
    'Usable frames per class after cleaning. The imbalance is deliberate and mirrors real recording practice, where some exercises are captured more often than others. Requested counts were lower limb 300, core and hip stability 275, Cat–Cow 240, Child’s Pose 210, Thread the Needle 165 and calf control 150. Synthetic data.', 150));
  push(P('The ordering in Figure 2 follows the requested counts, but the gaps are not identical to them, because cleaning does not remove frames uniformly across classes: poses in which a wrist or an ankle is more likely to be occluded lose proportionally more frames. Calf control, the standing class, retains the smallest absolute count and therefore contributes only fourteen samples to the test set — a point returned to in Section 5.4, because a perfect F1 on fourteen samples must not be read as a strong result.'));

  push(H2('3.3  Step 2 — cleaning'));
  push(P('Cleaning removes rows that cannot support a trustworthy feature vector. Four rules are applied in a fixed order, and the count removed by each is recorded rather than aggregated, so the effect of each rule is visible.'));
  push(table(
    ['Rule', 'Removed', 'Rationale'],
    [
      ['Exact duplicate frames', '18', 'A frame processed twice would appear in both training and test data and inflate the score.'],
      ['Missing a critical joint', '130', 'Hip, neck, both shoulders and both knees define the torso frame and the scale normaliser. Without them no feature in any family can be computed honestly.'],
      ['Detector confidence below 0.55', '5', 'A frame the detector itself does not trust should not carry the same weight as one it does.'],
      ['Coordinates outside the frame', '0', 'A guard against landmarks projected off-image. It fired zero times, which is reported rather than quietly dropped.'],
      ['Total', '153 (11.3%)', '1,358 raw frames reduced to 1,205 usable frames.'],
    ],
    [30, 16, 54],
  ));
  push(tableCaption('**Table 2.** Cleaning rules, the number of frames each removed, and why the rule exists. Measured on synthetic data.'));
  push(P('Figure 3 presents the same information graphically, showing both the proportion removed and its decomposition by reason.'));
  push(figure('f03_cleaning.png', 3,
    'Cleaning outcome: 153 of 1,358 raw frames (11.3%) removed, broken down by the rule that removed them. The dominant cause is a missing critical joint, at 130 frames. The out-of-frame rule removed nothing and is reported at zero rather than omitted. Synthetic data.', 152));
  push(P('The shape of Figure 3 matters more than the total. Eighty-five per cent of all removals come from one rule — a missing critical joint — and that concentration is informative. It says the data loss in this pipeline is driven by occlusion, not by detector failure or by geometric error, and occlusion is pose-dependent. That single observation is what makes the next step necessary.'));

  push(H2('3.4  Step 3 — why nothing is imputed'));
  push(P('**No landmark is imputed anywhere in the pipeline.** Where a coordinate is missing, the frame is removed. This was a deliberate decision against the more common practice of mean- or median-filling, and the reasoning is specific to pose data rather than general.'));
  push(P('Landmarks go missing here through occlusion, and occlusion is far more likely in some poses than in others. A wrist is much more likely to be hidden in Thread the Needle, where one arm passes under the body, than in the standing calf control exercise where both arms are visible. Filling a missing wrist coordinate with the column mean therefore does not insert a neutral value; it inserts the average wrist position across all six classes, which is a value characteristic of no class in particular, into precisely those frames belonging to the classes that are hardest to capture. The model would then learn to associate that manufactured average position with the occlusion-prone classes, and would appear to perform well on them for a reason that would not survive contact with real data.'));
  push(P('The cost of refusing to impute is 130 frames, about 9.6% of the raw data, and a mild reduction in the sample sizes of the occlusion-prone classes. That cost is accepted. The same principle is applied at feature level: `joint_angle` returns a missing value where either segment has near-zero length rather than a meaningless zero, a feature column is dropped only if more than 35% of its values are missing, and any remaining rows with missing features are removed. No value is ever invented at any point in the pipeline.'));

  push(H2('3.5  Step 4 — feature engineering'));
  push(P('The cleaned landmark table is converted into **45 features** in three deliberate families plus one quality indicator. Each family exists to answer a specific objection to the others.'));
  push(table(
    ['Family', 'Count', 'Construction', 'Why it is needed'],
    [
      ['Normalised coordinates', '26', 'Each of the 13 landmarks translated to a hip-centred origin and divided by torso length (neck-to-hip distance), giving x and y per joint.', 'Raw pixel coordinates would teach the model where the child stood in the frame and how tall they are. Hip-centring removes position; torso-length division removes size.'],
      ['Joint angles', '9', 'Angle at a vertex between the two segments to its neighbours, in degrees, for nine anatomically meaningful triples: both shoulders, both elbows, both hips, both knees, and the head–neck–hip trunk angle.', 'Angles are invariant to translation, to scale and to the child’s body proportions, which is exactly what an exercise classifier should key on rather than on body shape.'],
      ['Inter-joint distances', '9', 'Euclidean distance between chosen joint pairs, divided by torso length: wrist-to-ankle, head-to-hip, head-to-knee, hip-to-ankle, shoulder-to-knee, wrist-to-wrist, knee-to-knee and neck-to-ankle.', 'Angles discard the information that two joints are near each other. Wrist-to-ankle separates Child’s Pose from Thread the Needle; knee-to-hip separates lying from kneeling positions.'],
      ['Detector quality', '1', 'The per-frame detector confidence, carried through unchanged.', 'Frame quality carries genuine signal about how much the geometric features can be trusted, and hiding it would discard that.'],
    ],
    [22, 8, 36, 34],
  ));
  push(tableCaption('**Table 3.** The three feature families and the quality indicator, with the reason each exists.'));
  push(P('The torso length used as the scale normaliser is the neck-to-hip distance, guarded so that a degenerate near-zero torso produces a missing value rather than a division blow-up. The choice of neck-to-hip rather than, say, height is deliberate: it is the one distance that is present in every pose in this dataset, standing or lying, and it is one of the six joints the cleaning stage guarantees.'));
  push(P('The features are strictly frame-level. **No temporal windowing is performed**, because the dataset is constructed as independent frames rather than continuous sequences. Section 5.3 and Section 6 argue that this is the pipeline’s most consequential limitation and that the residual confusions are precisely those a movement-over-time model would be expected to resolve.'));
  push(P('Figure 4 shows the distribution of each joint angle by class, which is the direct evidence that the angle family carries class-conditional information.'));
  push(figure('f04_angle_distributions.png', 4,
    'Joint-angle distributions by exercise class, shown as boxplots. Several angles separate the standing class cleanly from the rest, while the quadruped-derived classes overlap substantially in trunk and hip angles. Synthetic data.', 152));
  push(P('Figure 4 rewards careful reading, because it explains a result that is otherwise counter-intuitive. The angle distributions do separate the classes — calf control, the only standing exercise, is distinguishable on almost every angle — but the separation between the three quadruped-derived classes is weak in exactly the angles one might expect to be most informative, the hip and trunk angles. Those three exercises are all performed on hands and knees, so their trunk and hip angles are similar by construction. What separates them is where the arms go, and that is captured better by normalised positions and by inter-joint distances than by angles. This is the mechanism behind the feature importance result in Section 5.5, which is otherwise easy to get backwards.'));

  push(H2('3.6  Step 5 — exploratory structure check'));
  push(P('Before any model was fitted, the feature space was projected to two dimensions with principal component analysis, purely as a structure check. Figure 5 shows the projection.'));
  push(figure('f05_pca.png', 5,
    'Principal component projection of the 45-dimensional feature space. The first two components account for 52.3% of total variance. Class clusters are visible but overlapping, with the overlap concentrated between exercises performed in similar body positions. Synthetic data.', 134));
  push(P('The first two components account for **52.3% of total variance**. That figure should be read as an indication of separability and nothing more. A little over half the variance in two dimensions means the remaining 43 dimensions still carry substantial information, so the visual overlap in Figure 5 is an upper bound on the true overlap rather than a measurement of it. What is useful in Figure 5 is the *pattern* of the overlap: the clusters that touch are the quadruped-derived classes with one another and the two lying-down classes with one another, which is the same structure that was deliberately built into the generator, is visible in Figure 1, and reappears in the confusion matrix in Section 5.3. The three views agreeing is a consistency check on the pipeline, not independent evidence.'));

  push(H2('3.7  Step 6 — the subject-level split'));
  push(P('The data are split into training and test sets **by subject, not by frame**. This is the single most important methodological decision in the pipeline and the one most often got wrong.'));
  push(P('Frames within a take come from the same synthetic subject, share that subject’s body scale, stretch and offset, and are separated only by a movement phase and a small amount of jitter. Consecutive frames are therefore near-duplicates of one another in feature space. Under a random frame-level split, a frame from take 17 would land in the training set and the frame from take 17 recorded a fraction of a second later would land in the test set. The model would not be asked to generalise to a new child; it would be asked to recognise a body it had already seen. The reported accuracy would rise, possibly close to ceiling, and it would mean nothing about performance on a child the system had never encountered.'));
  push(P('The implementation extracts the unique subject identifiers, splits *those* with a 25% test fraction under the fixed seed, and then assigns every frame to whichever side its subject fell on. The result is **577 training samples and 195 test samples**, with no subject appearing on both sides. The resulting split is not exactly 75/25 by frame count, because takes vary in length after cleaning, and that unevenness is accepted as the price of a clean separation. The same grouping logic underlies the cross-validation protocol in Section 3.10.'));

  push(H2('3.8  Step 7 — scaling fitted on training data only'));
  push(P('A `StandardScaler` is fitted **on the training partition only** and then applied to both partitions. Fitting a scaler on the full dataset before splitting is a common and quiet form of leakage: the per-feature means and standard deviations would then encode information about the test frames, and every model would receive a small unearned advantage that no amount of careful evaluation afterwards could detect. The scaler is retained on the returned dataset object so that any future inference path applies exactly the same transformation.'));
  push(P('Scaling matters unequally across the three models. The tree ensembles are invariant to monotone rescaling of individual features and would perform identically without it. The multilayer perceptron would not: its features span degrees (0 to 180), torso-normalised distances (roughly 0 to 3) and a confidence in the unit interval, and without standardisation the gradient signal would be dominated by the angle columns. Scaling all three identically also keeps the comparison fair, since the models then differ only in their inductive bias and not in their input.'));

  push(H2('3.9  Step 8 — model choice and hyperparameters'));
  push(P('Three model families were compared on identical data and identical splits. The intention was not to find the strongest possible model but to establish whether the task is learnable from frame-level geometry and whether the answer depends on model family — if three very different learners agree, the finding is about the data rather than about the learner.'));
  push(table(
    ['Model', 'Hyperparameters', 'Justification'],
    [
      ['Random Forest', 'n_estimators = 300; max_depth = 12; min_samples_leaf = 2; class_weight = balanced', '300 trees is past the point where the out-of-bag error curve flattens for a dataset this size. max_depth = 12 is constrained deliberately: unrestricted, the forest reaches roughly 1.000 training accuracy and generalises noticeably worse, with nothing in its output to signal that anything went wrong. min_samples_leaf = 2 prevents single-frame leaves. Balanced class weighting answers the deliberate class imbalance without resampling.'],
      ['Gradient Boosting', 'n_estimators = 150; learning_rate = 0.1; max_depth = 3', 'A stronger tree-based comparison that fits residuals sequentially rather than by bagging. Shallow depth-3 stumps with a moderate learning rate is the standard regularised configuration; the ensemble size is kept modest because the training set is small.'],
      ['Neural Network (MLP)', 'hidden layers (128, 64); ReLU; alpha = 1e-3; learning_rate_init = 1e-3; max_iter = 1500; tol = 1e-4; n_iter_no_change = 25', 'Included so the comparison is not confined to trees. Two hidden layers are sufficient for 45 inputs and six classes; a wider network would have more parameters than training samples. L2 regularisation at 1e-3 is the main defence against overfitting. max_iter was raised until convergence warnings stopped. Early stopping is switched off because this scikit-learn version’s internal validation scoring fails on string class labels; convergence is monitored through the loss curve instead.'],
    ],
    [20, 34, 46],
  ));
  push(tableCaption('**Table 4.** Model families, hyperparameters and the justification for each choice.'));
  push(P('The random state is fixed at 42 for all three models, for the split and for the generator, so the whole comparison is reproducible from a clean checkout.'));

  push(H2('3.10  Step 9 — evaluation protocol'));
  push(P('The protocol was fixed before any model was fitted, and three properties of it are worth stating explicitly.'));
  push(bullets([
    '**The test set was scored once.** Model selection used five-fold cross-validated macro F1 on the training partition only. The test set was touched exactly once, after all selection was complete. Repeatedly consulting a test set turns it into a second training set and quietly inflates the final figure.',
    '**Macro F1 is the primary metric, not accuracy.** The classes are deliberately imbalanced, so accuracy is dominated by the two largest classes. Macro F1 weights every class equally, which matches the requirement: for a system that gives feedback to a parent, an exercise class the model quietly gets wrong is a worse failure than a slightly lower overall score.',
    '**Per-class precision, recall and F1 are reported for every model**, not only aggregates, together with the confusion matrix and the training-minus-test generalisation gap. The gap is reported because it is the honest overfitting signal and because two of the three models turn out to have memorised their training data completely.',
  ]));

  push(H2('3.11  Reproducibility and testing'));
  push(P('Every stochastic component is seeded at 42: the frame generator, the label-noise selection, the duplicate sampling, the subject split and all three models. Running the pipeline on a clean checkout reproduces every number in Section 5 exactly.'));
  push(P('The codebase carries **90 automated tests, all passing**: 24 tests for the JavaScript step splitter, 25 for the pose-coach angle mathematics, and 41 Python checks including full parity tests between the JavaScript splitter and its Python mirror in `src/splitter.py`. The parity tests matter more than their count suggests. Two implementations of the same rule engine exist — one in the browser, one in the analysis pipeline — and without an executable check that they agree, the report would eventually describe behaviour that the shipped platform no longer has.'));

  /* ------------------------------------------------------- 4 The platform */
  push(pageBreak(), H1('4  The platform'));

  push(H2('4.1  Architecture'));
  push(P('The platform is a single self-contained HTML file. There is no server, no account system, no database, no storage and no analytics. The source is organised as separate HTML, CSS and JavaScript files under `platform/`, and a small Python build script inlines them into `dist/ai4mobility.html`, which opens from the filesystem with no web server at all. The only network request the platform ever makes is fetching the MediaPipe pose model, and that happens once, only if the family chooses to use the camera.'));
  push(P('The interface is divided into six sections: a hero introduction, a “Why this exists” explanation, a personalisation panel, the exercise guide, the live pose coach, and an about-and-sources section. The exercise content itself lives in `data/exercises.json`, a single source of truth from which `platform/js/data.js` is generated; nothing about an exercise is hard-coded in the interface.'));
  push(P('Four JavaScript modules do the work. `splitter.js` holds the rule-based step-splitting engine. `poses.js` renders the 46 stick-figure poses. `posecoach.js` runs pose estimation and joint-angle comparison. `app.js` wires them together and manages interface state.'));

  push(H2('4.2  The ten programmes and their sources'));
  push(P('Ten programmes ship with the platform. Five come from published Sheffield Children’s NHS Foundation Trust leaflets and one from a published yoga reference; the remaining four are described from general practice and are labelled as such in the interface through an explicit evidence label, so a parent can see which is which.'));
  push(table(
    ['Programme', 'Steps', 'Source'],
    [
      ['Lower Limb Exercises', '6', 'Sheffield Children’s NHS — General lower limb exercises'],
      ['Core and Hip Stability', '7', 'Sheffield Children’s NHS — Core and hip stability exercises'],
      ['Glute Strengthening', '6', 'Sheffield Children’s NHS — Glute strengthening'],
      ['Calf Control', '2', 'Sheffield Children’s NHS — Calf control exercises'],
      ['Wrist and Hand Exercises', '7', 'Sheffield Children’s NHS — Wrist exercises'],
      ['Thread the Needle', '7', 'Yoga Basics — Threading the Needle'],
      ['Child’s Pose', '6', 'General practice (labelled as such)'],
      ['Cat–Cow Stretch', '4', 'General practice (labelled as such)'],
      ['Standing Balance', '4', 'General practice (labelled as such)'],
      ['Seated Upper Body', '5', 'General practice (labelled as such)'],
    ],
    [36, 12, 52],
  ));
  push(tableCaption('**Table 5.** The ten shipped programmes, their reviewed step counts and their provenance. Full URLs appear in the references.'));
  push(P('Each programme stores its source description **verbatim** in an `original_description` field and displays it in the interface beside the generated steps. This was added in direct response to supervisor feedback, and it is also the standing mitigation described in Section 2.6: whatever the splitter does to the text, the parent can see the text it started from.'));
  push(P('The description box is editable. A parent whose child has been given a different programme by their own physiotherapist can paste that description in, press **Convert to steps**, and the step list is rebuilt from their text. This too was a direct response to supervisor feedback. It also means the platform is not limited to the ten shipped programmes, which is the difference between a demonstration and a tool.'));

  push(H2('4.3  The step-splitting engine'));
  push(P('**The step splitter is a rule-based linguistic engine. It is not a large language model.** No model weights are loaded, no network request is made, and the same input always produces the same output. It is implemented in `platform/js/splitter.js` with a mirror implementation in `src/splitter.py`, and the two are held in agreement by executable parity tests.'));
  push(P('The pipeline has eight stages. Each is described below with the specific problem it solves, because the value of a rule engine is precisely that each of its decisions can be named.'));
  push(numbered([
    '**Normalise.** Whitespace is collapsed, curly quotes and the various dash characters are unified, and ampersands are expanded. This exists because source text is pasted from PDFs and web pages and arrives with typographic variation that would otherwise defeat literal string matching later in the pipeline.',
    '**Detect explicit structure.** If the author has already numbered or bulleted their steps, that structure is preserved and the text is never re-split. This is the highest-precedence rule in the engine. An author who has numbered their steps has already made the segmentation decision, and a splitter that overrides that decision is worse than no splitter.',
    '**Segment.** Sentence segmentation with abbreviation and decimal protection. A list of abbreviations that must not end a sentence — e.g., i.e., approx., sec., min., reps. — is consulted, and decimal points inside numbers are protected. Without this, “hold for 2.5 seconds” becomes two steps.',
    '**Split compounds.** Sentences are broken on coordinating connectives — then, next, after that, followed by, and the semicolon — but **only when both halves independently read as instructions**. This condition is the heart of the engine. It is what stops “lift your leg and keep it level” collapsing into two fragments of which the second is meaningless alone, while still separating “sit on the chair, then straighten your knee” into the two distinct actions it describes.',
    '**Classify.** Every fragment is labelled as one of six types: action, position, hold, reps, safety or context. Classification uses an ordered instruction-verb lexicon drawn from the frequency of verbs in the NHS and physiotherapy leaflets used as source material, position markers such as “starting position” and “begin in”, and safety markers such as “stop if”, “do not”, “seek advice” and “physiotherapist”.',
    '**Extract parameters.** Hold durations and repetition counts are pulled out of the text, including word numerals — “ten times” becomes ten repetitions — and ranges, where “hold for 5 to 10 seconds” becomes an 8-second hold, the rounded midpoint. Extraction is what drives the on-screen timer and the repetition counter, so a step that says “hold for ten seconds” produces an actual ten-second timer rather than a sentence the parent has to time themselves.',
    '**Score.** Every step receives a confidence value and the whole conversion receives an overall confidence, both surfaced in the interface rather than hidden. A parent looking at a step list produced from their own pasted text can see how sure the engine is about it.',
    '**Assemble.** Non-instructional fragments are dropped, the remaining steps are ordered and renumbered, and **safety sentences are separated out and displayed apart from the steps to perform**. This last point is a safety decision, not a formatting one. “Stop if your child complains of pain” is not step four of seven; presenting it as a step to perform would be actively misleading.',
  ]));
  push(P('The engine is fully deterministic, inspectable and runs offline. Its evaluation against reviewed step lists is in Section 5.6.'));

  push(H2('4.4  The LLM adapter seam'));
  push(P('An `LLMSplitterAdapter` object exists in both the JavaScript and the Python implementations. **It is a stub. It is not connected to any model and it returns null.** It has an `available` flag set to false and a `reason` string explaining that there is no model, no API key and no backend endpoint. The public entry point checks the flag, finds it false, and falls through to the rule engine every time.'));
  push(P('It exists for two reasons: so that swapping in a real implementation is a single-file change, and so that this report can describe exactly what such an implementation would require. Those requirements are enumerated in Section 2.6 and repeated in the honesty register in Section 7. The seam is documented here so that a reader inspecting the source finds an explanation rather than an apparently abandoned feature, and it is emphatically not presented as working.'));

  push(H2('4.5  The illustration system'));
  push(P('The platform renders **46 hand-authored stick-figure poses**, drawn from stored joint coordinates by a small vector renderer, with props — a chair, a wall, a step, a table — drawn alongside the figure where the exercise requires one. Poses can alias one another, so a flow that passes through a position already in the bank reuses it rather than duplicating it.'));
  push(P('Two properties of this design are worth stating. First, the poses are hand-authored, not generated and not captured from motion. They stand in for the generative vision model that a fuller version of this system would use, and Section 7 records that plainly. Second, and more usefully, the pose bank does double duty: it is the reference the pose coach compares the child against, so the target the coach checks is by construction exactly the position the picture shows. A system in which the illustration and the feedback target came from different sources could show one thing and check another, and a parent would have no way of noticing.'));

  push(H2('4.6  The pose coach'));
  push(P('The pose coach uses the MediaPipe Pose Landmarker running entirely on the device, through the browser’s WebAssembly runtime. It draws a mirrored skeleton overlay on a canvas above the video, so the child sees themselves the way they would in a mirror rather than reversed. No frame is uploaded anywhere and no recording is made; the video element is the only place the image exists.'));
  push(P('Four joint angles are compared against targets, each with its own tolerance.'));
  push(table(
    ['Joint checked', 'Landmark triple used', 'Tolerance'],
    [
      ['Elbow', 'shoulder – elbow – wrist', '22°'],
      ['Knee', 'hip – knee – ankle', '20°'],
      ['Hip', 'shoulder – hip – knee', '22°'],
      ['Trunk', 'head – shoulder – hip', '24°'],
    ],
    [30, 46, 24],
  ));
  push(tableCaption('**Table 6.** The four joints the coach checks, the landmark triples used and the tolerance applied to each. The tolerances are engineering judgement, not clinical thresholds.'));
  push(P('**How the targets are derived.** For the pose currently on screen, the coach looks up that pose in the same hand-authored pose bank the illustration is drawn from, following any alias, and computes the four angles from the stored joint coordinates using the identical angle function it applies to the live landmarks. The result is cached per pose. There is no separate target table that could drift out of step with the illustrations: the target is a computed property of the picture. Figure 12 in Section 5.7 shows the resulting target angles by pose family.'));
  push(P('**How the measurement is made.** Left and right landmarks are averaged into midpoints for shoulder, hip, knee and ankle so that the comparison does not depend on which side is facing the camera, and landmarks whose visibility score falls below 0.4 are treated as absent rather than trusted. A coverage figure is computed from how many of the six core landmarks are actually visible, so the coach can decline to give feedback rather than give feedback based on a partially visible body.'));
  push(P('**What the parent sees.** One plain-English cue — the single most useful correction — plus a per-joint breakdown showing the measured and target angle for each of the four joints. The breakdown exists so the feedback is checkable. A single number scoring the pose would be easier to display and impossible for a parent to argue with.'));
  push(P('The coach degrades cleanly. If the model cannot be fetched, if the browser has no camera, or if permission is refused, it says so plainly and the rest of the interface continues to work. Camera use is optional throughout; every exercise is fully usable without it.'));

  push(H2('4.7  Personalisation'));
  push(P('Two personalisation controls are provided, both deliberately conservative.'));
  push(bullets([
    '**Focus area filter.** The guide can be filtered to the programmes relevant to a particular area of difficulty, so a family working on lower-limb strength is not scrolling past wrist exercises.',
    '**Difficulty.** Repetition counts and hold durations scale with a difficulty setting, and **the NHS default is always displayed alongside the adjusted figure**. A parent can therefore see both what the leaflet said and what the platform is currently suggesting, and can disregard the latter. Presenting only the scaled number would silently overwrite clinical guidance with a piece of arithmetic.',
    '**Resting positions are never scaled.** The 30-minute prone lie and similar resting positions are exempt from difficulty scaling entirely. These are prescribed durations with a physiological purpose, not a target to be made easier or harder, and treating them as one would be a clinical error dressed as a feature.',
  ]));

  push(H2('4.8  Accessibility'));
  push(P('Accessibility was treated as a requirement rather than an enhancement, on the straightforward grounds that a platform for families managing a disability that presents an accessibility barrier of its own has failed before it starts. The implemented controls are: a larger-text mode; a high-contrast mode; a calm mode that reduces motion, for users with vestibular sensitivity or attention difficulties; full keyboard navigation; a skip link to the main content; and ARIA labelling throughout so that structure is available to assistive technology.'));
  push(P('Read-aloud is provided through the browser’s built-in Web Speech API, with **Read this step** and **Read full guide** controls. Nothing is bundled, so quality depends on the device — this is recorded as a partial implementation in Section 7 rather than presented as a complete text-to-speech feature. Its purpose is specific: a parent whose hands are supporting a child cannot also be looking at a screen.'));

  push(H2('4.9  Privacy by construction'));
  push(P('The platform stores nothing and transmits nothing. There is no account system, no local storage of progress, no analytics and no third-party script beyond the pose model fetch. Progress tracking is per-visit only and vanishes when the tab closes. This is a limitation — Section 7 lists persistence as not built — but it is also the reason the platform requires no privacy policy, no data-processing agreement and no consent flow for a child’s data: there is no child’s data. For a system that would otherwise be handling video of disabled children in their own homes, that is a defensible default to have started from.'));

  /* ----------------------------------------------------------- 5 Results */
  push(pageBreak(), H1('5  Results'));
  push(quoteBox([
    '**Every quantitative result in this section was measured on the synthetic dataset described in Section 3.2.** The numbers characterise the pipeline and the feature design. They are not evidence about real children performing real exercises, and no claim in this section should be read as such.',
  ]));
  push(spacer(120));

  push(H2('5.1  Model comparison'));
  push(P('The three models were trained on identical data with identical splits. Table 7 gives the full comparison.'));
  push(table(
    ['Model', 'Test accuracy', 'Test macro F1', 'CV macro F1 (5-fold, train only)', 'Train accuracy', 'Gap'],
    [
      ['Random Forest', '0.928', '0.935', '0.955 ± 0.017', '0.965', '+0.037'],
      ['Gradient Boosting', '0.923', '0.931', '0.939 ± 0.016', '1.000', '+0.077'],
      ['Neural Network (MLP)', '0.923', '0.932', '0.939 ± 0.019', '1.000', '+0.077'],
    ],
    [26, 15, 15, 21, 13, 10],
    { headAlign: AlignmentType.CENTER, bodyAlign: AlignmentType.CENTER },
  ));
  push(tableCaption('**Table 7.** Model comparison. Measured on synthetic data. The generalisation gap is training accuracy minus test accuracy.'));
  push(P('**The Random Forest is the best model, and the margin is narrow.** On test accuracy it leads by 0.005, which on 195 test samples is a single sample; on macro F1 it leads by 0.003 to 0.004. Neither difference is meaningful on its own. What separates the three models is not the headline figure but the generalisation gap, discussed in Section 5.2, and the cross-validated score, where the Random Forest’s 0.955 ± 0.017 sits above the other two at 0.939, by more than the width of the standard deviations.'));
  push(P('The more useful reading of Table 7 is that all three models land within half a percentage point of each other. Three learners with very different inductive biases — bagged trees, boosted trees and a dense neural network — reaching effectively the same accuracy indicates that the ceiling is set by the data, not by the model. The remaining error is in the feature representation and in the deliberate label noise, and no amount of model selection will remove it. Figure 6 shows the comparison graphically.'));
  push(figure('f06_model_comparison.png', 6,
    'Test accuracy, test macro F1 and cross-validated macro F1 for the three model families. The three models are effectively tied on test performance; the Random Forest separates itself on the cross-validated score. Measured on synthetic data.', 150));
  push(P('Figure 6 makes the near-tie visible: the accuracy and macro F1 bars are indistinguishable at plotting resolution. The cross-validation bars are the ones that carry information, and they are also the ones computed without touching the test set at all, which is why they were the basis for selecting the Random Forest before the test set was scored.'));

  push(H2('5.2  Overfitting and the generalisation gap'));
  push(P('Figure 7 plots training accuracy against test accuracy for the three models, with the gap annotated.'));
  push(figure('f07_overfit_gap.png', 7,
    'Training versus test accuracy with the generalisation gap annotated. Gradient Boosting and the neural network both reach 1.000 training accuracy, more than double the Random Forest’s gap. Measured on synthetic data.', 150));
  push(P('**Gradient Boosting and the neural network both reach 1.000 training accuracy.** They have memorised their training data completely, including the six per cent of frames that carry deliberately incorrect labels. Their gap of +0.077 is more than twice the Random Forest’s +0.037. This is the clearest result in the study, and it is entirely invisible in Table 7’s accuracy column.'));
  push(P('The Random Forest’s advantage here was engineered rather than discovered. Its `max_depth` was constrained to 12 deliberately; left unrestricted, it too reaches approximately 1.000 training accuracy and generalises worse. The constraint costs 0.035 of training accuracy and buys back roughly 0.04 of generalisation gap. That trade is worth taking on this dataset and would be worth taking by a larger margin on real data, where the noise is not a controlled six per cent injected by a generator but whatever occlusion, mislabelling and inter-child variation actually produce.'));
  push(P('The broader point for a system of this kind is that a model which has memorised its training set gives no warning that it has. It reports high training accuracy and respectable test accuracy, and only the comparison between the two exposes it. Reporting the gap is therefore not a formality; on this dataset it is the only thing that distinguishes the three models at all.'));

  push(H2('5.3  Confusion analysis'));
  push(P('Figure 8 shows the Random Forest confusion matrix on the 195 held-out test samples.'));
  push(figure('f08_confusion.png', 8,
    'Random Forest confusion matrix on the held-out test set (195 samples from subjects not seen in training). Off-diagonal mass concentrates between exercises performed in similar body positions. Measured on synthetic data.', 132));
  push(P('The off-diagonal mass is not spread evenly, and where it falls is the most informative result in this report. Errors concentrate in two places, and both were predictable from Figure 1 and Figure 5.'));
  push(bullets([
    '**Between the quadruped-derived classes.** Cat–Cow, Thread the Needle and Child’s Pose are all performed on hands and knees. From a single frame, with the trunk horizontal and the hips above the knees in all three, the only reliable discriminators are arm configuration and head position — and at some phases of Cat–Cow the arm configuration is momentarily close to that of Child’s Pose.',
    '**Between the two lying-down classes.** The lower limb and core and hip stability programmes are both performed lying down and share a large part of their movement range.',
  ]));
  push(P('Two things follow. First, the errors are *systematic*, not random: the model is not confused about which exercises look alike, it is correctly identifying that some of them do. Second, and more importantly, both confusion clusters group exercises that differ chiefly in **how the position changes over time** rather than in any single static configuration. Cat–Cow is defined by alternating flexion and extension; Child’s Pose is defined by holding still. A single frame from the middle of a Cat–Cow cycle and a frame of Child’s Pose can be geometrically similar while the movements they belong to are entirely different. The features are frame-level by construction (Section 3.5), so this information is not available to the model at all. This is the argument, developed in Section 6, that temporal modelling is the highest-value next step for the classifier.'));
  push(P('Two positive observations should be recorded alongside. Calf control, the only standing exercise, is classified perfectly — it is geometrically unlike everything else, and the model finds that trivially. And Child’s Pose achieves perfect recall, meaning every genuine Child’s Pose frame is found; its imperfect precision of 0.875 comes from other classes being drawn into it, which is the expected behaviour for a resting position that other quadruped movements pass through.'));

  push(H2('5.4  Per-class performance'));
  push(P('Figure 9 shows per-class F1 for all three models side by side.'));
  push(figure('f09_per_class_f1.png', 9,
    'Per-class F1 for the three models. The weakest classes are the same in every model: lower limb at 0.886–0.900 and Thread the Needle at 0.905. Measured on synthetic data.', 152));
  push(P('The striking feature of Figure 9 is the agreement between the three models. The weakest classes are **lower limb** (F1 0.900 for the Random Forest, 0.886 for Gradient Boosting, 0.889 for the neural network) and **Thread the Needle** (F1 0.905, identical across all three models). Core and hip stability follows at 0.917 to 0.927. Three different learners failing on the same two classes, to within a couple of points, is strong evidence that the difficulty belongs to those classes rather than to any model’s inductive bias.'));
  push(P('The two weak classes are exactly the ones the confusion analysis predicts. Lower limb is one of the two lying-down classes and confuses with core and hip stability. Thread the Needle is one of the three quadruped-derived classes, and it is additionally the class in which occlusion is most likely — the whole point of the movement is that one arm threads under the body — so it loses proportionally more frames in cleaning and has the second-smallest test support at 22 samples.'));
  push(P('**Calf control returns a perfect F1 of 1.000 in all three models, and this should be read carefully rather than celebrated.** Its test support is 14 samples. A perfect score on 14 samples of the only standing exercise in a set of six is what one would expect from a class that is geometrically separated from all the others; it is not evidence of a well-calibrated model, and on a real dataset with real standing variation it would not persist. Appendix B gives the full precision, recall, F1 and support table for every class in every model.'));

  push(H2('5.5  Feature importance'));
  push(P('Figure 10 shows the top 14 features by Random Forest importance, coloured by family.'));
  push(figure('f10_feature_importance.png', 10,
    'Top 14 features by Random Forest importance, coloured by feature family. Normalised positions dominate; joint angles contribute far less than the feature design anticipated. Measured on synthetic data.', 150));
  push(P('**Normalised positions carry 77% of total importance and inter-joint distances carry 14%.** The joint angles — the family that the feature design in Section 3.5 argued was the most theoretically appropriate, being invariant to translation, scale and body proportion — account for the remainder along with the detector-quality feature. This is the opposite of what the design anticipated, and it is reported as such rather than reframed.'));
  push(P('The explanation is visible in Figure 4. The nine joint angles are chosen for anatomical meaning, and they do separate the standing class from everything else, but the three quadruped-derived classes have similar trunk and hip angles *by construction* — they are all performed on hands and knees. What distinguishes them is where the arms and head are relative to the torso, and after hip-centring and torso-length normalisation, a coordinate is a direct measure of exactly that. The normalised coordinates are, in effect, doing the work the angles were expected to do, and doing it with more resolution because there are 26 of them against 9 angles.'));
  push(P('Three consequences follow. First, the normalisation step in Section 3.5 is load-bearing rather than cosmetic: without hip-centring and torso-length division, the dominant feature family would be measuring where the child stood and how tall they are. Second, the 14% contributed by inter-joint distances vindicates including them — wrist-to-ankle and head-to-knee separate poses that angles alone treat as equivalent. Third, an angle-only feature set, which is a common design in pose-based exercise classification and was seriously considered here, would have discarded the majority of the discriminative signal available on this data.'));
  push(P('One caveat is required. Random Forest impurity-based importances are biased towards high-cardinality continuous features and are computed on correlated inputs, and the 26 normalised coordinates are correlated with each other. The 77/14 split should be read as a strong directional finding, not as a precise decomposition of variance. A permutation-importance analysis would give a more defensible estimate and has not been run.'));

  push(H2('5.6  Step splitter evaluation'));
  push(P('The rule-based splitter was evaluated against the reviewed step lists for the ten shipped programmes. Figure 11 shows the comparison.'));
  push(figure('f11_splitter.png', 11,
    'Step counts produced by the rule-based splitter against the reviewed step lists for the ten shipped programmes. Exact agreement on 2 of 10; mean confidence 0.78.', 152));
  push(P('**The splitter reproduces the reviewed step list exactly on 2 of the 10 programmes, with a mean confidence of 0.78.** Reported plainly, that is a weak headline number, and it is presented here without softening.'));
  push(P('The disagreements are, however, structured rather than random, and understanding them changes the interpretation. The mismatches occur on the multi-exercise NHS leaflets, where one reviewed “step” covers an entire sub-exercise — a leaflet may describe four distinct exercises under one heading, and the reviewed list treats each as a single step while the splitter, working from the prose, correctly identifies the several instructions each contains and produces more steps. In those cases the splitter is not wrong so much as operating at a finer granularity than the reviewer chose. Whether the finer granularity is better for a parent following along is an open question that only a user evaluation could settle.'));
  push(P('Two design decisions follow from this and are already implemented. The per-step and overall confidence values are **shown in the interface rather than hidden**, so a parent can see when the engine is unsure. And the original description is always displayed beside the generated steps, so a segmentation the parent disagrees with is visible and correctable rather than authoritative. A splitter that is right 20% of the time on exact match but transparent about the other 80% is a defensible thing to put in front of a family; the same splitter presenting its output as definitive would not be.'));
  push(P('The evaluation also has a clear methodological weakness. The reviewed step lists were produced by the project team, not by a physiotherapist, and there is no inter-rater agreement figure because there was only one rater. The 2-of-10 figure measures agreement with one team’s reading of the leaflets, not correctness.'));

  push(H2('5.7  Pose coach target angles'));
  push(P('Figure 12 shows the target joint angles the coach derives from the pose bank, grouped by pose family.'));
  push(figure('f12_coach_targets.png', 12,
    'Target joint angles per pose family, computed from the hand-authored pose bank that the stick-figure illustrations are drawn from. Tolerances are 20° to 24° per joint and are engineering judgement, not clinical thresholds.', 152));
  push(P('Figure 12 confirms that the four checked joints do discriminate between pose families: the standing and seated families differ markedly from the quadruped and lying families in knee and hip angle, and the trunk angle separates the flexed quadruped positions from the neutral ones. It also shows where the coach will be least useful. Within the quadruped family the target angles cluster tightly, and with tolerances of 20° to 24° several targets fall inside one another’s tolerance bands. In those cases the coach can confirm that the child is in a quadruped position with roughly correct joint angles, but it cannot distinguish which quadruped exercise is being performed — the same limitation, from the same cause, that the classifier exhibits in Section 5.3.'));
  push(P('**The tolerances have not been clinically validated.** They were set by engineering judgement to be wide enough not to nag a child who is approximately correct and narrow enough to catch a position that is clearly wrong. No physiotherapist has reviewed them, no measurement study supports them, and the correct tolerance for a child with a mobility difficulty may well differ from the correct tolerance for an unimpaired adult. Section 7 records this as not validated.'));

  push(H2('5.8  Test suite'));
  push(P('The codebase carries **90 automated tests and all of them pass**: 24 for the JavaScript step splitter, 25 for the pose-coach angle mathematics, and 41 Python checks including full JavaScript-to-Python parity for the splitter. The splitter tests cover the individual pipeline stages — normalisation, segmentation with abbreviation protection, compound splitting, classification, parameter extraction including word numerals and ranges — as well as end-to-end conversion of the shipped descriptions. The pose-coach tests cover the angle function against known geometric configurations, midpoint construction, visibility filtering and the comparison logic including its behaviour when landmarks are missing.'));
  push(P('These are unit and integration tests of a deterministic system. They demonstrate that the implementation does what it is specified to do; they say nothing about whether the specification is clinically appropriate, which is a separate question that Section 7 records as unanswered.'));

  /* -------------------------------------------------------- 6 Discussion */
  push(pageBreak(), H1('6  Discussion'));

  push(H2('6.1  What the model comparison actually establishes'));
  push(P('Three model families with substantially different inductive biases converged on the same accuracy to within half a percentage point. The natural reading is that the task, as posed, is limited by its representation rather than by its learner. Adding a fourth model family, or tuning any of the three harder, would be an inefficient use of effort; the available headroom is in the features and in the data, not in the hypothesis class.'));
  push(P('The finding that does discriminate between the models is the generalisation gap. Two of the three memorised their training data completely, including its injected label noise, and reported respectable test accuracy while doing so. The Random Forest avoided this only because its depth was constrained on purpose. For a system that would eventually give feedback to a parent about their child, the model that reports honestly about its own uncertainty is worth more than the model that scores a fraction of a point higher, and this study happens to select the same model on both criteria.'));

  push(H2('6.2  Why the confusions fall where they do'));
  push(P('Four separate views of the data agree about which classes are hard: the visual similarity in Figure 1, the cluster overlap in the PCA projection in Figure 5, the confusion matrix in Figure 8 and the per-class F1 in Figure 9. All four identify the quadruped-derived classes as mutually confusable and the two lying-down classes as mutually confusable. This is exactly the structure that was deliberately built into the generator, so the agreement is a consistency check on the pipeline rather than an independent discovery — an important distinction that a less careful reading would miss.'));
  push(P('What is genuinely informative is the *mechanism*. Both confusion clusters group exercises that differ chiefly in how the body configuration changes over time rather than in any single static configuration. Cat–Cow is a cyclical alternation between two positions; Child’s Pose is a sustained hold. There exist frames of Cat–Cow that are geometrically close to Child’s Pose, and no frame-level feature set can separate them, because the information that distinguishes them — what the body was doing a second earlier and what it does a second later — is not in the frame. The features are frame-level by construction, so the model is being asked to solve a problem that its inputs do not contain the answer to.'));
  push(P('This makes the prediction in Section 10 falsifiable rather than aspirational: adding velocity, acceleration and movement-phase features over a sliding window should improve precisely the quadruped and lying-down classes, and should leave calf control unchanged because calf control is already separable on static geometry. If temporal features were added and the gains appeared elsewhere, the explanation offered here would be wrong.'));

  push(H2('6.3  What the feature importance result changes'));
  push(P('The design in Section 3.5 anticipated that joint angles would dominate, on the sound theoretical grounds that angles are invariant to translation, scale and body proportion. They do not dominate. Normalised positions carry 77% of importance and inter-joint distances 14%. The result stands and the anticipation was wrong.'));
  push(P('The lesson is not that angles are useless — Figure 4 shows they separate the standing class cleanly, and their invariance properties remain real. It is that invariance is only valuable where the invariant quantity actually differs between classes. For exercises that share a gross body position, the angles at the major joints are similar by definition of that position, and the discriminative information moves into the relative placement of the extremities, which normalised coordinates measure directly and with more resolution. A practitioner designing a similar system should take from this that hip-centring and scale normalisation are the load-bearing steps, and that discarding coordinates in favour of an angles-only representation — a common and superficially principled choice — would cost most of the available signal.'));

  push(H2('6.4  What the synthetic dataset does and does not license'));
  push(P('This is the most important paragraph in the discussion, and it is stated without hedging.'));
  push(P('**What the synthetic results do license.** They license the claim that the pipeline is correctly constructed: that the split does not leak, that the scaler does not leak, that features are computed without invented values, that the evaluation protocol touches the test set once. They license the claim that the feature design behaves in an explicable way, and that the explanation of the feature-importance result is coherent with the angle distributions and the confusion structure. They license the comparative claim that, under this protocol, constrained bagged trees generalise better than unconstrained boosted trees or an unregularised-in-practice neural network. And they license the design conclusion that a frame-level representation has a specific, identifiable blind spot.'));
  push(P('**What they do not license.** They do not license any claim about how well this system would classify a real child’s exercise. The figure 0.928 is a property of the generator: it reflects the class-conditional configurations chosen, the movement amplitude set, the jitter and occlusion rates injected, and the six per cent label noise applied. Change any of those and the number changes. In particular, the generator produces variation that is well-behaved — Gaussian jitter, independent dropout, smooth phase oscillation — whereas a real recording of a child with cerebral palsy would contain asymmetry, involuntary movement, compensation patterns, orthotic devices, adult hands supporting the child, clothing occlusion and camera angles that no seeded generator anticipates. There is no reason to expect 0.928 to survive that, and this report makes no such claim. Rewriting `build_raw_frames` as a loader for real data is a deliberately small change, precisely so that every number here can be re-derived from reality the moment such data exists.'));
  push(P('A subtler point deserves stating. Because the generator and the platform derive their exercise definitions from the same pose bank, the classifier is in a sense being evaluated on data drawn from its own conceptual model of the exercises. That circularity is honest and unavoidable in a synthetic study, but it means the results cannot be treated as any kind of external validation of the exercise definitions themselves.'));

  push(H2('6.5  The platform in the light of the results'));
  push(P('The classifier results have a direct implication for the pose coach. Section 5.7 showed that within the quadruped family the target angles cluster inside one another’s tolerance bands, and Section 5.3 showed that the classifier cannot separate those same classes from a single frame. Both are the same limitation seen from two directions. The design consequence is that the coach must be told which exercise is being performed rather than inferring it — which is exactly how it is built, since the parent selects the step and the coach compares against that step’s target. Had the design instead attempted to identify the exercise from the camera and give feedback accordingly, the results in Section 5 predict it would have failed on the three most common quadruped exercises in the set.'));
  push(P('The splitter evaluation cuts the other way. A 2-of-10 exact match is a weak result, and it would be easy to present the structured nature of the disagreements as an excuse. It is better read as a specification problem: the reviewed lists and the splitter are answering different questions about what constitutes a step on a multi-exercise leaflet, and neither the project nor the leaflet defines that. Resolving it requires a physiotherapist to say what a step is for a parent following along at home, which is one of the reasons clinical review sits high in the next-steps list.'));

  /* --------------------------------------- 7 Honest implementation status */
  push(pageBreak(), H1('7  Honest implementation status'));
  push(P('This section is a direct response to the supervisor’s request that anything not implemented be described clearly, with the next step stated. It is placed in the body of the report, before the limitations and conclusions, rather than in an appendix.'));
  push(P('Table 8 covers everything that was built. Table 9 covers everything that was not.'));

  push(H2('7.1  What is built and what is partly built'));
  push(table(
    ['Component', 'Status', 'Detail and, where partial, the next step'],
    [
      ['Ten exercise programmes with sources', 'Built', 'Lower limb, core and hip stability, glute strengthening, calf control, wrist and hand, Child’s Pose, Cat–Cow, Thread the Needle, standing balance, seated upper body. Five sourced from Sheffield Children’s NHS leaflets, one from a published yoga reference, four labelled as general practice.'],
      ['Original description shown beside generated steps', 'Built', 'Added in response to supervisor feedback. Source text stored verbatim per programme in data/exercises.json.'],
      ['Rule-based step splitting', 'Built', 'Deterministic eight-stage linguistic pipeline. 24 unit tests, all passing. Evaluated in Section 5.6.'],
      ['Description-to-steps conversion in the interface', 'Built', 'The description box rebuilds the step list from whatever text is entered, whether shipped or typed by hand.'],
      ['Live pose estimation from the camera', 'Built', 'MediaPipe Pose Landmarker on-device, with targets derived from the illustration pose bank. Needs a connection the first time to fetch the model; degrades cleanly otherwise.'],
      ['Personalisation (focus filter, difficulty)', 'Built', 'NHS default always displayed alongside the adjusted figure. Resting positions never scaled.'],
      ['Accessibility controls', 'Built', 'Large text, high contrast, reduced motion, keyboard navigation, skip link, ARIA labelling.'],
      ['Classifier pipeline and model comparison', 'Built', 'Nine-stage reproducible pipeline, three model families, seeded throughout. On synthetic data only.'],
      ['Stick-figure illustrations', 'Partly built', 'All 46 poses render, but from hand-authored joint coordinates rather than captured motion or generated imagery. **Next step:** either capture reference motion from a consented adult demonstrator, or replace the bank with a generative model conditioned on the step text — the latter requires the clinical review in Table 9, because an illustration that misrepresents a position is a safety issue.'],
      ['Read-aloud', 'Partly built', 'Uses the browser’s Web Speech API; nothing is bundled, so quality varies by device. **Next step:** detect available voices, allow selection, and fall back to a clear on-screen prompt where synthesis is unavailable or unintelligible.'],
      ['Progress tracking', 'Partly built', 'Per-visit only. Nothing persists because nothing is stored. **Next step:** covered by the persistence entry in Table 9.'],
    ],
    [26, 13, 61],
  ));
  push(tableCaption('**Table 8.** Components that are built or partly built, with the next step for each partial item.'));

  push(H2('7.2  What is not built'));
  push(table(
    ['Item', 'Status', 'What the next step would be'],
    [
      ['LLM-based step splitting', 'NOT built', 'The LLMSplitterAdapter seam exists in both implementations and returns null. It is not connected to any model. Requires: (1) a server-side proxy holding the API key, since the platform is a static page; (2) a schema-constrained prompt with JSON validation and the rule engine retained as fallback; (3) rate limiting and a cost model; (4) a clinical safety review, because a model can invent an instruction that was not in the source text.'],
      ['Real recorded dataset', 'NOT obtained', 'Synthetic only. Requires ethical approval through the university process, informed parental consent and child assent, safeguarding arrangements including DBS-cleared supervision, a data-management plan covering identifiable video, and a clinical setting willing to host recording. Twenty consented participants would let every number in Section 5 be re-derived from reality; build_raw_frames is written to be replaced by a loader with no other pipeline change.'],
      ['Temporal / sequence modelling', 'NOT built', 'Features are frame-level only. Requires re-generating or re-recording data as continuous sequences rather than independent frames, adding velocity, acceleration and phase features over a sliding window, and re-running the three-model comparison. The confusion structure in Section 5.3 predicts exactly where the gain should appear, which makes this a testable next step rather than a hopeful one.'],
      ['Clinical validation', 'NOT done', 'No physiotherapist has reviewed the generated step lists, the illustrations or the coach tolerances. Requires recruiting a paediatric physiotherapist to review all ten step lists against their sources, adjudicate what constitutes a step on a multi-exercise leaflet, check every illustration against the position it claims to show, and set defensible joint-angle tolerances per pose.'],
      ['User evaluation', 'NOT done', 'No child and no parent has used the platform. Requires ethical approval, recruitment through a clinical or charitable partner, a protocol measuring both usability and whether the exercises are actually done, and a control condition of the leaflet alone. This is the largest single gap in the project.'],
      ['Accounts, saved history, therapist dashboard', 'NOT built', 'No backend of any kind exists. Requires a minimal authenticated service, a data-protection impact assessment covering children’s health data, a lawful basis for processing, retention and deletion policies, and a decision about whether adherence data visible to a clinician changes the parent’s relationship with the tool.'],
      ['Generative illustrations', 'NOT built', 'The 46 poses are hand-authored and stand in for a generative vision model. Requires a model that produces anatomically correct positions from step text, an automatic validation step, and clinical review of every generated image before display.'],
      ['Pose coach calibration', 'NOT validated', 'The 20° to 24° tolerances are engineering judgement, not clinical thresholds. Requires measurement of the achievable range for the target population and per-pose, per-joint tolerances agreed with a clinician, since a uniform tolerance is unlikely to be correct for both a trunk angle and a knee angle.'],
    ],
    [22, 12, 66],
  ));
  push(tableCaption('**Table 9.** Components that are not built or not validated, each with the concrete next step required.'));
  push(P('One point of emphasis. The two entries that gate most of the others are the real dataset and the clinical validation. Almost every quantitative claim in this report would be re-derived from the first, and almost every safety claim depends on the second. The engineering work remaining is smaller than the governance work remaining, and it would be misleading to present the project as closer to use than it is.'));

  /* ------------------------------------------ 8 Ethics and safeguarding */
  push(pageBreak(), H1('8  Ethics and safeguarding'));

  push(H2('8.1  Why no children were recorded'));
  push(P('No child was recorded, photographed or observed at any point in this project, and no data about any real person was collected. This was a deliberate decision made at the start rather than a constraint discovered later.'));
  push(P('Recording children with a disability, performing therapeutic movements, in their own homes, engages several protections at once: they are children, so they cannot consent for themselves; they have a disability, which makes them a vulnerable group under any reasonable reading; the recordings would be video of identifiable individuals, which is personal data of the most directly identifying kind; and the content would relate to health, which is special-category data under the UK GDPR. Assembling the approvals, consent process, safeguarding arrangements and data-management plan that this properly requires is not a fortnight’s work bolted onto a taught module. Doing it badly — recording a small convenience sample with informal consent — would have produced a slightly more impressive results section and a genuine ethical failure.'));
  push(P('The synthetic dataset is the consequence of that decision. It is a weaker evidentiary basis, and Section 6.4 states precisely how much weaker. That trade was made knowingly.'));

  push(H2('8.2  Ethical approval position'));
  push(P('The project as conducted involved no human participants, no personal data and no identifiable material, and therefore falls within the category for which a full ethics application is not required. A UREC1-style self-assessment was completed on that basis, recording that the project uses only synthetic data generated in code and publicly available published guidance, and that no recruitment, no observation and no data collection from any person took place.'));
  push(P('That position holds only for the project as it stands. Any of the following would change it and would require a full ethics application before any work began: recording video of a child; recruiting families to use the platform; collecting usability or adherence data; storing any camera output; or any evaluation involving a clinician’s patients. Each of the corresponding entries in Table 9 states this. The project has been arranged so that the boundary is unambiguous — there is no partial data collection anywhere in the codebase that could drift across it.'));

  push(H2('8.3  Data handling in the platform'));
  push(P('The platform collects nothing, stores nothing and transmits nothing. Camera frames are processed on the device by a model running in the browser; no frame is uploaded, no recording is made, and the video element is the only place the image exists. There is no account system, no local storage of progress, no cookies used for tracking and no analytics. The single network request the platform makes is the initial fetch of the pose model from its content-delivery host, which occurs only if a family chooses to enable the camera.'));
  push(P('This is a deliberate architecture rather than an absence of features. A system handling video of disabled children in their own homes has a large attack surface and a large regulatory footprint; the version of the system that has neither is the one that can be honestly described as safe to run today. The cost is that nothing persists between sessions, which is recorded as a limitation in Section 9 and as an unbuilt component in Table 9. Any future backend would require a data-protection impact assessment before a single record was stored.'));

  push(H2('8.4  The risk of a model inventing an instruction'));
  push(P('This risk deserves its own subsection because it is the reason for one of the project’s central design decisions.'));
  push(P('A language model asked to convert a description into steps can produce a step that is not in the source. It may be a plausible-sounding physiotherapy instruction, correctly formatted and confidently phrased, and it may not correspond to anything the clinician wrote. In this context the consequence is not a formatting error: it is a physical instruction, given to a child with a mobility difficulty, by a parent who has been given no reason to doubt it, in a situation where an inappropriate movement can cause harm and where the parent is the last line of review.'));
  push(P('The rule-based splitter has a bounded failure mode. It can only rearrange, classify and renumber text that the parent supplied. Its worst outcome is a badly segmented step list — visible, checkable and unable to introduce content that was not there. This is not an argument that language models should never be used for this task; it is an argument that using one requires the schema validation, the fallback path and above all the clinical safety review set out in Section 2.6 and Table 9.'));
  push(P('Two mitigations are already in place regardless of which splitter runs. The original source description is always displayed beside the generated steps, so any invented instruction would sit next to text that does not contain it. And per-step confidence is surfaced rather than hidden. Both were built for the rule engine and both would remain necessary, not sufficient, for a model-based one.'));

  push(H2('8.5  Safeguarding and clinical safety in the interface'));
  push(P('Three safeguarding decisions are implemented in the platform itself. Safety sentences are extracted by the splitter and displayed separately, never presented as a step to perform, so “stop if your child complains of pain” cannot appear as an instruction to follow. Resting positions such as the 30-minute prone lie are exempt from difficulty scaling, because their duration is prescribed for a physiological reason and is not a target to be adjusted. And the NHS default repetition and hold figures are always shown alongside any personalised figure, so the platform can never silently overwrite clinical guidance with its own arithmetic.'));
  push(P('The platform also carries an explicit statement that it is not a medical device and not a substitute for professional advice, that a clinician-prescribed programme should be followed in preference to anything shown here, and that any exercise causing pain should be stopped.'));

  /* ------------------------------------------------------ 9 Limitations */
  push(pageBreak(), H1('9  Limitations'));
  push(P('The limitations below are ordered by how much they constrain the conclusions, most constraining first.'));
  push(numbered([
    '**The dataset is synthetic.** Every quantitative result characterises a seeded generator, not children. The generator produces well-behaved variation — Gaussian jitter, independent dropout, smooth phase oscillation — while real recordings would contain asymmetry, involuntary movement, compensation patterns, orthotics, supporting adult hands, clothing occlusion and unanticipated camera angles. There is no basis for expecting the reported figures to transfer.',
    '**Nothing has been clinically validated.** No physiotherapist has reviewed the step lists, the illustrations or the pose-coach tolerances. The tolerances in particular are engineering judgement applied uniformly across joints and poses, which is unlikely to be correct for both a knee angle and a trunk angle.',
    '**Nothing has been user-evaluated.** No child and no parent has used the platform. Every usability claim in Section 4 is a design intention, not a measured outcome, and the central premise — that step-by-step multimodal presentation helps more than a leaflet — remains untested.',
    '**Features are frame-level only.** No temporal information is available to the classifier, and Section 6.2 argues that this is precisely what the residual confusions require.',
    '**The splitter evaluation has one rater.** The reviewed step lists were produced by the project team, not by a clinician, and there is no inter-rater agreement figure. The 2-of-10 exact-match figure measures agreement with one reading of the leaflets.',
    '**The test set is small.** 195 samples across six classes leaves calf control with 14 and Thread the Needle with 22. Per-class figures on supports that size have wide confidence intervals, and no confidence intervals were computed. A perfect F1 on 14 samples should not be read as a strong result.',
    '**Feature importances are impurity-based.** Random Forest impurity importances are biased towards high-cardinality continuous features and were computed over correlated inputs. The 77/14 split is a directional finding, not a precise decomposition; permutation importance was not run.',
    '**The exercise corpus is narrow.** Ten programmes, six of them from a single NHS trust’s leaflet series, with a house style the splitter has effectively been tuned against. Performance on a differently written leaflet is unknown.',
    '**The pose coach checks four angles.** Elbow, knee, hip and trunk, from averaged left-right midpoints. Rotation, asymmetry between sides and out-of-plane movement are not assessed at all, and a child could satisfy all four checks while performing the exercise incorrectly.',
    '**The literature survey is informal.** No protocol, no search strategy, no quality appraisal, and several background statements are explicitly uncited because they reflect general understanding rather than a source read for this project.',
    '**No persistence.** Nothing survives a closed tab, so the platform cannot support the longitudinal use that a home exercise programme actually involves.',
  ]));

  /* --------------------------------------- 10 Conclusions and future work */
  push(pageBreak(), H1('10  Conclusions and future work'));

  push(H2('10.1  Conclusions'));
  push(P('This project set out to convert written paediatric physiotherapy guidance into an accessible, step-by-step, multimodal format, and to establish through a controlled study whether frame-level skeletal features can distinguish exercise types. Both parts were completed within stated limits, and the limits are as much a part of the result as the outcomes.'));
  push(P('Returning to the research questions:'));
  push(bullets([
    '**RQ1.** A deterministic rule-based engine can segment published physiotherapy descriptions into usable step lists, but it agrees exactly with a human-reviewed segmentation on only 2 of 10 programmes, at a mean confidence of 0.78. The disagreements are structured rather than random — they occur on multi-exercise leaflets where the reviewer treated a whole sub-exercise as one step — which points to an unresolved specification question about what a step is, not simply to engine error.',
    '**RQ2.** Frame-level features are largely sufficient: 0.928 accuracy and 0.935 macro F1 on synthetic data. The residual error is not spread evenly. It concentrates between exercises that differ mainly in movement over time, which frame-level features cannot represent by construction.',
    '**RQ3.** The Random Forest generalises best, but the margin on test accuracy is one sample. The meaningful separation is the generalisation gap: +0.037 against +0.077 for both alternatives, which reached 1.000 training accuracy and memorised the injected label noise. The Random Forest’s advantage was engineered by constraining max_depth to 12, not discovered.',
    '**RQ4.** Normalised positions carry 77% of feature importance and inter-joint distances 14%. Joint angles, which the feature design expected to dominate, do not. The result is reported as it stands and explained in Section 6.3; the design intuition was wrong.',
    '**RQ5.** Section 7 answers this in full. The engineering work remaining on every unbuilt component is smaller than the governance work — ethical approval, consent, safeguarding and clinical review — that must precede it.',
  ]));
  push(P('The contribution is best described as a complete, inspectable and honestly bounded prototype: a platform that transforms guidance without altering it, a classifier study whose every number is reproducible from a seed, and a register of what is not built that is specific enough to be acted on. It is not a validated intervention, and no part of this report claims otherwise.'));

  push(H2('10.2  Future work, in priority order'));
  push(numbered([
    '**Obtain ethical approval and record a small consented dataset.** Even twenty participants would let every number in Section 5 be re-derived from reality. The pipeline is written so that only build_raw_frames changes. This is first because almost everything else depends on it.',
    '**Add temporal features over a sliding window and re-run the comparison.** Velocity, acceleration and movement phase. The confusion structure predicts the gain should appear in the quadruped and lying-down classes and leave calf control unchanged, which makes the experiment falsifiable.',
    '**Have a physiotherapist review the generated step lists and the coach tolerances.** This resolves the specification question behind the splitter evaluation and replaces uniform engineering-judgement tolerances with per-pose, per-joint clinical ones.',
    '**Connect a language model to the splitter behind a validating proxy,** keeping the rule engine as the fallback: server-side key, schema-constrained prompt, JSON validation, rate limiting, and clinical safety review of the failure modes.',
    '**Evaluate with families.** Does the platform change whether the exercises get done, and done correctly, compared with the leaflet alone? This is the question the whole project exists to raise and the one it has not answered.',
    '**Add persistence behind a data-protection impact assessment,** so a child’s history survives between visits and a physiotherapist can see adherence between appointments — with an explicit decision about what clinician visibility does to a parent’s relationship with the tool.',
  ]));
  push(P('The order is deliberate. Items one and three are governance-bound and have long lead times, so they should start first. Item two is pure engineering and can proceed in parallel. Item five depends on all of the preceding ones and is the only one that would justify describing the platform as anything more than a prototype.'));

  /* ------------------------------------------------------- References */
  push(pageBreak(), H1('References'));
  push(P('References follow the Harvard style. Where a background statement in Section 2 reflects general professional understanding rather than a source read for this project, it is marked as uncited in the text and no reference is fabricated for it here.', { size: 20, italics: true }));

  const refs = [
    'Bazarevsky, V., Grishchenko, I., Raveendran, K., Zhu, T., Zhang, F. and Grundmann, M. (2020) ‘BlazePose: on-device real-time body pose tracking’, arXiv preprint arXiv:2006.10204. Available at: https://arxiv.org/abs/2006.10204 (Accessed: 17 August 2026).',
    'Breiman, L. (2001) ‘Random forests’, Machine Learning, 45(1), pp. 5–32.',
    'Friedman, J.H. (2001) ‘Greedy function approximation: a gradient boosting machine’, The Annals of Statistics, 29(5), pp. 1189–1232.',
    'Google (2023) MediaPipe Pose Landmarker. Available at: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker (Accessed: 17 August 2026).',
    'Harris, C.R., Millman, K.J., van der Walt, S.J., Gommers, R., Virtanen, P., Cournapeau, D., et al. (2020) ‘Array programming with NumPy’, Nature, 585, pp. 357–362.',
    'Hunter, J.D. (2007) ‘Matplotlib: a 2D graphics environment’, Computing in Science & Engineering, 9(3), pp. 90–95.',
    'McKinney, W. (2010) ‘Data structures for statistical computing in Python’, Proceedings of the 9th Python in Science Conference, pp. 51–56.',
    'Mozilla (2024) Web Speech API. MDN Web Docs. Available at: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API (Accessed: 17 August 2026).',
    'National Institute for Health and Care Excellence (2017) Cerebral palsy in under 25s: assessment and management. NICE guideline NG62. Available at: https://www.nice.org.uk/guidance/ng62 (Accessed: 17 August 2026).',
    'Pedregosa, F., Varoquaux, G., Gramfort, A., Michel, V., Thirion, B., Grisel, O., et al. (2011) ‘Scikit-learn: machine learning in Python’, Journal of Machine Learning Research, 12, pp. 2825–2830.',
    'Sheffield Children’s NHS Foundation Trust (no date) General lower limb exercises. Available at: https://library.sheffieldchildrens.nhs.uk/general-lower-limb-exercises/ (Accessed: 17 August 2026).',
    'Sheffield Children’s NHS Foundation Trust (no date) Core and hip stability exercises. Available at: https://library.sheffieldchildrens.nhs.uk/core-and-hip-stability-exercises/ (Accessed: 17 August 2026).',
    'Sheffield Children’s NHS Foundation Trust (no date) Glute strengthening. Available at: https://library.sheffieldchildrens.nhs.uk/glute-strengthening/ (Accessed: 17 August 2026).',
    'Sheffield Children’s NHS Foundation Trust (no date) Calf control exercises. Available at: https://library.sheffieldchildrens.nhs.uk/calf-control-exercises/ (Accessed: 17 August 2026).',
    'Sheffield Children’s NHS Foundation Trust (no date) Wrist exercises. Available at: https://library.sheffieldchildrens.nhs.uk/wrist-exercises/ (Accessed: 17 August 2026).',
    'W3C (2023) Web Content Accessibility Guidelines (WCAG) 2.2. Available at: https://www.w3.org/TR/WCAG22/ (Accessed: 17 August 2026).',
    'Yoga Basics (no date) Threading the Needle. Available at: https://www.yogabasics.com/asana/threading-the-needle/ (Accessed: 17 August 2026).',
  ];
  refs.forEach((r) => c.push(new Paragraph({
    children: runs(r, { size: 21 }),
    indent: { left: 400, hanging: 400 },
    spacing: { after: 110, line: 290 },
    alignment: AlignmentType.LEFT,
  })));

  /* -------------------------------------------------------- Appendix A */
  push(pageBreak(), H1('Appendix A  Repository structure and how to run everything'));

  push(H2('A.1  Repository structure'));
  const tree = [
    'ai4mobility/',
    '  platform/                the web interface',
    '    index.html             page structure',
    '    css/styles.css         interface styles',
    '    js/splitter.js         step-splitting engine (rule-based)',
    '    js/poses.js            stick-figure renderer (46 poses)',
    '    js/posecoach.js        live pose estimation and joint-angle feedback',
    '    js/app.js              application logic',
    '    js/data.js             AUTO-GENERATED from data/exercises.json',
    '    build.py               regenerates data.js and inlines everything to dist/',
    '  src/                     Python pipeline used by the notebook',
    '    splitter.py            Python mirror of the JS splitter',
    '    data_prep.py           generation, cleaning, scaling, subject-level split',
    '    features.py            normalised coordinates, joint angles, distances',
    '    models.py              Random Forest / Gradient Boosting / MLP comparison',
    '    visualise.py           skeleton drawing and result figures',
    '  notebooks/',
    '    AI4Mobility.ipynb      full analysis notebook',
    '  data/',
    '    exercises.json         single source of truth for exercise content',
    '  tests/',
    '    test_splitter.js       24 tests for the JS splitter',
    '    test_posecoach.js      pose-coach angle mathematics',
    '    test_splitter.py       parity tests for the Python mirror',
    '  docs/',
    '    BRIEF.md               verified project facts',
    '    results.json           exact metrics',
    '    report/                this report',
    '    presentations/         slide decks',
    '    figures/               the twelve generated figures',
    '  scripts/',
    '    build_report.js        generator for this document',
    '  dist/',
    '    ai4mobility.html       single-file build, opens with no server',
  ];
  tree.forEach((line) => c.push(new Paragraph({
    children: [new TextRun({ text: line.replace(/ /g, ' '), font: 'Consolas', size: 17 })],
    spacing: { after: 0, line: 240 },
  })));
  push(spacer(200));

  push(H2('A.2  Running the platform'));
  push(P('No build step is required to view the platform. Either serve the `platform/` directory:'));
  push(code([
    'git clone <your-repo-url>',
    'cd ai4mobility',
    'python3 -m http.server 8000 --directory platform',
    '# then open http://localhost:8000',
  ]));
  push(P('or open `dist/ai4mobility.html` directly from the filesystem — it is fully self-contained and needs no server at all. To rebuild `dist/` and regenerate `platform/js/data.js` after editing `data/exercises.json`:'));
  push(code(['python3 platform/build.py']));

  push(H2('A.3  Running the tests'));
  push(code([
    'node tests/test_splitter.js       # JavaScript splitter tests',
    'node tests/test_posecoach.js      # pose-coach angle mathematics',
    'python3 -m pytest tests/ -q       # Python mirror and parity checks',
  ]));
  push(P('90 tests in total, all passing: 24 JavaScript splitter tests, 25 pose-coach tests and 41 Python checks including full JavaScript-to-Python splitter parity.'));

  push(H2('A.4  Running the analysis'));
  push(code([
    'python3 -m venv .venv && source .venv/bin/activate',
    'pip install -r requirements.txt',
    'jupyter notebook notebooks/AI4Mobility.ipynb',
  ]));
  push(P('The notebook also runs in Google Colab. Where an optional dependency is missing it prints exactly what would have run rather than failing silently. Individual pipeline stages can also be run directly:'));
  push(code([
    'python3 -m src.data_prep    # dataset summary and cleaning report',
    'python3 -m src.features     # feature table shape and family counts',
    'python3 -m src.models       # the three-model comparison',
  ]));
  push(P('Every stochastic component is seeded at 42, so a clean checkout reproduces every number in Section 5 exactly.'));

  push(H2('A.5  Rebuilding this report'));
  push(code(['node scripts/build_report.js']));
  push(P('The generator reads the figures from `docs/figures/` and the metrics from `docs/results.json`, and writes `docs/report/AI4Mobility_Project_Report.docx`.'));

  /* -------------------------------------------------------- Appendix B */
  push(pageBreak(), H1('Appendix B  Full per-class metrics for all three models'));
  push(P('All figures below are measured on the held-out test set of 195 samples from subjects not seen during training, on synthetic data. Support is the number of test samples in that class and is identical across models, since all three were evaluated on the same split.'));

  const order = ['calf_control', 'cat_cow', 'childs_pose', 'core_hip_stability', 'lower_limb', 'thread_the_needle'];
  const pretty = {
    calf_control: 'calf_control', cat_cow: 'cat_cow', childs_pose: 'childs_pose',
    core_hip_stability: 'core_hip_stability', lower_limb: 'lower_limb',
    thread_the_needle: 'thread_the_needle',
  };
  const f4 = (v) => v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') === ''
    ? v.toFixed(4) : v.toFixed(4);

  const modelKeys = ['Random Forest', 'Gradient Boosting', 'Neural Network'];
  const tableNums = { 'Random Forest': 10, 'Gradient Boosting': 11, 'Neural Network': 12 };
  modelKeys.forEach((mk) => {
    const m = results.models[mk];
    push(H2(`B.${modelKeys.indexOf(mk) + 1}  ${mk === 'Neural Network' ? 'Neural Network (MLP)' : mk}`));
    const rows = order.map((cls) => {
      const p = m.per_class[cls];
      return [pretty[cls], f4(p.precision), f4(p.recall), f4(p.f1), String(p.support)];
    });
    rows.push([
      'Macro average', '—', '—', m.macro_f1.toFixed(4), '195',
    ]);
    rows.push([
      'Weighted average', '—', '—', m.weighted_f1.toFixed(4), '195',
    ]);
    push(table(
      ['Class', 'Precision', 'Recall', 'F1', 'Support'],
      rows,
      [34, 17, 17, 17, 15],
      { headAlign: AlignmentType.CENTER, bodyAlign: AlignmentType.CENTER, size: 19 },
    ));
    push(tableCaption(`**Table ${tableNums[mk]}.** Per-class metrics for ${mk === 'Neural Network' ? 'the neural network (MLP)' : mk}. Test accuracy ${m.accuracy.toFixed(4)}, training accuracy ${m.train_accuracy.toFixed(4)}, cross-validated macro F1 ${m.cv_mean.toFixed(4)} ± ${m.cv_std.toFixed(4)}, generalisation gap +${m.overfit_gap.toFixed(4)}. Measured on synthetic data.`));
  });

  push(H2('B.4  Summary across the three models'));
  push(P('The pattern is consistent. Calf control is perfect in all three models on a support of 14. Lower limb is weakest in all three. Thread the Needle returns an identical F1 of 0.9048 in all three, from identical precision of 0.95 and recall of 0.8636 — the three models make the same errors on that class. Child’s Pose achieves perfect recall in all three, with precision between 0.875 and 0.9032, which is the signature of a class that other classes are drawn into rather than one that is missed.'));

  return c;
}

/* Fixed-width code block */
function code(lines) {
  return new Table({
    columnWidths: [CONTENT_DXA],
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_DXA, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'F4F6FA', color: 'auto' },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: lines.map((l) => new Paragraph({
          children: [new TextRun({ text: l.replace(/ /g, ' '), font: 'Consolas', size: 18 })],
          spacing: { after: 0, line: 250 },
        })),
      })],
    })],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
  });
}

/* -------------------------------------------------------------------- build */

function build() {
  let pageMap = {};
  const mapFile = '/tmp/toc_pages.json';
  if (fs.existsSync(mapFile)) {
    try { pageMap = JSON.parse(fs.readFileSync(mapFile, 'utf8')); } catch (e) { pageMap = {}; }
  }

  const numbering = {
    config: [
      {
        reference: 'a4m-bullet',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 460, hanging: 260 } } },
        }],
      },
      {
        reference: 'a4m-number',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 520, hanging: 320 } } },
        }],
      },
    ],
  };

  const doc = new Document({
    creator: 'Team Deepminds, Sheffield Hallam University',
    title: 'AI4Mobility: A Multimodal Assistive Platform for Parents Supporting Children with Mobility Difficulties',
    description: 'Group Project A60, module 55-708252, MSc, Sheffield Hallam University.',
    numbering,
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22, color: '1A1A1A' } },
      },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: 'Calibri', size: 30, bold: true, color: ACCENT } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: 'Calibri', size: 25, bold: true, color: ACCENT } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: 'Calibri', size: 22, bold: true, color: '1A1A1A' } },
      ],
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children: titlePage(),
      },
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            pageNumbers: { start: 1 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              children: [new TextRun({
                text: 'AI4Mobility  —  Group Project A60  —  Module 55-708252',
                size: 17, color: '6B7280',
              })],
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
              spacing: { after: 120 },
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              children: [
                new TextRun({ text: 'Team Deepminds', size: 17, color: '6B7280' }),
                new TextRun({ text: '\t', size: 17 }),
                new TextRun({ text: 'Page ', size: 17, color: '6B7280' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 17, color: '6B7280' }),
                new TextRun({ text: ' of ', size: 17, color: '6B7280' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: '6B7280' }),
              ],
              tabStops: [{ type: 'right', position: CONTENT_DXA - 60 }],
              spacing: { before: 100 },
            })],
          }),
        },
        children: [
          H1('Table of contents'),
          ...tocParagraphs(pageMap),
          pageBreak(),
          ...buildBody(pageMap),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc).then((buf) => {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, buf);
    console.log('written:', OUT, (buf.length / 1024).toFixed(0) + ' KB');
    console.log('toc page numbers:', Object.keys(pageMap).length ? 'loaded from ' + mapFile : 'not yet resolved');
  });
}

build().catch((e) => { console.error(e); process.exit(1); });
