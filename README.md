# MCAP — Pennsylvania county outlook

Live county map and dashboards for the MCAP 2028 model. Static site: plain
HTML, CSS and JavaScript, no build step, no server, no external libraries.
Hosts on GitHub Pages; also runs by double-clicking `index.html`.

## Deploy on GitHub Pages

1. Create a repository (say `mcap-pa`) and push this folder to `main`.
2. Repository → Settings → Pages → Source: *Deploy from a branch* → `main`, `/ (root)` → Save.
3. After about a minute the site is at `https://<username>.github.io/mcap-pa/`.

Every later data update is: run the build tool, commit, push.

## Using the site

- Tabs switch what the map is colored by: projected margin, red/blue/purple
  classification, swing (base → projected), density, elasticity, vulnerability.
- Hover a county for its value; click it (or use the search box, or the
  "closest counties" list) to open its dashboard. Esc returns to the
  statewide view.
- The dashboard follows `MCAP__Dashboard_Variables.docx`. Red and blue
  counties show the top row and education; purple counties (projected margin
  inside 5 points) add enthusiasm, registration, vulnerability and historic
  margins.
- The URL tracks the state (`#view=swing&county=Erie`), so a link opens the
  page on a specific county and view.
- *Download map* saves the current map as PNG. *Print dashboard* prints the
  dashboard alone (choose "Save as PDF" in the print dialog for a file).

## Loading your data

Put the three tables in a folder (or three sheets in one workbook) and run:

```
pip install pandas openpyxl
python tools/build_data.py --input path/to/folder      # or path/to/workbook.xlsx
```

The tool checks every county is present, values are inside their scales and
years are complete, then writes `data/mcap_data.js`. Commit that file. If the
source uses positive = Republican, add `--flip-sign`.

Column names are matched loosely (case, spaces and underscores ignored). Any
of the aliases in `tools/build_data.py` work; the canonical names are:

**county_metrics** — one row per county

| column | meaning | scale |
| --- | --- | --- |
| county | county name, without "County" | matches the map |
| logpwd | Population Density Score | 0–10 |
| elasticity | Elasticity Score | 0–2 |
| macrotide | National Mood Impact | −5 to 5 |
| basemarg | Base Margin, points | +D / −R |
| projmarg | Projected Margin 2028, points | +D / −R |
| vulcomposite | Economic Vulnerability composite | 0–100 |
| anxiety_tier | Local Anxiety Risk Tier | Low, Moderate, Elevated, High |
| turnout_d_2024, turnout_r_2024 | party turnout rate 2024 | % |
| turnout_d_2026, turnout_r_2026 | party turnout rate 2026 | % |
| reg_net_d, reg_net_r, reg_net_i | net registration change, D / R / I-other | registrants |

**education_series** — one row per county-year, 2012–2028

| column | meaning |
| --- | --- |
| county, year | |
| cnty_edu_pct | CNTYEDU%, county attainment |
| st_edu_pct | STEDU%, state attainment |

**historic_margins** — one row per county-cycle, 2012, 2014 … 2024

| column | meaning |
| --- | --- |
| county, year | |
| margin | result, points, +D / −R |

`tools/demo_input/` holds fabricated sample tables in exactly this shape. The
page shows a "Demo data" chip while it is built from them; it disappears when
you build from your own input.

## Layout of the repo

```
index.html          page
css/style.css
js/colors.js        palette, margin ramp, formatting
js/panels.js        dashboard panels (SVG) and statewide summary
js/map.js           choropleth, legend, PNG export
js/app.js           state, tabs, search, URL hash
data/mcap_data.js   generated: geometry + all three tables
tools/build_data.py data build and validation
tools/pa_counties.geojson   US Census county boundaries with FIPS / PennDOT codes
tools/demo_input/   sample tables
```

Boundaries are US Census county geography; the squares in
`MCAP__PA_County_GeoJSON.xlsx` are only centroid boxes and are not used.
Margins are percentage points, positive = Democratic, throughout.
