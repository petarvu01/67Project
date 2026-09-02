// Wires the map, tabs, search and dashboard together.
(function () {
  const M = window.MCAP, data = window.MCAP_DATA;
  if (!data) { document.getElementById("dash").innerHTML = "<p>data/mcap_data.js is missing. Run tools/build_data.py.</p>"; return; }

  const $ = id => document.getElementById(id);
  const svg = $("map"), dash = $("dash"), tip = $("tip"), tabs = $("tabs"), search = $("search");
  const byName = Object.fromEntries(data.counties.map(c => [c.name, c]));
  const specs = M.map.metrics(data);
  const counts = { Blue: 0, Purple: 0, Red: 0 };
  data.counties.forEach(c => counts[M.classify(data.metrics[c.name].projmarg)]++);

  const state = { metric: "projmarg", county: null };

  // ---------------------------------------------------------- map
  const { paths, zoom, refreshSelection } = M.map.build(svg, data, name => state.county === name ? clear() : select(name));

  $("zoomIn").addEventListener("click", () => zoom.in());
  $("zoomOut").addEventListener("click", () => zoom.out());
  $("zoomReset").addEventListener("click", () => zoom.reset());

  function paint() {
    const spec = specs[state.metric];
    data.counties.forEach(c => {
      const r = data.metrics[c.name];
      paths[c.name].setAttribute("fill", spec.color(spec.value(r)));
    });
    $("mapTitle").textContent = spec.title;
    $("mapSub").textContent = spec.sub + ". Hover for the number, click a county to open its dashboard.";
    $("legend").innerHTML = M.map.legendHtml(spec, counts);
    tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.key === state.metric));
  }

  // tooltip
  svg.addEventListener("mousemove", e => {
    const p = e.target.closest(".cty");
    if (!p) { tip.style.display = "none"; return; }
    const r = data.metrics[p.dataset.n], spec = specs[state.metric];
    const main = spec.tip ? spec.tip(r) : `${spec.title}: ${(+spec.value(r)).toFixed(2)}`;
    const extra = spec.tip ? "" : ` · ${M.fmtMargin(r.projmarg)}`;
    tip.innerHTML = `<b>${M.esc(p.dataset.n)} County</b>${M.esc(main)} · ${M.classify(r.projmarg)}${extra}`;
    tip.style.display = "block";
    const x = Math.min(e.clientX + 14, window.innerWidth - 240), y = e.clientY + 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });
  svg.addEventListener("mouseleave", () => { tip.style.display = "none"; });

  // ---------------------------------------------------------- tabs
  M.map.TABS.forEach(([key, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.key = key; b.textContent = label; b.setAttribute("role", "tab");
    b.addEventListener("click", () => { state.metric = key; paint(); writeHash(); });
    tabs.appendChild(b);
  });

  // ---------------------------------------------------------- search
  const dl = $("countyList");
  data.counties.map(c => c.name).sort().forEach(n => { const o = document.createElement("option"); o.value = n; dl.appendChild(o); });
  function trySearch() {
    const q = search.value.trim().toLowerCase().replace(/\s+county$/, "");
    if (!q) return;
    const hit = data.counties.find(c => c.name.toLowerCase() === q) ||
                data.counties.find(c => c.name.toLowerCase().startsWith(q));
    if (hit) { select(hit.name); search.value = ""; search.blur(); }
  }
  search.addEventListener("change", trySearch);
  search.addEventListener("keydown", e => { if (e.key === "Enter") trySearch(); });

  // ---------------------------------------------------------- selection
  function select(name) {
    if (!byName[name]) return;
    state.county = name;
    Object.values(paths).forEach(p => p.classList.remove("sel"));
    const p = paths[name];
    p.classList.add("sel");
    p.parentNode.appendChild(p);              // draw selected outline on top
    refreshSelection();
    dash.innerHTML = M.panels.dashboard(byName[name], data);
    positionEduLegend();
    document.title = `${name} County — Pennsylvania county outlook`;
    writeHash();
    if (window.innerWidth <= 1100) dash.scrollIntoView({ block: "start" });
  }
  function clear() {
    state.county = null;
    Object.values(paths).forEach(p => p.classList.remove("sel"));
    refreshSelection();
    dash.innerHTML = M.panels.statewide(data);
    document.title = "Pennsylvania county outlook — MCAP";
    writeHash();
  }

  dash.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.county) select(b.dataset.county);
    if (b.dataset.act === "print") window.print();
    if (b.dataset.act === "clear") clear();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && state.county) clear(); });

  $("mapPng").addEventListener("click", () => {
    M.map.downloadPng(svg, `pa_${state.metric}${state.county ? "_" + state.county : ""}.png`);
  });

  // Legend label 2 follows label 1's rendered width, so it never overlaps
  // regardless of county name length (measured, not estimated).
  function positionEduLegend() {
    dash.querySelectorAll('svg.chart').forEach(svg => {
      const t1 = svg.querySelector('#lbl1'), l2 = svg.querySelector('#lbl2line'), t2 = svg.querySelector('#lbl2');
      if (!t1 || !l2 || !t2) return;
      const x = t1.getBBox().x + t1.getBBox().width + 14;
      l2.setAttribute('x1', x); l2.setAttribute('x2', x + 18);
      t2.setAttribute('x', x + 24);
    });
  }

  // ---------------------------------------------------------- URL hash
  function writeHash() {
    const parts = [];
    if (state.metric !== "projmarg") parts.push("view=" + state.metric);
    if (state.county) parts.push("county=" + encodeURIComponent(state.county));
    const h = parts.length ? "#" + parts.join("&") : "";
    if (h !== location.hash) history.replaceState(null, "", location.pathname + location.search + h);
  }
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    const v = q.get("view"), c = q.get("county");
    if (v && specs[v]) state.metric = v;
    paint();
    if (c && byName[c]) select(c); else clear();
  }
  window.addEventListener("hashchange", readHash);

  // ---------------------------------------------------------- boot
  if (data.meta.demo) $("demoChip").hidden = false;
  readHash();
})();
