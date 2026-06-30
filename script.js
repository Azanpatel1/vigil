// Single-screen landing: hero only, no scroll. Hero buttons reveal the rest of
// the page — "Why it matters" jumps to the story, "Request a pilot" to the CTA.
(function () {
  const body = document.body;
  const more = document.getElementById("more");
  if (!more) return;

  body.classList.add("landing");

  function revealMore(targetSel) {
    more.hidden = false;
    body.classList.remove("landing");
    // Wait for layout after un-hiding before scrolling to the target.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const t = targetSel && document.querySelector(targetSel);
        if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );
  }

  document.querySelectorAll("[data-reveal]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      revealMore(a.getAttribute("data-reveal"));
    });
  });

  const home = more.querySelector(".more-home");
  if (home) {
    home.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "auto" });
      body.classList.add("landing");
      more.hidden = true;
    });
  }
})();

// One-time reveal-on-scroll for general sections
const revealEls = document.querySelectorAll(
  ".feature, .tl-item, .device-card, .pioneer, .solution-head, .science-intro, .cta-inner"
);
revealEls.forEach((el) => el.classList.add("reveal"));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const delay = entry.target.classList.contains("feature") || entry.target.classList.contains("tl-item") ? i * 40 : 0;
        setTimeout(() => entry.target.classList.add("in"), delay);
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
revealEls.forEach((el) => revealObserver.observe(el));

// Problem cards: pop in/out every time they enter or leave the viewport
const cards = document.querySelectorAll(".problem-cards .pcard");
cards.forEach((c) => c.classList.add("pop-hidden"));
const cardObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("pop-hidden", !entry.isIntersecting);
    });
  },
  { threshold: 0.25 }
);
cards.forEach((c) => cardObserver.observe(c));

// Big stat count-up — re-runs every time it scrolls back into view
const formatNum = (n) => n.toLocaleString("en-US");
const statEl = document.querySelector(".stat-num");
if (statEl) {
  const target = parseInt(statEl.dataset.count, 10);
  let raf = null;
  const runCount = () => {
    if (raf) cancelAnimationFrame(raf);
    const duration = 1800;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      statEl.textContent = formatNum(Math.floor(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
      else statEl.textContent = "Nearly " + formatNum(target);
    };
    raf = requestAnimationFrame(tick);
  };
  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          runCount();
        } else {
          if (raf) cancelAnimationFrame(raf);
          statEl.textContent = "0";
        }
      });
    },
    { threshold: 0.6 }
  );
  countObserver.observe(statEl);
}

// Neural-network cloud housed inside a brain silhouette. Signal pulses travel
// along the pathways on their own and surface decoded "commands" as floating
// labels — a glimpse of the brain being read in real time (no cursor needed).
(function () {
  const canvas = document.getElementById("neural-net");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PHRASES = [
    "Raise left hand", "Squeeze right hand", "Wiggle your toes",
    "Open your eyes", "Yes", "I'm still here", "Nod your head",
    "Squeeze my hand", "Blink twice",
  ];
  const PALETTE = ["#c0973f", "#7c9a8e", "#6f7d9c", "#bd87a4", "#8aa06f", "#c0973f", "#7c9a8e"];
  const GOLD = "192,151,63";

  // Stylised brain silhouette (top view, front at top): egg-shaped overall with
  // a lobulated gyri-like contour and a small frontal notch, in a 170 x 200 space.
  const BRAIN = "M85 20 C92 14 100 14 104 22 C118 20 128 32 126 46 C142 48 150 66 142 80 C156 90 156 114 140 122 C150 138 140 160 120 164 C116 178 96 182 85 180 C74 182 54 178 50 164 C30 160 20 138 30 122 C14 114 14 90 28 80 C20 66 28 48 44 46 C42 32 52 20 66 22 C70 14 78 14 85 20 Z";
  const FISSURE = "M85 28 C81 70 89 130 85 174";
  const BW = 170, BH = 200;

  let W = 0, H = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let nodes = [], edges = [], adj = [], hubs = [];
  let pending = [], labels = [];
  let lastAuto = 0, built = false;
  let brainPath = null, fissurePath = null;
  let sc = 1, ox = 0, oy = 0;
  const rawBrain = new Path2D(BRAIN);

  const rnd = (a, b) => a + Math.random() * (b - a);

  function fitBrain() {
    // Fill most of the panel; leave a small band below the brain for the caption.
    // Cap width below the panel so there's real room to push the brain right.
    sc = Math.min((W * 0.78) / BW, (H * 0.86) / BH);
    // Right-align the brain (small margin off the right edge).
    ox = (W - BW * sc) * 0.98;
    oy = (H - BH * sc) * 0.12;
    const m = new DOMMatrix([sc, 0, 0, sc, ox, oy]);
    brainPath = new Path2D(); brainPath.addPath(new Path2D(BRAIN), m);
    fissurePath = new Path2D(); fissurePath.addPath(new Path2D(FISSURE), m);
  }

  function build() {
    nodes = []; edges = []; adj = []; hubs = [];
    const N = 74;
    let attempts = 0;
    // Test points in the raw design space under an identity transform so the
    // hit-test matches the silhouette regardless of the canvas dpr transform.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    while (nodes.length < N && attempts < N * 60) {
      attempts++;
      const dx = rnd(0, BW);
      const dy = rnd(0, BH);
      if (!ctx.isPointInPath(rawBrain, dx, dy)) continue;
      const x = ox + dx * sc;
      const y = oy + dy * sc;
      nodes.push({
        x0: x, y0: y, _x: x, _y: y, act: 0,
        r: rnd(3.6, 6.2), spd: rnd(0.5, 1.3), amp: rnd(2.2, 5),
        ph: rnd(0, 6.28), ph2: rnd(0, 6.28),
        color: PALETTE[(Math.random() * PALETTE.length) | 0],
      });
    }
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const idx = (Math.random() * nodes.length) | 0;
      nodes[idx].r = rnd(8.4, 13); nodes[idx].hub = true; hubs.push(idx);
    }
    adj = nodes.map(() => []);
    const seen = new Set();
    const addEdge = (i, j) => {
      if (i === j) return;
      const key = i < j ? i + "-" + j : j + "-" + i;
      if (seen.has(key)) return;
      seen.add(key); edges.push({ i, j }); adj[i].push(j); adj[j].push(i);
    };
    for (let i = 0; i < nodes.length; i++) {
      const d = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x0 - nodes[j].x0, dy = nodes[i].y0 - nodes[j].y0;
        d.push({ j, dist: dx * dx + dy * dy });
      }
      d.sort((a, b) => a.dist - b.dist);
      const k = nodes[i].hub ? 4 : 2 + ((Math.random() * 2) | 0);
      for (let m = 0; m < k && m < d.length; m++) addEdge(i, d[m].j);
    }
    built = true;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    if (W < 2 || H < 2) return;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitBrain();
    build();
  }

  const nd = (i, j) => Math.hypot(nodes[i].x0 - nodes[j].x0, nodes[i].y0 - nodes[j].y0);

  function trigger(idx, text) {
    if (idx == null || idx < 0 || !nodes[idx]) return;
    const visited = new Set([idx]);
    pending.push({ node: idx, at: performance.now(), depth: 0, visited });
    if (text) {
      labels.push({ i: idx, text, born: performance.now() });
      if (labels.length > 2) labels.shift();
    }
  }

  const MAXD = 4, MAXN = 16;
  function step(now) {
    if (!pending.length) return;
    const ready = [], rest = [];
    for (const p of pending) (now >= p.at ? ready : rest).push(p);
    const added = [];
    const diag = Math.hypot(W, H) || 1;
    for (const p of ready) {
      nodes[p.node].act = 1;
      if (p.depth < MAXD && p.visited.size < MAXN) {
        for (const nb of adj[p.node]) {
          if (!p.visited.has(nb)) {
            p.visited.add(nb);
            added.push({ node: nb, at: now + 90 + (nd(p.node, nb) / diag) * 1400, depth: p.depth + 1, visited: p.visited });
          }
        }
      }
    }
    pending = rest.concat(added);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function draw(now) {
    if (W < 2 || H < 2 || !built) { requestAnimationFrame(draw); return; }
    const t = reduce ? 0 : now;
    for (const n of nodes) {
      n._x = n.x0 + (reduce ? 0 : Math.sin(t * 0.0003 * n.spd + n.ph) * n.amp);
      n._y = n.y0 + (reduce ? 0 : Math.cos(t * 0.0003 * n.spd + n.ph2) * n.amp);
      n.act *= 0.94; if (n.act < 0.01) n.act = 0;
    }
    step(now);
    const interval = reduce ? 6000 : 3800;
    if (now - lastAuto > interval && hubs.length) {
      trigger(hubs[(Math.random() * hubs.length) | 0], PHRASES[(Math.random() * PHRASES.length) | 0]);
      lastAuto = now;
    }

    ctx.clearRect(0, 0, W, H);

    // Brain silhouette
    ctx.fillStyle = "rgba(124,154,142,0.05)";
    ctx.fill(brainPath);
    ctx.strokeStyle = "rgba(22,24,29,0.28)";
    ctx.lineWidth = 1.6;
    ctx.stroke(brainPath);
    ctx.strokeStyle = "rgba(22,24,29,0.16)";
    ctx.lineWidth = 1.2;
    ctx.stroke(fissurePath);

    // Edges
    for (const e of edges) {
      const a = nodes[e.i], b = nodes[e.j], act = Math.max(a.act, b.act);
      ctx.beginPath();
      ctx.moveTo(a._x, a._y); ctx.lineTo(b._x, b._y);
      if (act > 0.04) {
        ctx.strokeStyle = `rgba(${GOLD},${0.12 + 0.62 * act})`;
        ctx.lineWidth = 1 + 2.2 * act;
      } else {
        ctx.strokeStyle = "rgba(22,24,29,0.09)";
        ctx.lineWidth = 0.9;
      }
      ctx.stroke();
    }
    // Nodes
    for (const n of nodes) {
      const a = n.act;
      ctx.beginPath();
      ctx.arc(n._x, n._y, n.r * (1 + 0.7 * a), 0, 6.283);
      if (a > 0.04) {
        ctx.shadowBlur = 13 * a; ctx.shadowColor = `rgba(${GOLD},${a})`;
        ctx.fillStyle = `rgba(${GOLD},0.9)`;
      } else {
        ctx.shadowBlur = 0; ctx.fillStyle = n.color;
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Decoded labels
    for (let k = labels.length - 1; k >= 0; k--) {
      const l = labels[k], age = now - l.born, life = 2600;
      if (age > life) { labels.splice(k, 1); continue; }
      let alpha = 1;
      if (age < 240) alpha = age / 240;
      else if (age > life - 650) alpha = (life - age) / 650;
      const n = nodes[l.i], rise = Math.min(age * 0.02, 16);
      ctx.font = "600 17px Inter, -apple-system, sans-serif";
      const tw = ctx.measureText(l.text).width, padX = 13, h = 31;
      let lx = n._x + 18, py = n._y - 38 - rise;
      lx = Math.max(6, Math.min(lx, W - tw - padX * 2 - 6));
      py = Math.max(6, py);
      ctx.beginPath(); ctx.moveTo(n._x, n._y); ctx.lineTo(lx + 8, py + h);
      ctx.strokeStyle = `rgba(${GOLD},${0.5 * alpha})`; ctx.lineWidth = 1; ctx.stroke();
      roundRect(ctx, lx, py, tw + padX * 2, h, 13);
      ctx.fillStyle = `rgba(247,245,239,${0.94 * alpha})`; ctx.fill();
      ctx.strokeStyle = `rgba(${GOLD},${0.7 * alpha})`; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = `rgba(22,24,29,${alpha})`;
      ctx.fillText(l.text, lx + padX, py + 21);
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  requestAnimationFrame(draw);
})();
