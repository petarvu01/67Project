// Dashboard panels. Each function returns an HTML/SVG string for one panel,
// so the two layouts (Red/Blue, Purple) are just different compositions.
(function () {
  const M = window.MCAP, C = M.C;
  const f1 = v => (+v).toFixed(1);
  const lin = (n, lo, hi) => Array.from({ length: n }, (_, i) => lo + (hi - lo) * i / (n - 1));

  // ---------------------------------------------------------- thermometer
  function thermometer(val, lo, hi, title, color, dec = 1) {
    const v = Math.min(hi, Math.max(lo, val));
    const fr = (v - lo) / (hi - lo);
    const ty = 22, tb = 132, cx = 44, hw = 9;
    const yOf = t => tb - (t - lo) / (hi - lo) * (tb - ty);
    const fillY = yOf(v);
    const ticks = lin(5, lo, hi).map(t =>
      `<line x1="${cx + hw + 3}" x2="${cx + hw + 8}" y1="${yOf(t).toFixed(1)}" y2="${yOf(t).toFixed(1)}" stroke="${C.rule}"/>` +
      `<text x="${cx + hw + 12}" y="${(yOf(t) + 3.5).toFixed(1)}" class="tk">${+t.toFixed(2)}</text>`).join("");
    const zero = lo < 0 && hi > 0
      ? `<line x1="${cx - hw - 6}" x2="${cx + hw + 6}" y1="${yOf(0).toFixed(1)}" y2="${yOf(0).toFixed(1)}" stroke="${C.muted}" stroke-dasharray="3 2"/>` : "";
    return `<svg viewBox="0 0 120 190" class="therm" role="img" aria-label="${M.esc(title)} ${v.toFixed(dec)} on a scale of ${lo} to ${hi}">
<text x="60" y="12" class="pt">${M.esc(title)}</text>
<rect x="${cx - hw}" y="${ty}" width="${2 * hw}" height="${tb - ty}" rx="${hw}" fill="${C.track}" stroke="${C.rule}"/>
<rect x="${cx - hw + 2}" y="${fillY.toFixed(1)}" width="${2 * hw - 4}" height="${(tb - fillY + 6).toFixed(1)}" rx="${hw - 2}" fill="${color}"/>
<circle cx="${cx}" cy="${tb + 10}" r="15" fill="${color}" stroke="${C.rule}"/>
${ticks}${zero}
<text x="60" y="182" class="tv" fill="${color}">${v.toFixed(dec)}</text>
</svg>`;
  }

  // ---------------------------------------------------------- big numbers
  function readout(title, value, note) {
    return `<div class="read"><span>${M.esc(title)}</span>
<strong class="cond" style="color:${M.marginColor(value)}">${M.fmtMargin(value)}</strong><em>${M.esc(note)}</em></div>`;
  }

  // ---------------------------------------------------------- education
  function education(series, county, lastActual, W = 420) {
    const H = 220, L = 40, R = 38, T = 18, B = 28;
    const yrs = series.map(r => r[0]), c = series.map(r => r[1]), s = series.map(r => r[2]);
    const y0 = yrs[0], y1 = yrs[yrs.length - 1];
    const lo = Math.floor(Math.min(...c, ...s) / 2) * 2, hi = Math.ceil(Math.max(...c, ...s) / 2) * 2;
    const X = y => L + (y - y0) / (y1 - y0) * (W - L - R);
    const Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const poly = (vals, keep) => yrs.map((y, i) => keep(y) ? `${X(y).toFixed(1)},${Y(vals[i]).toFixed(1)}` : null).filter(Boolean).join(" ");
    const act = y => y <= lastActual, prj = y => y >= lastActual;
    let grid = "";
    for (let g = lo; g <= hi; g += 2)
      grid += `<line x1="${L}" x2="${W - R}" y1="${Y(g).toFixed(1)}" y2="${Y(g).toFixed(1)}" stroke="${C.rule}"/><text x="${L - 6}" y="${(Y(g) + 3.5).toFixed(1)}" class="tk" text-anchor="end">${g}%</text>`;
    const xt = [y0, y0 + 4, y0 + 8, y0 + 12, y1].filter(y => y <= y1).map(y => `<text x="${X(y).toFixed(1)}" y="${H - 8}" class="tk" text-anchor="middle">${y}</text>`).join("");
    const band = y1 > lastActual
      ? `<rect x="${X(lastActual).toFixed(1)}" y="${T}" width="${(X(y1) - X(lastActual)).toFixed(1)}" height="${H - T - B}" fill="#EEF1F5"/><text x="${(X(lastActual) + 5).toFixed(1)}" y="${H - B - 6}" class="tk">projected</text>` : "";
    const cl = c[c.length - 1], sl = s[s.length - 1];
    const close = Math.abs(Y(cl) - Y(sl)) < 11;
    const clY = close && cl >= sl ? Y(cl) - 5 : Y(cl);
    const slY = close && sl > cl ? Y(sl) + 5 : Y(sl);
    return `<div class="panel"><h3>Education attainment</h3><p>Bachelor's degree or higher, county vs state, ${y0}–${y1}</p>
<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Education line chart">${band}${grid}${xt}
<polyline points="${poly(s, act)}" fill="none" stroke="${C.muted}" stroke-width="2"/>
<polyline points="${poly(s, prj)}" fill="none" stroke="${C.muted}" stroke-width="2" stroke-dasharray="5 4"/>
<polyline points="${poly(c, act)}" fill="none" stroke="${C.teal}" stroke-width="2.6"/>
<polyline points="${poly(c, prj)}" fill="none" stroke="${C.teal}" stroke-width="2.6" stroke-dasharray="5 4"/>
<circle cx="${X(y1).toFixed(1)}" cy="${Y(cl).toFixed(1)}" r="3.5" fill="${C.teal}"/><text x="${(X(y1) + 7).toFixed(1)}" y="${(clY + 4).toFixed(1)}" class="tv2" fill="${C.teal}">${Math.round(cl)}%</text>
<circle cx="${X(y1).toFixed(1)}" cy="${Y(sl).toFixed(1)}" r="3.5" fill="${C.muted}"/><text x="${(X(y1) + 7).toFixed(1)}" y="${(slY + 4).toFixed(1)}" class="tk">${Math.round(sl)}%</text>
<line x1="${L}" x2="${L + 18}" y1="${T + 4}" y2="${T + 4}" stroke="${C.teal}" stroke-width="2.6"/><text id="lbl1" x="${L + 24}" y="${T + 8}" class="tk">${M.esc(county)} County</text>
<line id="lbl2line" x1="0" x2="0" y1="${T + 4}" y2="${T + 4}" stroke="${C.muted}" stroke-width="2"/><text id="lbl2" x="0" y="${T + 8}" class="tk">State average</text>
</svg></div>`;
  }

  // ---------------------------------------------------------- historic margins
  function historic(series) {
    const W = 420, H = 220, L = 40, R = 18, T = 22, B = 28;
    const yrs = series.map(r => r[0]), m = series.map(r => r[1]);
    const y0 = yrs[0], y1 = yrs[yrs.length - 1];
    const lim = Math.ceil((Math.max(...m.map(Math.abs)) + 3) / 5) * 5;
    const X = y => L + (y - y0) / (y1 - y0) * (W - L - R);
    const Y = v => T + (lim - v) / (2 * lim) * (H - T - B);
    const pts = yrs.map((y, i) => `${X(y).toFixed(1)},${Y(m[i]).toFixed(1)}`).join(" ");
    const area = `${X(y0).toFixed(1)},${Y(0).toFixed(1)} ${pts} ${X(y1).toFixed(1)},${Y(0).toFixed(1)}`;
    let grid = "";
    for (let g = -lim; g <= lim; g += 5)
      grid += `<line x1="${L}" x2="${W - R}" y1="${Y(g).toFixed(1)}" y2="${Y(g).toFixed(1)}" stroke="${C.rule}"/><text x="${L - 6}" y="${(Y(g) + 3.5).toFixed(1)}" class="tk" text-anchor="end">${g === 0 ? "Even" : Math.abs(g) + (g > 0 ? "D" : "R")}</text>`;
    const dots = yrs.map((y, i) => {
      const v = m[i], col = v >= 0 ? C.dem : C.rep;
      return `<circle cx="${X(y).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4" fill="${col}" stroke="#fff" stroke-width="1.5"/>` +
        `<text x="${X(y).toFixed(1)}" y="${(Y(v) + (v >= 0 ? -9 : 15)).toFixed(1)}" class="tv2" text-anchor="middle" fill="${col}">${Math.abs(Math.round(v))}${v >= 0 ? "D" : "R"}</text>`;
    }).join("");
    const xt = yrs.map(y => `<text x="${X(y).toFixed(1)}" y="${H - 8}" class="tk" text-anchor="middle">${y}</text>`).join("");
    const id = "h" + Math.random().toString(36).slice(2, 7);
    return `<div class="panel"><h3>Historic margins</h3><p>Result by cycle, ${y0}–${y1}</p>
<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Historic margin line chart">${grid}
<defs><clipPath id="${id}u"><rect x="0" y="0" width="${W}" height="${Y(0).toFixed(1)}"/></clipPath><clipPath id="${id}d"><rect x="0" y="${Y(0).toFixed(1)}" width="${W}" height="${H}"/></clipPath></defs>
<polygon points="${area}" fill="${C.dem}" opacity=".16" clip-path="url(#${id}u)"/><polygon points="${area}" fill="${C.rep}" opacity=".16" clip-path="url(#${id}d)"/>
<line x1="${L}" x2="${W - R}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="${C.muted}" stroke-width="1.2"/>
<polyline points="${pts}" fill="none" stroke="${C.ink}" stroke-width="2"/>${dots}${xt}</svg></div>`;
  }

  // ---------------------------------------------------------- enthusiasm
  function enthusiasm(r) {
    const W = 420, H = 220, L = 40, T = 34, B = 28;
    const d = [r.turnout_d_2024, r.turnout_d_2026], rp = [r.turnout_r_2024, r.turnout_r_2026];
    const top = Math.max(...d, ...rp) * 1.25;
    const Y = v => T + (top - v) / top * (H - T - B);
    let out = "";
    ["2024", "2026"].forEach((yr, i) => {
      const gx = L + 60 + i * 180;
      [[d[i], C.dem], [rp[i], C.rep]].forEach(([v, col], k) => {
        const x = gx + k * 46;
        out += `<rect x="${x}" y="${Y(v).toFixed(1)}" width="40" height="${(Y(0) - Y(v)).toFixed(1)}" fill="${col}"/><text x="${x + 20}" y="${(Y(v) - 5).toFixed(1)}" class="tv2" text-anchor="middle">${Math.round(v)}%</text>`;
      });
      const gap = d[i] - rp[i];
      out += `<text x="${gx + 43}" y="${H - 8}" class="tk" text-anchor="middle">${yr}</text>`;
      out += `<text x="${gx + 43}" y="${T - 8}" class="tv2" text-anchor="middle" fill="${gap >= 0 ? C.dem : C.rep}">gap ${Math.abs(gap).toFixed(1)} ${gap >= 0 ? "D" : "R"}</text>`;
    });
    let grid = "";
    for (let g = 0; g < top; g += 20)
      grid += `<line x1="${L}" x2="${W - 8}" y1="${Y(g).toFixed(1)}" y2="${Y(g).toFixed(1)}" stroke="${C.rule}"/><text x="${L - 6}" y="${(Y(g) + 3.5).toFixed(1)}" class="tk" text-anchor="end">${g}%</text>`;
    return `<div class="panel"><h3>Enthusiasm</h3><p>Party turnout rate, 2024 and 2026</p>
<div class="key"><span><i style="background:${C.dem}"></i>Democratic</span><span><i style="background:${C.rep}"></i>Republican</span></div>
<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Turnout bar chart">${grid}${out}</svg></div>`;
  }

  // ---------------------------------------------------------- registration
  function registration(r) {
    const W = 420, H = 220, L = 46, T = 34, B = 28;
    const vals = [["Dem", r.reg_net_d, C.dem], ["Rep", r.reg_net_r, C.rep], ["Ind / other", r.reg_net_i, C.ind]];
    const vmax = Math.max(0, ...vals.map(v => v[1])), vmin = Math.min(0, ...vals.map(v => v[1]));
    const hi = (vmax || 1) * 1.25, lo = vmin - hi * 0.12;
    const Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const out = vals.map(([n, v, c], i) => {
      const x = L + 40 + i * 118;
      return `<rect x="${x}" y="${Math.min(Y(v), Y(0)).toFixed(1)}" width="60" height="${Math.abs(Y(0) - Y(v)).toFixed(1)}" fill="${c}"/>` +
        `<text x="${x + 30}" y="${(v >= 0 ? Y(v) - 5 : Y(v) + 13).toFixed(1)}" class="tv2" text-anchor="middle">${M.fmtInt(v)}</text>` +
        `<text x="${x + 30}" y="${H - 8}" class="tk" text-anchor="middle">${n}</text>`;
    }).join("");
    const step = niceStep(hi - lo);
    let grid = "";
    for (let g = Math.ceil(lo / step) * step; g <= hi; g += step)
      grid += `<line x1="${L}" x2="${W - 8}" y1="${Y(g).toFixed(1)}" y2="${Y(g).toFixed(1)}" stroke="${C.rule}"/><text x="${L - 6}" y="${(Y(g) + 3.5).toFixed(1)}" class="tk" text-anchor="end">${(Math.round(g) || 0).toLocaleString("en-US")}</text>`;
    const lead = Math.abs(r.reg_net_d) >= Math.abs(r.reg_net_r) ? [r.reg_net_d, "D"] : [r.reg_net_r, "R"];
    return `<div class="panel"><h3>Registration trend</h3><p>Net change, trailing four years</p>
<div class="velo"><span>Velocity leader</span><strong class="cond" style="color:${lead[1] === "D" ? C.dem : C.rep}">+${Math.abs(lead[0]).toLocaleString("en-US")} ${lead[1]}</strong></div>
<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Registration change bar chart">${grid}<line x1="${L}" x2="${W - 8}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="${C.muted}"/>${out}</svg></div>`;
  }
  function niceStep(span) {
    const raw = span / 5, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  }

  // ---------------------------------------------------------- vulnerability
  function vulnerability(r) {
    const col = M.vulnColorFor(r.vulcomposite);
    const sign = r.vulcomposite > 0 ? "+" : r.vulcomposite < 0 ? "\u2212" : "";
    return `<div class="panel vul"><div><h3>Economic vulnerability</h3><p>Composite Economic Vulnerability Score (CEVS) and local anxiety risk tier</p></div>
<strong class="cond" style="color:${col}">${sign}${Math.abs(r.vulcomposite).toFixed(2)}</strong><span class="sub">z-score vs<br>state average</span>
<div class="tier" style="background:${col}">${M.esc(r.anxiety_tier)}</div></div>`;
  }

  // ---------------------------------------------------------- header + composition
  function header(c, r, kind) {
    return `<div class="dhead" style="--kind:${M.kindColor(kind)}">
<h2 class="cond">${M.esc(c.name)} County</h2>
<div class="meta">FIPS ${c.fips}, PennDOT ${c.penndot}</div>
<div class="kind">${kind} county</div>
<button class="btn" type="button" data-act="print">Print dashboard</button>
</div>`;
  }

  function topRow(r) {
    return `<div class="row top">
${thermometer(r.logpwd, 0, 10, "Population density", C.teal)}
${thermometer(r.elasticity, 0, 2, "Elasticity", C.elastic, 2)}
${thermometer(r.macrotide, -5, 5, "National mood", r.macrotide >= 0 ? C.dem : C.rep)}
${readout("Base margin", r.basemarg, "before the national tide")}
${readout("Projected margin, 2028", r.projmarg, M.swingText(r.basemarg, r.projmarg))}
</div>`;
  }

  function dashboard(c, data) {
    const r = data.metrics[c.name], kind = M.classify(r.projmarg);
    const edu = data.education[c.name] || [], his = data.historic[c.name] || [];
    let html = header(c, r, kind) + topRow(r);
    if (kind === "Purple") {
      html += `<div class="row two">${education(edu, c.name, data.meta.edu_last_actual)}${historic(his)}</div>`;
      html += `<div class="row two">${enthusiasm(r)}${registration(r)}</div>`;
      html += vulnerability(r);
      html += `<div class="note">Purple county: projected margin inside ${M.PURPLE_BAND} points, so all panels are shown. Margins are percentage points, positive = Democratic.</div>`;
    } else {
      html += `<div class="row">${education(edu, c.name, data.meta.edu_last_actual, 860)}</div>`;
      html += `<div class="note">${kind} county: projected margin beyond ${M.PURPLE_BAND} points. Margins are percentage points, positive = Democratic.</div>`;
    }
    return html;
  }

  // Statewide summary shown before a county is selected.
  function statewide(data) {
    const rows = data.counties.map(c => ({ name: c.name, m: data.metrics[c.name].projmarg }));
    const n = { Blue: 0, Purple: 0, Red: 0 };
    rows.forEach(r => n[M.classify(r.m)]++);
    const closest = rows.slice().sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 12);
    const maxAbs = Math.max(...closest.map(r => Math.abs(r.m)), 1);
    const li = closest.map(r => {
      const w = Math.abs(r.m) / maxAbs * 50, col = M.marginColor(r.m);
      const bar = r.m >= 0 ? `left:50%;width:${w}%;background:${col}` : `right:50%;width:${w}%;background:${col}`;
      return `<li><button type="button" data-county="${M.esc(r.name)}">${M.esc(r.name)}</button><span class="bar"><i style="${bar}"></i></span><span class="m" style="color:${col}">${M.fmtMargin(r.m)}</span></li>`;
    }).join("");
    return `<div class="state">
<h2 class="cond">Pennsylvania, 2028 projection</h2>
<p class="lead">${data.counties.length} counties classified on projected margin. Click a county on the map, pick one from the list, or use the search box to open its dashboard.</p>
<div class="kpis">
<div class="kpi" style="--k:${C.dem}"><strong class="cond">${n.Blue}</strong><span>Blue counties</span></div>
<div class="kpi" style="--k:${C.pur}"><strong class="cond">${n.Purple}</strong><span>Purple counties, inside ${M.PURPLE_BAND} points</span></div>
<div class="kpi" style="--k:${C.rep}"><strong class="cond">${n.Red}</strong><span>Red counties</span></div>
</div>
<div class="panel"><h3>Closest counties</h3><p>Smallest projected margins, either direction</p><ul class="closest">${li}</ul></div>
</div>`;
  }

  M.panels = { dashboard, statewide };
})();
