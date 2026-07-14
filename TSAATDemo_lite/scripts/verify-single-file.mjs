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
assert(html.includes("demo123"), "The hard-coded demo credential must be packaged.");
assert(details.size > 1_000_000, "Output is unexpectedly small and likely incomplete.");

console.log(`Verified one self-contained HTML application (${(details.size / 1024 / 1024).toFixed(2)} MiB).`);
console.log("No external script, stylesheet, Next asset, or image references were found.");
