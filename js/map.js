// Choropleth map: draws counties once, recolors on metric change.
(function () {
  const M = window.MCAP, C = M.C;
  const NS = "http://www.w3.org/2000/svg";

  // Small hand-tuned nudges (dx, dy in map units) so labels don't collide
  // with neighboring county names or run outside a narrow county's outline.
  const LABEL_OFFSET = {
    Westmoreland: [-6, 14], Allegheny: [-4, -10], Northampton: [10, -6],
    Bucks: [8, 10], Berks: [0, -6], Dauphin: [-2, 8],
  };

  // One entry per tab. `value` returns the number to color by; `color` maps it.
  function metrics(data) {
    const m = data.metrics;
    const rows = data.counties.map(c => m[c.name]);
    const absMax = k => Math.ceil(Math.max(...rows.map(r => Math.abs(r[k]))) / 5) * 5;
    const range = fn => { const v = rows.map(fn); return [Math.min(...v), Math.max(...v)]; };
    const swingLim = Math.ceil(Math.max(...rows.map(r => Math.abs(r.projmarg - r.basemarg))) * 10) / 10;
    const lim = absMax("projmarg");
    const seq = (key, title, sub, unit, ramp) => {
      const [lo, hi] = range(r => r[key]);
      return { key, title, sub, unit, value: r => r[key], color: v => ramp((v - lo) / (hi - lo || 1)),
               legend: { kind: "seq", lo, hi, unit, ramp } };
    };
    return {
      projmarg: { key: "projmarg", title: "Projected margin, 2028", sub: "PROJMARG, percentage points",
        value: r => r.projmarg, color: v => M.binColor(M.marginBins(lim), v),
        legend: { kind: "bins", bins: M.marginBins(lim), unit: " pt" }, tip: r => M.fmtMargin(r.projmarg) },
      basemarg: { key: "basemarg", title: "Base margin", sub: "BASEMARG, before the national tide",
        value: r => r.basemarg, color: v => M.binColor(M.marginBins(lim), v),
        legend: { kind: "bins", bins: M.marginBins(lim), unit: " pt" }, tip: r => M.fmtMargin(r.basemarg) },
      kind: { key: "kind", title: "Red, blue and purple counties", sub: `Purple = projected margin inside ${M.PURPLE_BAND} points`,
        value: r => r.projmarg, color: v => M.kindColor(M.classify(v)),
        legend: { kind: "cat" }, tip: r => M.fmtMargin(r.projmarg) },
      swing: { key: "swing", title: "Swing, base to projected", sub: "PROJMARG minus BASEMARG, points",
        value: r => r.projmarg - r.basemarg, color: v => M.binColor(M.marginBins(swingLim), v),
        legend: { kind: "bins", bins: M.marginBins(swingLim), unit: " pt" },
        tip: r => M.swingText(r.basemarg, r.projmarg) },
      logpwd: seq("logpwd", "Population density score", "LOGPWD, 0–10", "", M.seqRamp("#EAF1F0", C.teal, "#12453F")),
      elasticity: seq("elasticity", "Elasticity score", "ELASTICITY, 0–2", "", M.seqRamp("#EEF0FC", C.elastic, "#20307A")),
      vulcomposite: seq("vulcomposite", "Economic vulnerability", "Composite score (CEVS), z-score vs state average", "", M.seqRamp("#F5EFE6", C.warn, "#7A3E0C")),
    };
  }
  // basemarg is available as a view (#view=basemarg) but not shown as a tab.
  const TABS = [["projmarg", "Projected margin"], ["kind", "Red / blue / purple"], ["swing", "Swing"],
                ["logpwd", "Density"], ["elasticity", "Elasticity"], ["vulcomposite", "Vulnerability"]];

  function build(svg, data, onSelect) {
    const [W, H] = data.meta.view;
    const base = { x: -6, y: -6, w: W + 12, h: H + 12 };
    svg.setAttribute("viewBox", `${base.x} ${base.y} ${base.w} ${base.h}`);

    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `<filter id="mapShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#0B0E13" flood-opacity="0.28"/>
    </filter>`;
    svg.appendChild(defs);

    const g = document.createElementNS(NS, "g");
    g.setAttribute("filter", "url(#mapShadow)");
    const paths = {};
    let dragged = false;
    data.counties.forEach(c => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", c.path);
      p.setAttribute("class", "cty");
      p.setAttribute("tabindex", "0");
      p.setAttribute("role", "button");
      p.setAttribute("aria-label", c.name + " County");
      p.dataset.n = c.name;
      p.addEventListener("click", () => { if (!dragged) onSelect(c.name); });
      p.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(c.name); } });
      p.addEventListener("mouseenter", () => spotlight(c.name));
      p.addEventListener("mouseleave", clearSpotlight);
      g.appendChild(p);
      paths[c.name] = p;
    });
    svg.appendChild(g);

    function spotlight(name) {
      const selName = Object.keys(paths).find(n => paths[n].classList.contains("sel"));
      Object.entries(paths).forEach(([n, p]) => {
        const crisp = n === name || n === selName;
        p.classList.toggle("faded", !crisp);
        p.classList.toggle("hot", n === name);
      });
    }
    function clearSpotlight() {
      const selName = Object.keys(paths).find(n => paths[n].classList.contains("sel"));
      Object.entries(paths).forEach(([n, p]) => {
        p.classList.remove("hot");
        p.classList.toggle("faded", !!selName && n !== selName);
      });
    }
    // Called by app.js right after it adds/removes the .sel class, so the
    // rest of the map blurs behind the selected county even without a hover.
    function refreshSelection() { clearSpotlight(); }

    // Every county gets a label, sized to its footprint. At the statewide
    // view small counties render too small to read (by design, to avoid
    // clutter); zooming in enlarges them along with everything else, so
    // detail appears exactly where the person has zoomed to look for it.
    const lg = document.createElementNS(NS, "g");
    lg.setAttribute("class", "labels");
    data.counties.forEach(c => {
      const bb = paths[c.name].getBBox();
      const size = Math.max(4.5, Math.min(15, Math.sqrt(bb.width * bb.height) / 9));
      const [ox, oy] = LABEL_OFFSET[c.name] || [0, 0];
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", c.cx + ox); t.setAttribute("y", c.cy + oy); t.setAttribute("class", "lbl");
      t.setAttribute("font-size", size.toFixed(1));
      t.setAttribute("stroke-width", (size * 0.22).toFixed(2));
      t.textContent = c.name;
      lg.appendChild(t);
    });
    svg.appendChild(lg);

    // ---- zoom / pan --------------------------------------------------
    const MAXZ = 10;
    let vb = { ...base };
    function apply() { svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); }
    function clampView() {
      vb.w = Math.min(base.w, Math.max(base.w / MAXZ, vb.w));
      vb.h = Math.min(base.h, Math.max(base.h / MAXZ, vb.h));
      const padX = vb.w * 0.9, padY = vb.h * 0.9;
      vb.x = Math.min(base.x + base.w - vb.w + padX, Math.max(base.x - padX, vb.x));
      vb.y = Math.min(base.y + base.h - vb.h + padY, Math.max(base.y - padY, vb.y));
    }
    function toSvg(clientX, clientY) {
      const pt = svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }
    function zoomBy(factor, clientX, clientY) {
      const p = clientX != null ? toSvg(clientX, clientY) : { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
      const nw = vb.w / factor, nh = vb.h / factor;
      vb.x = p.x - (p.x - vb.x) * (nw / vb.w);
      vb.y = p.y - (p.y - vb.y) * (nh / vb.h);
      vb.w = nw; vb.h = nh;
      clampView(); apply();
    }
    function reset() { vb = { ...base }; apply(); }
    svg.addEventListener("wheel", e => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY);
    }, { passive: false });

    let dragging = false, last = null, moved = 0;
    svg.addEventListener("pointerdown", e => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.pointerType === "touch") return; // touch is handled by the pinch/pan block below
      dragging = true; moved = 0; last = { x: e.clientX, y: e.clientY };
      const onMove = e2 => {
        if (!dragging) return;
        const s = vb.w / svg.clientWidth;
        const dx = (e2.clientX - last.x) * s, dy = (e2.clientY - last.y) * s;
        moved += Math.abs(e2.clientX - last.x) + Math.abs(e2.clientY - last.y);
        vb.x -= dx; vb.y -= dy;
        last = { x: e2.clientX, y: e2.clientY };
        clampView(); apply();
      };
      const onUp = () => {
        if (moved > 4) { dragged = true; setTimeout(() => { dragged = false; }, 0); }
        dragging = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    // Two-finger pinch and one-finger pan on touch (kept separate from the
    // mouse path above since touch shouldn't fight page scroll on one finger).
    const touches = new Map();
    let touchLast = null;
    svg.addEventListener("pointerdown", e => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, e);
      if (touches.size === 1) touchLast = { x: e.clientX, y: e.clientY };
    });
    svg.addEventListener("pointermove", e => {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      const prev = touches.get(e.pointerId);
      touches.set(e.pointerId, e);
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (prev._dist) zoomBy(dist / prev._dist, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        touches.get(e.pointerId)._dist = dist;
        if (a.pointerId !== e.pointerId) a._dist = dist; else b._dist = dist;
      } else if (touches.size === 1 && touchLast) {
        const s = vb.w / svg.clientWidth;
        vb.x -= (e.clientX - touchLast.x) * s; vb.y -= (e.clientY - touchLast.y) * s;
        touchLast = { x: e.clientX, y: e.clientY };
        clampView(); apply();
      }
    });
    ["pointerup", "pointercancel"].forEach(ev => svg.addEventListener(ev, e => {
      touches.delete(e.pointerId); touchLast = null;
    }));

    return { paths, group: g, refreshSelection, zoom: { in: (x, y) => zoomBy(1.5, x, y), out: (x, y) => zoomBy(1 / 1.5, x, y), reset } };
  }

  function legendHtml(spec, counts) {
    const cnt = `<div class="counts"><span><i style="background:${C.dem}"></i>Blue ${counts.Blue}</span><span><i style="background:${C.pur}"></i>Purple ${counts.Purple}</span><span><i style="background:${C.rep}"></i>Red ${counts.Red}</span></div>`;
    const L = spec.legend;
    if (L.kind === "cat") return cnt;
    if (L.kind === "bins") {
      const chips = L.bins.map((b, i) =>
        `<span class="chip"><i style="background:${b.color}"></i>${M.binLabel(L.bins, i, L.unit)}</span>`).join("");
      return `<div class="chips">${chips}</div>${cnt}`;
    }
    let stops;
    if (L.kind === "div") stops = M.MARGIN_STOPS.map(([t, c]) => `<stop offset="${Math.round(t * 100)}%" stop-color="${c}"/>`).join("");
    else stops = [0, .25, .5, .75, 1].map(t => `<stop offset="${t * 100}%" stop-color="${L.ramp(t)}"/>`).join("");
    const id = "lg" + spec.key;
    const lo = L.kind === "div" ? L.lo : (+L.lo).toFixed(1), hi = L.kind === "div" ? L.hi : (+L.hi).toFixed(1);
    return `<span>${lo}</span><svg><defs><linearGradient id="${id}" x1="0" x2="1">${stops}</linearGradient></defs><rect width="240" height="12" rx="6" fill="url(#${id})"/></svg><span>${hi}</span>${cnt}`;
  }

  function downloadPng(svg, filename) {
    const clone = svg.cloneNode(true);
    clone.querySelectorAll(".cty").forEach(p => {
      p.setAttribute("stroke", p.classList.contains("sel") ? C.ink : "#fff");
      p.setAttribute("stroke-width", p.classList.contains("sel") ? "2.6" : "0.9");
    });
    clone.querySelectorAll(".lbl").forEach(t => {
      t.setAttribute("style", "font:600 13px Barlow,Arial,sans-serif;fill:#15181D;paint-order:stroke;stroke:#fff;stroke-width:3px;text-anchor:middle");
    });
    const vb = svg.viewBox.baseVal;
    clone.setAttribute("width", vb.width * 2); clone.setAttribute("height", vb.height * 2);
    clone.setAttribute("xmlns", NS);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = vb.width * 2; cv.height = vb.height * 2;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#F3F4F6"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = filename; a.href = cv.toDataURL("image/png"); a.click();
    };
    img.src = url;
  }

  M.map = { metrics, TABS, build, legendHtml, downloadPng };
})();
