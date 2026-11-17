# DSMR TSAAT User Guide

Open [the interactive guide](guide/TSAAT-User-Guide.html) in a browser. It contains the feature directory, role pathways, worked examples and a self-contained practice lab. The guide and practice app work offline.

The guide uses plain English and calls the devices, software, networks and services you look after your **cyber terrain**. Underlined technical terms open their glossary definitions. The glossary and walkthrough wording remain editable in the workbook. Older workbooks keep their custom wording and gain any missing new glossary entries when loaded.

All 13 TSAAT Feature Guide topics include a short, text-guided recording of their steps in the actual practice lab. Each uses the bundled sample data and the same navy and teal player as **Choose what to include**. The player has native playback/fullscreen controls, optional English captions, one shortcut per step and a transcript using the current workbook wording. Playback starts only on request. The 13 `*-walkthrough.mp4` files live beside `TSAAT-User-Guide.html` in `guide/`, keeping the HTML smaller. Keep those MP4 files in the same folder when moving, sharing or saving an updated guide. Posters and captions remain embedded; everything works offline. The written instructions remain beneath each video.

Record one topic at a time with `python scripts/build_topic_video.py TOPIC` (for example, `explore-soft`). Topic IDs are in `src/structure.json`; their real-app workflows are in `scripts/walkthroughs/`. The existing scope recording retains its command, `python scripts/build_scope_video.py`. The recorder launches a fresh lab through the guide, verifies the actions, then captures the real controls with caption, pointer and focus overlays. Recording overlays remain above native CMDB and report dialogs. It checks offline operation and records source/video hashes in `assets/TOPIC-walkthrough.json`. Chapter titles come from the workbook; changing recorded instructions requires a fresh capture.

Recording requires the project's Playwright dependency, Chrome and Playwright's FFmpeg recorder (`npx playwright install ffmpeg`), plus an H.264 FFmpeg encoder (`--ffmpeg PATH`, or `imageio-ffmpeg` installed in `build/video-tools`). Raw clips stay in ignored `build/TOPIC-recording/`. `--reuse-recording` re-encodes only when the lab source hash still matches. `--steps 3,4` refreshes selected chapters only when all original clips exist and the source and chapter wording are unchanged. Recorders write the MP4 files to `guide/` and the posters, captions and provenance to `assets/`. Normal guide builds use this checked-in media without recording dependencies. Rebuild with `python scripts/build_guide.py`, then run `node tests/topic-video.cjs TOPIC` for a single page or `npm run test:video` for every page.

The original overview and topic artwork responds with a gentle tilt and glow as the pointer moves across its banner. Click or tap the banner for a brief light pulse. These decorative effects preserve the page layout, work offline and switch off when reduced motion is enabled.

Numbered steps on the 13 topic guidance pages use an open, border-free layout with a soft pointer-following light, a glowing number badge, a short heading underline and an illuminated connector line. The number responds more strongly when the pointer is nearby; the text stays still. Tab to a step or one of its glossary links for the same visual emphasis, with the keyboard focus ring around the number. Reduced motion uses a static highlight. Touch scrolling, text selection and glossary navigation keep their normal behavior, and the effects stay out of printed pages and the PDF handbook.

On the feature guide, hovering Governance lights the third (bottom) image layer, Discovery lights the middle layer, and Getting started lights the orange route. Keyboard focus inside each panel gives the same highlight. Getting started spans the full width beneath the other two panels. Reduced motion keeps these highlights instant.

Use **Generate PDF User Guide** beneath the Feature Guide introduction to download a PDF of the current guide text. It uses any workbook wording loaded in the guide, including your edits. PDF generation runs in the browser and works offline using the bundled PDF-lib library; it does not upload the guide or require a separate installation.

The handbook includes a linked contents page, illustrated walkthroughs for all 13 topics, worked examples, four role pathways, practice instructions, troubleshooting, keyboard guidance and the full glossary. It uses selectable text and links back to the contents and glossary. The additional PDF narrative and page layouts live in `src/pdf-content.js` and `src/pdf-guide.js`. Saved HTML copies keep the complete generator. The PDF explains how to use the practice lab; launch the lab from the interactive guide's button.

## Run the practice lab

1. Open `guide/TSAAT-User-Guide.html` and select **Practice lab**.
2. Use the practice launch button to open the app immediately in a new window. There is no identity form to complete.
3. Explore the app using the eight bundled weekly sample snapshots. Use **Reset practice** to return to the starting view.

The practice app runs entirely in the browser. No installation, Node runtime, local server or database is needed. It includes all eight active NoSQL workspace screens, filtering, historical dates, CMDB details, topology, Excel exports and PDF reports. Each window has its own practice state. If your browser blocks the new window, allow popups for the guide and use the launch button again. There is no direct-launch fallback link.

The entire app is embedded in the guide, including copies saved through **Save updated guide**. The distribution also includes [TSAAT-Practice-Lab.html](guide/TSAAT-Practice-Lab.html), but opening that file directly does not start a session. Every new session must start with the guide's launch button. Each opened app URL is tied to its own window; copying it into a fresh tab or window does not launch the app. See [the practice lab notes](practice-lab/README.md) for implementation and sample data details.

The browser launch rule is not authentication.

## Edit the guide

The [Excel workbook](guide/TSAAT-Guide-Text.xlsx) supplies the guide's wording. Edit the **Text** column of the **Guide text** worksheet. Stable keys connect rows to interface elements. Open **Guide workbook** using the book icon and **How to use TSAAT** link at the bottom of the left sidebar (open the navigation menu first on a small screen). **Load edited workbook** previews changes and **Save updated guide** downloads an HTML copy with the complete practice app. Save it alongside the walkthrough MP4 files to keep video playback available.

To rebuild the guide from its workbook and the checked-in practice app:

```powershell
python scripts/build_guide.py
```

When serving the guide over HTTP, keep the workbook beside it to load edited wording automatically. The guide also opens directly from disk; start each new practice session from its launch button.

## Rebuild the browser practice app

Use Node.js and Python 3.9 or later. The builder expects a sibling `DSMR_TSAAT` checkout with its installed offline dependencies and bundled sample fixtures. It reuses the application's original screens, NoSQL loaders, calculations and document renderers. It does not require a compiled Next application and does not modify the sibling checkout.

```powershell
python scripts/build_practice_lab.py
```

For another location, add `--app-source "D:\Projects\DSMR_TSAAT"`. The builder initializes a fresh temporary sample store, builds `guide/TSAAT-Practice-Lab.html`, embeds it in the guide, and creates `releases/TSAAT-Practice-Lab-Browser.zip`. The ZIP contains both HTML files, all 13 walkthrough MP4 files, the workbook and provenance notes. Extract them together into the same folder. Runtime stores and credentials are excluded. Users only need a browser to run the resulting files.

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
| `vendor/pdf-lib/` | Offline PDF-lib distribution, licence and provenance |
| `releases/` | Ignored, locally generated distribution ZIPs |

## Run the checks

With Node.js and Chrome installed, run `npm install` followed by `npm test`. Set `PLAYWRIGHT_CHANNEL=msedge` to use Edge. `npm run test:practice` runs the browser lab checks alone. Test artifacts go to the ignored `build/` folder.

`npm run test:pdf` checks offline PDF downloads, complete guide wording, artwork, workbook changes, pagination and generation from saved HTML. It also writes a sample handbook to `output/pdf/TSAAT-User-Guide.pdf` for visual review.

The practice test disables network access and checks immediate button launch, blocked popups and direct launches, saved guide copies, sample counts across eight dates, navigation, filtering, CMDB details, reports, session isolation and mobile layout. The guide checks cover role pathways, examples, search and workbook import/export with saved HTML reloads.
