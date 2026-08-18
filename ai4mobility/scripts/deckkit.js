'use strict';
/* =============================================================================
   AI4Mobility — shared deck design kit
   -----------------------------------------------------------------------------
   One design system for all four individual presentations, so the decks look
   like they came from the same team. Every helper here writes British English
   content supplied by the caller; nothing in this file invents facts.

   Canvas: LAYOUT_WIDE (13.33 x 7.5 in). pres.layout is set before any slide is
   added. Hex colours carry no leading '#', per pptxgenjs.
   ============================================================================= */

const fs = require('fs');
const pptxgen = require('pptxgenjs');

/* ----------------------------------------------------------------- palette */

const C = {
  primary: '2F6690',
  primaryDark: '1F4A68',
  accent: 'E8734A',
  accentDark: 'C85A34',
  ink: '1C2B3A',
  inkSoft: '4B6072',
  line: 'DDE6EC',
  surface: 'FFFFFF',
  page: 'F4F7FA',
  // derived tints, used only as flat fills (pptxgenjs has no gradients)
  tintPrimary: 'E9F0F6',
  tintAccent: 'FBEDE6',
  onDarkSoft: 'B9CEDD',
};

const FONT = { head: 'Cambria', body: 'Calibri' };

const M = 0.62;                 // page margin
const CW = 13.33 - 2 * M;       // content width, 12.09
const FOOT_Y = 6.85;
const BOTTOM = 6.58;            // lowest usable y for content

const SHAPE = { round: 'roundRect', ellipse: 'ellipse', rect: 'rect' };

/* ------------------------------------------------------------- image utils */

/** Read a PNG's pixel dimensions straight from its IHDR chunk. */
function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(12) !== 0x49484452) {
    throw new Error(`not a readable PNG header: ${file}`);
  }
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/** Fit an image inside a box without distorting it; returns placement inches. */
function fitImage(file, box) {
  const { w, h } = imageSize(file);
  const s = Math.min(box.w / w, box.h / h);
  const outW = w * s;
  const outH = h * s;
  return {
    x: box.x + (box.w - outW) / 2,
    y: box.y + (box.h - outH) / 2,
    w: outW,
    h: outH,
  };
}

/* ------------------------------------------------------------------- deck */

function makeDeck({ member, role, deckTitle }) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';           // must precede any addSlide call
  pres.author = member;
  pres.company = 'Sheffield Hallam University — Team Deepminds';
  pres.subject = 'A60 AI4Mobility, module 55-708252';
  pres.title = deckTitle || `AI4Mobility — ${member}`;
  pres._member = member;
  pres._role = role;
  pres._n = 0;
  return pres;
}

function footer(pres, slide, dark) {
  slide.addText(`A60 AI4Mobility  ·  ${pres._member}  ·  Team Deepminds`, {
    x: M, y: FOOT_Y, w: 9.4, h: 0.3, margin: 0, valign: 'middle',
    fontFace: FONT.body, fontSize: 9,
    color: dark ? C.onDarkSoft : C.inkSoft,
  });
  slide.addShape(SHAPE.ellipse, {
    x: 12.34, y: FOOT_Y - 0.02, w: 0.35, h: 0.35,
    fill: { color: dark ? C.accent : C.tintPrimary },
    line: { color: dark ? C.accent : C.line, width: 0.75 },
  });
  slide.addText(String(pres._n), {
    x: 12.34, y: FOOT_Y - 0.02, w: 0.35, h: 0.35, margin: 0,
    align: 'center', valign: 'middle', fontFace: FONT.body,
    fontSize: 10, bold: true, color: dark ? 'FFFFFF' : C.primary,
  });
}

function baseSlide(pres, { dark = false, note } = {}) {
  const s = pres.addSlide();
  pres._n += 1;
  s.background = { color: dark ? C.primaryDark : C.surface };
  footer(pres, s, dark);
  if (note) s.addNotes(note);
  return s;
}

/** Kicker + title + optional standfirst. Returns the y where content may start. */
function titleBlock(slide, { kicker, title, subtitle, dark = false }) {
  const titleY = kicker ? 0.72 : 0.52;
  if (kicker) {
    slide.addText(kicker.toUpperCase(), {
      x: M, y: 0.42, w: CW, h: 0.26, margin: 0, valign: 'middle',
      fontFace: FONT.body, fontSize: 10.5, bold: true, charSpacing: 1.6,
      color: dark ? C.accent : C.accentDark,
    });
  }
  slide.addText(title, {
    x: M, y: titleY, w: CW, h: 0.66, margin: 0, valign: 'middle',
    fontFace: FONT.head, fontSize: 28, bold: true,
    color: dark ? 'FFFFFF' : C.primaryDark,
  });
  let y = titleY + 0.78;
  if (subtitle) {
    slide.addText(subtitle, {
      x: M, y, w: CW - 0.4, h: 0.42, margin: 0, valign: 'top',
      fontFace: FONT.body, fontSize: 13.5,
      color: dark ? C.onDarkSoft : C.inkSoft,
    });
    y += 0.56;
  }
  return y + 0.14;
}

/* --------------------------------------------------------------- primitives */

/** Rounded card, the repeated container motif across every deck. */
function card(slide, { x, y, w, h, fill = C.page, lineColour = C.line, shadow = false }) {
  const opts = {
    x, y, w, h, rectRadius: 0.07,
    fill: { color: fill },
    line: { color: lineColour, width: 0.75 },
  };
  if (shadow) {
    opts.shadow = { type: 'outer', color: '9FB3C2', blur: 8, offset: 2, angle: 90, opacity: 0.25 };
  }
  slide.addShape(SHAPE.round, opts);
}

/** Small filled circle carrying a number or short glyph — the second motif. */
function badge(slide, { x, y, d = 0.4, text, fill = C.primary, colour = 'FFFFFF', size = 13 }) {
  slide.addShape(SHAPE.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0.5 } });
  slide.addText(String(text), {
    x, y, w: d, h: d, margin: 0, align: 'center', valign: 'middle',
    fontFace: FONT.body, fontSize: size, bold: true, color: colour,
  });
}

/**
 * Icon-and-text rows: numbered or dotted badge, bold lead, muted detail.
 * items: [{ h: 'Lead line', t: 'Supporting detail' }]
 */
function rows(slide, items, {
  x = M, y, w = CW, bottom = BOTTOM, badgeStyle = 'num', numStart = 1,
  headSize, bodySize = 12, dark = false,
} = {}) {
  const n = items.length;
  const hasDetail = items.some((it) => it.t);
  if (!headSize) headSize = hasDetail ? 15 : 13.5;
  const total = bottom - y;
  const rowH = Math.min(total / n, hasDetail ? 1.02 : 0.56);
  const y0 = y + Math.max(0, (total - rowH * n) / 2);
  items.forEach((it, i) => {
    const ry = y0 + i * rowH;
    const glyph = badgeStyle === 'num' ? String(numStart + i) : '';
    if (badgeStyle === 'num') {
      badge(slide, { x, y: ry + 0.04, d: 0.4, text: glyph, fill: dark ? C.accent : C.primary, size: 12.5 });
    } else {
      slide.addShape(SHAPE.ellipse, {
        x: x + 0.06, y: ry + 0.16, w: 0.16, h: 0.16,
        fill: { color: dark ? C.accent : C.accent }, line: { color: dark ? C.accent : C.accent, width: 0.5 },
      });
    }
    const tx = x + 0.58;
    const tw = w - 0.58;
    slide.addText(it.h, {
      x: tx, y: ry, w: tw, h: it.t ? 0.32 : 0.4, margin: 0, valign: 'middle',
      fontFace: FONT.body, fontSize: headSize, bold: true,
      color: dark ? 'FFFFFF' : C.ink,
    });
    if (it.t) {
      slide.addText(it.t, {
        x: tx, y: ry + 0.32, w: tw, h: rowH - 0.38, margin: 0, valign: 'top',
        fontFace: FONT.body, fontSize: bodySize,
        color: dark ? C.onDarkSoft : C.inkSoft,
      });
    }
  });
}

/** Rough wrapped-line count, used to size cards so they neither clip nor gape. */
function estimateLines(text, widthIn, fontSize) {
  const charsPerLine = Math.max(12, (widthIn - 0.28) * 144 / fontSize * 1.02);
  return Math.max(1, Math.ceil(String(text).length / charsPerLine));
}

function estimateBulletsHeight(items, widthIn, fontSize, space = 8) {
  const lineH = fontSize * 1.28 / 72;
  const lines = items.reduce((a, t) => a + estimateLines(t, widthIn, fontSize), 0);
  return lines * lineH + (items.length - 1) * (space / 72);
}

/** Plain bullet list inside a given box. Keep to six items or fewer. */
function bullets(slide, items, { x, y, w, h, size = 13, colour = C.ink, space = 8 }) {
  const runs = items.map((t, i) => ({
    text: t,
    options: {
      bullet: { code: '2022' }, breakLine: i !== items.length - 1,
      paraSpaceAfter: i === items.length - 1 ? 0 : space,
    },
  }));
  slide.addText(runs, {
    x, y, w, h, margin: 0, valign: 'top',
    fontFace: FONT.body, fontSize: size, color: colour, lineSpacingMultiple: 1.05,
  });
}

/** Height a callout needs for its text, so nothing is ever clipped by its box. */
function labelLineCount(label, w) {
  if (!label) return 0;
  const cpl = Math.max(8, (w - 0.48) * 144 / (9.5 * 1.62));
  return Math.max(1, Math.ceil(String(label).length / cpl));
}

function calloutHeight({ text, w = CW, size = 12.5, label }) {
  const cpl = Math.max(12, (w - 0.48) * 144 / size * 1.02);
  const lines = Math.max(1, Math.ceil(String(text).length / cpl));
  return 0.14 + labelLineCount(label, w) * 0.24 + lines * (size * 1.3 / 72) + 0.2;
}

/** Tinted note box with a small label — used for caveats and honesty statements. */
function callout(slide, { x = M, y, w = CW, h = 0.95, label, text, tone = 'accent', size = 12.5 }) {
  const fill = tone === 'accent' ? C.tintAccent : C.tintPrimary;
  const edge = tone === 'accent' ? 'F0C9B6' : 'C6D8E5';
  const labelColour = tone === 'accent' ? C.accentDark : C.primaryDark;
  slide.addShape(SHAPE.round, {
    x, y, w, h, rectRadius: 0.07,
    fill: { color: fill }, line: { color: edge, width: 0.75 },
  });
  let ty = y + 0.14;
  if (label) {
    const lh = labelLineCount(label, w) * 0.24;
    slide.addText(label.toUpperCase(), {
      x: x + 0.24, y: ty, w: w - 0.48, h: lh, margin: 0, valign: 'top',
      fontFace: FONT.body, fontSize: 9.5, bold: true, charSpacing: 1.3, color: labelColour,
    });
    ty += lh + 0.04;
  }
  slide.addText(text, {
    x: x + 0.24, y: ty, w: w - 0.48, h: y + h - ty - 0.12, margin: 0, valign: 'top',
    fontFace: FONT.body, fontSize: size, color: C.ink, lineSpacingMultiple: 1.05,
  });
}

/** Three or four large figures with labels. */
function statRow(slide, stats, { y, h = 1.5, x = M, w = CW, gap = 0.26, valueSize = 32 } = {}) {
  const n = stats.length;
  const cw = (w - gap * (n - 1)) / n;
  stats.forEach((st, i) => {
    const cx = x + i * (cw + gap);
    card(slide, { x: cx, y, w: cw, h, fill: C.page });
    slide.addText(st.value, {
      x: cx + 0.16, y: y + 0.14, w: cw - 0.32, h: 0.62, margin: 0, valign: 'middle',
      fontFace: FONT.head, fontSize: valueSize, bold: true, color: C.primary, align: 'center',
    });
    slide.addText(st.label, {
      x: cx + 0.14, y: y + 0.76, w: cw - 0.28, h: 0.3, margin: 0, valign: 'middle',
      fontFace: FONT.body, fontSize: 12, bold: true, color: C.ink, align: 'center',
    });
    if (st.sub) {
      slide.addText(st.sub, {
        x: cx + 0.14, y: y + 1.03, w: cw - 0.28, h: h - 1.1, margin: 0, valign: 'top',
        fontFace: FONT.body, fontSize: 10, color: C.inkSoft, align: 'center',
      });
    }
  });
}

/* ------------------------------------------------------------ slide recipes */

function titleSlide(pres, { title, standfirst, member, role, meta, note }) {
  const s = baseSlide(pres, { dark: true, note });
  s.addText('PROJECT A60  ·  MODULE 55-708252', {
    x: M, y: 0.9, w: CW, h: 0.3, margin: 0, valign: 'middle',
    fontFace: FONT.body, fontSize: 12, bold: true, charSpacing: 2, color: C.accent,
  });
  s.addText(title, {
    x: M, y: 1.32, w: 11.4, h: 1.5, margin: 0, valign: 'middle',
    fontFace: FONT.head, fontSize: 42, bold: true, color: 'FFFFFF',
  });
  s.addText(standfirst, {
    x: M, y: 2.86, w: 10.6, h: 0.9, margin: 0, valign: 'top',
    fontFace: FONT.body, fontSize: 15, color: C.onDarkSoft, lineSpacingMultiple: 1.1,
  });

  card(s, { x: M, y: 3.95, w: 6.4, h: 1.72, fill: C.primary, lineColour: C.primary });
  s.addText('PRESENTED BY', {
    x: M + 0.3, y: 4.14, w: 5.8, h: 0.26, margin: 0, valign: 'middle',
    fontFace: FONT.body, fontSize: 9.5, bold: true, charSpacing: 1.4, color: C.onDarkSoft,
  });
  s.addText(member, {
    x: M + 0.3, y: 4.42, w: 5.8, h: 0.46, margin: 0, valign: 'middle',
    fontFace: FONT.head, fontSize: 21, bold: true, color: 'FFFFFF',
  });
  s.addText(role, {
    x: M + 0.3, y: 4.92, w: 5.8, h: 0.5, margin: 0, valign: 'top',
    fontFace: FONT.body, fontSize: 13, color: C.onDarkSoft,
  });

  const metaX = 7.35;
  card(s, { x: metaX, y: 3.95, w: 13.33 - M - metaX, h: 1.72, fill: C.primaryDark, lineColour: '355F7C' });
  const metaRuns = meta.map((t, i) => ({
    text: t,
    options: { breakLine: i !== meta.length - 1, paraSpaceAfter: i === meta.length - 1 ? 0 : 5 },
  }));
  s.addText(metaRuns, {
    x: metaX + 0.3, y: 4.14, w: 13.33 - M - metaX - 0.6, h: 1.34, margin: 0, valign: 'middle',
    fontFace: FONT.body, fontSize: 12.5, color: 'FFFFFF', lineSpacingMultiple: 1.05,
  });
  return s;
}

function sectionSlide(pres, { number, title, summary, note }) {
  const s = baseSlide(pres, { dark: true, note });
  badge(s, { x: M, y: 2.5, d: 0.86, text: number, fill: C.accent, size: 26 });
  s.addText(title, {
    x: M, y: 3.56, w: 10.8, h: 0.9, margin: 0, valign: 'middle',
    fontFace: FONT.head, fontSize: 34, bold: true, color: 'FFFFFF',
  });
  if (summary) {
    s.addText(summary, {
      x: M, y: 4.52, w: 9.8, h: 0.8, margin: 0, valign: 'top',
      fontFace: FONT.body, fontSize: 14, color: C.onDarkSoft, lineSpacingMultiple: 1.1,
    });
  }
  return s;
}

function bulletSlide(pres, { kicker, title, subtitle, items, style = 'num', numStart = 1, callout: co, note }) {
  const s = baseSlide(pres, { note });
  let y = titleBlock(s, { kicker, title, subtitle });
  let bottom = BOTTOM;
  let coH = 0;
  if (co) {
    coH = Math.max(co.h || 0, calloutHeight({ text: co.text, w: CW, size: co.size, label: co.label }));
    bottom = BOTTOM - coH - 0.24;
  }
  rows(s, items, { y, bottom, badgeStyle: style, numStart });
  if (co) callout(s, Object.assign({}, co, { y: BOTTOM - coH, h: coH }));
  return s;
}

function figureSlide(pres, {
  kicker, title, subtitle, image, caption, side, sideTitle, callout: co, note,
}) {
  const s = baseSlide(pres, { note });
  const y = titleBlock(s, { kicker, title, subtitle });
  const capH = caption ? 0.42 : 0.05;
  let boxW = CW;
  if (side && side.length) boxW = 7.45;

  const box = { x: M, y: y + 0.06, w: boxW, h: BOTTOM - y - capH - 0.12 };
  const pl = fitImage(image, box);
  card(s, {
    x: pl.x - 0.12, y: pl.y - 0.12, w: pl.w + 0.24, h: pl.h + 0.24,
    fill: C.surface, lineColour: C.line, shadow: true,
  });
  s.addImage({ path: image, x: pl.x, y: pl.y, w: pl.w, h: pl.h });
  if (caption) {
    s.addText(caption, {
      x: box.x, y: pl.y + pl.h + 0.2, w: box.w, h: 0.34, margin: 0, valign: 'top',
      fontFace: FONT.body, fontSize: 10.5, italic: true, color: C.inkSoft, align: 'center',
    });
  }
  if (side && side.length) {
    const sx = M + boxW + 0.38;
    const sw = 13.33 - M - sx;
    let sy = y + 0.06;
    if (sideTitle) {
      s.addText(sideTitle, {
        x: sx, y: sy, w: sw, h: 0.34, margin: 0, valign: 'middle',
        fontFace: FONT.body, fontSize: 14, bold: true, color: C.primaryDark,
      });
      sy += 0.42;
    }
    const coSize = co ? (co.size || 11.5) : 11.5;
    const coH = co ? Math.max(co.h || 0, calloutHeight({ text: co.text, w: sw, size: coSize, label: co.label })) : 0;
    const listH = BOTTOM - sy - (co ? coH + 0.22 : 0);
    bullets(s, side, { x: sx, y: sy, w: sw, h: listH, size: 12.5 });
    if (co) callout(s, Object.assign({}, co, { x: sx, w: sw, y: BOTTOM - coH, h: coH, size: coSize }));
  } else if (co) {
    const coH = Math.max(co.h || 0, calloutHeight({ text: co.text, w: CW, size: co.size, label: co.label }));
    callout(s, Object.assign({}, co, { y: BOTTOM - coH, h: coH }));
  }
  return s;
}

function twoColSlide(pres, { kicker, title, subtitle, left, right, callout: co, note }) {
  const s = baseSlide(pres, { note });
  const y = titleBlock(s, { kicker, title, subtitle });
  const coH = co ? Math.max(co.h || 0, calloutHeight({ text: co.text, w: CW, size: co.size, label: co.label })) : 0;
  const avail = BOTTOM - y - (co ? coH + 0.24 : 0);
  const gap = 0.34;
  const w = (CW - gap) / 2;
  const textW = w - 0.56;
  const needed = Math.max(
    ...[left, right].map((col) => 0.66 + estimateBulletsHeight(col.items, textW, col.size || 12.5) + 0.34)
  );
  const h = Math.min(avail, Math.max(2.4, needed));
  const cy = y + (avail - h) * (co ? 0 : 0.34);
  [[left, M], [right, M + w + gap]].forEach(([col, x]) => {
    card(s, { x, y: cy, w, h, fill: col.fill || C.page, lineColour: col.lineColour || C.line });
    s.addText(col.title, {
      x: x + 0.28, y: cy + 0.2, w: w - 0.56, h: 0.4, margin: 0, valign: 'middle',
      fontFace: FONT.body, fontSize: 15, bold: true, color: col.titleColour || C.primaryDark,
    });
    bullets(s, col.items, {
      x: x + 0.28, y: cy + 0.66, w: w - 0.56, h: h - 0.86,
      size: col.size || 12.5, colour: col.textColour || C.ink,
    });
  });
  if (co) callout(s, Object.assign({}, co, { y: Math.min(BOTTOM - coH, cy + h + 0.28), h: coH }));
  return s;
}

function tableSlide(pres, {
  kicker, title, subtitle, headers, rows: body, colW, note, caption,
  callout: co, highlight = [], align, fontSize = 12, rowH,
}) {
  const s = baseSlide(pres, { note });
  const y = titleBlock(s, { kicker, title, subtitle });
  const colAlign = (i) => (align ? align[i] : (i === 0 ? 'left' : 'center'));
  if (!rowH) {
    const room = BOTTOM - y - (caption ? 0.5 : 0)
      - (co ? calloutHeight({ text: co.text, w: CW, size: co.size, label: co.label }) + 0.24 : 0);
    rowH = Math.min(0.62, Math.max(0.36, room / (body.length + 1)));
  }

  const head = headers.map((h, i) => ({
    text: h,
    options: {
      bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize,
      align: colAlign(i), valign: 'middle',
    },
  }));
  const bodyRows = body.map((r, ri) => r.map((cell, ci) => ({
    text: String(cell),
    options: {
      fontSize,
      bold: highlight.includes(ri),
      color: highlight.includes(ri) ? C.primaryDark : C.ink,
      fill: { color: highlight.includes(ri) ? C.tintPrimary : (ri % 2 ? C.page : C.surface) },
      align: colAlign(ci), valign: 'middle',
    },
  })));

  s.addTable([head, ...bodyRows], {
    x: M, y, w: CW, colW,
    border: { type: 'solid', color: C.line, pt: 0.5 },
    fontFace: FONT.body, color: C.ink,
    rowH, margin: [4, 8, 4, 8], valign: 'middle',
  });

  const lineH = fontSize * 1.32 / 72;
  const rowEst = (cells) => Math.max(
    rowH,
    Math.max(...cells.map((c, i) => estimateLines(c, colW ? colW[i] : CW / headers.length, fontSize))) * lineH + 0.16
  );
  const tableBottom = [headers, ...body].reduce((a, r) => a + rowEst(r), y);
  if (caption) {
    s.addText(caption, {
      x: M, y: Math.min(tableBottom + 0.12, BOTTOM - 0.4), w: CW, h: 0.36, margin: 0, valign: 'top',
      fontFace: FONT.body, fontSize: 10.5, italic: true, color: C.inkSoft,
    });
  }
  if (co) {
    const coH = Math.max(co.h || 0, calloutHeight({ text: co.text, w: CW, size: co.size, label: co.label }));
    callout(s, Object.assign({}, co, { y: BOTTOM - coH, h: coH }));
  }
  return s;
}

function statSlide(pres, { kicker, title, subtitle, stats, items, callout: co, note }) {
  const s = baseSlide(pres, { note });
  const y = titleBlock(s, { kicker, title, subtitle });
  statRow(s, stats, { y, h: 1.6 });
  let ny = y + 1.86;
  const coH = co ? Math.max(co.h || 0, calloutHeight({ text: co.text, w: CW, size: co.size, label: co.label })) : 0;
  if (items && items.length) {
    rows(s, items, { y: ny, bottom: BOTTOM - (co ? coH + 0.22 : 0), badgeStyle: 'dot' });
  }
  if (co) callout(s, Object.assign({}, co, { y: BOTTOM - coH, h: coH }));
  return s;
}

function teamSlide(pres, { members, highlight, note, title = 'Team Deepminds — four roles, one platform', subtitle }) {
  const s = baseSlide(pres, { note });
  const y = titleBlock(s, { kicker: 'The team', title, subtitle });
  const gap = 0.3;
  const w = (CW - gap) / 2;
  const avail = BOTTOM - y;
  const h = Math.min(1.95, (avail - gap) / 2);
  const y0 = y + Math.max(0, (avail - (2 * h + gap)) / 2);
  members.forEach((mem, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (w + gap);
    const cy = y0 + row * (h + gap);
    const on = mem.name === highlight;
    card(s, {
      x, y: cy, w, h,
      fill: on ? C.primary : C.page,
      lineColour: on ? C.primary : C.line,
      shadow: on,
    });
    s.addText(mem.name, {
      x: x + 0.28, y: cy + h * 0.14, w: w - 1.9, h: 0.42, margin: 0, valign: 'middle',
      fontFace: FONT.head, fontSize: 17, bold: true, color: on ? 'FFFFFF' : C.primaryDark,
    });
    s.addText(mem.role, {
      x: x + 0.28, y: cy + h * 0.4, w: w - 0.56, h: 0.38, margin: 0, valign: 'middle',
      fontFace: FONT.body, fontSize: 12.5, color: on ? 'FFFFFF' : C.ink,
    });
    s.addText(mem.share, {
      x: x + 0.28, y: cy + h * 0.66, w: w - 0.56, h: 0.34, margin: 0, valign: 'middle',
      fontFace: FONT.body, fontSize: 11, color: on ? C.onDarkSoft : C.inkSoft,
    });
    if (on) {
      s.addText('THIS DECK', {
        x: x + w - 1.55, y: cy + h * 0.14 + 0.07, w: 1.27, h: 0.28, margin: 0,
        align: 'center', valign: 'middle', fontFace: FONT.body,
        fontSize: 9, bold: true, charSpacing: 1.2, color: C.primaryDark,
        fill: { color: 'FFFFFF' },
      });
    }
  });
  return s;
}

function closingSlide(pres, { title, points, closer, contact, note }) {
  const s = baseSlide(pres, { dark: true, note });
  s.addText('IN CLOSING', {
    x: M, y: 0.86, w: CW, h: 0.3, margin: 0, valign: 'middle',
    fontFace: FONT.body, fontSize: 11, bold: true, charSpacing: 2, color: C.accent,
  });
  s.addText(title, {
    x: M, y: 1.24, w: 11.6, h: 1.0, margin: 0, valign: 'middle',
    fontFace: FONT.head, fontSize: 32, bold: true, color: 'FFFFFF',
  });
  const gap = 0.28;
  const w = (CW - gap * (points.length - 1)) / points.length;
  points.forEach((p, i) => {
    const x = M + i * (w + gap);
    card(s, { x, y: 2.5, w, h: 1.94, fill: C.primary, lineColour: '3C7AA6' });
    s.addText(p.h, {
      x: x + 0.24, y: 2.68, w: w - 0.48, h: 0.44, margin: 0, valign: 'middle',
      fontFace: FONT.body, fontSize: 14, bold: true, color: 'FFFFFF',
    });
    s.addText(p.t, {
      x: x + 0.24, y: 3.14, w: w - 0.48, h: 1.16, margin: 0, valign: 'top',
      fontFace: FONT.body, fontSize: 11.5, color: 'E4EEF5', lineSpacingMultiple: 1.05,
    });
  });
  s.addText(closer, {
    x: M, y: 4.72, w: 11.6, h: 0.9, margin: 0, valign: 'top',
    fontFace: FONT.head, fontSize: 17, italic: true, color: 'FFFFFF', lineSpacingMultiple: 1.1,
  });
  s.addText(contact, {
    x: M, y: 5.74, w: 11.6, h: 0.8, margin: 0, valign: 'top',
    fontFace: FONT.body, fontSize: 12, color: C.onDarkSoft, lineSpacingMultiple: 1.1,
  });
  return s;
}

/* ------------------------------------------------------------ shared content */

const TEAM = [
  { name: 'Krushna Sai Teja Adhala', role: 'Data engineering and pipeline lead', share: 'Peer contribution split: 28%' },
  { name: 'Ailuri Rupa Sri', role: 'Model development and evaluation lead', share: 'Peer contribution split: 26%' },
  { name: 'Nandi Reddy Shashidhar Reddy', role: 'Pose estimation and visualisation lead', share: 'Peer contribution split: 24%' },
  { name: 'Dhanush Sanjay', role: 'Research and documentation lead', share: 'Peer contribution split: 22%' },
];

const MODEL_TABLE = {
  headers: ['Model', 'Test accuracy', 'Test macro F1', 'CV macro F1 (5-fold, train only)', 'Train accuracy', 'Generalisation gap'],
  rows: [
    ['Random Forest', '0.928', '0.935', '0.955 ± 0.017', '0.965', '+0.037'],
    ['Gradient Boosting', '0.923', '0.931', '0.939 ± 0.016', '1.000', '+0.077'],
    ['Neural Network (MLP)', '0.923', '0.932', '0.939 ± 0.019', '1.000', '+0.077'],
  ],
  colW: [2.85, 1.75, 1.75, 2.65, 1.6, 1.49],
  highlight: [0],
};

const FIG = (name) => `/home/claude/repo/ai4mobility/docs/figures/${name}`;

const META = [
  'Sheffield Hallam University — MSc',
  'AI Research and Development Project',
  'Team Deepminds  ·  Supervisor: Alejandro',
];

module.exports = {
  C, FONT, M, CW, BOTTOM, SHAPE, TEAM, MODEL_TABLE, META, FIG,
  makeDeck, baseSlide, titleBlock, card, badge, rows, bullets, callout, statRow,
  titleSlide, sectionSlide, bulletSlide, figureSlide, twoColSlide, tableSlide, calloutHeight,
  statSlide, teamSlide, closingSlide, imageSize, fitImage,
};
