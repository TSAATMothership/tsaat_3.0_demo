import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = process.cwd();
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const manifest = JSON.parse(await fs.readFile("Database Schema/data/database-build-manifest.json", "utf8"));

describe("database bootstrap against the current inventory package", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-bootstrap-"));
    for (const folder of ["scripts", "Database Schema/loaders", "Database Schema/migrations", "Database Schema/data", "data/snapshots"]) {
      await fs.mkdir(path.join(directory, folder), { recursive: true });
    }
    // Run the real bootstrap. Only the external SQL boundary and lower loader
    // are replaced; referenced post-load files must exist in today's checkout.
    for (const file of ["scripts/bootstrap-demo-database.ps1", "Database Schema/migrations/026_populate_demo_entity_panel_details.sql", "Database Schema/loaders/populate-sample-cve-metadata.sql"]) {
      await fs.copyFile(path.join(root, file), path.join(directory, file));
    }
    await fs.writeFile(path.join(directory, "Database Schema/loaders/build-and-load-database.ps1"), `
param($DatabaseName, $ServerInstance, $SqlUser, $SqlPassword, [switch]$EncryptConnection, [switch]$TrustServerCertificate, $DataLoadMode, [switch]$RequireNewDatabase)
if (!$RequireNewDatabase -or $DataLoadMode -ne 'ClientPayload') { throw 'Missing fresh-database/payload guard' }
if ($EncryptConnection -or $TrustServerCertificate) { throw 'Setup transport policy changed' }
Add-Content -LiteralPath $env:TSAAT_TEST_TRACE -Value '{"stage":"load"}'
$global:LASTEXITCODE = 0
`);
    await fs.writeFile(path.join(directory, "sqlcmd.ps1"), `
$query = ''; $sqlFile = ''; $sqlText = ''
for ($index = 0; $index -lt $args.Count; $index++) {
  if ($args[$index] -eq '-Q') { $query = $args[$index + 1] }
  if ($args[$index] -eq '-i') { $sqlFile = $args[$index + 1]; $sqlText = [IO.File]::ReadAllText($sqlFile) }
}
@{ query=$query; file=$sqlFile; sql=$sqlText } | ConvertTo-Json -Compress | Add-Content -LiteralPath $env:TSAAT_TEST_TRACE
$global:LASTEXITCODE = 0
if ($env:TSAAT_TEST_SCENARIO -eq 'existing' -and $query.Contains('DB_ID')) { $global:LASTEXITCODE = 1 }
if ($env:TSAAT_TEST_SCENARIO -eq 'population-failure' -and $sqlText.Contains('TSAAT_SAMPLE_CVE_METADATA')) { $global:LASTEXITCODE = 1 }
`);
  });
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

  function run(script = "scripts/bootstrap-demo-database.ps1", extra = "", scenario = "new") {
    return spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
      `& ${quote(path.join(directory, script))} -DatabaseName TSAAT_Bootstrap_Test -ServerInstance test-server -EncryptConnection:$false -TrustServerCertificate:$false ${extra}`
    ], { cwd: directory, encoding: "utf8", env: { ...process.env, SQLCMD_PATH: path.join(directory, "sqlcmd.ps1"),
      TSAAT_TEST_TRACE: path.join(directory, "trace.jsonl"), TSAAT_TEST_SCENARIO: scenario } });
  }
  async function trace(): Promise<{ stage?: string; query?: string; file?: string; sql?: string }[]> {
    return (await fs.readFile(path.join(directory, "trace.jsonl"), "utf8")).trim().split(/\r?\n/).map(line => JSON.parse(line));
  }

  it("finishes bootstrap using only retained population scripts", async () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("schema and bundled sample data are ready");
    const calls = await trace();
    expect(calls).toHaveLength(4);
    expect(calls[0].query).toContain("DB_ID");
    expect(calls[1].stage).toBe("load");
    expect(calls[2].file).toContain("026_populate_demo_entity_panel_details.sql");
    expect(calls[3].sql).toContain("TSAAT_SAMPLE_CVE_METADATA");
    expect(JSON.stringify(calls)).not.toMatch(/server_patch|PATCH_MANAGEMENT/);
    await expect(fs.access(calls[3].file!)).rejects.toThrow(); // SQL input is temporary.
  });

  it("refuses an existing database before invoking the loader", async () => {
    const result = run(undefined, "", "existing");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Preflight failed");
    expect(await trace()).toHaveLength(1);
  });

  it("propagates a retained population failure instead of reporting success", async () => {
    const result = run(undefined, "", "population-failure");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Sample population failed");
    expect(result.stdout).not.toContain("sample data are ready");
    const calls = await trace();
    await expect(fs.access(calls[3].file!)).rejects.toThrow();
  });

  it("probes a manifest-selected retained reference in SqlServerFiles mode", async () => {
    const loader = "Database Schema/loaders/build-and-load-database.ps1";
    await fs.copyFile(path.join(root, loader), path.join(directory, loader));
    const files = ["Database Schema/database-schema.sql", "Database Schema/data/database-build-manifest.json",
      "Database Schema/loaders/load-data.sql", "Database Schema/loaders/validate-database.sql",
      ...Object.values(manifest.packageDataFiles).map(file => "Database Schema/" + file),
      ...manifest.freshSchemaMigrations.map((file: string) => "Database Schema/migrations/" + file)];
    for (const file of files) await fs.copyFile(path.join(root, file), path.join(directory, file));
    for (const file of manifest.snapshotFiles) await fs.writeFile(path.join(directory, "data/snapshots", file), "{}");
    const result = run(loader, "-DataLoadMode SqlServerFiles -SqlServerPackageDataRoot 'C:\\staged\\references' -SqlServerSnapshotsRoot 'C:\\staged\\snapshots'");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const probes = (await trace()).filter(call => call.query?.includes("OPENROWSET"));
    expect(probes).toHaveLength(2);
    const firstReference = path.basename(Object.values(manifest.packageDataFiles)[0] as string);
    expect(probes[0].query).toContain(`C:\\staged\\references\\${firstReference}`);
    expect(probes[0].query).not.toContain("reference-versions.json");
    expect(probes[1].query).toContain(`C:\\staged\\snapshots\\${manifest.snapshotFiles[0]}`);
  });
});
