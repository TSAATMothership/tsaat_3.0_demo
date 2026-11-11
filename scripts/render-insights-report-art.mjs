import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Manual maintenance tool only. Builds and PDF requests consume the committed PNGs.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public", "insights-report-art");
const artwork = ["software-terrain", "endpoint-evidence", "vulnerability-evidence"];
const description = "Locally rendered derivatives of the same original SVGs used by Governance Insights. No remote resources. Regenerate when source artwork changes.";

function options(args) {
  if (args.includes("--help") || args.includes("-h")) return { help: true };
  let browser = process.env.TSAAT_CHROME_PATH;
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== "--browser" || !args[index + 1] || args[index + 1].startsWith("--")) {
      throw new Error("Usage: node scripts/render-insights-report-art.mjs --browser <absolute-local-Chrome-path>. Use --help for details.");
    }
    browser = args[++index];
  }
  if (!browser || !path.isAbsolute(browser)) {
    throw new Error("Provide an absolute path to an already installed Chrome/Chromium executable using --browser or TSAAT_CHROME_PATH. No browser is downloaded.");
  }
  return { browser };
}

async function render(executablePath) {
  if (!(await fs.stat(executablePath)).isFile()) throw new Error("The supplied browser path is not an executable file.");
  const sources = await Promise.all(artwork.map(async name => ({ name, source: await fs.readFile(path.join(root, "public", `${name}.svg`)) })));
  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    pipe: true,
    args: ["--disable-background-networking", "--disable-component-update", "--disable-domain-reliability", "--disable-sync", "--no-pings", "--no-first-run", "--no-default-browser-check", "--host-resolver-rules=MAP * ~NOTFOUND", "--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication"]
  });
  const rendered = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 620, height: 480, deviceScaleFactor: 2 });
    await page.setJavaScriptEnabled(false);
    await page.setOfflineMode(true);
    await page.setRequestInterception(true);
    const blocked = new Set();
    page.on("request", request => { blocked.add(request.url()); void request.abort(); });
    for (const { name, source } of sources) {
      // The SVG is inline and self-contained. No navigation, external font or asset fetch is allowed.
      await page.setContent(`<html><body style="margin:0;background:transparent">${source.toString("utf8")}</body></html>`, { waitUntil: "load" });
      const png = await page.screenshot({ type: "png", omitBackground: true });
      if (blocked.size) throw new Error(`Artwork ${name}.svg attempted to load an external resource. Keep the source SVG self-contained; no outputs were written.`);
      rendered.push({ name, source, png });
    }
  } finally {
    await browser.close();
  }

  // Render everything successfully before replacing any derivative; publish the manifest last.
  await fs.mkdir(target, { recursive: true });
  const manifest = { description, assets: [] };
  for (const { name, source, png } of rendered) {
    await fs.writeFile(path.join(target, `${name}.png`), png);
    manifest.assets.push({
      source: `public/${name}.svg`,
      sourceSha256: crypto.createHash("sha256").update(source).digest("hex"),
      output: `public/insights-report-art/${name}.png`
    });
  }
  await fs.writeFile(path.join(target, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Rendered ${rendered.length} local Insights illustrations to ${target}. Review the PNGs and source hashes before committing.`);
}

try {
  const config = options(process.argv.slice(2));
  if (config.help) {
    console.log(`Render the five bundled Governance Insights SVGs to transparent 1240 x 960 PNGs.

Usage:
  node scripts/render-insights-report-art.mjs --browser <absolute-local-Chrome-path>
  TSAAT_CHROME_PATH may supply the browser path instead of --browser.

The script uses the repository's existing puppeteer-core installation and an
explicitly selected, preinstalled Chrome/Chromium browser. It downloads nothing,
blocks page requests, disables page JavaScript and uses local pipe communication.
Source and output paths resolve relative to this script, independent of shell cwd.
It preserves manifest.json's source/sourceSha256/output schema.

This is manual artwork maintenance; application PDF generation and builds do not
invoke this script or launch a browser. See public/insights-report-art/README.md.`);
  } else {
    await render(config.browser);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
