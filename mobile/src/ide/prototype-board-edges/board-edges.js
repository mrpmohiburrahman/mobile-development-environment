/*
 * PROTOTYPE — board edges. Throwaway. Answers: how should navigation edges
 * draw between the frames on the blueprint row?
 *
 * Seven variants, switchable via ?variant= and the bottom bar:
 *   A — Arcs above the row, always on (all 19 edges)
 *   B — Hover/select only (board clean until a frame is chosen)
 *   C — Gutter rails (subway-map horizontal rail above the row)
 *   D — B + a fired press ignites its arc for 1.2s even with nothing hovered
 *   E — A, but the 12 declared tab edges collapse to one dashed tab-bar rail
 *   F — C with arrowheads, so direction survives
 *   G — D + back presses OBSERVED: a back press draws an edge to the actual
 *       history target; before any press, the '?' stub
 *
 * Run: python3 -m http.server 4173 --directory mobile/src/ide/prototype-board-edges
 * Then open http://127.0.0.1:4173/?variant=A
 */

const PHONE = { w: 390, h: 820 };
const LABEL_H = 30; // label row above the phone frame
const GAP = 32;
const PAD = 24;
const FRAME_STRIDE = PHONE.w + GAP;
const HEADROOM = 260; // room above the row for arcs / rails

const SCREENS = ['login', 'index', 'habits', 'stats', 'profile', 'habit', 'settings'];
const TAB_SCREENS = ['index', 'habits', 'stats', 'profile'];

// Every edge the talk-opportunities map counted, with the route list's provenance.
const OBSERVED_EDGES = [
  { from: 'login', to: 'index', label: 'signIn() → /' },
  { from: 'index', to: 'profile', label: '/' + ' → /profile' },
  { from: 'index', to: 'stats', label: '/ → /stats' },
  { from: 'index', to: 'habit', label: 'select → /habit' },
  { from: 'habits', to: 'habit', label: 'select → /habit' },
  { from: 'profile', to: 'settings', label: '/profile → /settings' },
  { from: 'profile', to: 'login', label: 'signOut() → /login' },
];
// The tab bar sits on four screens and reaches all four tab destinations.
const DECLARED_EDGES = SCREENS.filter((k) => TAB_SCREENS.includes(k)).flatMap((from) =>
  TAB_SCREENS.filter((to) => to !== from).map((to) => ({ from, to })),
);
// Back controls, unresolvable: habit renders one in both branches, settings renders one.
const UNRESOLVED_ON = ['habit', 'settings'];

const TONE = {
  observed: '#2E7D32', // ok
  declared: '#8A7E6E', // muted
  unresolved: '#D9481E', // degraded
  fired: '#D9481E',
};

const $ = (sel, root = document) => root.querySelector(sel);
const idxOf = (key) => SCREENS.indexOf(key);
// Anchors are read off the frame's own layout box inside the transformed board,
// never from constants: offsetLeft/offsetTop are in the board's untransformed
// coordinate space, which is the same space the SVG layer lives in. So a zoom
// moves both together and nothing is recomputed. This is the production answer.
const frameEl = (key) => document.getElementById('screen-' + key);
const centerX = (key) => { const el = frameEl(key); return el ? el.offsetLeft + PHONE.w / 2 : 0; };
const frameTop = () => { const el = frameEl(SCREENS[0]); return el ? el.offsetTop + LABEL_H : 0; };

function arcPath(x1, x2, baseY, lift) {
  const midX = (x1 + x2) / 2;
  const d = Math.max(Math.abs(x2 - x1), 1);
  const dy = baseY - lift - d * 0.08;
  return `M ${x1} ${baseY} C ${midX} ${dy}, ${midX} ${dy}, ${x2} ${baseY}`;
}

function makeSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'edge-layer';
  svg.setAttribute('width', String(PAD * 2 + FRAME_STRIDE * SCREENS.length));
  svg.setAttribute('height', String(HEADROOM + PHONE.h + LABEL_H + 40));
  return svg;
}

function addPath(svg, { d, tone, dashed, width = 2 }) {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', tone);
  p.setAttribute('stroke-width', String(width));
  if (dashed) p.setAttribute('stroke-dasharray', '6 5');
  if (p.setAttribute('stroke-linecap', 'round') === undefined) { /* noop */ }
  svg.appendChild(p);
  return p;
}

function addText(svg, { x, y, text, tone }) {
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y));
  t.setAttribute('fill', tone);
  t.setAttribute('font-size', '14');
  t.setAttribute('text-anchor', 'middle');
  t.textContent = text;
  svg.appendChild(t);
  return t;
}

/* ------------------------------------------------------------------ */
/* Shared board chrome                                                 */
/* ------------------------------------------------------------------ */

function buildBoard(container, variant) {
  container.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'board';
  board.style.transformOrigin = 'top left';
  board.style.paddingTop = HEADROOM + 'px';
  board.style.transform = `scale(${state.scale})`;

  // The SVG layer sits INSIDE the transformed container, so edges scale with
  // frames by construction rather than by recalculation.
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
    frame.addEventListener('mouseenter', () => { state.hover = key; render(); });
    frame.addEventListener('mouseleave', () => { state.hover = null; render(); });
    frame.addEventListener('click', (e) => {
      if (e.target.closest('.mock-press')) return;
      state.focus = state.focus === key ? null : key;
      render();
    });
    board.appendChild(frame);
  }

  container.appendChild(board);
  return { board, svg };
}

/* ------------------------------------------------------------------ */
/* Variant A — arcs above the row                                      */
/* ------------------------------------------------------------------ */

function drawArcs(svg, { declared }) {
  svg.innerHTML = '';
  const topY = frameTop(); // top edge of the phone frames
  for (const e of OBSERVED_EDGES) drawEdgeArc(svg, e, TONE.observed, false, topY);
  if (declared === 'arcs') for (const e of DECLARED_EDGES) drawEdgeArc(svg, e, TONE.declared, true, topY);
  if (declared === 'rail') drawTabRail(svg, topY);
  for (const key of UNRESOLVED_ON) {
    const x = centerX(key);
    addPath(svg, { d: `M ${x - 40} ${topY} C ${x - 30} ${topY - 60}, ${x - 10} ${topY - 90}, ${x} ${topY - 110}`, tone: TONE.unresolved, dashed: true });
    addText(svg, { x, y: topY - 116, text: '?', tone: TONE.unresolved });
  }
  if (state.fired) {
    const [a, b] = state.fired;
    addPath(svg, { d: arcPath(centerX(a), centerX(b), topY, 130), tone: TONE.fired, width: 3.5, dashed: false });
  }
}

function drawEdgeArc(svg, { from, to }, tone, dashed, topY) {
  const x1 = centerX(from), x2 = centerX(to);
  // Adjacent frames dip low; far frames lift high, over the ones between.
  const hop = Math.abs(idxOf(from) - idxOf(to));
  const lift = 40 + hop * 42;
  addPath(svg, { d: arcPath(x1, x2, topY, lift), tone, dashed, width: dashed ? 1.5 : 2 });
}

/* ------------------------------------------------------------------ */
/* Variant B — hover/select only                                       */
/* ------------------------------------------------------------------ */

function drawTabRail(svg, topY) {
  // One dashed rail under the label row, spanning the four tab frames, with a
  // short drop into each. Twelve arcs become one line and a word.
  const xs = TAB_SCREENS.map(centerX);
  const y = topY - 48;
  addPath(svg, { d: `M ${Math.min(...xs) - 120} ${y} H ${Math.max(...xs) + 120}`, tone: TONE.declared, dashed: true, width: 1.5 });
  for (const x of xs) addPath(svg, { d: `M ${x} ${y} V ${topY}`, tone: TONE.declared, dashed: true, width: 1.5 });
  addText(svg, { x: Math.min(...xs) - 60, y: y - 8, text: 'tab bar · declared', tone: TONE.declared });
}

function drawFiredArc(svg, topY) {
  if (!state.fired) return;
  const [a, b] = state.fired;
  addPath(svg, { d: arcPath(centerX(a), centerX(b), topY, 130), tone: TONE.fired, width: 3.5, dashed: false });
}

function drawObservedBack(svg, topY) {
  for (const { from, to } of OBSERVED_BACK) {
    // Drawn as observed, but hooked: it leaves from the LEFT edge of the frame
    // (where the back glyph sits) so a reader can tell it from a forward edge.
    const x1 = centerX(from) - PHONE.w / 2 + 24, x2 = centerX(to);
    addPath(svg, { d: arcPath(x1, x2, topY, 60 + Math.abs(idxOf(from) - idxOf(to)) * 42), tone: TONE.observed, width: 2, dashed: false });
    addText(svg, { x: x1, y: topY - 8, text: '‹', tone: TONE.observed });
  }
}

function drawFocused(svg, { fired, backObserved = false }) {
  svg.innerHTML = '';
  const topY = frameTop();
  if (fired) drawFiredArc(svg, topY);
  if (backObserved) drawObservedBack(svg, topY);
  const key = state.focus ?? state.hover;
  if (!key) return;
  const outgoing = OBSERVED_EDGES.filter((e) => e.from === key);
  const incoming = OBSERVED_EDGES.filter((e) => e.to === key);
  for (const e of incoming) drawEdgeArc(svg, e, TONE.observed, false, topY);
  for (const e of outgoing) drawEdgeArc(svg, e, TONE.observed, false, topY);
  if (TAB_SCREENS.includes(key)) {
    for (const to of TAB_SCREENS) {
      if (to !== key) drawEdgeArc(svg, { from: key, to }, TONE.declared, true, topY);
    }
  }
  const backSeen = OBSERVED_BACK.some((b) => b.from === key);
  if (UNRESOLVED_ON.includes(key) && !(backObserved && backSeen)) {
    const x = centerX(key);
    addPath(svg, { d: `M ${x - 40} ${topY} C ${x - 30} ${topY - 60}, ${x - 10} ${topY - 90}, ${x} ${topY - 110}`, tone: TONE.unresolved, dashed: true });
    addText(svg, { x, y: topY - 116, text: '?', tone: TONE.unresolved });
  }
  for (const frame of document.querySelectorAll('.frame')) {
    const k = frame.dataset.key;
    frame.style.opacity = k === key || outgoing.some((e) => e.to === k) || incoming.some((e) => e.from === k) ? '1' : '0.35';
  }
}

function clearFocusDim() {
  for (const frame of document.querySelectorAll('.frame')) frame.style.opacity = '1';
}

/* ------------------------------------------------------------------ */
/* Variant C — gutter rails                                            */
/* ------------------------------------------------------------------ */

function ensureMarkers(svg) {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  for (const [id, tone] of [['arrow-observed', TONE.observed], ['arrow-declared', TONE.declared], ['arrow-fired', TONE.fired]]) {
    const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    m.setAttribute('id', id); m.setAttribute('viewBox', '0 0 10 10'); m.setAttribute('refX', '9'); m.setAttribute('refY', '5');
    m.setAttribute('markerWidth', '7'); m.setAttribute('markerHeight', '7'); m.setAttribute('orient', 'auto-start-reverse');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); path.setAttribute('fill', tone);
    m.appendChild(path); defs.appendChild(m);
  }
  svg.appendChild(defs);
}

function drawRails(svg, { arrows }) {
  svg.innerHTML = '';
  if (arrows) ensureMarkers(svg);
  const topY = frameTop();
  const railY = topY - 200; // inside the top padding, above the frames
  // One rail per provenance, stacked: observed lowest, declared above it.
  const rails = [
    { tone: TONE.observed, dashed: false, y: railY + 20, edges: OBSERVED_EDGES },
    { tone: TONE.declared, dashed: true, y: railY + 6, edges: DECLARED_EDGES },
  ];
  for (const rail of rails) {
    addPath(svg, { d: `M ${PAD - 8} ${rail.y} H ${PAD + FRAME_STRIDE * SCREENS.length}`, tone: rail.tone, dashed: rail.dashed, width: 1.5 });
    for (const e of rail.edges) {
      const x1 = centerX(e.from), x2 = centerX(e.to);
      const kind = rail === rails[0] ? 'observed' : 'declared';
      // Source rises to the rail; target drops from it. With arrows the rise
      // starts from the frame and the drop ends in an arrowhead, so the two
      // ends read differently.
      const up = addPath(svg, { d: `M ${x1} ${topY} V ${rail.y}`, tone: rail.tone, dashed: rail.dashed, width: 1.5 });
      const down = addPath(svg, { d: `M ${x2} ${rail.y} V ${topY}`, tone: rail.tone, dashed: rail.dashed, width: 1.5 });
      if (arrows) {
        down.setAttribute('marker-end', `url(#arrow-${kind})`);
        // The horizontal run between the two drops, with a direction arrow at its midpoint.
        const seg = addPath(svg, { d: `M ${x1} ${rail.y} H ${x2}`, tone: rail.tone, dashed: rail.dashed, width: 1.5 });
        seg.setAttribute('marker-mid', `url(#arrow-${kind})`);
        void up;
      } else {
        addText(svg, { x: x2, y: topY - 4, text: '▼', tone: rail.tone });
      }
    }
  }
  for (const key of UNRESOLVED_ON) {
    addText(svg, { x: centerX(key), y: railY - 8, text: '?', tone: TONE.unresolved });
  }
  if (state.fired) {
    const [a, b] = state.fired;
    const y = railY + 20;
    const x1 = centerX(a), x2 = centerX(b);
    const seg = addPath(svg, { d: `M ${x1} ${y} H ${x2}`, tone: TONE.fired, width: 3.5, dashed: false });
    const drop = addPath(svg, { d: `M ${x2} ${y} V ${topY}`, tone: TONE.fired, width: 3.5, dashed: false });
    if (arrows) drop.setAttribute('marker-end', 'url(#arrow-fired)');
    void seg;
  }
}

/* ------------------------------------------------------------------ */
/* State + switcher                                                    */
/* ------------------------------------------------------------------ */

const state = {
  variant: new URLSearchParams(location.search).get('variant') ?? 'A',
  scale: 0.5,
  hover: null,
  focus: null,
  fired: null,
};

const DRAWS = {
  A: (svg) => drawArcs(svg, { declared: 'arcs' }),
  B: (svg) => drawFocused(svg, { fired: false }),
  C: (svg) => drawRails(svg, { arrows: false }),
  D: (svg) => drawFocused(svg, { fired: true }),
  E: (svg) => drawArcs(svg, { declared: 'rail' }),
  F: (svg) => drawRails(svg, { arrows: true }),
  G: (svg) => drawFocused(svg, { fired: true, backObserved: true }),
};
const NAMES = {
  A: 'Arcs, always on',
  B: 'Hover/select only',
  C: 'Gutter rails',
  D: 'Hover + fired arc',
  E: 'Arcs, tab bar collapsed to a rail',
  F: 'Gutter rails + arrowheads',
  G: 'Hover + fired + back observed',
};
// Back presses the prototype has "observed". Each resolves against a fake
// history stack: habit came from index or habits, settings from profile.
const BACK_HISTORY = { habit: ['index', 'habits'], settings: ['profile'] };
const OBSERVED_BACK = [];

let svgRef = null;

function render() {
  clearFocusDim();
  DRAWS[state.variant](svgRef);
  $('#variant-label').textContent = `${state.variant} — ${NAMES[state.variant]}`;
  $('#scale-label').textContent = `${Math.round(state.scale * 100)}% · ctrl+scroll to zoom`;
}

function setVariant(v) {
  state.variant = v;
  const url = new URL(location.href);
  url.searchParams.set('variant', v);
  history.replaceState(null, '', url);
  render();
}

function cycle(dir) {
  const order = Object.keys(NAMES);
  const i = order.indexOf(state.variant);
  setVariant(order[(i + dir + order.length) % order.length]);
}

let firedTimer = null;
function ignite(from, to, text) {
  state.fired = [from, to];
  $('#event-line').textContent = text;
  render();
  clearTimeout(firedTimer);
  // The ignition is a flash, not a state: it fades after 1.2s so the board
  // is not accumulating red. The route list keeps the record.
  firedTimer = setTimeout(() => { state.fired = null; render(); }, 1200);
}

function fireRandomPress() {
  const e = OBSERVED_EDGES[Math.floor(Math.random() * OBSERVED_EDGES.length)];
  ignite(e.from, e.to, `press: ${e.from} → ${e.to} (${e.label})`);
}

function fireBackPress() {
  const from = UNRESOLVED_ON[Math.floor(Math.random() * UNRESOLVED_ON.length)];
  const options = BACK_HISTORY[from];
  const to = options[Math.floor(Math.random() * options.length)];
  if (!OBSERVED_BACK.some((b) => b.from === from && b.to === to)) OBSERVED_BACK.push({ from, to });
  ignite(from, to, `back press on ${from}: history resolved to ${to} — now an observed edge (variant G only)`);
}

function buildChrome(container) {
  const legend = document.createElement('div');
  legend.id = 'legend';
  legend.innerHTML = `
    <span><i style="background:${TONE.observed}"></i>observed — the seam watched it</span>
    <span><i class="dashed" style="background:${TONE.declared}"></i>declared — read off the router</span>
    <span><i style="background:${TONE.unresolved}"></i>? — back: unresolvable</span>
    <button id="fire">fire a press</button>
    <button id="fire-back">fire a back press</button>
    <button id="zero">clear observations</button>
    <span id="event-line">nothing observed yet — fire a press</span>
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
    // The honest zero: strip observed edges, keep declared ones, and say so.
    OBSERVED_EDGES.length = 0;
    OBSERVED_BACK.length = 0;
    state.fired = null;
    $('#event-line').textContent = 'observed: nothing yet — the board is watching, no route has been seen';
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
const { svg } = buildBoard(host, state.variant);
svgRef = svg;
buildChrome(host);
render();
