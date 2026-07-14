import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import autoprefixer from "autoprefixer";
import * as esbuild from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const liteRoot = path.resolve(scriptDirectory, "..");
const workspaceRoot = path.resolve(liteRoot, "..");
const demoRoot = path.join(workspaceRoot, "TSAATDemo");
const dataRoot = path.join(demoRoot, "data");
const outputPath = path.join(liteRoot, "TSAATDemo_lite.html");
const liteRequire = createRequire(path.join(liteRoot, "package.json"));
const textEncoder = new TextEncoder();
const sharedSnapshotKeys = ["managedNetworks", "ictSystems", "ciDependencies"];

function gzipBase64(value) {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
  return gzipSync(buffer, { level: 9 }).toString("base64");
}

function dataUri(contentType, bytes) {
  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function buildEmbeddedData() {
  const snapshotDirectory = path.join(dataRoot, "snapshots");
  const snapshotNames = (await readdir(snapshotDirectory))
    .filter((name) => /^week-\d+\.json$/i.test(name))
    .sort((left, right) => left.localeCompare(right));
  assert.equal(snapshotNames.length, 8, "TSAATDemo_lite requires all eight source snapshots.");

  const files = {};
  const snapshotHeaders = {};
  let sharedPayload = null;
  let latestSourceBytes = null;
  let rawSnapshotBytes = 0;
  let compressedPayloadBytes = 0;

  for (const [index, name] of snapshotNames.entries()) {
    const filePath = path.join(snapshotDirectory, name);
    const sourceBytes = await readFile(filePath);
    rawSnapshotBytes += sourceBytes.byteLength;
    const source = JSON.parse(sourceBytes.toString("utf8"));

    if (!sharedPayload) {
      sharedPayload = Object.fromEntries(sharedSnapshotKeys.map((key) => [key, source[key]]));
    } else {
      for (const key of sharedSnapshotKeys) {
        assert.deepEqual(source[key], sharedPayload[key], `${key} differs in ${name}; shared packing would be unsafe.`);
      }
    }

    const variablePayload = { ...source };
    for (const key of sharedSnapshotKeys) {
      delete variablePayload[key];
    }
    const variableJson = JSON.stringify(variablePayload);
    const gzip = gzipBase64(variableJson);
    compressedPayloadBytes += Buffer.byteLength(gzip, "base64");
    const key = `snapshots/${name}`;
    files[key] = { gzip, kind: "snapshot" };
    snapshotHeaders[key] = JSON.stringify({
      snapshotId: source.snapshotId,
      snapshotDate: source.snapshotDate,
      generatedAt: source.generatedAt
    });

    const reconstructed = JSON.parse(
      `${variableJson.slice(0, -1)},${JSON.stringify(sharedPayload).slice(1)}`
    );
    assert.deepEqual(reconstructed, source, `Packed snapshot ${name} does not reconstruct exactly.`);
    if (index === snapshotNames.length - 1) {
      latestSourceBytes = sourceBytes;
      files["current.json"] = { alias: key };
    }
  }

  const currentBytes = await readFile(path.join(dataRoot, "current.json"));
  assert(latestSourceBytes?.equals(currentBytes), "current.json must match the latest snapshot exactly.");

  const sharedJson = JSON.stringify(sharedPayload);
  const sharedSnapshotChunk = gzipBase64(sharedJson);
  compressedPayloadBytes += Buffer.byteLength(sharedSnapshotChunk, "base64");

  for (const [relativePath, kind] of [
    ["runtime-config.json", "text"],
    ["spi-definitions.json", "text"],
    ["templates/network-target-state-template.xlsx", "binary"]
  ]) {
    const bytes = await readFile(path.join(dataRoot, ...relativePath.split("/")));
    const gzip = gzipBase64(bytes);
    compressedPayloadBytes += Buffer.byteLength(gzip, "base64");
    files[relativePath] = { gzip, kind };
  }

  return {
    files,
    sharedSnapshotChunk,
    snapshotHeaders,
    stats: {
      snapshotCount: snapshotNames.length,
      rawSnapshotBytes,
      compressedPayloadBytes
    }
  };
}

function sourceLoader(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".tsx") return "tsx";
  if (extension === ".ts") return "ts";
  if (extension === ".jsx") return "jsx";
  return "js";
}

function resolveSourceModule(basePath) {
  for (const candidate of [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js")
  ]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return basePath;
}

function compatibilityPlugin({ embeddedData, embeddedAssets }) {
  const shim = (name) => path.join(liteRoot, "src", "shims", name);
  const aliases = new Map([
    ["server-only", shim("empty.ts")],
    ["next/navigation", shim("next-navigation.ts")],
    ["next/link", shim("next-link.tsx")],
    ["next/image", shim("next-image.tsx")],
    ["next/headers", shim("next-headers.ts")],
    ["next/server", shim("next-server.ts")],
    ["node:fs", shim("embedded-fs.ts")],
    ["fs", shim("embedded-fs.ts")],
    ["node:fs/promises", shim("embedded-fs.ts")],
    ["fs/promises", shim("embedded-fs.ts")],
    ["node:path", shim("node-path.ts")],
    ["path", shim("node-path.ts")],
    ["node:zlib", shim("node-zlib.ts")],
    ["zlib", shim("node-zlib.ts")],
    ["node:perf_hooks", shim("node-perf-hooks.ts")],
    ["@/components/server-stream-hint", shim("server-stream-hint.tsx")]
  ]);

  return {
    name: "tsaat-demo-lite-compatibility",
    setup(build) {
      build.onResolve({ filter: /^virtual:embedded-data$/ }, () => ({
        path: "embedded-data",
        namespace: "tsaat-virtual"
      }));
      build.onResolve({ filter: /^virtual:embedded-assets$/ }, () => ({
        path: "embedded-assets",
        namespace: "tsaat-virtual"
      }));
      build.onLoad({ filter: /.*/, namespace: "tsaat-virtual" }, (args) => {
        if (args.path === "embedded-data") {
          return {
            loader: "js",
            contents: [
              `export const embeddedFiles=${JSON.stringify(embeddedData.files)};`,
              `export const sharedSnapshotChunk=${JSON.stringify(embeddedData.sharedSnapshotChunk)};`,
              `export const snapshotHeaders=${JSON.stringify(embeddedData.snapshotHeaders)};`
            ].join("\n")
          };
        }
        return {
          loader: "js",
          contents: `export const assets=${JSON.stringify(embeddedAssets.assets)};export const workerSource=${JSON.stringify(embeddedAssets.workerSource)};`
        };
      });

      build.onResolve({ filter: /.*/ }, (args) => {
        const alias = aliases.get(args.path);
        return alias ? { path: alias } : null;
      });
      build.onResolve(
        { filter: /^(?:react|react-dom|react-is)(?:\/.*)?$/ },
        (args) => ({ path: liteRequire.resolve(args.path) })
      );
      build.onResolve({ filter: /^@\// }, (args) => ({
        path: resolveSourceModule(path.join(demoRoot, args.path.slice(2)))
      }));

      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
        if (!args.path.startsWith(demoRoot)) {
          return null;
        }
        let source = await readFile(args.path, "utf8");
        source = source.replace(/window\.location\.(?:assign|replace)\s*\(/g, "globalThis.__TSAAT_NAVIGATE__(");
        source = source.replace(
          /new Worker\(\s*new URL\(\s*["']\.\/ict-system-impact-analyser-2-worker\.ts["']\s*,\s*import\.meta\.url\s*\)\s*,\s*\{\s*type:\s*["']module["']\s*\}\s*\)/g,
          "new Worker(globalThis.__TSAAT_WORKER_URL__, { type: 'classic' })"
        );
        return { contents: source, loader: sourceLoader(args.path) };
      });
    }
  };
}

async function compileCss(topographyDataUri) {
  const input = await readFile(path.join(demoRoot, "app", "globals.css"), "utf8");
  const processed = await postcss([
    tailwindcss(path.join(liteRoot, "tailwind.config.cjs")),
    autoprefixer()
  ]).process(input, { from: path.join(demoRoot, "app", "globals.css") });
  const withInlineAsset = processed.css.replace(
    /url\((['"]?)\/bg-topography\.svg\1\)/g,
    `url("${topographyDataUri}")`
  );
  const minified = await esbuild.transform(withInlineAsset, { loader: "css", minify: true });
  return minified.code;
}

async function main() {
  const embeddedData = await buildEmbeddedData();
  const workerBuild = await esbuild.build({
    entryPoints: [path.join(demoRoot, "components", "ict-system-impact-analyser-2-worker.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    target: ["es2022"],
    minify: true,
    legalComments: "none"
  });
  const workerSource = workerBuild.outputFiles[0].text;

  const markSvg = await readFile(path.join(demoRoot, "public", "dct-mark.svg"));
  const topographySvg = await readFile(path.join(demoRoot, "public", "bg-topography.svg"));
  const embeddedAssets = {
    assets: {
      "/dct-mark.svg": dataUri("image/svg+xml", markSvg),
      "/bg-topography.svg": dataUri("image/svg+xml", topographySvg)
    },
    workerSource
  };

  const plugin = compatibilityPlugin({ embeddedData, embeddedAssets });
  const appBuild = await esbuild.build({
    entryPoints: [path.join(liteRoot, "src", "main.tsx")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    target: ["es2022"],
    jsx: "automatic",
    minify: true,
    treeShaking: true,
    legalComments: "none",
    banner: {
      js: "var process=globalThis.process||{env:{},cwd:function(){return '/';}};globalThis.process=process;"
    },
    define: {
      "process.env.NODE_ENV": "\"production\"",
      global: "globalThis"
    },
    nodePaths: [path.join(liteRoot, "node_modules"), path.join(workspaceRoot, "node_modules")],
    plugins: [plugin],
    logLevel: "info"
  });
  const javascript = appBuild.outputFiles.find((file) => file.path.endsWith(".js"))?.text ?? appBuild.outputFiles[0].text;
  const css = await compileCss(embeddedAssets.assets["/bg-topography.svg"]);
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const safeJavascript = javascript.replace(/<\/script/gi, "<\\/script");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="application-name" content="TSAATDemo_lite">
<meta name="description" content="Self-contained offline TSAAT demonstration application">
<title>TSAAT</title>
<style>${safeCss}</style>
</head>
<body class="font-['Segoe_UI','Trebuchet_MS','Arial',sans-serif] antialiased">
<div id="root" data-tsaat-lite-snapshots="${embeddedData.stats.snapshotCount}">
<section class="panel mx-auto mt-12 max-w-xl p-8 text-center"><p class="text-xs uppercase tracking-[0.16em] text-slate-300/75">Offline data package</p><h1 class="mt-2 text-2xl font-semibold text-slate-100">Loading TSAAT...</h1></section>
</div>
<script>${safeJavascript}</script>
</body>
</html>`;
  await writeFile(outputPath, html, "utf8");
  const outputStats = await stat(outputPath);
  console.log(`Built ${path.relative(workspaceRoot, outputPath)}`);
  console.log(`Snapshots: ${embeddedData.stats.snapshotCount}`);
  console.log(`Source snapshot data: ${(embeddedData.stats.rawSnapshotBytes / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`Packed data payload: ${(embeddedData.stats.compressedPayloadBytes / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`Self-contained HTML: ${(outputStats.size / 1024 / 1024).toFixed(2)} MiB`);
}

await main();
