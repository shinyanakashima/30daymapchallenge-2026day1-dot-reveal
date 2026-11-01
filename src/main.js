// 何点で分かる？ 北海道の点描
const STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 25, 30, 40, 50, 65, 80, 100, 130, 160, 200, 250, 320, 400, 500];
const CHIPS = [3, 10, 30, 100];
const INITIAL_N = 3;
const PLAY_INTERVAL = 900;

const NOTES = {
  farthest: "最遠点：置いた点から最も遠い頂点を順に足す",
  dp: "簡略化：今の輪郭から最も外れた頂点を順に足す",
  arc: "等間隔：輪郭線上にほぼ等間隔の補間点を置く（元の頂点ではない）",
};

const $ = (id) => document.getElementById(id);
const canvas = $("map");
const ctx = canvas.getContext("2d");

const state = {
  n: INITIAL_N,
  method: "farthest",
  answer: false,
  playing: false,
  timer: null,
  addedAt: [], // 表示順 i の点が追加された時刻
};

let data, N, sets, view;

function vdc(k) {
  let v = 0, d = 1;
  while (k) { d *= 2; v += (k & 1) / d; k >>= 1; }
  return v;
}

function buildSets() {
  const V = data.vertices;
  const fromOrder = (order) => order.map((idx) => ({ p: V[idx], ring: idx }));
  const arc = data.arc_points.map((p, k) => ({ p, ring: vdc(k) }));
  sets = { farthest: fromOrder(data.orders.farthest), dp: fromOrder(data.orders.dp), arc };
}

// ---------- 描画 ----------
function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const V = data.vertices;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of V) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const pad = 14;
  const s = Math.min((r.width - pad * 2) / (x1 - x0), (r.height - pad * 2) / (y1 - y0));
  view = {
    dpr, s,
    ox: (r.width - (x1 - x0) * s) / 2 - x0 * s,
    oy: (r.height - (y1 - y0) * s) / 2 + y1 * s,
  };
  draw();
}

const tx = (p) => [view.ox + p[0] * view.s, view.oy - p[1] * view.s];

function radius(n) {
  // 点が少ないほど大きく。画面の大きさにも合わせる。
  const base = Math.max(2.2, Math.min(9, 26 / Math.sqrt(n)));
  return base * Math.min(1.2, Math.max(0.8, view.s * 1.6));
}

let raf = 0;
function draw() {
  cancelAnimationFrame(raf);
  const { dpr } = view;
  const w = canvas.width / dpr, h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pts = sets[state.method].slice(0, state.n);
  const now = performance.now();
  let animating = false;

  if (state.answer) {
    // 元の輪郭線
    ctx.beginPath();
    data.vertices.forEach((p, i) => { const [x, y] = tx(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.strokeStyle = css("--outline");
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 選ばれていない元の頂点
    if (state.method !== "arc") {
      const used = new Set(pts.map((q) => q.p));
      ctx.fillStyle = css("--ghost");
      for (const p of data.vertices) {
        if (used.has(p)) continue;
        const [x, y] = tx(p);
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    // 表示中の点を輪郭の順に結んだ形
    if (pts.length >= 2) {
      const sorted = [...pts].sort((a, b) => a.ring - b.ring);
      ctx.beginPath();
      sorted.forEach((q, i) => { const [x, y] = tx(q.p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = css("--new");
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const r = radius(state.n);
  const dot = css("--dot"), fresh = css("--new");
  pts.forEach((q, i) => {
    const age = now - (state.addedAt[i] ?? -1e9);
    if (age < 0) { animating = true; return; }
    const t = Math.min(1, age / 500);
    if (t < 1) animating = true;
    const [x, y] = tx(q.p);
    const rr = r * (t < 1 ? 0.3 + 0.7 * easeOut(t) + 0.25 * Math.sin(Math.PI * t) : 1);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = age < 1400 ? fresh : dot;
    ctx.fill();
  });
  if (!animating && pts.some((_, i) => now - (state.addedAt[i] ?? -1e9) < 1400)) animating = true;
  if (animating) raf = requestAnimationFrame(draw);
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// ---------- 状態 ----------
function setN(n, { animate = true } = {}) {
  n = Math.max(1, Math.min(N, Math.round(n)));
  const now = performance.now();
  for (let i = state.n; i < n; i++) state.addedAt[i] = animate ? now + (i - state.n) * Math.min(40, 400 / (n - state.n)) : -1e9;
  state.n = n;
  syncUI();
  draw();
}

function setMethod(m) {
  state.method = m;
  state.addedAt = [];
  syncUI();
  draw();
}

function setAnswer(on) {
  state.answer = on;
  syncUI();
  draw();
}

function nextStep(n, dir) {
  const list = [...STEPS.filter((s) => s < N), N];
  if (dir > 0) return list.find((s) => s > n) ?? N;
  return [...list].reverse().find((s) => s < n) ?? 1;
}

// スライダーは対数目盛
const toSlider = (n) => Math.round((Math.log(n) / Math.log(N)) * 1000);
const fromSlider = (v) => Math.round(Math.exp((v / 1000) * Math.log(N)));

function syncUI() {
  $("count-n").textContent = state.n;
  $("slider").value = toSlider(state.n);
  document.querySelectorAll("#chips button").forEach((b) => b.classList.toggle("on", +b.dataset.n === state.n));
  document.querySelectorAll("#methods button").forEach((b) => b.setAttribute("aria-checked", b.dataset.method === state.method));
  $("btn-answer").setAttribute("aria-pressed", state.answer);
  $("btn-play").textContent = state.playing ? "停止" : "自動再生";
  $("method-note").textContent = NOTES[state.method];

  const note = $("answer-note");
  note.classList.toggle("off", !state.answer);
  if (state.answer) {
    let s = `北海道本島（周辺の島は含まない）`;
    if (state.method === "dp") {
      const d = state.n < N ? data.dp_deviation_km[state.n] : 0;
      if (d != null) s += ` / 輪郭とのずれ 最大 約${d < 10 ? d.toFixed(1) : Math.round(d)}km`;
    }
    note.textContent = s;
  }
  const h = `#n=${state.n}&m=${state.method}${state.answer ? "&a=1" : ""}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}

// ---------- 再生 ----------
function play() {
  if (state.n >= N) setN(1, { animate: false });
  state.playing = true;
  state.answer = false;
  syncUI();
  tick();
}
function tick() {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    if (!state.playing) return;
    setN(nextStep(state.n, 1));
    if (state.n >= N) { stop(); setAnswer(true); return; }
    tick();
  }, state.n < 3 ? PLAY_INTERVAL * 1.4 : PLAY_INTERVAL);
}
function stop() {
  state.playing = false;
  clearTimeout(state.timer);
  syncUI();
}

function reset() {
  stop();
  state.answer = false;
  state.n = 0;
  state.addedAt = [];
  setN(INITIAL_N);
}

// ---------- 起動 ----------
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const n = parseInt(q.get("n"), 10);
  const m = q.get("m");
  return {
    n: Number.isFinite(n) ? n : INITIAL_N,
    method: sets[m] ? m : "farthest",
    answer: q.get("a") === "1",
  };
}

async function init() {
  const res = await fetch("data/hokkaido_points.json");
  data = await res.json();
  N = data.vertices.length;
  buildSets();
  $("count-max").textContent = N;

  const chips = $("chips");
  for (const n of [...CHIPS, N]) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.n = n;
    b.textContent = n === N ? "全部" : n;
    b.addEventListener("click", () => { stop(); setN(n); });
    chips.append(b);
  }

  $("slider").addEventListener("input", (e) => { stop(); setN(fromSlider(+e.target.value), { animate: false }); });
  $("btn-plus").addEventListener("click", () => { stop(); setN(nextStep(state.n, 1)); });
  $("btn-minus").addEventListener("click", () => { stop(); setN(nextStep(state.n, -1)); });
  document.querySelectorAll("#methods button").forEach((b) => b.addEventListener("click", () => setMethod(b.dataset.method)));
  $("btn-answer").addEventListener("click", () => setAnswer(!state.answer));
  $("btn-play").addEventListener("click", () => (state.playing ? stop() : play()));
  $("btn-reset").addEventListener("click", reset);
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" && e.target.type === "range") return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { stop(); setN(nextStep(state.n, 1)); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { stop(); setN(nextStep(state.n, -1)); }
    else if (e.key === "a") setAnswer(!state.answer);
    else return;
    e.preventDefault();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  new ResizeObserver(resize).observe($("stage"));

  const h = readHash();
  state.method = h.method;
  state.answer = h.answer;
  state.n = 0;
  resize();
  setN(h.n);
}

init().catch((err) => {
  $("method-note").textContent = "データを読み込めませんでした。";
  console.error(err);
});
