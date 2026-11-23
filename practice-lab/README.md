# TSAAT browser practice lab

Open `TSAAT-User-Guide.html` in a current desktop browser and select **Practice lab**. Use the practice launch button to open a new practice window immediately. There is no identity form to complete. If popups are blocked, allow popups for the guide and use the button again; there is no direct-launch fallback link. Keep the guide open while launching additional sessions. The opened practice window runs independently.

Every new session must start from the guide's launch button. The included `TSAAT-Practice-Lab.html` cannot launch a session when opened directly. Each opened app URL is tied to that particular window; copying it into a fresh tab or window is blocked.

Everything needed for the practice app is included in each HTML file: application code, styles, artwork, report worker, reference data and eight weekly sample snapshots (19 September–7 November 2026). No Node runtime, local server, SQL connection, installation or internet connection is required. Each window has its own persona selection and practice state. **Reset practice** clears selections and returns to the latest Aegis Mesh North endpoint view. Closing a window discards its state. Exported files remain wherever you save them.

The guide opens on **TSAAT Overview**. Its nine original popup videos are separate `overview-*.mp4` files; the 13 feature walkthroughs are separate `*-walkthrough.mp4` files. Keep all 22 videos beside `TSAAT-User-Guide.html`, including when moving the guide or saving an updated copy. Posters, captions and the interactive story remain embedded in the guide. Extract the complete ZIP into one folder.

The practice edition includes all eight active TSAAT workspace screens: the three Governance insights screens and the five Discovery explorers, plus scope/date filters, CMDB details, topology and browser-generated Excel/PDF downloads. It uses the companion application's NoSQL loaders, calculations, screen components and report renderers with browser adapters. Its sample evidence is read-only. It does not connect to an operational installation.

The browser launch rule is not authentication.

## Maintaining this edition

The source is in `practice-lab/browser/`. `scripts/build_browser_lab.mjs` bundles the sibling `DSMR_TSAAT` source using its already-installed esbuild, React, Tailwind, PostCSS and PDF dependencies. It initializes a fresh temporary sample store using the application's supported initializer; it never reads `NoSQL/data`, credentials or database configuration. The build does not alter the sibling application. `source-manifest.json` records the source revision, input hashes and evidence hashes.

The adapters replace filesystem access with a compressed embedded store, Next navigation with hash navigation, and API transport with in-window calls to the original route handlers. NoSQL filtering and calculations remain in the original provider. Source compatibility substitutions fail the build when their expected source changes. A content security policy prevents network connections.

Run `python scripts/build_practice_lab.py` to regenerate both HTML files and `releases/TSAAT-Practice-Lab-Browser.zip`. Use `--app-source` for a different source checkout. Building requires Node and Python; using the finished HTML files does not.

Validation covers guide navigation and workbook round trips, launch with network disabled, all eight screens, historical snapshot counts, scope/domain changes, search, CMDB and topology navigation, isolated sessions, immediate button launch, popup retry, blocked direct file and copied-URL launches, saved guide copies, and exported XLSX/PDF signatures. These changes are confined to the guide and browser edition; they do not change the operational SQL/NoSQL providers or schema.
