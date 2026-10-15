/*
 * PROTOTYPE — board edges, set 2. Throwaway.
 * Answers: how should navigation edges draw between the blueprint frames,
 * without ever revealing edges on hover, and without drawing spaghetti over
 * the frames.
 *
 * Eight variants, ?variant= and the bottom bar:
 *   H — Sankey: quiet grey bands; a press thickens and tints the band it used
 *   I — Comet: nothing static; a press sends a dot along the arc, fading trail
 *   J — Footprints: small numbered ticks on each frame's rim, the only marks
 *   K — Breadcrumb: one chain of the last 6 presses, fading oldest first
 *   L — Minimap: a small graph in the corner; the board itself stays bare
 *   M — Spine: one vertical line per frame, ticks for in/out, press lights one
 *   N — Heat: frames tint by how often pressed; a press sends a ripple
 *   O — Ribbon: one flowing band per flow, thickness = frequency, always quiet
 *
 * Run: python3 -m http.server 58626 --bind 127.0.0.1 \
 *        --directory mobile/src/ide/prototype-board-edges
 * Open: http://127.0.0.1:58626/set2.html?variant=H
 */

const PHONE = { w: 390, h: 820 };
const LABEL_H = 30, GAP = 32, PAD = 24, HEADROOM = 220, FRAME_STRIDE = PHONE.w + GAP;

const SCREENS = ['login', 'index', 'habits', 'stats', 'profile', 'habit', 'settings'];
const TAB_SCREENS = ['index', 'habits', 'stats', 'profile'];

// The seven observed edges, with a plausible frequency so thickness means something.
const EDGES = [
  { from: 'login', to: 'index', label: 'signIn() → /', n: 3 },
  { from: 'index', to: 'profile', label: '/ → /profile', n: 2 },
  { from: 'index', to: 'stats', label: '/ → /stats', n: 1 },
  { from: 'index', to: 'habit', label: 'select → /habit', n: 6 },
  { from: 'habits', to: 'habit', label: 'select → /habit', n: 4 },
  { from: 'profile', to: 'settings', label: '/profile → /settings', n: 2 },
  { from: 'profile', to: 'login', label: 'signOut() → /login', n: 1 },
];
const BACK_HISTORY = { habit: ['index', 'habits'], settings: ['profile'] };
const UNRESOLVED_ON = ['habit', 'settings'];

const INK = '#3D332A';
const INK_SOFT = '#A39888';
const PAPER = '#F4EFE8';
const WARM = '#C2410C';

const $ = (sel, root = document) => root.querySelector(sel);
const idxOf = (key) => SCREENS.indexOf(key);
const frameEl = (key) => document.getElementById('screen-' + key);
const centerX = (key) => { const el = frameEl(key); return el ? el.offsetLeft + PHONE.w / 2 : 0; };
const frameTop = () => { const el = frameEl(SCREENS[0]); return el ? el.offsetTop + LABEL_H : 0; };

function arcPath(x1, x2, baseY, lift) {
  const midX = (x1 + x2) / 2;
  const d = Math.max(Math.abs(x2 - x1), 1);
  const dy = baseY - lift - d * 0.06;
  return `M ${x1} ${baseY} C ${midX} ${dy}, ${midX} ${dy}, ${x2} ${baseY}`;
}

function makeSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'edge-layer';
  svg.setAttribute('width', String(PAD * 2 + FRAME_STRIDE * SCREENS.length));
  svg.setAttribute('height', String(HEADROOM + PHONE.h + LABEL_H + 40));
  return svg;
}

function addPath(svg, { d, stroke, width = 1.5, dash, opacity = 1, fill = 'none' }) {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  p.setAttribute('fill', fill);
  p.setAttribute('stroke', stroke);
  p.setAttribute('stroke-width', String(width));
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  p.setAttribute('opacity', String(opacity));
  if (dash) p.setAttribute('stroke-dasharray', dash);
  svg.appendChild(p);
  return p;
}

function addText(svg, { x, y, text, color, size = 12, anchor = 'middle', weight = '500' }) {
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y));
  t.setAttribute('fill', color);
  t.setAttribute('font-size', String(size));
  t.setAttribute('font-weight', weight);
  t.setAttribute('text-anchor', anchor);
  t.textContent = text;
  svg.appendChild(t);
  return t;
}

function addCircle(svg, { cx, cy, r, fill, opacity = 1 }) {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', String(cx)); c.setAttribute('cy', String(cy));
  c.setAttribute('r', String(r)); c.setAttribute('fill', fill);
  c.setAttribute('opacity', String(opacity));
  svg.appendChild(c);
  return c;
}

/* ------------------------------------------------------------------ */
/* Board chrome                                                        */
/* ------------------------------------------------------------------ */

function buildBoard(container) {
  container.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'board';
  board.style.transformOrigin = 'top left';
  board.style.transform = `scale(${state.scale})`;
  board.style.paddingTop = HEADROOM + 'px';

  const svg = makeSvg();
  board.appendChild(svg);

  for (const key of SCREENS) {
    const frame = document.createElement('div');
    frame.className = 'frame';
    frame.id = 'screen-' + key;
    frame.dataset.key = key;
    frame.innerHTML = `
      <div class="frame-label"><span class="chip">${idxOf(key) + 1}</span><span>${key}</span><span class="rule"></span></div>
      <div class="phone">
        <div class="phone-screen">
          <div class="mock-header">${key}</div>
          ${TAB_SCREENS.includes(key) ? '<div class="mock-tabs">● ● ● ●</div>' : ''}
          ${UNRESOLVED_ON.includes(key) ? '<div class="mock-back">‹ back</div>' : ''}
          <button class="mock-press" data-key="${key}">press</button>
        </div>
      </div>`;
    board.appendChild(frame);
  }
  container.appendChild(board);
  return svg;
}

/* ------------------------------------------------------------------ */
/* Shared: a press log, newest first. Every variant reads from it.     */
/* ------------------------------------------------------------------ */

const presses = []; // { from, to, back, t }
function record(from, to, back = false) {
  presses.unshift({ from, to, back, t: Date.now() });
  if (presses.length > 40) presses.pop();
  const e = EDGES.find((x) => x.from === from && x.to === to);
  if (e) e.n += 1;
  state.last = { from, to, back };
  $('#event-line').textContent = back
    ? `back on ${from} resolved to ${to}`
    : `${from} → ${to}`;
  render();
}

/* ------------------------------------------------------------------ */
/* H — Sankey bands. Quiet grey; the last press tints its band.        */
/* ------------------------------------------------------------------ */

function drawSankey(svg) {
  svg.innerHTML = '';
  const topY = frameTop();
  const max = Math.max(...EDGES.map((e) => e.n));
  for (const e of EDGES) {
    const hop = Math.abs(idxOf(e.from) - idxOf(e.to));
    const w = 2 + (e.n / max) * 10;
    const hot = state.last && state.last.from === e.from && state.last.to === e.to;
    addPath(svg, {
      d: arcPath(centerX(e.from), centerX(e.to), topY, 36 + hop * 34),
      stroke: hot ? WARM : INK_SOFT, width: w, opacity: hot ? 0.9 : 0.35,
    });
  }
}

/* ------------------------------------------------------------------ */
/* I — Comet. Nothing static; the press travels as a dot.              */
/* ------------------------------------------------------------------ */

let comet = null; // { from, to, start, dur }
function drawComet(svg) {
  svg.innerHTML = '';
  if (!comet) return;
  const topY = frameTop();
  const hop = Math.abs(idxOf(comet.from) - idxOf(comet.to));
  const d = arcPath(centerX(comet.from), centerX(comet.to), topY, 36 + hop * 34);
  const path = addPath(svg, { d, stroke: 'transparent', width: 0 });
  const len = path.getTotalLength();
  const t = Math.min(1, (Date.now() - comet.start) / comet.dur);
  // Trail: a handful of dots behind the head, fading.
  for (let i = 6; i >= 0; i--) {
    const p = path.getPointAtLength(Math.max(0, t - i * 0.035) * len);
    addCircle(svg, { cx: p.x, cy: p.y, r: i === 0 ? 5 : 3, fill: WARM, opacity: i === 0 ? 1 : 0.5 - i * 0.07 });
  }
  if (t >= 1) comet = null;
  else requestAnimationFrame(() => render());
}

/* ------------------------------------------------------------------ */
/* J — Footprints. Numbered ticks on the rim, nothing between frames.  */
/* ------------------------------------------------------------------ */

function drawFootprints(svg) {
  svg.innerHTML = '';
  const topY = frameTop();
  const byKey = new Map();
  for (const p of presses) {
    const list = byKey.get(p.from) ?? [];
    list.push(p);
    byKey.set(p.from, list);
  }
  for (const key of SCREENS) {
    const list = (byKey.get(key) ?? []).slice(0, 5);
    const x0 = centerX(key) - PHONE.w / 2 + 20;
    list.forEach((p, i) => {
      const x = x0 + i * 26;
      addCircle(svg, { cx: x, cy: topY - 16, r: 9, fill: PAPER, opacity: 1 });
      addCircle(svg, { cx: x, cy: topY - 16, r: 9, fill: 'none', opacity: 1 });
      const ring = svg.lastChild;
      ring.setAttribute('stroke', p.back ? INK_SOFT : WARM);
      ring.setAttribute('stroke-width', '1.25');
      addText(svg, { x, y: topY - 12, text: String(presses.indexOf(p) + 1), color: INK, size: 10, weight: '600' });
    });
  }
  if (presses.length === 0) {
    addText(svg, { x: PAD, y: topY - 30, text: 'nothing yet — each press leaves a numbered tick on the frame it left', color: INK_SOFT, anchor: 'start', size: 13 });
  }
}

/* ------------------------------------------------------------------ */
/* K — Breadcrumb. One chain of the last six presses.                   */
/* ------------------------------------------------------------------ */

function drawBreadcrumb(svg) {
  svg.innerHTML = '';
  const topY = frameTop();
  const chain = presses.slice(0, 6).reverse();
  if (chain.length === 0) {
    addText(svg, { x: PAD, y: topY - 30, text: 'nothing yet — the last six presses will form one chain here', color: INK_SOFT, anchor: 'start', size: 13 });
    return;
  }
  chain.forEach((p, i) => {
    const age = chain.length - 1 - i; // 0 = newest
    const opacity = 1 - age * 0.14;
    const hop = Math.abs(idxOf(p.from) - idxOf(p.to));
    addPath(svg, {
      d: arcPath(centerX(p.from), centerX(p.to), topY, 28 + hop * 22 + age * 6),
      stroke: p.back ? INK_SOFT : INK, width: age === 0 ? 2.25 : 1.25, opacity, dash: p.back ? '4 4' : null,
    });
    addText(svg, { x: (centerX(p.from) + centerX(p.to)) / 2, y: topY - (36 + hop * 22 + age * 6), text: String(i + 1), color: INK, size: 11, weight: '600' });
  });
}

/* ------------------------------------------------------------------ */
/* L — Minimap. The board stays bare; a small graph sits in the corner.*/
/* ------------------------------------------------------------------ */

function drawMinimap(svg) {
  svg.innerHTML = '';
  const topY = frameTop();
  const ox = PAD, oy = topY - 150, cell = 34;
  const pos = (key) => ({ x: ox + idxOf(key) * cell, y: oy + (idxOf(key) % 2 === 0 ? 0 : 22) });
  addText(svg, { x: ox, y: oy - 16, text: 'routes', color: INK_SOFT, anchor: 'start', size: 11, weight: '600' });
  for (const e of EDGES) {
    const a = pos(e.from), b = pos(e.to);
    const hot = state.last && state.last.from === e.from && state.last.to === e.to;
    addPath(svg, { d: `M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${oy - 30}, ${(a.x + b.x) / 2} ${oy - 30}, ${b.x} ${b.y}`, stroke: hot ? WARM : INK_SOFT, width: hot ? 2 : 1, opacity: hot ? 1 : 0.5 });
  }
  for (const key of SCREENS) {
    const p = pos(key);
    const hot = state.last && (state.last.from === key || state.last.to === key);
    addCircle(svg, { cx: p.x, cy: p.y, r: hot ? 5 : 3.5, fill: hot ? WARM : INK });
    addText(svg, { x: p.x, y: p.y + 14, text: String(idxOf(key) + 1), color: INK_SOFT, size: 9 });
  }
}

/* ------------------------------------------------------------------ */
/* M — Spine. One hairline per frame; ticks mark its exits.            */
/* ------------------------------------------------------------------ */

function drawSpine(svg) {
  svg.innerHTML = '';
  const topY = frameTop();
  for (const key of SCREENS) {
    const x = centerX(key);
    const exits = EDGES.filter((e) => e.from === key);
    const hot = state.last && state.last.from === key;
    addPath(svg, { d: `M ${x} ${topY} V ${topY - 150}`, stroke: hot ? WARM : INK_SOFT, width: hot ? 1.75 : 1, opacity: hot ? 1 : 0.6 });
    exits.forEach((e, i) => {
      const y = topY - 28 - i * 22;
      const fired = state.last && state.last.from === e.from && state.last.to === e.to;
      addPath(svg, { d: `M ${x} ${y} H ${x + 14}`, stroke: fired ? WARM : INK, width: 1.5 });
      addText(svg, { x: x + 20, y: y + 4, text: `→ ${e.to}`, color: fired ? WARM : INK, anchor: 'start', size: 11, weight: fired ? '600' : '400' });
    });
    if (UNRESOLVED_ON.includes(key)) {
      addText(svg, { x, y: topY - 164, text: '‹', color: INK_SOFT, size: 13 });
    }
  }
}

/* ------------------------------------------------------------------ */
/* N — Heat. Frames tint by traffic; a press ripples out.              */
/* ------------------------------------------------------------------ */

function drawHeat(svg) {
  svg.innerHTML = '';
  const topY = frameTop();
  const counts = new Map(SCREENS.map((k) => [k, 0]));
  for (const p of presses) counts.set(p.from, (counts.get(p.from) ?? 0) + 1);
  const max = Math.max(1, ...counts.values());
  for (const key of SCREENS) {
    const n = counts.get(key) ?? 0;
    const frame = frameEl(key)?.querySelector('.phone');
    if (frame) frame.style.boxShadow = n ? `0 0 0 2px rgba(194,65,12,${(n / max) * 0.55})` : '';
  }
  if (state.last) {
    const age = Date.now() - (presses[0]?.t ?? Date.now());
    if (age < 900) {
      const t = age / 900;
      const x1 = centerX(state.last.from), x2 = centerX(state.last.to);
      addCircle(svg, { cx: x1, cy: topY + 6, r: 8 + t * 26, fill: 'none', opacity: 1 - t });
      svg.lastChild.setAttribute('stroke', WARM); svg.lastChild.setAttribute('stroke-width', '1.5');
      addPath(svg, { d: arcPath(x1, x2, topY, 40), stroke: WARM, width: 1.5, opacity: 1 - t, dash: '3 5' });
      requestAnimationFrame(() => render());
    }
  }
  if (presses.length === 0) {
    addText(svg, { x: PAD, y: topY - 30, text: 'nothing yet — a frame warms as presses leave it', color: INK_SOFT, anchor: 'start', size: 13 });
  }
}

/* ------------------------------------------------------------------ */
/* O — Ribbon. One band per flow, thickness is frequency. Always quiet.*/
/* ------------------------------------------------------------------ */

function drawRibbon(svg) {
  svg.innerHTML = '';
  const topY = frameTop();
  const max = Math.max(...EDGES.map((e) => e.n));
  // Lane assignment so bands from the same frame don't overlap.
  const lane = new Map();
  for (const e of EDGES) {
    const used = lane.get(e.from) ?? 0;
    lane.set(e.from, used + 1);
    const w = 3 + (e.n / max) * 14;
    const hop = Math.abs(idxOf(e.from) - idxOf(e.to));
    addPath(svg, {
      d: arcPath(centerX(e.from) + (used - 1) * 8, centerX(e.to), topY, 30 + hop * 30),
      stroke: INK, width: w, opacity: 0.12 + (e.n / max) * 0.28,
    });
  }
  addText(svg, { x: PAD, y: topY - HEADROOM + 30, text: 'thicker means more often · nothing flashes', color: INK_SOFT, anchor: 'start', size: 13 });
}

/* ------------------------------------------------------------------ */
/* Switcher                                                            */
/* ------------------------------------------------------------------ */

const state = {
  variant: new URLSearchParams(location.search).get('variant') ?? 'H',
  scale: 0.5,
  last: null,
};

const DRAWS = { H: drawSankey, I: drawComet, J: drawFootprints, K: drawBreadcrumb, L: drawMinimap, M: drawSpine, N: drawHeat, O: drawRibbon };
const NAMES = {
  H: 'Sankey bands',
  I: 'Comet',
  J: 'Footprints',
  K: 'Breadcrumb chain',
  L: 'Minimap',
  M: 'Spine',
  N: 'Heat',
  O: 'Ribbon',
};

let svgRef = null;
let rendering = false;
function render() {
  if (rendering) return;
  rendering = true;
  for (const f of document.querySelectorAll('.phone')) f.style.boxShadow = '';
  DRAWS[state.variant](svgRef);
  $('#variant-label').textContent = `${state.variant} — ${NAMES[state.variant]}`;
  $('#scale-label').textContent = `${Math.round(state.scale * 100)}% · ctrl+scroll to zoom`;
  rendering = false;
}

function setVariant(v) {
  state.variant = v;
  comet = null;
  const url = new URL(location.href);
  url.searchParams.set('variant', v);
  history.replaceState(null, '', url);
  render();
}

function cycle(dir) {
  const order = Object.keys(NAMES);
  setVariant(order[(order.indexOf(state.variant) + dir + order.length) % order.length]);
}

function fireRandomPress() {
  const e = EDGES[Math.floor(Math.random() * EDGES.length)];
  if (state.variant === 'I') comet = { from: e.from, to: e.to, start: Date.now(), dur: 700 };
  record(e.from, e.to);
}

function fireBackPress() {
  const from = UNRESOLVED_ON[Math.floor(Math.random() * UNRESOLVED_ON.length)];
  const options = BACK_HISTORY[from];
  const to = options[Math.floor(Math.random() * options.length)];
  if (state.variant === 'I') comet = { from, to, start: Date.now(), dur: 700 };
  record(from, to, true);
}

function buildChrome(container) {
  const legend = document.createElement('div');
  legend.id = 'legend';
  legend.innerHTML = `
    <button id="fire">fire a press</button>
    <button id="fire-back">fire a back press</button>
    <button id="zero">clear</button>
    <span id="event-line">nothing yet — fire a press</span>
    <span id="scale-label"></span>`;
  container.prepend(legend);

  const switcher = document.createElement('div');
  switcher.id = 'switcher';
  switcher.innerHTML = `<button id="prev">←</button><span id="variant-label"></span><button id="next">→</button>`;
  document.body.appendChild(switcher);

  $('#prev').addEventListener('click', () => cycle(-1));
  $('#next').addEventListener('click', () => cycle(1));
  $('#fire').addEventListener('click', fireRandomPress);
  $('#fire-back').addEventListener('click', fireBackPress);
  $('#zero').addEventListener('click', () => {
    presses.length = 0;
    state.last = null;
    comet = null;
    $('#event-line').textContent = 'cleared — nothing observed';
    render();
  });

  document.addEventListener('keydown', (e) => {
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '')) return;
    if (e.key === 'ArrowLeft') cycle(-1);
    if (e.key === 'ArrowRight') cycle(1);
  });
  window.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    state.scale = Math.min(2, Math.max(0.25, state.scale + (e.deltaY < 0 ? 0.03 : -0.03)));
    $('.board').style.transform = `scale(${state.scale})`;
    render();
  }, { passive: false });
}

const host = $('#host');
svgRef = buildBoard(host);
buildChrome(host);
render();
