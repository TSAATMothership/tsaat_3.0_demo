import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { initializeJsonStore, repositoryRoot } from "./setup-json-store.mjs";
const require = createRequire(import.meta.url);
const [command, mode, ...args] = process.argv.slice(2);
if (!["build", "dev", "start"].includes(command) || !["sql", "nosql"].includes(mode)) throw new Error("Usage: node scripts/run-app.mjs <build|dev|start> <sql|nosql> [Next options]");
if (mode === "nosql") {
  const result = await initializeJsonStore();
  console.log("No-SQL JSON data: " + result.directory + (result.created ? " (initialized from repository JSON)" : " (existing data retained)"));
}
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), command, ...args], {
  cwd: repositoryRoot, stdio: "inherit", env: { ...process.env, TSAAT_DATA_PROVIDER: mode === "nosql" ? "json" : "sql" }, windowsHide: true
});
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
