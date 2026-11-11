# Governance Insights PDF artwork

These transparent PNGs are local print derivatives of the same original SVG illustrations used by the Governance Insights pages. The SVGs are the editable source; update them before regenerating the matching PDF artwork. The illustrations are conceptual and do not represent measured topology or evidence counts.

| Insights page | Source artwork | PDF derivative |
| --- | --- | --- |
| Cyber Terrain | [cyber-terrain.svg](../cyber-terrain.svg) | [cyber-terrain.png](cyber-terrain.png) |
| Installed Software | [software-terrain.svg](../software-terrain.svg) | [software-terrain.png](software-terrain.png) |
| Discovery | [discovery-terrain.svg](../discovery-terrain.svg) | [discovery-terrain.png](discovery-terrain.png) |
| End Point | [endpoint-evidence.svg](../endpoint-evidence.svg) | [endpoint-evidence.png](endpoint-evidence.png) |
| Security Vulnerability | [vulnerability-evidence.svg](../vulnerability-evidence.svg) | [vulnerability-evidence.png](vulnerability-evidence.png) |

The shared PDF theme reads these committed images and the original [TSAAT logo](../tsaat-logo.png) locally. PDF generation does not start a browser, download assets or use this regeneration script. Charts and outline section icons remain vector drawings in the PDF.

## Regeneration

Use the already installed repository dependencies (`npm ci --offline`) and an already installed Chrome/Chromium browser. From the repository root, explicitly select its executable:

~~~powershell
node scripts/render-insights-report-art.mjs --browser 'C:\Program Files\Google\Chrome\Application\chrome.exe'
~~~

Alternatively, set `TSAAT_CHROME_PATH` to the absolute executable path and omit `--browser`. Run `node scripts/render-insights-report-art.mjs --help` for usage. The script resolves source and output paths from its own location, so an absolute script path also works from another shell directory.

The manual [renderer](../../scripts/render-insights-report-art.mjs) uses the existing `puppeteer-core` package, local pipe communication and a 620 x 480 viewport at double resolution. It writes transparent 1240 x 960 PNGs and [manifest.json](manifest.json), retaining the source path, raw SVG byte SHA-256 and output path for every image. It blocks page requests, disables page JavaScript, renders without network access and refuses source artwork that attempts to load an external resource. It never discovers or downloads a browser. No package, build or runtime hook invokes it.

After changing source artwork, regenerate all five derivatives, review the PNGs and sample report pages, and run the focused theme tests:

~~~powershell
npm test -- tests/insights-pdf-theme.test.ts
~~~

Keep the SVG sources, corresponding PNGs and manifest together in the same change. Browser versions can affect raster bytes, so review appearance as well as source hashes. The theme tests verify source hashes, the complete five-asset mapping and PNG dimensions/signatures. This procedure changes presentation assets only; it does not alter either SQL or JSON evidence, data structures or calculations.
