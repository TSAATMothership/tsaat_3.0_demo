#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");

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
const bundledSwcTarballPath = path.join(
  repoRoot,
  "Dependencies",
  "offline-artifacts",
  "@next",
  "swc-win32-x64-msvc-14.2.33.tgz"
);
const bundledSwcExtractDir = path.join(
  repoRoot,
  "Dependencies",
  "external",
  "cache",
  "swc-win32-x64-msvc-14.2.33"
);
const bundledSwcExtractedBinaryPath = path.join(
  bundledSwcExtractDir,
  "package",
  "next-swc.win32-x64-msvc.node"
);
const requiredSwcPackage = "@next/swc-win32-x64-msvc@14.2.33";
const requiredSwcBinaryBytes = 135864320;
const requiredSwcBinarySha256 = "2CDDED4F290711FBD6911D880AA1A653519AF42C6139B9AE07C4D408A42B9B1B";
const requiredSwcTarballBytes = 41491235;
const requiredSwcTarballSha256 = "AB5D8BC3837EF28228FEBBED8AC51CB9E5E460B351ADCCF169B7EC7888127382";
const requiredSwcDownloadUrl =
  "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz";

function fileExists(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function sha256Upper(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex").toUpperCase();
}

function validateSwcBinary(filePath, sourceLabel) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (error) {
    console.error(`[ERROR] Unable to inspect SWC binary from ${sourceLabel}: ${filePath}`);
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  }

  if (!stat.isFile()) {
    console.error(`[ERROR] SWC binary path is not a file (${sourceLabel}): ${filePath}`);
    process.exit(1);
  }

  if (stat.size !== requiredSwcBinaryBytes) {
    console.error(`[ERROR] Unexpected SWC binary size (${sourceLabel}): ${filePath}`);
    console.error(
      `[ERROR] Expected ${requiredSwcBinaryBytes} bytes for ${requiredSwcPackage}; found ${stat.size} bytes.`
    );
    console.error(`[ERROR] Re-stage the exact artifact from: ${requiredSwcDownloadUrl}`);
    process.exit(1);
  }

  const hash = sha256Upper(filePath);
  if (hash !== requiredSwcBinarySha256) {
    console.error(`[ERROR] Unexpected SWC binary hash (${sourceLabel}): ${filePath}`);
    console.error(`[ERROR] Expected SHA-256: ${requiredSwcBinarySha256}`);
    console.error(`[ERROR] Actual SHA-256:   ${hash}`);
    console.error(`[ERROR] Re-stage the exact artifact from: ${requiredSwcDownloadUrl}`);
    process.exit(1);
  }
}

function validateBundledSwcTarball(filePath, sourceLabel) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (error) {
    console.error(`[ERROR] Unable to inspect bundled SWC archive from ${sourceLabel}: ${filePath}`);
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  }

  if (!stat.isFile()) {
    console.error(`[ERROR] Bundled SWC archive path is not a file (${sourceLabel}): ${filePath}`);
    process.exit(1);
  }

  if (stat.size !== requiredSwcTarballBytes) {
    console.error(`[ERROR] Unexpected bundled SWC archive size (${sourceLabel}): ${filePath}`);
    console.error(
      `[ERROR] Expected ${requiredSwcTarballBytes} bytes for ${requiredSwcPackage}; found ${stat.size} bytes.`
    );
    console.error(`[ERROR] Re-acquire the exact artifact from: ${requiredSwcDownloadUrl}`);
    process.exit(1);
  }

  const hash = sha256Upper(filePath);
  if (hash !== requiredSwcTarballSha256) {
    console.error(`[ERROR] Unexpected bundled SWC archive hash (${sourceLabel}): ${filePath}`);
    console.error(`[ERROR] Expected SHA-256: ${requiredSwcTarballSha256}`);
    console.error(`[ERROR] Actual SHA-256:   ${hash}`);
    console.error(`[ERROR] Re-acquire the exact artifact from: ${requiredSwcDownloadUrl}`);
    process.exit(1);
  }
}

function extractSwcFromBundledArchive() {
  if (!fileExists(bundledSwcTarballPath)) {
    return false;
  }

  validateBundledSwcTarball(bundledSwcTarballPath, "repository artifact");
  fs.mkdirSync(bundledSwcExtractDir, { recursive: true });

  const tarResult = spawnSync("tar", ["-xf", bundledSwcTarballPath, "-C", bundledSwcExtractDir], {
    cwd: repoRoot,
    stdio: "pipe"
  });
  if (tarResult.error) {
    console.error("[ERROR] Failed to run tar while extracting bundled SWC archive.");
    console.error(`[ERROR] ${tarResult.error.message}`);
    process.exit(1);
  }
  if (typeof tarResult.status === "number" && tarResult.status !== 0) {
    console.error("[ERROR] tar failed while extracting bundled SWC archive.");
    process.stderr.write(tarResult.stderr ? tarResult.stderr.toString() : "");
    process.exit(1);
  }

  if (!fileExists(bundledSwcExtractedBinaryPath)) {
    console.error("[ERROR] Bundled SWC archive did not contain expected binary:");
    console.error(`  ${bundledSwcExtractedBinaryPath}`);
    process.exit(1);
  }

  validateSwcBinary(bundledSwcExtractedBinaryPath, "bundled archive extracted binary");
  fs.mkdirSync(path.dirname(stagedSwcBinaryPath), { recursive: true });
  fs.copyFileSync(bundledSwcExtractedBinaryPath, stagedSwcBinaryPath);
  validateSwcBinary(stagedSwcBinaryPath, "staged from bundled archive");
  console.log("[INFO] Extracted SWC binary from bundled in-repo archive.");
  return true;
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

  if (fileExists(swcPackageBinaryPath)) {
    validateSwcBinary(swcPackageBinaryPath, "node_modules package path");
    return;
  }

  if (fileExists(swcFallbackBinaryPath)) {
    validateSwcBinary(swcFallbackBinaryPath, "node_modules fallback path");
    return;
  }

  if (fileExists(stagedSwcBinaryPath)) {
    validateSwcBinary(stagedSwcBinaryPath, "staged external path");
    fs.mkdirSync(path.dirname(swcPackageBinaryPath), { recursive: true });
    fs.copyFileSync(stagedSwcBinaryPath, swcPackageBinaryPath);
    validateSwcBinary(swcPackageBinaryPath, "copied node_modules package path");
    console.log("[INFO] Copied staged SWC binary into node_modules for offline dev.");
    return;
  }

  if (extractSwcFromBundledArchive()) {
    fs.mkdirSync(path.dirname(swcPackageBinaryPath), { recursive: true });
    fs.copyFileSync(stagedSwcBinaryPath, swcPackageBinaryPath);
    validateSwcBinary(swcPackageBinaryPath, "copied node_modules package path");
    console.log("[INFO] Copied extracted SWC binary into node_modules for offline dev.");
    return;
  }

  console.error("[ERROR] Missing Next.js SWC binary for offline dev on win32-x64.");
  console.error(`[ERROR] Expected one of:`);
  console.error(`  ${swcPackageBinaryPath}`);
  console.error(`  ${swcFallbackBinaryPath}`);
  console.error("[ERROR] Staged external SWC binary not found:");
  console.error(`  ${stagedSwcBinaryPath}`);
  console.error("[ERROR] Bundled SWC archive not found:");
  console.error(`  ${bundledSwcTarballPath}`);
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
