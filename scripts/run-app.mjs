import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkOfflineDependencies } from "./offline-dependencies.mjs";
import { initializeJsonStore, repositoryRoot } from "./setup-json-store.mjs";
const require = createRequire(import.meta.url);
const [command, mode, ...args] = process.argv.slice(2);
if (!["build", "dev", "start"].includes(command) || !["sql", "nosql"].includes(mode)) throw new Error("Usage: node scripts/run-app.mjs <build|dev|start> <sql|nosql> [Next options]");
if (fs.existsSync(path.join(repositoryRoot, '.local/offline-install.lock'))) {
  console.error('An offline installation is in progress or was interrupted. Wait for it to finish before starting or building the app. See docs/offline-builds.md for interrupted-install recovery.');
  process.exit(1);
}
let nextCli;
try {
  nextCli = require.resolve("next/dist/bin/next");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
  console.error("Next.js is missing or incomplete in node_modules.");
  console.error(`From the repository root (${repositoryRoot}), run: npm run install:offline`);
  console.error('This stops checkout app servers before running npm ci --offline.');
  console.error(`Then retry npm run ${command}:${mode} with your original options. Installation uses the committed vendor/npm archives; no network is needed.`);
  process.exit(1);
}
const env = { ...process.env, TSAAT_DATA_PROVIDER: mode === "nosql" ? "json" : "sql", NEXT_TELEMETRY_DISABLED: "1" };
let attemptDirectory;
function finish(code) {
  process.exitCode = code ?? 1;
  if (attemptDirectory) {
    if (fs.existsSync(env.TSAAT_OFFLINE_ATTEMPTS)) {
      console.error(fs.readFileSync(env.TSAAT_OFFLINE_ATTEMPTS, "utf8"));
      process.exitCode = 1; // Also reject attempts caught/suppressed by dependencies.
      fs.unlinkSync(env.TSAAT_OFFLINE_ATTEMPTS);
    }
    fs.rmdirSync(attemptDirectory);
  }
}
if (command === "build") {
  console.log(`Offline dependencies verified: ${checkOfflineDependencies()} archives.`);
  attemptDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tsaat-offline-build-"));
  env.TSAAT_OFFLINE_ATTEMPTS = path.join(attemptDirectory, "attempts.log");
  const preload = path.join(repositoryRoot, "scripts/offline-network.cjs").replaceAll("\\", "/");
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --require "${preload}"`.trim();
  env.npm_config_offline = "true";
  env.npm_config_audit = "false";
  console.log("Compiling with network access blocked in Node build processes.");
  console.log("Running the required ESLint CLI check before compilation.");
  const lint = spawnSync(process.execPath, [path.join(repositoryRoot, 'scripts/lint.mjs')], {
    cwd: repositoryRoot, stdio: 'inherit', env, windowsHide: true
  });
  if (lint.error) console.error(lint.error.message);
  if (lint.status !== 0 || fs.existsSync(env.TSAAT_OFFLINE_ATTEMPTS)) {
    finish(lint.status ?? 1);
    process.exit(process.exitCode);
  }
}
if (mode === "nosql") {
  const result = await initializeJsonStore();
  console.log("No-SQL JSON data: " + result.directory + (result.created ? " (initialized from repository JSON)" : " (existing data retained)"));
}
const child = spawn(process.execPath, [nextCli, command, ...args], {
  cwd: repositoryRoot, stdio: "inherit", env, windowsHide: true
});
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("close", finish);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
