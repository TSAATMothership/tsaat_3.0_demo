import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const liteRoot = path.resolve(scriptDirectory, "..");
const htmlPath = path.join(liteRoot, "TSAATDemo_lite.html");
const html = await readFile(htmlPath, "utf8");
const details = await stat(htmlPath);

assert(html.startsWith("<!doctype html>"), "Output must be an HTML5 document.");
assert.match(html, /data-tsaat-lite-snapshots="8"/, "All eight snapshots must be packaged.");
assert.match(html, /<style>[^]*<\/style>/, "CSS must be embedded.");
assert.match(html, /<script>[^]*<\/script>/, "JavaScript must be embedded.");
assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i, "External scripts are not allowed.");
assert.doesNotMatch(html, /<link\b[^>]*\brel\s*=\s*["']?stylesheet/i, "External stylesheets are not allowed.");
assert.doesNotMatch(html, /\b(?:src|href)\s*=\s*["']\/_next\//i, "Next.js build assets are not allowed.");
assert.doesNotMatch(html, /url\(["']?\/bg-topography\.svg/i, "The topography asset must be embedded.");
assert.doesNotMatch(html, /<img\b[^>]*\bsrc\s*=\s*["']\//i, "Images must not use external paths.");
assert.doesNotMatch(
  html,
  /rgba\(125,\s*211,\s*252,\s*(?:0?\.)34\)/,
  "The generated analyser must not contain the retired vertical axis-divider stroke."
);
assert(html.includes("demo123"), "The hard-coded demo credential must be packaged.");
assert(html.includes("Network Impact Analyser"), "The Network Impact Analyser tab must be packaged.");
assert(html.includes("diagramNetworkIds"), "The multi-network analyser request contract must be packaged.");
assert(html.includes("CMDB Drill Through"), "The shared CMDB drill-through panel must be packaged.");
assert(html.includes("/api/assets/cmdb-details"), "The CMDB asset-details API bridge must be packaged.");
assert(html.includes("data-cmdb-asset-id"), "Clickable CMDB device-name triggers must be packaged.");
assert(html.includes("Threat Surface Area Action Plan"), "The Threat Surface Area Action Plan tab must be packaged.");
assert(html.includes("Discovery Action Plan"), "The Discovery Action Plan tab must be packaged.");
assert(html.includes("ICT System Modelling Action Plan"), "The ICT System Modelling Action Plan tab must be packaged.");
assert(
  html.includes("Critical/High Open Findings > 60 days old"),
  "The Critical/High finding ageing action must be packaged."
);
assert(html.includes("Quick Wins by Recommended Action"), "Plan-specific recommended quick wins must be packaged.");
assert(!html.includes("Oldest Open Findings"), "The removed Oldest Open Findings table must not be packaged.");
assert(details.size > 1_000_000, "Output is unexpectedly small and likely incomplete.");

console.log(`Verified one self-contained HTML application (${(details.size / 1024 / 1024).toFixed(2)} MiB).`);
console.log("No external script, stylesheet, Next asset, or image references were found.");
