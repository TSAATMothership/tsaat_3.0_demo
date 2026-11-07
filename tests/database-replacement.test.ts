import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.join(process.cwd(), "scripts/remove-setup-database.ps1").replaceAll("'", "''");
describe("database replacement target guards", () => {
  it.each(["master", "model", "msdb", "tempdb", "TSAATDB;DROP DATABASE other", "bad]name"])("refuses %s before opening SQL", database => {
    const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `
$ErrorActionPreference='Stop'
function New-Object { throw 'Unexpected connection attempt' }
$settings=[pscustomobject]@{database='${database}';server='test-server'}
$administrator=[pscustomobject]@{authMode='trusted'}
& '${script}' -Settings $settings -Administrator $administrator -ExpectedIdentity 'test-identity'
`], { encoding: "utf8", input: "" });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("System databases cannot be replaced");
    expect(result.stdout + result.stderr).not.toContain("Unexpected connection attempt");
  });
});
