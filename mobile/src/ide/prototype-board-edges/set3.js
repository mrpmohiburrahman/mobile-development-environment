/*
 * PROTOTYPE — board edges, set 3. Throwaway.
 * Each variant copies the connection language of a named tool:
 *   P — Figma connectors      blue, points, halos, white labels
 *   Q — Unreal Blueprints     dark grid, node headers, pins, wires
 *   R — TfL line strip        stations on a line, coloured spans
 *   S — Linear dark           near-black, gradient threads, glow
 *   T — Apple HIG             system blue, flat, pills
 *   U — Adjacency matrix      no lines at all: a grid
 * No variant reveals edges on hover.
 *
 * Run: python3 -m http.server 60207 --bind 127.0.0.1 \
 *        --directory mobile/src/ide/prototype-board-edges
 * Open: http://127.0.0.1:60207/set3.html?variant=P
 */

const PHONE = { w: 390, h: 820 };
const LABEL_H = 30, GAP = 32, PAD = 24, HEADROOM = 240, STRIDE = PHONE.w + GAP;

const SCREENS = ['login', 'index', 'habits', 'stats', 'profile', 'habit', 'settings'];
const TAB_SCREENS = ['index', 'habits', 'stats', 'profile'];
const EDGES = [
  { from: 'login', to: 'index', label: 'sign in', n: 3 },
  { from: 'index', to: 'profile', label: 'profile', n: 2 },
  { from: 'index', to: 'stats', label: 'stats', n: 1 },
  { from: 'index', to: 'habit', label: 'open habit', n: 6 },
  { from: 'habits', to: 'habit', label: 'open habit', n: 4 },
  { from: 'profile', to: 'settings', label: 'settings', n: 2 },
  { from: 'profile', to: 'login', label: 'sign out', n: 1 },
];
const BACK_HISTORY = { habit: ['index', 'habits'], settings: ['profile'] };
const UNRESOLVED_ON = ['habit', 'settings'];

const $ = (s, r = document) => r.querySelector(s);
const idxOf = (k) => SCREENS.indexOf(k);
const frameEl = (k) => document.getElementById('screen-' + k);
const centerX = (k) => { const el = frameEl(k); return el ? el.offsetLeft + PHONE.w / 2 : 0; };
const frameTop = () => { const el = frameEl(SCREENS[0]); return el ? el.offsetTop + LABEL_H : 0; };

function arc(x1, x2, baseY, lift) {
  const midX = (x1 + x2) / 2;
  const dy = baseY - lift - Math.max(Math.abs(x2 - x1), 1) * 0.05;
  return { d: `M ${x1} ${baseY} C ${midX} ${dy}, ${midX} ${dy}, ${x2} ${baseY}`, midX, midY: baseY * 0.25 + dy * 0.75 };
}

function svgEl() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'edge-layer';
  svg.setAttribute('width', String(PAD * 2 + STRIDE * SCREENS.length));
  svg.setAttribute('height', String(HEADROOM + PHONE.h + LABEL_H + 40));
  return svg;
}
function path(svg, { d, stroke, width = 1.5, dash, opacity = 1, marker }) {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d); p.setAttribute('fill', 'none');
  p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', String(width));
  p.setAttribute('stroke-linecap', 'round'); p.setAttribute('opacity', String(opacity));
  if (dash) p.setAttribute('stroke-dasharray', dash);
  if (marker) p.setAttribute('marker-end', `url(#${marker})`);
  svg.appendChild(p); return p;
}
function marker(svg, id, color) {
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.appendChild(defs); }
  const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  m.setAttribute('id', id); m.setAttribute('viewBox', '0 0 10 10'); m.setAttribute('refX', '8');
  m.setAttribute('refY', '5'); m.setAttribute('markerWidth', '6.5'); m.setAttribute('markerHeight', '6.5');
  m.setAttribute('orient', 'auto-start-reverse');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); p.setAttribute('fill', color);
  m.appendChild(p); defs.appendChild(m);
}
function dot(svg, { cx, cy, r, fill, stroke, width = 1.5, opacity = 1 }) {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
  c.setAttribute('fill', fill); c.setAttribute('opacity', String(opacity));
  if (stroke) { c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', String(width)); }
  svg.appendChild(c); return c;
}
function label(svg, { x, y, text, fg, bg, size = 11, weight = '500', border }) {
  const w = text.length * (size * 0.58) + 16;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  r.setAttribute('x', x - w / 2); r.setAttribute('y', y - 10); r.setAttribute('width', w); r.setAttribute('height', 20);
  r.setAttribute('rx', 10); r.setAttribute('fill', bg);
  if (border) { r.setAttribute('stroke', border); r.setAttribute('stroke-width', '1'); }
  g.appendChild(r);
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', x); t.setAttribute('y', y + 4); t.setAttribute('text-anchor', 'middle');
  t.setAttribute('fill', fg); t.setAttribute('font-size', String(size)); t.setAttribute('font-weight', weight);
  t.textContent = text; g.appendChild(t); svg.appendChild(g); return g;
}
function text(svg, { x, y, str, fill, size = 11, anchor = 'middle', weight = '500' }) {
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', anchor);
  t.setAttribute('fill', fill); t.setAttribute('font-size', String(size)); t.setAttribute('font-weight', weight);
  t.textContent = str; svg.appendChild(t); return t;
}

/* ---------------- fake but furnished screens ---------------- */
function content(key) {
  const bar = (w, c = '') => `<div class="sk ${c}" style="width:${w}%"></div>`;
  const card = (inner) => `<div class="card">${inner}</div>`;
  const row = (a, b) => `<div class="row"><div class="avatar"></div><div class="grow">${bar(a)}${bar(b, 'thin')}</div></div>`;
  switch (key) {
    case 'login': return `<div class="h">Welcome back</div>${bar(52)}<div class="field"></div><div class="field"></div><div class="btn warm">Sign in</div>${bar(34, 'thin')}`;
    case 'index': return `<div class="h">Today</div>${card(row(64, 40))}${card(row(48, 36))}${card(row(70, 30))}<div class="btn">＋ New habit</div>`;
    case 'habits': return `<div class="h">Habits</div>${['Meditate', 'Run', 'Read', 'Stretch'].map((n) => card(`<div class="row"><div class="check">✓</div><div class="grow"><div class="name">${n}</div>${bar(30, 'thin')}</div><div class="chev">›</div></div>`)).join('')}`;
    case 'stats': return `<div class="h">This week</div><div class="chart">${[42, 68, 34, 80, 56, 92, 64].map((h) => `<div class="col" style="height:${h}%"></div>`).join('')}</div>${bar(58)}${bar(42, 'thin')}`;
    case 'profile': return `<div class="center"><div class="avatar big"></div><div class="h sm">Rafael M.</div>${bar(36, 'thin')}</div>${card(row(50, 30))}${card(row(44, 30))}`;
    case 'habit': return `<div class="back">‹ Back</div><div class="h">Meditate</div><div class="ring"><span>12</span></div>${bar(66)}${bar(48, 'thin')}<div class="btn warm">Mark done</div>`;
    case 'settings': return `<div class="back">‹ Back</div><div class="h">Settings</div>${['Notifications', 'Dark mode', 'Sync', 'Sounds'].map((n, i) => card(`<div class="row"><div class="name grow2">${n}</div><div class="toggle ${i === 1 ? 'on' : ''}"><i></i></div></div>`)).join('')}`;
    default: return '';
  }
}

function buildBoard(container) {
  container.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'board';
  board.style.transformOrigin = 'top left';
  board.style.transform = `scale(${state.scale})`;
  board.style.paddingTop = HEADROOM + 'px';
  const svg = svgEl(); board.appendChild(svg);
  for (const key of SCREENS) {
    const f = document.createElement('div');
    f.className = 'frame'; f.id = 'screen-' + key; f.dataset.key = key;
    f.innerHTML = `<div class="frame-label"><span class="chip">${idxOf(key) + 1}</span><span>${key}</span><span class="rule"></span></div>
      <div class="phone"><div class="phone-screen"><div class="status"><span>9:41</span><span>▂▄▆</span></div>${content(key)}${TAB_SCREENS.includes(key) ? '<div class="tabs"><i></i><i></i><i></i><i></i></div>' : ''}</div></div>`;
    board.appendChild(f);
  }
  container.appendChild(board);
  return svg;
}

/* ---------------- state ---------------- */
const state = { variant: new URLSearchParams(location.search).get('variant') ?? 'P', scale: 0.5, last: null };
const presses = [];
function record(from, to, back = false) {
  presses.unshift({ from, to, back, t: Date.now() });
  state.last = { from, to, back };
  $('#event-line').textContent = back ? `back on ${from} resolved to ${to}` : `${from} → ${to}`;
  render();
}
const isLast = (e) => state.last && state.last.from === e.from && state.last.to === e.to;

/* ---------------- P — Figma ---------------- */
function drawP(svg) {
  svg.innerHTML = ''; marker(svg, 'pArr', '#0D99FF');
  const topY = frameTop();
  for (const e of EDGES) {
    const hop = Math.abs(idxOf(e.from) - idxOf(e.to));
    const a = arc(centerX(e.from), centerX(e.to), topY, 30 + hop * 30);
    const hot = isLast(e);
    path(svg, { d: a.d, stroke: '#FFFFFF', width: hot ? 6 : 5, opacity: 0.9 });
    path(svg, { d: a.d, stroke: hot ? '#0D99FF' : '#B9B9B9', width: hot ? 2 : 1.5, marker: 'pArr' });
    dot(svg, { cx: centerX(e.from), cy: topY, r: 3.5, fill: '#fff', stroke: '#0D99FF' });
    if (hot) label(svg, { x: a.midX, y: a.midY - 6, text: e.label, fg: '#0D99FF', bg: '#fff', border: '#0D99FF' });
  }
  for (const k of UNRESOLVED_ON) text(svg, { x: centerX(k), y: topY - 18, str: '?', fill: '#F24822', size: 13, weight: '600' });
}

/* ---------------- Q — Unreal Blueprints ---------------- */
function drawQ(svg) {
  svg.innerHTML = ''; marker(svg, 'qArr', '#FFFFFF');
  const topY = frameTop();
  const cols = ['#4C9AFF', '#FF9F43', '#1DD1A1', '#F368E0', '#54A0FF', '#FF6B6B', '#A3CB38'];
  EDGES.forEach((e, i) => {
    const x1 = centerX(e.from), x2 = centerX(e.to);
    const y1 = topY - 30 - (i % 3) * 26, y2 = y1;
    const d = `M ${x1} ${topY} V ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2 + 22} V ${topY}`;
    path(svg, { d, stroke: isLast(e) ? '#FFFFFF' : cols[i % cols.length], width: isLast(e) ? 2.5 : 1.75, marker: 'qArr', opacity: isLast(e) ? 1 : 0.8 });
    dot(svg, { cx: x1, cy: topY, r: 4, fill: '#0B0E1A', stroke: cols[i % cols.length], width: 2 });
    if (isLast(e)) label(svg, { x: (x1 + x2) / 2, y: y1 - 8, text: e.label, fg: '#fff', bg: '#2A2F45', border: '#4C9AFF' });
  });
}

/* ---------------- R — TfL line strip ---------------- */
function drawR(svg) {
  svg.innerHTML = '';
  const topY = frameTop();
  const lineY = topY - 26;
  const lineCols = ['#E32017', '#0098D4', '#FAA300', '#00782A', '#F386A1', '#894E24', '#00A4A7'];
  // The line itself, through every station.
  path(svg, { d: `M ${centerX(SCREENS[0])} ${lineY} H ${centerX(SCREENS.at(-1))}`, stroke: '#B9B9B9', width: 5 });
  EDGES.forEach((e, i) => {
    const x1 = centerX(e.from), x2 = centerX(e.to);
    const y = lineY - 22 - (i % 3) * 20;
    path(svg, { d: `M ${x1} ${y} H ${x2}`, stroke: lineCols[i % lineCols.length], width: isLast(e) ? 6 : 4, opacity: isLast(e) ? 1 : 0.75 });
    path(svg, { d: `M ${x1} ${y} V ${lineY}`, stroke: lineCols[i % lineCols.length], width: 2 });
    path(svg, { d: `M ${x2} ${y} V ${lineY}`, stroke: lineCols[i % lineCols.length], width: 2 });
    label(svg, { x: (x1 + x2) / 2, y: y - 10, text: e.label, fg: '#1D1D1B', bg: '#fff', border: '#1D1D1B', size: 10 });
  });
  for (const k of SCREENS) {
    const station = UNRESOLVED_ON.includes(k);
    dot(svg, { cx: centerX(k), cy: lineY, r: station ? 7 : 5, fill: '#fff', stroke: '#1D1D1B', width: 2.5 });
    if (station) text(svg, { x: centerX(k), y: lineY - 78, str: 'back ?', fill: '#E32017', size: 10, weight: '600' });
  }
}

/* ---------------- S — Linear dark ---------------- */
function drawS(svg) {
  svg.innerHTML = ''; marker(svg, 'sArr', '#8A9CFF');
  const topY = frameTop();
  for (const e of EDGES) {
    const hop = Math.abs(idxOf(e.from) - idxOf(e.to));
    const a = arc(centerX(e.from), centerX(e.to), topY, 26 + hop * 26);
    const hot = isLast(e);
    if (hot) path(svg, { d: a.d, stroke: '#5E6AD2', width: 7, opacity: 0.35 });
    path(svg, { d: a.d, stroke: hot ? '#B9C2FF' : '#4A4F6B', width: hot ? 1.75 : 1, opacity: hot ? 1 : 0.7, marker: hot ? 'sArr' : null });
    dot(svg, { cx: centerX(e.from), cy: topY, r: 2.5, fill: hot ? '#B9C2FF' : '#4A4F6B' });
    dot(svg, { cx: centerX(e.to), cy: topY, r: 2.5, fill: hot ? '#B9C2FF' : '#4A4F6B' });
    if (hot) label(svg, { x: a.midX, y: a.midY - 8, text: e.label.toUpperCase(), fg: '#B9C2FF', bg: '#101222', border: '#2A2E4A', size: 9 });
  }
}

/* ---------------- T — Apple HIG ---------------- */
function drawT(svg) {
  svg.innerHTML = ''; marker(svg, 'tArr', '#0071E3');
  const topY = frameTop();
  for (const e of EDGES) {
    const hop = Math.abs(idxOf(e.from) - idxOf(e.to));
    const a = arc(centerX(e.from), centerX(e.to), topY, 22 + hop * 20);
    const hot = isLast(e);
    path(svg, { d: a.d, stroke: hot ? '#0071E3' : '#C7C7CC', width: hot ? 2 : 1.25, marker: 'tArr' });
    if (hot) label(svg, { x: a.midX, y: a.midY - 8, text: e.label, fg: '#0071E3', bg: '#fff', border: '#D1D1D6' });
  }
  for (const k of SCREENS) dot(svg, { cx: centerX(k), cy: topY, r: 3, fill: '#fff', stroke: '#0071E3' });
}

/* ---------------- U — Adjacency matrix ---------------- */
function drawU(svg) {
  svg.innerHTML = '';
  const topY = frameTop();
  const cell = 30, ox = PAD + 34, oy = topY - 200;
  text(svg, { x: ox - 8, y: oy - 12, str: 'from ↓   to →', fill: '#8A7E6E', size: 11, anchor: 'start' });
  for (const k of SCREENS) {
    text(svg, { x: ox + idxOf(k) * cell + cell / 2, y: oy - 4, str: String(idxOf(k) + 1), fill: '#3D332A', size: 11, weight: '600' });
    text(svg, { x: ox - 10, y: oy + idxOf(k) * cell + cell / 2 + 4, str: String(idxOf(k) + 1), fill: '#3D332A', size: 11, weight: '600', anchor: 'end' });
  }
  const hotBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  for (const e of EDGES) {
    const cx = ox + idxOf(e.to) * cell + cell / 2, cy = oy + idxOf(e.from) * cell + cell / 2;
    if (isLast(e)) {
      hotBg.setAttribute('x', cx - cell / 2); hotBg.setAttribute('y', cy - cell / 2);
      hotBg.setAttribute('width', cell); hotBg.setAttribute('height', cell); hotBg.setAttribute('rx', 8);
      hotBg.setAttribute('fill', '#C2410C'); hotBg.setAttribute('opacity', '0.14'); svg.appendChild(hotBg);
    }
    dot(svg, { cx, cy, r: 4 + e.n, fill: isLast(e) ? '#C2410C' : '#3D332A', opacity: isLast(e) ? 1 : 0.7 });
  }
  if (state.last) text(svg, { x: ox + 7 * cell + 20, y: oy + 20, str: `${state.last.from} → ${state.last.to}`, fill: '#C2410C', size: 13, anchor: 'start', weight: '600' });
  text(svg, { x: ox + 7 * cell + 20, y: oy + 44, str: 'dot size = how often', fill: '#8A7E6E', size: 11, anchor: 'start' });
}

/* ---------------- switcher ---------------- */
const DRAWS = { P: drawP, Q: drawQ, R: drawR, S: drawS, T: drawT, U: drawU };
const NAMES = { P: 'Figma connectors', Q: 'Unreal Blueprints', R: 'TfL line strip', S: 'Linear dark', T: 'Apple HIG', U: 'Adjacency matrix' };
const DARK = new Set(['Q', 'S']);
let svgRef = null;
function render() {
  document.body.dataset.theme = DARK.has(state.variant) ? 'dark' : 'light';
  DRAWS[state.variant](svgRef);
  $('#variant-label').textContent = `${state.variant} — ${NAMES[state.variant]}`;
  $('#scale-label').textContent = `${Math.round(state.scale * 100)}% · ctrl+scroll to zoom`;
}
function setVariant(v) {
  state.variant = v;
  const u = new URL(location.href); u.searchParams.set('variant', v);
  history.replaceState(null, '', u); render();
}
function cycle(d) { const o = Object.keys(NAMES); setVariant(o[(o.indexOf(state.variant) + d + o.length) % o.length]); }
function fire() {
  const e = EDGES[Math.floor(Math.random() * EDGES.length)];
  record(e.from, e.to);
}
function fireBack() {
  const from = UNRESOLVED_ON[Math.floor(Math.random() * UNRESOLVED_ON.length)];
  const opts = BACK_HISTORY[from];
  record(from, opts[Math.floor(Math.random() * opts.length)], true);
}
function chrome(container) {
  const bar = document.createElement('div');
  bar.id = 'legend';
  bar.innerHTML = `<button id="fire">fire a press</button><button id="fire-back">fire a back press</button><button id="zero">clear</button><span id="event-line">nothing yet — fire a press</span><span id="scale-label"></span>`;
  container.prepend(bar);
  const sw = document.createElement('div');
  sw.id = 'switcher';
  sw.innerHTML = `<button id="prev">←</button><span id="variant-label"></span><button id="next">→</button>`;
  document.body.appendChild(sw);
  $('#prev').addEventListener('click', () => cycle(-1));
  $('#next').addEventListener('click', () => cycle(1));
  $('#fire').addEventListener('click', fire);
  $('#fire-back').addEventListener('click', fireBack);
  $('#zero').addEventListener('click', () => { presses.length = 0; state.last = null; $('#event-line').textContent = 'cleared — nothing observed'; render(); });
  document.addEventListener('keydown', (e) => {
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '')) return;
    if (e.key === 'ArrowLeft') cycle(-1);
    if (e.key === 'ArrowRight') cycle(1);
  });
  window.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return; e.preventDefault();
    state.scale = Math.min(2, Math.max(0.25, state.scale + (e.deltaY < 0 ? 0.03 : -0.03)));
    $('.board').style.transform = `scale(${state.scale})`; render();
  }, { passive: false });
}
const host = $('#host');
svgRef = buildBoard(host);
chrome(host);
render();
