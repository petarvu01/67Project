"""
Build data/mcap_data.js for the MCAP Pennsylvania site.

    python tools/build_data.py                        # uses tools/demo_input/*.csv
    python tools/build_data.py --input master.xlsx     # the MCAP master workbook
    python tools/build_data.py --input path/to/dir     # three plain CSVs instead
    python tools/build_data.py --flip-sign             # source uses +R / -D

Two input shapes are supported:

1. The MCAP master workbook (sheets: Master, Enthusiasm, Registration,
   VulComposite, Historic Margins, ...). Detected automatically when the
   input file has a sheet named "Master". Cycle 2028 in the Master sheet is
   read as the current snapshot (LOGPWD, ELASTICITY, MACROTIDE, BASEMARG,
   PROJMARG); all cycles feed the education line. Margins, education shares
   and the national-mood impact are stored as fractions in the workbook
   (e.g. -0.27) and are multiplied by 100 here to display as points/percent.
   The vulnerability composite (CEVS) is a z-score, not 0-100, and the
   anxiety tier is whatever label the sheet assigns (11 distinct labels
   appear in the source) - both are shown as given.

2. Three plain tables (CSV files in a folder, or three sheets in a workbook
   with no "Master" sheet), named county_metrics / education_series /
   historic_margins. This is the simpler shape documented in README.md,
   useful for hand-built or partial data.

Either way the tool validates that all 67 counties are present and every
county has the same set of cycles, then writes a single JS file the page
loads with a <script> tag - so the site works on GitHub Pages and opened
straight from disk.
"""

import argparse, json, math, os, re, sys
from datetime import date

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GEOJSON = os.path.join(HERE, "pa_counties.geojson")
OUT = os.path.join(ROOT, "data", "mcap_data.js")

EDU_YEARS = list(range(2012, 2029))
HIST_YEARS = list(range(2012, 2025, 2))

# canonical name -> accepted aliases (normalised: lowercase, no spaces/_/%)
METRIC_COLS = {
    "county": ["county", "countyname", "name"],
    "logpwd": ["logpwd", "populationdensityscore", "density"],
    "elasticity": ["elasticity", "elasticityscore"],
    "macrotide": ["macrotide", "nationalmoodimpact", "nationalmood"],
    "basemarg": ["basemarg", "basemargin"],
    "projmarg": ["projmarg", "projectedmargin", "projectedmargin2028"],
    "vulcomposite": ["vulcomposite", "economicvulnerability", "compositeeconomicscore"],
    "anxiety_tier": ["anxietytier", "localanxietyrisktier", "risktier", "tier"],
    "turnout_d_2024": ["turnoutd2024", "demturnout2024", "democraticturnout2024"],
    "turnout_r_2024": ["turnoutr2024", "repturnout2024", "republicanturnout2024"],
    "turnout_d_2026": ["turnoutd2026", "demturnout2026", "democraticturnout2026"],
    "turnout_r_2026": ["turnoutr2026", "repturnout2026", "republicanturnout2026"],
    "reg_net_d": ["regnetd", "netd", "registrationnetd", "netdemocratic"],
    "reg_net_r": ["regnetr", "netr", "registrationnetr", "netrepublican"],
    "reg_net_i": ["regneti", "neti", "netiother", "registrationneti", "netindependent"],
}
EDU_COLS = {
    "county": ["county", "countyname"], "year": ["year"],
    "cnty_edu_pct": ["cntyedupct", "cntyedu", "countyedu", "countyeducation"],
    "st_edu_pct": ["stedupct", "stedu", "stateedu", "stateeducation"],
}
HIST_COLS = {
    "county": ["county", "countyname"], "year": ["year"],
    "margin": ["margin", "historicmargin", "result"],
}
RANGES = {"logpwd": (0, 10), "elasticity": (0, 2), "macrotide": (-5, 5),
          "vulcomposite": (0, 100), "turnout_d_2024": (0, 100), "turnout_r_2024": (0, 100),
          "turnout_d_2026": (0, 100), "turnout_r_2026": (0, 100)}
TIERS = ["Low", "Moderate", "Elevated", "High"]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def pick(df, spec, table):
    """Rename df columns to canonical names using the alias table."""
    have = {norm(c): c for c in df.columns}
    out, missing = {}, []
    for canon, aliases in spec.items():
        for a in [canon] + aliases:
            if norm(a) in have:
                out[canon] = have[norm(a)]
                break
        else:
            missing.append(canon)
    if missing:
        sys.exit(f"[{table}] missing columns: {', '.join(missing)}\n"
                 f"   found: {', '.join(df.columns)}")
    return df[list(out.values())].rename(columns={v: k for k, v in out.items()})


def read_table(src, name):
    if os.path.isdir(src):
        for ext in ("csv", "xlsx"):
            p = os.path.join(src, f"{name}.{ext}")
            if os.path.exists(p):
                return pd.read_csv(p) if ext == "csv" else pd.read_excel(p)
        sys.exit(f"could not find {name}.csv or {name}.xlsx in {src}")
    # single workbook with three sheets
    xl = pd.ExcelFile(src)
    sheet = next((s for s in xl.sheet_names if norm(s) == norm(name)), None)
    if sheet is None:
        sys.exit(f"workbook has no sheet named {name}; sheets: {xl.sheet_names}")
    return xl.parse(sheet)


# --------------------------------------------------------------- geometry
def project_paths():
    gj = json.load(open(GEOJSON, encoding="utf-8"))
    k = math.cos(math.radians(41.0))
    pts = []
    for f in gj["features"]:
        g = f["geometry"]
        rings = g["coordinates"] if g["type"] == "Polygon" else [r for p in g["coordinates"] for r in p]
        for r in rings:
            pts += [(x * k, y) for x, y in r]
    xs, ys = zip(*pts)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    W = 1000.0
    H = round(W * (y1 - y0) / (x1 - x0), 1)

    def P(lon, lat):
        return ((lon * k - x0) / (x1 - x0) * W, (y1 - lat) / (y1 - y0) * H)

    counties = []
    for f in gj["features"]:
        g, pr = f["geometry"], f["properties"]
        rings = g["coordinates"] if g["type"] == "Polygon" else [r for p in g["coordinates"] for r in p]
        d = ""
        for r in rings:
            for i, (lon, lat) in enumerate(r):
                x, y = P(lon, lat)
                d += f"{'M' if i == 0 else 'L'}{x:.1f} {y:.1f}"
            d += "Z"
        cx, cy = P(pr["CENTROID_LON"], pr["CENTROID_LAT"])
        counties.append({"name": pr["COUNTY_NAME"], "fips": pr["FIPS_CODE"],
                         "penndot": pr["PENNDOT_CODE"], "path": d,
                         "cx": round(cx, 1), "cy": round(cy, 1)})
    return counties, W, H


# --------------------------------------------------------------- master workbook
def is_master_workbook(path):
    if not (os.path.isfile(path) and path.lower().endswith((".xlsx", ".xlsm"))):
        return False
    try:
        return "Master" in pd.ExcelFile(path).sheet_names
    except Exception:
        return False


def clean_names(df):
    """Find the county-name column regardless of case, rename it to 'County'."""
    col = next(c for c in df.columns if norm(c) == "county")
    if col != "County":
        df = df.rename(columns={col: "County"})
    df = df[df["County"].notna()].copy()
    df["County"] = df["County"].astype(str).str.strip()
    return df[df["County"].str.len() > 0]


def build_from_master_workbook(path, names, flip):
    sign = -1.0 if flip else 1.0
    xl = pd.ExcelFile(path)
    master = clean_names(xl.parse("Master"))
    hist = clean_names(xl.parse("Historic Margins"))
    enth = clean_names(xl.parse("Enthusiasm"))
    reg = clean_names(xl.parse("Registration"))
    vul = clean_names(xl.parse("VulComposite"))

    cycles = sorted(master["CYCLE"].unique())
    last_cycle, last_actual = cycles[-1], cycles[-2]  # 2028 snapshot, 2024 last actual
    snap = master[master["CYCLE"] == last_cycle].set_index("County")

    problems = []
    for label, df in (("Master", master), ("Historic Margins", hist),
                      ("Enthusiasm", enth), ("Registration", reg), ("VulComposite", vul)):
        have = set(df["County"])
        missing, extra = sorted(set(names) - have), sorted(have - set(names))
        if missing:
            problems.append(f"{label}: no rows for {', '.join(missing)}")
        if extra:
            problems.append(f"{label}: unknown counties {', '.join(extra)}")
    if problems:
        print("Validation failed:\n  - " + "\n  - ".join(problems))
        sys.exit(1)

    reg_i = reg.set_index("County")
    enth_i = enth.set_index("County")
    vul_i = vul.set_index("County")

    metrics = {}
    for name in names:
        s, r, e, v = snap.loc[name], reg_i.loc[name], enth_i.loc[name], vul_i.loc[name]
        metrics[name] = {
            "logpwd": round(float(s["LOGPWD"]), 2),
            "elasticity": round(float(s["ELASTICITY"]), 2),
            "macrotide": round(float(s["MACROTIDE"]) * 100 * sign, 2),
            "basemarg": round(float(s["BASEMARG"]) * 100 * sign, 1),
            "projmarg": round(float(s["PROJMARG"]) * 100 * sign, 1),
            "vulcomposite": round(float(v["Composite Economic Score (CEVS)"]), 2),
            "anxiety_tier": str(v["Local Anxiety Risk Tier"]).strip(),
            "turnout_d_2024": round(float(e["2024 Dem Turnout %"]) * 100, 1),
            "turnout_r_2024": round(float(e["2024 Rep Turnout %"]) * 100, 1),
            "turnout_d_2026": round(float(e["2026 Dem Turnout %"]) * 100, 1),
            "turnout_r_2026": round(float(e["2026 Rep Turnout %"]) * 100, 1),
            "reg_net_d": int(round(float(r["Net Dem Change"]))),
            "reg_net_r": int(round(float(r["Net Rep Change"]))),
            "reg_net_i": int(round(float(r["Net Independent/Other Change"]))),
        }

    edu_out = {}
    for name, g in master.groupby("County"):
        g = g.sort_values("CYCLE")
        edu_out[name] = [[int(c), round(float(ce) * 100, 1), round(float(se) * 100, 1)]
                         for c, ce, se in g[["CYCLE", "CNTYEDU%", "STEDU%"]].values]

    his_out = {}
    for name, g in hist.groupby("County"):
        g = g.sort_values("Cycle")
        his_out[name] = [[int(c), round(float(m) * 100 * sign, 1)]
                         for c, m in g[["Cycle", "Margin"]].values]

    return metrics, edu_out, his_out, int(last_actual)


# --------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=os.path.join(HERE, "demo_input"))
    ap.add_argument("--flip-sign", action="store_true",
                    help="source margins use positive = Republican")
    ap.add_argument("--demo", action="store_true",
                    help="mark the output as demo data (shown as a chip on the page)")
    args = ap.parse_args()

    counties, W, H = project_paths()
    names = [c["name"] for c in counties]
    is_demo = args.demo or os.path.abspath(args.input) == os.path.join(HERE, "demo_input")

    if is_master_workbook(args.input):
        metrics, edu_out, his_out, edu_last_actual = build_from_master_workbook(
            args.input, names, args.flip_sign)
    else:
        met = pick(read_table(args.input, "county_metrics"), METRIC_COLS, "county_metrics")
        edu = pick(read_table(args.input, "education_series"), EDU_COLS, "education_series")
        his = pick(read_table(args.input, "historic_margins"), HIST_COLS, "historic_margins")

        for df in (met, edu, his):
            df["county"] = df["county"].astype(str).str.strip().str.replace(r"\s+County$", "", regex=True)

        problems = []
        for label, df in (("county_metrics", met), ("education_series", edu), ("historic_margins", his)):
            missing = sorted(set(names) - set(df["county"]))
            extra = sorted(set(df["county"]) - set(names))
            if missing:
                problems.append(f"{label}: no rows for {', '.join(missing)}")
            if extra:
                problems.append(f"{label}: unknown counties {', '.join(extra)} (check spelling)")
        if met["county"].duplicated().any():
            problems.append("county_metrics: duplicate county rows")

        for col, (lo, hi) in RANGES.items():
            bad = met[(met[col] < lo) | (met[col] > hi)]
            if not bad.empty:
                problems.append(f"county_metrics.{col}: outside {lo}..{hi} for {', '.join(bad['county'])}")
        met["anxiety_tier"] = met["anxiety_tier"].astype(str).str.strip().str.title()

        for label, df, years in (("education_series", edu, EDU_YEARS), ("historic_margins", his, HIST_YEARS)):
            cov = df.groupby("county")["year"].apply(lambda s: sorted(set(int(y) for y in s)))
            short = [c for c, ys in cov.items() if any(y not in ys for y in years)]
            if short:
                problems.append(f"{label}: incomplete years ({years[0]}-{years[-1]}) for "
                                f"{', '.join(short[:8])}{'…' if len(short) > 8 else ''}")

        if problems:
            print("Validation failed:\n  - " + "\n  - ".join(problems))
            sys.exit(1)

        sign = -1.0 if args.flip_sign else 1.0
        for col in ("basemarg", "projmarg"):
            met[col] = met[col].astype(float) * sign
        his["margin"] = his["margin"].astype(float) * sign

        metrics = {}
        for r in met.to_dict("records"):
            metrics[r["county"]] = {k: (round(float(v), 2) if isinstance(v, (int, float)) and not isinstance(v, bool)
                                        else v) for k, v in r.items() if k != "county"}
            for k in ("reg_net_d", "reg_net_r", "reg_net_i"):
                metrics[r["county"]][k] = int(round(float(r[k])))

        edu_out = {c: [[int(y), round(float(cp), 1), round(float(sp), 1)]
                       for y, cp, sp in g.sort_values("year")[["year", "cnty_edu_pct", "st_edu_pct"]].values
                       if int(y) in EDU_YEARS]
                   for c, g in edu.groupby("county")}
        his_out = {c: [[int(y), round(float(m), 1)]
                       for y, m in g.sort_values("year")[["year", "margin"]].values if int(y) in HIST_YEARS]
                   for c, g in his.groupby("county")}
        edu_last_actual = 2024

    payload = {
        "meta": {"built": date.today().isoformat(), "demo": bool(is_demo),
                 "view": [W, H], "edu_last_actual": edu_last_actual, "purple_band": 5.0},
        "counties": counties,
        "metrics": metrics,
        "education": edu_out,
        "historic": his_out,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("// generated by tools/build_data.py - do not edit by hand\n")
        fh.write("window.MCAP_DATA = ")
        json.dump(payload, fh, separators=(",", ":"))
        fh.write(";\n")
    print(f"wrote {os.path.relpath(OUT, ROOT)}  ({os.path.getsize(OUT) // 1024} KB, "
          f"{len(metrics)} counties, demo={is_demo})")


if __name__ == "__main__":
    main()
