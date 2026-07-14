# TSAATDemo_lite

`TSAATDemo_lite.html` is the complete TSAAT demonstration application packaged as one offline HTML file. It contains the React application, compiled styling, SVG assets, impact-analyser worker, report generators, XLSX template, runtime configuration, and all eight demo-data snapshots.

## Run the app

Double-click `TSAATDemo_lite.html`, or open it in a current Chromium-based browser such as Microsoft Edge or Google Chrome.

- Username: `demo`
- Password: `demo123`

The application uses hash routes such as `TSAATDemo_lite.html#/cyber-cop` so navigation, filters, drill-throughs, refresh, and browser back/forward work directly from `file://` without a web server.

## Offline behavior

- No SQL database, Node.js server, API service, internet access, or external asset is required at runtime.
- The eight source snapshots are split into shared and date-specific chunks, gzip-compressed, embedded in the HTML, and expanded only when requested.
- Existing `/api/...` calls execute through an in-browser compatibility layer.
- PDF, CSV, JSON, XLSX, and SVG exports are generated or downloaded in the browser.
- Login state lasts for the browser tab when storage is available.
- Measures and Discovery settings reset when the HTML document is reopened, matching the restart behavior of `TSAATDemo`.

## Rebuild and verify

The build intentionally reuses the inspected `../TSAATDemo` source as its parity source, then packages the result into the standalone HTML artifact.

```powershell
cd "C:\ShuffyNet\VS Code\TSAAT\TSAATDemo_lite"
npm install
npm run build
npm run verify
```
