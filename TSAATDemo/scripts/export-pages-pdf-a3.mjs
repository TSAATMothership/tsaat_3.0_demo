import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { PDFDocument } from "pdf-lib";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status > 0) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function resolveChromePath() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error("No Chrome/Edge executable found in standard locations.");
}

function sanitizeFileName(input) {
  return input
    .replace(/^\/+/, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/-+/g, "-")
    .replace(/\{\}|\[\]/g, "")
    .replace(/^$/, "home");
}

async function mergePdfs(inputFiles, outputFile) {
  const merged = await PDFDocument.create();
  for (const file of inputFiles) {
    const bytes = await fs.readFile(file);
    const source = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }
  const out = await merged.save();
  await fs.writeFile(outputFile, out);
}

async function killProcessTree(pid) {
  if (!pid) {
    return;
  }
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore"
      });
      killer.on("error", () => resolve());
      killer.on("close", () => resolve());
    });
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // ignore
  }
}

async function main() {
  const repoRoot = process.cwd();
  const dataPath = path.join(repoRoot, "data", "current.json");
  const current = JSON.parse(await fs.readFile(dataPath, "utf8"));

  const routes = ["/", "/measures", "/networks"];
  for (const network of current.managedNetworks ?? []) {
    routes.push(`/networks/${network.id}`);
  }
  routes.push("/systems");
  for (const system of current.ictSystems ?? []) {
    routes.push(`/systems/${system.id}`);
  }
  routes.push("/findings", "/report");

  const outputDir = path.join(repoRoot, "artifacts", "page-pdf-export-a3");
  await fs.mkdir(outputDir, { recursive: true });

  const port = 3050;
  const baseUrl = `http://localhost:${port}`;

  const server = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    detached: process.platform !== "win32"
  });

  let logs = "";
  server.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  const generated = [];
  try {
    await waitForServer(baseUrl);

    const browser = await puppeteer.launch({
      executablePath: await resolveChromePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    for (let index = 0; index < routes.length; index += 1) {
      const route = routes[index];
      const url = `${baseUrl}${route}`;

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 120000
      });

      // Let charts/fonts settle for capture consistency.
      await sleep(1200);
      await page.emulateMediaType("screen");

      const fileName = `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(route)}.pdf`;
      const outputPath = path.join(outputDir, fileName);

      await page.pdf({
        path: outputPath,
        format: "A3",
        landscape: true,
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
        preferCSSPageSize: false,
        displayHeaderFooter: false
      });

      generated.push(outputPath);
      console.log(`Rendered ${route} -> ${fileName}`);
    }

    await browser.close();

    const mergedPath = path.join(repoRoot, "artifacts", "DCT-WebApp-All-Pages-A3.pdf");
    await mergePdfs(generated, mergedPath);

    console.log(`Merged A3 PDF created: ${mergedPath}`);
  } finally {
    await killProcessTree(server.pid);

    if (logs.trim()) {
      await fs.writeFile(path.join(outputDir, "dev-server.log.txt"), logs);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
