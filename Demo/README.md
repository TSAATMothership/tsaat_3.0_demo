# TSAAT standalone demo

Open [index.html](index.html) in a current Chrome or Edge browser. Double-clicking the file is sufficient. There is no installation, SQL connection, login, backend server or internet requirement. The same file can be served by any static host.

The banner identifies this as an offline demo using synthetic sample data. Use the header to select networks or ICT systems and one of eight historical snapshots. Explore Discovery, Measures, Findings, risk profiles, heatmaps, impact analysers and Briefs & Reports. Reports and workbook exports are generated in the browser.

Menu / Settings contains Discovery Tools, SPI Risk Matrix and SPI Priority Matrix. Saving a matrix updates the demo immediately. Settings persist in browser local storage where supported; a visible notice explains session-only storage when unavailable. Reset demo settings restores the packaged defaults. A new browser, private window or moved file can have a separate settings store.

## Data and maintenance

The authoritative sample snapshots are [data/snapshots](../data/snapshots). Reference definitions come from [Database Schema/data](../Database%20Schema/data). [data/profile.json](data/profile.json) describes these inputs. [data/cmdb-attributes.json](data/cmdb-attributes.json) contains editable attribute mappings for each asset type.

The build packages these JSON structures, code, images, spreadsheet template and analyser worker into index.html. Local JSON fetches are deliberately avoided because browsers restrict file-to-file access. Edit source JSON, then rebuild; do not edit the HTML manually. The delivered HTML is portable on its own.

The demo adds deterministic sample device discovery fields, contacts, IP Scan/ARP observations and missing ATO/DIIS examples. It does not contain operational database extracts. Its snapshots end in April 2026 and are historical examples, not current operational results.

From the repository root:

~~~powershell
npm ci
npm run demo:build
npm run demo:test
npm run docs:generate
npm run check
npm run build
~~~

Development requires Node 24; running the completed demo does not. Browser tests use an installed Chrome/Edge, or DEMO_BROWSER_PATH. See [the demo development contract](../docs/demo.md) and [SDLC](../docs/sdlc.md). Commit source changes, index.html and build-manifest.json together.
