# Crossfoot

Business intelligence for a single CSV file, made for **AFP** (Association for Financial
Professionals) sessions and dressed in the AFP look from `styles/afp.css` of the AFP workshop:
AFP Dark Blue `#002B49`, Medium Blue `#0076A8`, Light Blue `#77CBD5`, Light Orange `#FB8F2E`,
Green `#0B7E5E`, warm greys, ALL-CAPS navy headings, and Franklin Gothic with Libre Franklin as
the open-source stand-in. Drag fields onto shelves to get charts and pivot tables, filter with
tabs, and restyle the visualizations with a CSS file. Runs fully offline in the browser:
double-click `index.html`, nothing to install.

Crossfoot is a rebrand of Polder (itself a rebrand of Tatko) with the
same engine, plus a few finance-specific defaults.

**The name.** To *foot* a column is to total it; to *crossfoot* a table is to total it across its
rows too and check that both grand totals agree. It is the oldest control in finance, and it is
what every pivot table does. Tagline: "Insight that adds up."

**The icon.** A ledger grid on an AFP Dark Blue tile: three data columns rise like a bar chart,
a Light Blue totals row and totals column cross at the grand total, which is orange and checked.
Source: `tools/icon.svg`.

## What changed from Polder

| Polder (DLL)                                   | Crossfoot (AFP)                                                  |
|------------------------------------------------|------------------------------------------------------------------|
| DLL blue UI, white top bar, Figtree/Effra      | AFP navy top bar with palette rule, orange CTA, Libre Franklin   |
| DLL / DLL Night chart themes                   | AFP / AFP Night, palettes validated for CVD separation and contrast |
| "Lowlands Asset Finance" contract portfolio    | Fictional "Meridian Components" group debt book (month-end positions, k EUR) |
| Presets sum everything                         | Snapshot presets pin the latest month end (balances are stocks)  |
| Every number defaults to Sum                   | Fields named like rates, %, ratios, yields, prices or day counts default to Average |

Since v1.1 Crossfoot also has the **calculated measures** first built for DWA42
(`DWA1/applications/DWA42`), an **All points** switch on scatter plots, a clear refusal of CSV files
over 400 MB, and toasts that stay up long enough to read (click to close).

Everything else (12 chart types, pivot engine, filters, theme CSS, save/open, PNG/SVG/CSV
export, Mac app) is unchanged.

## Calculated measures

Click **f(x) New calculation** (under the measures, or next to the Values shelf).

- **Guided**: pick a template (Ratio, Rate %, Difference, Product, Share of total, Per record),
  then the aggregate and field for A and B and the operator. A sentence spells out the result.
- **Formula**: type freely, with buttons for operators, aggregates and functions, and field chips.
  Errors are explained and the culprit is highlighted.
- A live preview shows the total and one line per member of a dimension. Format as Number,
  Percent, Currency $ or Currency €, with 0 to 2 decimals.

Grammar: `SUM AVG MEDIAN MIN MAX COUNT COUNTD` over one `[Field]` (or `COUNT(*)`), `+ - * / ^ ( )`,
`TOTAL(x)` (x over every row in view, for shares of total), `ROUND(x, n)`, `ABS(x)`, `SQRT(x)`,
and `[Another calculation]`. A formula is evaluated per group from that group's aggregates (each
pivot cell, bar, subtotal and grand total), so an effective rate is total interest over total
balances, never an average of row rates. Division by zero gives an empty cell. Calculations are
saved with the layout (autosave per file, and `.crossfoot.json` workbooks).

The Meridian demo ships with four: **Effective Rate %** (`SUM([Annual Interest (k EUR)]) /
SUM([Outstanding (k EUR)])`, the weighted rate), **Variance vs Budget (k EUR)**, **Variance vs
Budget %** and **Share of Outstanding**. Engine: `app/js/calc.js`.

Limit: rows are never combined before aggregation, so a weighted rate needs an interest (or
amount × rate) column in the CSV; `debt_clean.csv` has `TOTAL_RATE` but no interest column.

## Workshop use

Crossfoot is the **Interrogate** step of the session's finance analytics cycle (Think, Ask,
Collect, Transform, Interrogate, Communicate, Act, Learn), which is why it lives in
`AFP-Workshop/3. Transform_Interrogate/`. Load the decision-ready table from
`../Datasets/debt_clean.csv` (50k rows) or try the built-in
Meridian demo. The demo mirrors that table's shape with friendlier column names; it is generated,
not derived from the workshop file.

## Folder layout

```
Crossfoot/
├── app/                  the application (this is what gets zipped)
│   ├── index.html        entry point, works from file://
│   ├── css/crossfoot.css AFP-style UI (light + dark)
│   ├── css/fonts.css     generated: Libre Franklin as a data: URL
│   ├── js/               data, theme, pivot, charts, export, app
│   ├── vendor/           plotly.js 2.35.2 (MIT)
│   ├── fonts/            Libre Franklin variable (SIL OFL) + licence
│   ├── assets/           icons generated from tools/icon.svg
│   ├── samples/          generated demo dataset (fictional)
│   └── themes/           example theme CSS files (afp.css, afp-night.css, …)
├── desktop/macos/        native Mac wrapper (Swift + WKWebView)
├── desktop/windows/      native Windows wrapper (Python + pywebview/WebView2), installer.iss
├── website/              static landing page, ready to upload as-is
├── dist/                 Crossfoot-<version>.zip, .dmg, Crossfoot.app (and -Setup.exe / -Windows.zip once built on Windows)
└── tools/                build scripts, icon.svg
```

## Build

Uses the macOS system Python 3 with Pillow, plus `rsvg-convert` (`brew install librsvg`) for the icons.

```sh
/usr/bin/python3 tools/build.py          # icons, fonts.css, demo data, themes, zip, dmg, website/
python3 -m http.server 8765 --bind 127.0.0.1 &   # then:
tools/screenshots.sh                     # regenerate website screenshots
```

The Mac app is ad-hoc signed, not notarized.

### Windows

`tools/build_windows.ps1` builds the Windows app on a Windows 10/11 PC (PyInstaller does not cross-compile): `powershell -ExecutionPolicy Bypass -File tools\build_windows.ps1`. It needs Python 3.10 to 3.13 on PATH and gives `dist/Crossfoot-<version>-Windows.zip` plus, if Inno Setup 6 is installed, `dist/Crossfoot-<version>-Setup.exe` (per-user, no admin rights). The wrapper is `desktop/windows/crossfoot_win.py`: it serves `app/` from `127.0.0.1:8766` and shows it in a WebView2 window (pywebview), so layouts and themes persist between launches. Without a PC, the workflow `.github/workflows/windows-build.yml` builds it on a GitHub runner (Actions › Build Windows app › Run workflow; pushing a tag such as `v1.0.0` also attaches the files to a Release). Not code-signed (SmartScreen: More info › Run anyway). The Windows build is not yet tested on a real PC; the launcher itself is tested on the Mac with `uv run desktop/windows/crossfoot_win.py --serve`.

Self-test: `CROSSFOOT_SELFTEST=/some/dir dist/Crossfoot.app/Contents/MacOS/Crossfoot`.

### Website on GitHub Pages

The code lives in the AFP workshop folder (`3. Transform_Interrogate/Crossfoot/`) and is published as its own repository, **gauthiervasseur/crossfoot**. `.github/workflows/pages.yml` runs `tools/pages.py` on every push to `main` and publishes `website/` (with the live app in `play/`) to `https://gauthiervasseur.github.io/crossfoot/`. One-time: Settings › Pages › Source: GitHub Actions. The page's Mac and Windows download buttons point at the latest GitHub Release: attach `Crossfoot-latest.dmg` (a copy of `dist/Crossfoot-<version>.dmg`) by hand; the workflow attaches `Crossfoot-latest-Setup.exe` and `Crossfoot-latest-Windows.zip` when you push a tag. Run `tools/pages.py` locally to preview the Pages copy in `_site/`.

## Deep links

`index.html#demo&preset=table|bar|line|scatter|treemap|kpi|calc&theme=afp|afp-night|arcade|corporate&dark|light&mute`

## Theme CSS

Variables are named `--crossfoot-*`; see `app/themes/afp.css` or the Theme tab in the app.
