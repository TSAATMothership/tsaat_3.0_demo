# DSMR TSAAT User Guide

Open [the interactive guide](guide/TSAAT-User-Guide.html) in a browser. It contains the feature directory, pathways for managers, network owners, ICT system owners and analysts, worked examples, and a practice lab. The guide and its artwork work offline.

## Run the practice lab

1. Extract the local `releases/TSAAT-Practice-Lab-Windows-x64.zip` into a folder on a Windows x64 computer.
2. Double-click `Start Practice Lab.cmd` and leave the launcher open. It opens the guide on `http://127.0.0.1:43871`.
3. Under **Practice lab**, enter a username and choose **Launch TSAAT in a new window**. The session opens End Point Explorer for Aegis Mesh North. The name labels the browser session. The application uses eight bundled weekly sample snapshots.

The packaged release contains its own Node runtime, compiled TSAAT application, guide, workbook and sample data. Close the launcher to stop the local server. After cloning the source, build the ZIP using the instructions below or obtain the packaged release from the project owner.

## Edit the guide

The [Excel workbook](guide/TSAAT-Guide-Text.xlsx) supplies the guide’s wording. Edit the **Text** column of the **Guide text** worksheet. Stable keys connect the rows to interface elements. In the guide, **Guide workbook → Load edited workbook** previews your changes and **Save updated guide** downloads a standalone HTML copy.

To build the checked-in HTML from the workbook, run this from the repository root with Python 3.9 or later. The guide builder uses the Python standard library and bundled JavaScript.

```powershell
python scripts/build_guide.py
```

When serving the guide over HTTP, keep the workbook beside the HTML. Rebuild the practice package to distribute changes to the offline lab.

## Build the Windows practice release

Use a Windows x64 machine with Python 3.9 or later. The packager expects a sibling `DSMR_TSAAT` application checkout with its NoSQL compilation, installed app dependencies, runtime archive and sample fixtures. The companion application README documents its offline installation and `build:nosql` commands.

```powershell
python scripts/build_practice_lab.py
```

For a different location, supply `--app-source "D:\Projects\DSMR_TSAAT"`. The packager rebuilds the guide, verifies the Node runtime archive against the companion manifest and initialises a new training store from the sample fixtures. It creates the release in `releases/`. Git ignores that directory.

## Repository layout

| Path | Contents |
| --- | --- |
| `guide/` | Ready-to-open HTML and editable Excel workbook |
| `src/` | HTML template, styles, JavaScript, navigation structure and required workbook keys |
| `assets/` | TSAAT logo, terrain illustration and feature artwork |
| `practice-lab/` | Windows launcher and loopback application host |
| `scripts/` | Guide and practice release builders |
| `tests/` | Guide navigation, workbook round-trip and named training-session checks |
| `vendor/jszip/` | Offline JSZip distribution and its licence |
| `releases/` | Locally generated Windows distribution |

## Run the checks

With Node.js and Chrome installed, run `npm install` followed by `npm test`. Set `PLAYWRIGHT_CHANNEL` to `msedge` to test with Edge. Browser test outputs go to the ignored `build/` folder.

For the practice test, extract the release into `build/test-lab/` so `lab-host.cjs` sits directly inside that folder, then run `npm run test:practice`. Alternatively, set `TEST_LAB_ROOT` to an extracted lab folder. This check drives Chromium against the packaged application’s HTTP handler using an in-process transport. To check the Windows desktop handoff, start the release using its CMD launcher.

