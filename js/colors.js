// Colors, scales and formatting shared by the map and the panels.
// Sign convention everywhere: positive margin = Democratic, negative = Republican.
(function () {
  const C = {
    dem: "#1F5FA9", rep: "#B0202F", pur: "#7A4A9E", ind: "#8A8F98",
    teal: "#2E7D74", elastic: "#4C6EF5", warn: "#C4761E",
    ink: "#15181D", muted: "#6B7280", rule: "#D9DEE5", track: "#E8ECF1",
    tier: { Low: "#2E7D74", Moderate: "#C9A227", Elevated: "#C4761E", High: "#B0202F" },
  };

  const MARGIN_STOPS = [
    [0.00, "#7F1420"], [0.25, C.rep], [0.42, "#E09098"], [0.47, "#D8BFD8"],
    [0.50, "#B98FC9"], [0.53, "#C6C6E4"], [0.58, "#8FB4DC"], [0.75, C.dem], [1.00, "#123F73"],
  ];

  // Discrete color bands for margin/swing choropleths. A continuous gradient
  // over a wide range (e.g. -80..80) crushes most counties into one shade;
  // named bands, as professional election maps use, keep every band
  // visually distinct regardless of how skewed the underlying values are.
  const NICE = [1, 2, 5];
  function niceThreshold(x) {
    if (x <= 0) return 0;
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const n = x / p;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  }
  function nextNice(x) {
    let p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-9))));
    for (let k = 0; k < 12; k++) {
      for (const n of NICE) { const v = n * p; if (v > x) return v; }
      p *= 10;
    }
    return x * 2;
  }
  function marginBins(lim) {
    const t0 = niceThreshold(lim * 0.06);
    const t1raw = niceThreshold(lim * 0.25), t1 = t1raw > t0 ? t1raw : nextNice(t0);
    const t2raw = niceThreshold(lim * 0.5), t2 = t2raw > t1 ? t2raw : nextNice(t1);
    return [
      { max: -t2, color: "#7F1420" },
      { max: -t1, color: C.rep },
      { max: -t0, color: "#E09098" },
      { max: t0, color: C.pur },
      { max: t1, color: "#8FB4DC" },
      { max: t2, color: C.dem },
      { max: Infinity, color: "#123F73" },
    ];
  }
  function binColor(bins, v) {
    for (const b of bins) if (v <= b.max) return b.color;
    return bins[bins.length - 1].color;
  }
  function binLabel(bins, i, unit) {
    const lo = i === 0 ? -Infinity : bins[i - 1].max, hi = bins[i].max;
    const dec = Math.max(0, ...bins.filter(b => Number.isFinite(b.max)).map(b => (String(b.max).split(".")[1] || "").length));
    const f = n => (+Math.abs(n).toFixed(dec)).toString();
    if (lo === -Infinity) return `${f(hi)}${unit} or more R`;
    if (hi === Infinity) return `${f(lo)}${unit} or more D`;
    if (lo < 0 && hi > 0) return `Within ${f(hi)}${unit}`;
    return lo >= 0 ? `${f(lo)}\u2013${f(hi)}${unit} D` : `${f(hi)}\u2013${f(lo)}${unit} R`;
  }

  function hex(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
  function mix(a, b, u) {
    const A = hex(a), B = hex(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * u).toString(16).padStart(2, "0")).join("");
  }
  function ramp(stops) {
    return t => {
      t = Math.min(1, Math.max(0, t));
      for (let i = 0; i < stops.length - 1; i++) {
        const [a, ca] = stops[i], [b, cb] = stops[i + 1];
        if (t >= a && t <= b) return mix(ca, cb, (t - a) / (b - a));
      }
      return stops[stops.length - 1][1];
    };
  }

  const PURPLE_BAND = (window.MCAP_DATA && window.MCAP_DATA.meta.purple_band) || 5;

  window.MCAP = window.MCAP || {};
  Object.assign(window.MCAP, {
    C,
    MARGIN_STOPS,
    marginRamp: ramp(MARGIN_STOPS),
    marginBins, binColor, binLabel,
    seqRamp: (lo, mid, hi) => ramp([[0, lo], [0.5, mid], [1, hi]]),
    PURPLE_BAND,
    fmtMargin(v, d = 1) {
      if (v == null || Number.isNaN(v)) return "n/a";
      if (Math.abs(v) < 0.05) return "Even";
      return `+${Math.abs(v).toFixed(d)} ${v > 0 ? "D" : "R"}`;
    },
    marginColor(v) { return Math.abs(v) < PURPLE_BAND ? C.pur : v > 0 ? C.dem : C.rep; },
    // Vulnerability composite (CEVS) is a z-score: negative = insulated,
    // positive = vulnerable. Color is continuous, independent of the tier label text.
    vulnColor: ramp([[0, "#2E7D74"], [0.5, "#C9A227"], [1, "#B0202F"]]),
    vulnColorFor(z) { return this.vulnColor(Math.min(1, Math.max(0, (z + 2.5) / 5))); },
    classify(v) { return Math.abs(v) < PURPLE_BAND ? "Purple" : v > 0 ? "Blue" : "Red"; },
    kindColor(k) { return { Blue: C.dem, Red: C.rep, Purple: C.pur }[k]; },
    swingText(base, proj) {
      const d = proj - base;
      if (Math.abs(d) < 0.05) return "no net swing";
      return `${Math.abs(d).toFixed(1)} pt swing to ${d > 0 ? "D" : "R"}`;
    },
    fmtInt(v) { return (v >= 0 ? "+" : "\u2212") + Math.abs(Math.round(v)).toLocaleString("en-US"); },
    esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); },
  });
})();
