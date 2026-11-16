# DSMR TSAAT User Guide

Open [the interactive guide](guide/TSAAT-User-Guide.html) in a browser. It contains the feature directory, role pathways, worked examples and a self-contained practice lab. The guide and practice app work offline.

## Run the practice lab

1. Open `guide/TSAAT-User-Guide.html` and select **Practice lab**.
2. Enter a username and choose **Launch TSAAT in a new window**.
3. Explore the app using the eight bundled weekly sample snapshots. Use **Reset practice** to return to the starting view.

The practice app runs entirely in the browser. No installation, Node runtime, local server or database is needed. It includes all eight active NoSQL workspace screens, filtering, historical dates, CMDB details, topology, Excel exports and PDF reports. Each window has its own practice state. The username is a window label, not a login.

The entire app is embedded in the guide, including copies saved through **Save updated guide**. [TSAAT-Practice-Lab.html](guide/TSAAT-Practice-Lab.html) is also available as a separate standalone file. See [the practice lab notes](practice-lab/README.md) for implementation and sample data details.

## Edit the guide

The [Excel workbook](guide/TSAAT-Guide-Text.xlsx) supplies the guide's wording. Edit the **Text** column of the **Guide text** worksheet. Stable keys connect rows to interface elements. In the guide, **Guide workbook → Load edited workbook** previews changes and **Save updated guide** downloads a standalone HTML copy with the complete practice app.

To rebuild the guide from its workbook and the checked-in practice app:

```powershell
python scripts/build_guide.py
```

When serving the guide over HTTP, keep the workbook beside it to load edited wording automatically. Both HTML files also open directly from disk.

## Rebuild the browser practice app

Use Node.js and Python 3.9 or later. The builder expects a sibling `DSMR_TSAAT` checkout with its installed offline dependencies and bundled sample fixtures. It reuses the application's original screens, NoSQL loaders, calculations and document renderers. It does not require a compiled Next application and does not modify the sibling checkout.

```powershell
python scripts/build_practice_lab.py
```

For another location, add `--app-source "D:\Projects\DSMR_TSAAT"`. The builder initializes a fresh temporary sample store, builds `guide/TSAAT-Practice-Lab.html`, embeds it in the guide, and creates `releases/TSAAT-Practice-Lab-Browser.zip`. The ZIP contains both HTML files, the workbook and provenance notes. Runtime stores and credentials are excluded. Users only need a browser to run the resulting files.

## Repository layout

| Path | Contents |
| --- | --- |
| `guide/` | Standalone guide, practice app and editable wording workbook |
| `src/` | Guide template, styles, JavaScript, navigation and workbook keys |
| `assets/` | Guide logo and feature artwork |
| `practice-lab/browser/` | Browser storage, navigation, API and shell adapters |
| `practice-lab/source-manifest.json` | Source revision and bundled evidence/input hashes |
| `scripts/` | Guide builder and browser lab packager |
| `tests/` | Guide/workbook and offline app regression checks |
| `vendor/jszip/` | Offline JSZip distribution and licence |
| `releases/` | Ignored, locally generated distribution ZIPs |

## Run the checks

With Node.js and Chrome installed, run `npm install` followed by `npm test`. Set `PLAYWRIGHT_CHANNEL=msedge` to use Edge. `npm run test:practice` runs the browser lab checks alone. Test artifacts go to the ignored `build/` folder.

The practice test disables network access and checks popup launch/fallback, standalone copies, sample counts across eight dates, navigation, filtering, CMDB details, reports, session isolation and mobile layout. The guide checks cover role pathways, examples, search and workbook import/export with saved HTML reloads.
