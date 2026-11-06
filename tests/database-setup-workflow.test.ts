import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = process.cwd();
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

describe("complete database setup with isolated SQL boundary", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-setup-workflow-"));
    await fs.mkdir(path.join(directory, "scripts"));
    await fs.mkdir(path.join(directory, "node_modules/tsx"), { recursive: true });
    await fs.writeFile(path.join(directory, "node_modules/tsx/package.json"), "{}");
    for (const file of ["ensure-db-config.ps1", "prepare-database.ps1", "invoke-dpapi.ps1"]) {
      await fs.copyFile(path.join(root, "scripts", file), path.join(directory, "scripts", file));
    }
    await fs.writeFile(path.join(directory, "scripts/bootstrap-demo-database.ps1"), `
param($DatabaseName, $ServerInstance, $EncryptConnection, $TrustServerCertificate, $SqlUser, $SqlPassword)
if (-not $EncryptConnection -or -not $TrustServerCertificate) { throw 'TLS defaults were lost' }
if ($ServerInstance -ne 'tcp:test-server,1444') { throw 'TCP target was lost' }
Add-Content -LiteralPath $env:TSAAT_TEST_TRACE -Value 'bootstrap'
if ($env:TSAAT_TEST_SCENARIO -eq 'bootstrap-failure') { throw 'Simulated loader failure' }
`);
  });
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

  function run(scenario: string, setup = true) {
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(TSAAT_SQL_|TSAAT_DB_CONFIG_|TSAAT_APP_DATABASE$)/.test(key)) delete env[key];
    Object.assign(env, {
      TSAAT_SQL_SERVER: "test-server,1444", TSAAT_APP_DATABASE: "TSAAT_Setup_Test",
      TSAAT_SQL_USER: "test-user", TSAAT_SQL_PASSWORD: "test-secret",
      TSAAT_DB_CONFIG_ASSUME_YES: "true", TSAAT_TEST_SCENARIO: scenario,
      SQLCMD_PATH: path.join(directory, "scripts/bootstrap-demo-database.ps1"),
      TSAAT_TEST_TRACE: path.join(directory, "trace.txt")
    });
    const command = `
$ErrorActionPreference = 'Stop'
function New-Object {
  param([string]$TypeName, [object[]]$ArgumentList)
  if ($TypeName -ne 'System.Data.SqlClient.SqlConnection') { return Microsoft.PowerShell.Utility\\New-Object @PSBoundParameters }
  $connection = [pscustomobject]@{}
  $connection | Add-Member ScriptMethod Open { if ($env:TSAAT_TEST_SCENARIO -eq 'connection-failure') { throw 'Simulated connection failure' } }
  $connection | Add-Member ScriptMethod Dispose { }
  $connection | Add-Member ScriptMethod CreateCommand {
    $command = [pscustomobject]@{ CommandText = ''; Parameters = (Microsoft.PowerShell.Utility\\New-Object System.Data.SqlClient.SqlCommand).Parameters }
    $command | Add-Member ScriptMethod ExecuteScalar { return [int]($env:TSAAT_TEST_SCENARIO -in @('existing', 'validation-failure')) }
    return $command
  }
  return $connection
}
function node {
  $settings = ($input | Out-String) | ConvertFrom-Json
  if ($settings.password -ne 'test-secret') { throw 'Credentials did not reach validation' }
  Add-Content -LiteralPath $env:TSAAT_TEST_TRACE -Value 'validate'
  $global:LASTEXITCODE = [int]($env:TSAAT_TEST_SCENARIO -eq 'validation-failure')
}
& ${quote(path.join(directory, "scripts/ensure-db-config.ps1"))} -RepoRoot ${quote(directory)} ${setup ? "-SetupDatabase" : ""}
`;
    return spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { cwd: directory, env, input: "", encoding: "utf8" });
  }

  async function trace() {
    return fs.readFile(path.join(directory, "trace.txt"), "utf8").catch(() => "");
  }

  it("creates schema/data before validating and publishing encrypted settings", async () => {
    const result = run("new");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect((await trace()).trim().split(/\r?\n/)).toEqual(["bootstrap", "validate"]);
    const config = await fs.readFile(path.join(directory, "DB_config"), "utf8");
    expect(config).toContain("ciphertextBase64");
    expect(config + result.stdout + result.stderr).not.toContain("test-secret");
  });

  it("validates an existing database without bootstrap and preserves config on a rerun", async () => {
    expect(run("existing").status).toBe(0);
    const before = await fs.readFile(path.join(directory, "DB_config"), "utf8");
    expect(run("existing").status).toBe(0);
    expect(await fs.readFile(path.join(directory, "DB_config"), "utf8")).toBe(before);
    expect((await trace()).trim().split(/\r?\n/)).toEqual(["validate", "validate"]);
  });

  it.each(["connection-failure", "bootstrap-failure", "validation-failure"])("does not publish config after %s", async scenario => {
    const result = run(scenario);
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("Database ready.");
    expect(result.stdout + result.stderr).not.toContain("test-secret");
    await expect(fs.access(path.join(directory, "DB_config"))).rejects.toThrow();
    if (scenario === "connection-failure") expect(await trace()).toBe("");
  });

  it("leaves saved config intact when existing database validation fails", async () => {
    expect(run("existing", false).status).toBe(0);
    const before = await fs.readFile(path.join(directory, "DB_config"), "utf8");
    expect(run("validation-failure").status).not.toBe(0);
    expect(await fs.readFile(path.join(directory, "DB_config"), "utf8")).toBe(before);
    expect((await trace()).trim()).toBe("validate");
  });
});
