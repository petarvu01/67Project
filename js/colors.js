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
