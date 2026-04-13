#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const nextCliPath = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const nextPackagePath = path.join(repoRoot, "node_modules", "next", "package.json");
const swcPackageBinaryPath = path.join(
  repoRoot,
  "node_modules",
  "@next",
  "swc-win32-x64-msvc",
  "next-swc.win32-x64-msvc.node"
);
const swcFallbackBinaryPath = path.join(
  repoRoot,
  "node_modules",
  "next",
  "next-swc-fallback",
  "@next",
  "swc-win32-x64-msvc",
  "next-swc.win32-x64-msvc.node"
);
const stagedSwcBinaryPath = path.join(
  repoRoot,
  "Dependencies",
  "external",
  "@next",
  "swc-win32-x64-msvc",
  "next-swc.win32-x64-msvc.node"
);

function fileExists(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function ensureOfflineSwcBinary() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    return;
  }

  if (!fileExists(nextPackagePath)) {
    console.error("[ERROR] Missing node_modules\\next\\package.json.");
    console.error("[ERROR] Restore dependencies before running npm run dev.");
    process.exit(1);
  }

  if (fileExists(swcPackageBinaryPath) || fileExists(swcFallbackBinaryPath)) {
    return;
  }

  if (fileExists(stagedSwcBinaryPath)) {
    fs.mkdirSync(path.dirname(swcPackageBinaryPath), { recursive: true });
    fs.copyFileSync(stagedSwcBinaryPath, swcPackageBinaryPath);
    console.log("[INFO] Copied staged SWC binary into node_modules for offline dev.");
    return;
  }

  console.error("[ERROR] Missing Next.js SWC binary for offline dev on win32-x64.");
  console.error(`[ERROR] Expected one of:`);
  console.error(`  ${swcPackageBinaryPath}`);
  console.error(`  ${swcFallbackBinaryPath}`);
  console.error("[ERROR] Staged external SWC binary not found:");
  console.error(`  ${stagedSwcBinaryPath}`);
  console.error("[ERROR] Pre-stage the SWC artifact or run compileApp.cmd first.");
  process.exit(1);
}

function runNextDev() {
  if (!fileExists(nextCliPath)) {
    console.error(`[ERROR] Missing Next.js CLI: ${nextCliPath}`);
    console.error("[ERROR] Restore dependencies before running npm run dev.");
    process.exit(1);
  }

  const env = {
    ...process.env,
    NEXT_DISABLE_SWC_DOWNLOAD: "1",
    NEXT_SKIP_SWC_DOWNLOAD: "1",
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "1"
  };
  const args = [nextCliPath, "dev", ...process.argv.slice(2)];
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(typeof code === "number" ? code : 1);
  });
}

ensureOfflineSwcBinary();
runNextDev();
