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
if ($EncryptConnection -or $TrustServerCertificate) { throw 'SSL must be disabled' }
if ($ServerInstance -ne 'test-server,1444') { throw 'Server target was lost' }
if ($SqlUser -ne 'setup-admin' -or $SqlPassword -ne 'admin-secret') { throw 'Bootstrap did not use administrator credentials' }
Add-Content -LiteralPath $env:TSAAT_TEST_TRACE -Value 'bootstrap'
if ($env:TSAAT_TEST_SCENARIO -eq 'bootstrap-failure') { throw 'Simulated loader failure' }
`);
    await fs.writeFile(path.join(directory, "scripts/configure-database-user.ps1"), `
param($Settings, $Administrator, [switch]$CheckOnly, [byte[]]$VerifiedLoginSid)
if ($Settings.authMode -ne 'sql' -or $Settings.password -ne 'test-secret' -or $Settings.sslEnabled) { throw 'Wrong application settings' }
if ($Administrator.userId -ne 'setup-admin' -or $Administrator.password -ne 'admin-secret' -or $Administrator.sslEnabled) { throw 'Wrong administrator settings' }
if ($CheckOnly) {
  Add-Content -LiteralPath $env:TSAAT_TEST_TRACE -Value 'login-preflight'
  if ($env:TSAAT_TEST_SCENARIO -eq 'login-collision') { throw 'Login already exists' }
  return [pscustomobject]@{ LoginSid = [byte[]]@(1,2,3) }
} else {
  if (($VerifiedLoginSid -join ',') -ne '1,2,3') { throw 'Verified login identity was not preserved' }
  Add-Content -LiteralPath $env:TSAAT_TEST_TRACE -Value 'login-create'
  if ($env:TSAAT_TEST_SCENARIO -eq 'login-failure') { throw 'Login creation failed' }
}
`);
    await fs.writeFile(path.join(directory, "scripts/remove-setup-database.ps1"), `
param($Settings, $Administrator, $ExpectedIdentity)
if ($Settings.database -ne 'TSAAT_Setup_Test' -or $ExpectedIdentity -ne '7|2026-11-06 12:00:00.000') { throw 'Wrong replacement target' }
if ($Administrator.userId -ne 'setup-admin' -or $Administrator.password -ne 'admin-secret') { throw 'Wrong drop credentials' }
Add-Content -LiteralPath $env:TSAAT_TEST_TRACE -Value 'drop'
if ($env:TSAAT_TEST_SCENARIO -eq 'existing-drop-failure') { throw 'Simulated drop failure' }
`);
  });
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

  function run(scenario: string, setup = true, options: { replacement?: string; confirmation?: string } = {}) {
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(TSAAT_SQL_|TSAAT_DB_CONFIG_|TSAAT_DB_REPLACE_EXISTING$|TSAAT_APP_DATABASE$)/.test(key)) delete env[key];
    Object.assign(env, {
      TSAAT_SQL_SERVER: "test-server,1444", TSAAT_APP_DATABASE: "TSAAT_Setup_Test",
      TSAAT_SQL_USER: "test-user", TSAAT_SQL_PASSWORD: "test-secret",
      TSAAT_SQL_ADMIN_USER: "setup-admin", TSAAT_SQL_ADMIN_PASSWORD: "admin-secret",
      TSAAT_DB_CONFIG_ASSUME_YES: "true", TSAAT_TEST_SCENARIO: scenario,
      TSAAT_DB_REPLACE_EXISTING: options.replacement ?? "TSAAT_Setup_Test",
      SQLCMD_PATH: path.join(directory, "scripts/bootstrap-demo-database.ps1"),
      TSAAT_TEST_TRACE: path.join(directory, "trace.txt")
    });
    const command = `
$ErrorActionPreference = 'Stop'
function New-Object {
  param([string]$TypeName, [object[]]$ArgumentList)
  if ($TypeName -ne 'System.Data.SqlClient.SqlConnection') { return Microsoft.PowerShell.Utility\\New-Object @PSBoundParameters }
  $parsed = Microsoft.PowerShell.Utility\\New-Object System.Data.SqlClient.SqlConnectionStringBuilder -ArgumentList $ArgumentList
  if ($parsed.Encrypt -or $parsed.IntegratedSecurity -or $parsed.UserID -ne 'setup-admin') { throw 'Wrong administrator connection string' }
  $connection = [pscustomobject]@{}
  $connection | Add-Member ScriptMethod Open { if ($env:TSAAT_TEST_SCENARIO -eq 'connection-failure') { throw 'Simulated connection failure' } }
  $connection | Add-Member ScriptMethod Dispose { }
  $connection | Add-Member ScriptMethod CreateCommand {
    $command = [pscustomobject]@{ CommandText = ''; Parameters = (Microsoft.PowerShell.Utility\\New-Object System.Data.SqlClient.SqlCommand).Parameters }
    $command | Add-Member ScriptMethod ExecuteScalar {
      if ($env:TSAAT_TEST_SCENARIO.StartsWith('existing') -or $env:TSAAT_TEST_SCENARIO -eq 'validation-failure') { return '7|2026-11-06 12:00:00.000' }
      return $null
    }
    return $command
  }
  return $connection
}
function node {
  $settings = ($input | Out-String) | ConvertFrom-Json
  if ($settings.sslEnabled) { throw 'SSL enabled during validation' }
  if ($settings.userId -eq 'setup-admin') {
    if ($settings.password -ne 'admin-secret') { throw 'Administrator credentials did not reach validation' }
    Add-Content -LiteralPath $env:TSAAT_TEST_TRACE -Value 'validate-admin'
    $global:LASTEXITCODE = [int]($env:TSAAT_TEST_SCENARIO -eq 'validation-failure')
  } else {
    if ($settings.password -ne 'test-secret') { throw 'Credentials did not reach validation' }
    Add-Content -LiteralPath $env:TSAAT_TEST_TRACE -Value 'validate-app'
    $global:LASTEXITCODE = [int]($env:TSAAT_TEST_SCENARIO -eq 'app-validation-failure')
  }
}
${options.confirmation === undefined ? `& ${quote(path.join(directory, "scripts/ensure-db-config.ps1"))} -RepoRoot ${quote(directory)} ${setup ? "-SetupDatabase" : ""}` : `
function Read-Host { param($Prompt); Write-Host $Prompt; return ${quote(options.confirmation)} }
$settings=[pscustomobject]@{server='test-server,1444'; database='TSAAT_Setup_Test';authMode='sql';userId='test-user';password='test-secret';sslEnabled=$false;sslType='strict'}
$administrator=[pscustomobject]@{authMode='sql';userId='setup-admin';password='admin-secret'}
& ${quote(path.join(directory, "scripts/prepare-database.ps1"))} -Settings $settings -Administrator $administrator -RepoRoot ${quote(directory)} -Interactive
`}
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
    expect((await trace()).trim().split(/\r?\n/)).toEqual(["login-preflight", "bootstrap", "validate-admin", "login-create", "validate-app"]);
    const config = await fs.readFile(path.join(directory, "DB_config"), "utf8");
    expect(config).toContain("ciphertextBase64");
    expect(config + result.stdout + result.stderr).not.toContain("test-secret");
    expect(config + result.stdout + result.stderr).not.toContain("admin-secret");
  });

  it("drops and rebuilds an existing database before reattaching the verified login", async () => {
    expect(run("existing").status).toBe(0);
    const before = await fs.readFile(path.join(directory, "DB_config"), "utf8");
    expect(run("existing").status).toBe(0);
    expect(await fs.readFile(path.join(directory, "DB_config"), "utf8")).toBe(before);
    const sequence = ["login-preflight", "drop", "bootstrap", "validate-admin", "login-create", "validate-app"];
    expect((await trace()).trim().split(/\r?\n/)).toEqual([...sequence, ...sequence]);
  });

  it.each(["connection-failure", "login-collision", "existing-drop-failure", "bootstrap-failure", "validation-failure", "login-failure", "app-validation-failure"])("does not publish config after %s", async scenario => {
    const result = run(scenario);
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("Database ready.");
    expect(result.stdout + result.stderr).not.toContain("test-secret");
    await expect(fs.access(path.join(directory, "DB_config"))).rejects.toThrow();
    if (scenario === "connection-failure") {
      expect(await trace()).toBe("");
      const output = result.stdout + result.stderr;
      expect(output).toContain("tcp:server,port");
      expect(output).toContain("answer n");
      expect(output).toContain("administrator credentials");
      expect(output).toContain("DB_config was not saved");
    }
  });

  it("leaves saved config intact when existing database validation fails", async () => {
    expect(run("existing").status).toBe(0);
    await fs.writeFile(path.join(directory, "trace.txt"), "");
    const before = await fs.readFile(path.join(directory, "DB_config"), "utf8");
    expect(run("validation-failure").status).not.toBe(0);
    expect(await fs.readFile(path.join(directory, "DB_config"), "utf8")).toBe(before);
    expect((await trace()).trim().split(/\r?\n/)).toEqual(["login-preflight", "drop", "bootstrap", "validate-admin"]);
  });

  it.each(["", "true", "OtherDatabase"])("refuses unattended replacement with acknowledgement %j", async replacement => {
    const result = run("existing", true, { replacement });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("TSAAT_DB_REPLACE_EXISTING");
    expect((await trace()).trim()).toBe("login-preflight");
    await expect(fs.access(path.join(directory, "DB_config"))).rejects.toThrow();
  });

  it.each(["", "y", "OtherDatabase"])("cancels interactive replacement after %j without deleting anything", async confirmation => {
    const result = run("existing", true, { confirmation });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("test-server,1444");
    expect(result.stdout).toContain("Type TSAAT_Setup_Test");
    expect((await trace()).trim()).toBe("login-preflight");
  });

  it("replaces after exact interactive confirmation", async () => {
    const result = run("existing", true, { confirmation: "TSAAT_Setup_Test" });
    expect(result.stderr).toBe(""); expect(result.status).toBe(0);
    expect((await trace()).trim().split(/\r?\n/)).toEqual(["login-preflight", "drop", "bootstrap", "validate-admin", "login-create", "validate-app"]);
  });

  it("refuses unattended conversion of a previously encrypted configuration", async () => {
    expect(run("existing", false).status).toBe(0);
    const before = await fs.readFile(path.join(directory, "DB_config"), "utf8");
    const result = run("existing");
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("interactively");
    expect(await fs.readFile(path.join(directory, "DB_config"), "utf8")).toBe(before);
    expect(await trace()).toBe("");
  });
});
