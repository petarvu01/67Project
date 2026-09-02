"""
MCAP Pennsylvania dashboard builder.

    python run_mcap.py                       # statewide maps + sample counties
    python run_mcap.py --county Erie         # one county dashboard
    python run_mcap.py --all-counties        # all 67 dashboards
    python run_mcap.py --regenerate-data     # rebuild the demo CSVs
    python run_mcap.py --maps-only

Outputs land in ./output as PNG (add --pdf for a combined PDF).
"""

import argparse
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.colors import LinearSegmentedColormap

import mcap_data as data
import mcap_dashboard as dash
import mcap_geo as geo
import mcap_maps as maps
from mcap_theme import (ACCENT, CANVAS, DEM, INK, INK_SOFT, REP, apply_theme,
                        classify_county, format_margin, margin_color)

HERE = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(HERE, "output")

DENSITY_CMAP = LinearSegmentedColormap.from_list("dens", ["#EAF1F0", ACCENT, "#12453F"])
ELASTIC_CMAP = LinearSegmentedColormap.from_list("elas", ["#EEF0FC", "#4C6EF5", "#20307A"])
VULN_CMAP = LinearSegmentedColormap.from_list("vuln", ["#F5EFE6", "#C4761E", "#7A3E0C"])

SOURCE_NOTE = ("Boundaries: US Census county geography, joined to FIPS and "
               "PennDOT codes from MCAP__PA_County_GeoJSON.xlsx.  "
               "Values are demo data, not real results.")


def _save(fig, name, pdf=None):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f"{name}.png")
    fig.savefig(path, facecolor=CANVAS, bbox_inches=None)
    if pdf is not None:
        pdf.savefig(fig, facecolor=CANVAS)
    plt.close(fig)
    print(f"  wrote {os.path.relpath(path, HERE)}")
    return path


# ----------------------------------------------------------------------------
# Statewide sheets
# ----------------------------------------------------------------------------
def sheet_projected_margin(counties, metrics, pdf=None):
    fig = plt.figure(figsize=(14.5, 9.6))
    ax = fig.add_axes([0.04, 0.10, 0.92, 0.78])
    maps.map_margin(ax, counties, metrics, "projmarg", fig=fig,
                    title="Projected Margin 2028",
                    subtitle="Pennsylvania counties  ·  PROJMARG, percentage "
                             "points, positive = Democratic")
    fig.text(0.04, 0.035, SOURCE_NOTE, fontsize=7.6, color=INK_SOFT)
    return _save(fig, "01_pa_projected_margin_2028", pdf)


def sheet_classification(counties, metrics, pdf=None):
    fig = plt.figure(figsize=(14.5, 9.6))
    ax = fig.add_axes([0.04, 0.10, 0.92, 0.78])
    _, purple = maps.map_classification(
        ax, counties, metrics, "projmarg",
        title="Red, Blue and Purple counties",
        subtitle="Classified on PROJMARG  ·  Purple = projected margin inside "
                 "5 points")
    fig.text(0.04, 0.035,
             f"{len(purple)} purple "
             f"{'county' if len(purple) == 1 else 'counties'}: " + ", ".join(purple),
             fontsize=7.8, color=INK_SOFT, wrap=True)
    return _save(fig, "02_pa_county_classification", pdf)


def sheet_drivers(counties, metrics, pdf=None):
    """Swing map plus the three single-variable maps and two leaderboards."""
    fig = plt.figure(figsize=(16.5, 11.4))
    gs = fig.add_gridspec(2, 3, left=0.035, right=0.972, top=0.842, bottom=0.055,
                          hspace=0.24, wspace=0.14, height_ratios=[1.28, 1.0])

    fig.text(0.035, 0.955, "What is moving the map", fontsize=22, weight="bold",
             color=INK, va="center")
    fig.text(0.035, 0.921,
             "Base margin to projected margin, and the three underlying scores",
             fontsize=10, color=INK_SOFT, va="center")

    ax = fig.add_subplot(gs[0, 0:2])
    _, swing = maps.map_swing(ax, counties, metrics, fig=fig,
                              title="Swing, base to projected",
                              subtitle="PROJMARG minus BASEMARG, points")

    ax = fig.add_subplot(gs[0, 2])
    maps.leaderboard(
        ax, metrics.assign(swing=metrics["projmarg"] - metrics["basemarg"]),
        "swing", n=12, ascending=True,
        fmt=lambda v: f"{v:+.1f}", color_fn=lambda v: DEM if v >= 0 else REP,
        title="Largest movement toward Republicans")

    ax = fig.add_subplot(gs[1, 0])
    maps.map_sequential(ax, counties, metrics, "logpwd", DENSITY_CMAP,
                        "Population Density Score (LOGPWD)", fig=fig, label_top=3)

    ax = fig.add_subplot(gs[1, 1])
    maps.map_sequential(ax, counties, metrics, "elasticity", ELASTIC_CMAP,
                        "Elasticity Score (ELASTICITY)", fig=fig, label_top=3)

    ax = fig.add_subplot(gs[1, 2])
    maps.map_sequential(ax, counties, metrics, "vulcomposite", VULN_CMAP,
                        "Economic Vulnerability (VULCOMPOSITE)", fig=fig,
                        label_top=3)

    fig.text(0.035, 0.018, SOURCE_NOTE, fontsize=7.6, color=INK_SOFT)
    return _save(fig, "03_pa_swing_drivers", pdf)


def sheet_margin_ranking(counties, metrics, pdf=None):
    fig = plt.figure(figsize=(14.5, 9.0))
    gs = fig.add_gridspec(1, 3, left=0.05, right=0.97, top=0.84, bottom=0.07,
                          wspace=0.42)

    fig.text(0.05, 0.935, "County margin ranking", fontsize=21, weight="bold",
             color=INK, va="center")
    fig.text(0.05, 0.898,
             "Projected 2028 margin, and the closest counties in the state",
             fontsize=10, color=INK_SOFT, va="center")

    fmt = lambda v: format_margin(v)
    ax = fig.add_subplot(gs[0, 0])
    maps.leaderboard(ax, metrics, "projmarg", n=14, ascending=False, fmt=fmt,
                     color_fn=margin_color, title="Strongest Democratic")

    ax = fig.add_subplot(gs[0, 1])
    closest = metrics.assign(absm=metrics["projmarg"].abs()).nsmallest(14, "absm")
    maps.leaderboard(ax, closest, "projmarg", n=14, ascending=False, fmt=fmt,
                     color_fn=margin_color, title="Closest to even")

    ax = fig.add_subplot(gs[0, 2])
    maps.leaderboard(ax, metrics, "projmarg", n=14, ascending=True, fmt=fmt,
                     color_fn=margin_color, title="Strongest Republican")

    fig.text(0.05, 0.022, SOURCE_NOTE, fontsize=7.6, color=INK_SOFT)
    return _save(fig, "04_pa_margin_ranking", pdf)


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Build MCAP Pennsylvania visuals")
    ap.add_argument("--county", action="append", default=None,
                    help="build a dashboard for this county (repeatable)")
    ap.add_argument("--all-counties", action="store_true")
    ap.add_argument("--maps-only", action="store_true")
    ap.add_argument("--regenerate-data", action="store_true")
    ap.add_argument("--pdf", action="store_true", help="also write a combined PDF")
    ap.add_argument("--geojson", default=geo.GEOJSON_PATH)
    args = ap.parse_args()

    apply_theme()
    counties = geo.load_counties(args.geojson)
    metrics, education, historic = data.load_all(counties,
                                                 regenerate=args.regenerate_data)
    print(f"loaded {len(counties)} counties, {len(metrics)} metric rows")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    pdf = PdfPages(os.path.join(OUTPUT_DIR, "MCAP_PA_dashboards.pdf")) if args.pdf else None

    print("statewide sheets:")
    sheet_projected_margin(counties, metrics, pdf)
    sheet_classification(counties, metrics, pdf)
    sheet_drivers(counties, metrics, pdf)
    sheet_margin_ranking(counties, metrics, pdf)

    if not args.maps_only:
        if args.all_counties:
            targets = metrics["county"].tolist()
        elif args.county:
            targets = args.county
        else:
            # One of each layout: strongest D, strongest R, closest to even.
            targets = [
                metrics.loc[metrics["projmarg"].idxmax(), "county"],
                metrics.loc[metrics["projmarg"].idxmin(), "county"],
                metrics.loc[metrics["projmarg"].abs().idxmin(), "county"],
            ]

        print("county dashboards:")
        for name in targets:
            rec = data.county_record(metrics, name)
            fig = dash.build_dashboard(rec, education, historic, counties)
            kind = classify_county(rec["projmarg"]).lower()
            _save(fig, f"county_{name.replace(' ', '_')}_{kind}", pdf)

    if pdf is not None:
        pdf.close()
        print(f"  wrote output/MCAP_PA_dashboards.pdf")


if __name__ == "__main__":
    main()
