import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";

const execFileAsync = promisify(execFile);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status >= 300) {
        return;
      }
    } catch {
      // retry
    }
    await wait(1000);
  }
  throw new Error(`Timed out waiting for server: ${url}`);
}

async function resolveChromePath() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error("Chrome executable not found in standard locations.");
}

async function renderPageToPdf(chromePath, url, outputPath) {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=20000",
    "--print-to-pdf-no-header",
    `--print-to-pdf=${outputPath}`,
    url
  ];

  await execFileAsync(chromePath, args, { maxBuffer: 1024 * 1024 * 10 });
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

  const mergedBytes = await merged.save();
  await fs.writeFile(outputFile, mergedBytes);
}

async function main() {
  const repoRoot = process.cwd();
  const dataPath = path.join(repoRoot, "data", "current.json");
  const current = JSON.parse(await fs.readFile(dataPath, "utf8"));

  const firstNetworkId = current.managedNetworks?.[0]?.id;
  const firstSystemId = current.ictSystems?.[0]?.id;

  if (!firstNetworkId || !firstSystemId) {
    throw new Error("Dataset missing network/system IDs needed for drill-down pages.");
  }

  const outputDir = path.join(repoRoot, "artifacts", "page-pdf-export");
  await fs.mkdir(outputDir, { recursive: true });

  const server =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/c", "npm run dev -- --port 3000"], {
          cwd: repoRoot,
          stdio: ["ignore", "pipe", "pipe"]
        })
      : spawn("npm", ["run", "dev", "--", "--port", "3000"], {
          cwd: repoRoot,
          stdio: ["ignore", "pipe", "pipe"]
        });

  let serverLogs = "";
  server.stdout.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });

  try {
    await waitForServer("http://localhost:3000");

    const chromePath = await resolveChromePath();
    const baseUrl = "http://localhost:3000";

    const pages = [
      { name: "01-executive-dashboard", route: "/" },
      { name: "02-measures", route: "/measures" },
      { name: "03-managed-networks", route: "/networks" },
      { name: "04-network-detail", route: `/networks/${firstNetworkId}` },
      { name: "05-ict-systems", route: "/systems" },
      { name: "06-system-detail", route: `/systems/${firstSystemId}` },
      { name: "07-findings-register", route: "/findings" },
      { name: "08-written-report", route: "/report" }
    ];

    const generated = [];

    for (const page of pages) {
      const outputPath = path.join(outputDir, `${page.name}.pdf`);
      await renderPageToPdf(chromePath, `${baseUrl}${page.route}`, outputPath);
      generated.push(outputPath);
      console.log(`Rendered: ${page.route}`);
    }

    const mergedOutput = path.join(repoRoot, "artifacts", "DCT-WebApp-All-Pages.pdf");
    await fs.mkdir(path.dirname(mergedOutput), { recursive: true });
    await mergePdfs(generated, mergedOutput);

    console.log(`Merged PDF created: ${mergedOutput}`);
  } finally {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
    await wait(1000);
    if (!server.killed) {
      server.kill("SIGKILL");
    }

    if (serverLogs.trim()) {
      await fs.writeFile(path.join(outputDir, "dev-server.log.txt"), serverLogs);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
