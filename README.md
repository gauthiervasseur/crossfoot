# Crossfoot

Business intelligence for a single CSV file, made for **AFP** (Association for Financial
Professionals) sessions and dressed in the AFP look from `styles/afp.css` of the AFP workshop:
AFP Dark Blue `#002B49`, Medium Blue `#0076A8`, Light Blue `#77CBD5`, Light Orange `#FB8F2E`,
Green `#0B7E5E`, warm greys, ALL-CAPS navy headings, and Franklin Gothic with Libre Franklin as
the open-source stand-in. Drag fields onto shelves to get charts and pivot tables, filter with
tabs, and restyle the visualizations with a CSS file. Runs fully offline in the browser:
double-click `index.html`, nothing to install.

Crossfoot is a rebrand of Polder (`~/Shared-SynologyDrive/SynologyDrive/Code/Polder`, itself a rebrand of Tatko) with the
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
| Every number defaults to Sum                   | Fields named like rates, %, ratios, yields or prices default to Average |

Everything else (12 chart types, pivot engine, filters, theme CSS, save/open, PNG/SVG/CSV
export, Mac app) is unchanged.

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
├── website/              static landing page, ready to upload as-is
├── dist/                 Crossfoot-<version>.zip, Crossfoot-<version>.dmg, Crossfoot.app
└── tools/                build scripts, icon.svg
```

## Build

Uses the macOS system Python 3 with Pillow, plus `rsvg-convert` (`brew install librsvg`) for the icons.

```sh
/usr/bin/python3 tools/build.py          # icons, fonts.css, demo data, themes, zip, dmg, website/
python3 -m http.server 8765 --bind 127.0.0.1 &   # then:
tools/screenshots.sh                     # regenerate website screenshots
```

The Mac app is ad-hoc signed, not notarized (see the Tatko README in `SynologyDrive/Code/Tatko` for notarization steps).
Self-test: `CROSSFOOT_SELFTEST=/some/dir dist/Crossfoot.app/Contents/MacOS/Crossfoot`.
`tools/publish_pages.sh` publishes `website/` to a `gh-pages` branch once the repo has a remote.

## Deep links

`index.html#demo&preset=table|bar|line|scatter|treemap|kpi&theme=afp|afp-night|arcade|corporate&dark|light&mute`

## Theme CSS

Variables are named `--crossfoot-*`; see `app/themes/afp.css` or the Theme tab in the app.
