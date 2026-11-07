import { spawnSync } from "node:child_process";
import { promises as fs, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = process.cwd();
const source = readFileSync(path.join(root, "scripts/ensure-db-config.ps1"), "utf8");
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const library = source.slice(0, source.indexOf("$script:RepoRoot = Resolve-RepoRoot -InputRoot $RepoRoot"));

function cleanEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(TSAAT_SQL_|TSAAT_DB_CONFIG_|TSAAT_APP_DATABASE$)/.test(key)) delete env[key];
  }
  return env;
}

describe("interactive database setup", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "tsaat-setup-prompts-"));
    await fs.mkdir(path.join(directory, "scripts"));
    await fs.copyFile(path.join(root, "scripts/invoke-dpapi.ps1"), path.join(directory, "scripts/invoke-dpapi.ps1"));
    const interactiveScript = source
      .replace(/function Is-Interactive \{[\s\S]*?\r?\n\}/, "function Is-Interactive { return $true }")
      .replace(/function Resolve-LocalSqlExpressEndpoint \{[\s\S]*?\r?\n\}/, "function Resolve-LocalSqlExpressEndpoint { return 'tcp:127.0.0.1,14333' }");
    await fs.writeFile(path.join(directory, "scripts/ensure-db-config.ps1"), interactiveScript);
    // Keep real prompt/normalization/encryption behavior; isolate provisioning.
    await fs.writeFile(path.join(directory, "scripts/prepare-database.ps1"), `
param($Settings, $Administrator, $RepoRoot, $Interactive)
if ($Settings.database -ne 'TSAATDB') { throw 'Wrong setup database' }
if ($Settings.sslEnabled -or $Settings.sslType -ne 'strict') { throw 'SSL must be disabled' }
if ($Settings.authMode -ne 'sql' -or -not $Settings.userId -or -not $Settings.password) { throw 'Missing application credentials' }
if ($Administrator.sslEnabled -or $Administrator.database -ne 'master') { throw 'Wrong administrator connection' }
if ($Administrator.authMode -eq 'sql' -and ($Administrator.userId -ne 'setup_admin' -or $Administrator.password -ne 'admin-secret')) { throw 'Administrator credentials did not reach setup' }
if ($env:TSAAT_TEST_FAIL -eq 'true') { throw 'Simulated setup failure' }
`);
  });
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

  function run(answers: string[], fail = false) {
    const command = `
$ErrorActionPreference = 'Stop'
$global:setupAnswers = New-Object 'System.Collections.Generic.Queue[string]'
${answers.map(answer => `$global:setupAnswers.Enqueue(${quote(answer)})`).join("\n")}
function Read-Host {
  param([string]$Prompt, [switch]$AsSecureString)
  Add-Content -LiteralPath ${quote(path.join(directory, "prompts.txt"))} -Value $Prompt
  if ($global:setupAnswers.Count -eq 0) { throw 'Unexpected extra prompt' }
  $answer = $global:setupAnswers.Dequeue()
  if ($AsSecureString) {
    if ($answer -eq '') { return New-Object Security.SecureString }
    return ConvertTo-SecureString $answer -AsPlainText -Force
  }
  return $answer
}
& ${quote(path.join(directory, "scripts/ensure-db-config.ps1"))} -RepoRoot ${quote(directory)} -SetupDatabase
if ($global:setupAnswers.Count -ne 0) { throw 'Not all prompt answers were used' }
`;
    return spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
      cwd: directory, encoding: "utf8", input: "", env: { ...cleanEnvironment(), TSAAT_TEST_FAIL: String(fail) }
    });
  }

  function inspect() {
    return spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "scripts/emit-db-config-env.ps1"), "-RepoRoot", directory], {
      cwd: directory, encoding: "utf8", input: "", env: cleanEnvironment()
    });
  }

  it.each(["y", ""])("accepts local SQLEXPRESS (%j) and creates configuration for TSAATDB without another endpoint prompt", async answer => {
    const result = run([answer, "", "app-secret", "app-secret", ""]);
    expect(result.stderr).toBe(""); expect(result.status).toBe(0);
    const prompts = await fs.readFile(path.join(directory, "prompts.txt"), "utf8");
    expect(prompts).toContain("Is the SQL Server endpoint localhost\\SQLEXPRESS? [Y/n]");
    expect(prompts).not.toContain("SQL Server endpoint (for example");
    const saved = inspect();
    expect(saved.status).toBe(0);
    expect(saved.stdout).toContain('set "DB_CONF_SERVER=tcp:127.0.0.1,14333"');
    expect(saved.stdout).toContain('set "DB_CONF_DATABASE=TSAATDB"');
    expect(saved.stdout).toContain('set "DB_CONF_ENCRYPT=false"');
    expect(saved.stdout).toContain('set "DB_CONF_TRUST_SERVER_CERTIFICATE=false"');
    expect(saved.stdout).toContain('set "DB_CONF_AUTH_MODE=sql"');
    expect(saved.stdout).toContain('set "DB_CONF_USER_ID=tsaat_app"');
    expect(saved.stdout).toContain('set "DB_CONF_PASSWORD=app-secret"');
    expect(prompts).not.toContain('Enable SQL SSL');
    expect(prompts).not.toContain('Authentication mode');
    expect(prompts).toContain('Database password');
    expect(result.stdout + result.stderr + await fs.readFile(path.join(directory, "DB_config"), "utf8")).not.toContain('app-secret');
  });

  it("asks for a custom endpoint after no, and retries blank/invalid input", async () => {
    const result = run(["n", "", "bad;endpoint", "tcp:db-host,1444", "chosen_user", "app-secret", "app-secret", ""]);
    expect(result.stderr).toBe(""); expect(result.status).toBe(0);
    expect(await fs.readFile(path.join(directory, "prompts.txt"), "utf8")).toContain("SQL Server endpoint (for example");
    const saved = inspect();
    expect(saved.stdout).toContain('set "DB_CONF_SERVER=tcp:db-host,1444"');
    expect(saved.stdout).toContain('set "DB_CONF_DATABASE=TSAATDB"');
    expect(saved.stdout).toContain('set "DB_CONF_USER_ID=chosen_user"');
  });

  it("asks again with saved configuration and changes only after successful setup", async () => {
    expect(run(["y", "", "app-secret", "app-secret", ""]).status).toBe(0);
    const before = await fs.readFile(path.join(directory, "DB_config"), "utf8");
    expect(run(["n", "tcp:replacement,1555", "", "app-secret", "app-secret", ""], true).status).not.toBe(0);
    expect(await fs.readFile(path.join(directory, "DB_config"), "utf8")).toBe(before);
    expect(run(["n", "tcp:replacement,1555", "", "app-secret", "app-secret", ""]).status).toBe(0);
    const saved = inspect();
    expect(saved.stdout).toContain('set "DB_CONF_SERVER=tcp:replacement,1555"');
    expect(saved.stdout).toContain('set "DB_CONF_TRUST_SERVER_CERTIFICATE=false"');
    const prompts = await fs.readFile(path.join(directory, "prompts.txt"), "utf8");
    expect(prompts).not.toContain("Use these database settings?");
  });

  it("uses TSAATDB when interactive setup starts from an older saved database name", () => {
    const seeded = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "scripts/ensure-db-config.ps1"), "-RepoRoot", directory], {
      cwd: directory, encoding: "utf8", input: "", env: {
        ...cleanEnvironment(), TSAAT_DB_CONFIG_ASSUME_YES: "true", TSAAT_SQL_SERVER: "old-server",
        TSAAT_APP_DATABASE: "TSAAT_UI3", TSAAT_SQL_TRUSTED_CONNECTION: "true"
      }
    });
    expect(seeded.status).toBe(0);
    expect(run(["y", "", "app-secret", "app-secret", ""]).status).toBe(0);
    expect(inspect().stdout).toContain('set "DB_CONF_DATABASE=TSAATDB"');
    expect(inspect().stdout).toContain('set "DB_CONF_ENCRYPT=false"');
  });

  it("asks for separate SQL administrator credentials without persisting them", async () => {
    const result = run(["y", "new_app", "app-secret", "app-secret", "n", "setup_admin", "admin-secret"]);
    expect(result.stderr).toBe(""); expect(result.status).toBe(0);
    const output = result.stdout + result.stderr + inspect().stdout + await fs.readFile(path.join(directory, "DB_config"), "utf8");
    expect(output).not.toContain("admin-secret");
    expect(output).not.toContain("setup_admin");
  });

  it("retries blank passwords and mismatched confirmations", () => {
    const result = run(["y", "new_app", "", "bad;password", "app-secret", "different", "app-secret", "app-secret", "y"]);
    expect(result.stderr).toBe(""); expect(result.status).toBe(0);
    expect(result.stdout).toContain("Passwords do not match");
    expect(result.stdout).not.toContain("app-secret");
  });
});

describe("local SQLEXPRESS endpoint discovery", () => {
  it.each([
    ["static", "tcp:127.0.0.1,1444"],
    ["dynamic", "tcp:127.0.0.1,1555"],
    ["loopback", "tcp:127.0.0.1,14333"],
    ["disabled", "localhost\\SQLEXPRESS"],
    ["unassigned", "localhost\\SQLEXPRESS"],
    ["unavailable", "localhost\\SQLEXPRESS"]
  ])("resolves %s configuration without changing SQL Server", (scenario, expected) => {
    const command = `
$ErrorActionPreference = 'Stop'
. ([scriptblock]::Create(${quote(library)}))
function Get-ItemProperty {
  param([string]$LiteralPath, $ErrorAction)
  if (${quote(scenario)} -eq 'unavailable') { throw 'Registry unavailable' }
  if ($LiteralPath.EndsWith('Instance Names\\SQL')) { return [pscustomobject]@{SQLEXPRESS='MSSQL16.SQLEXPRESS'} }
  if ($LiteralPath.EndsWith('\\Tcp')) { return [pscustomobject]@{Enabled=([int](${quote(scenario)} -ne 'disabled')); ListenOnAllIPs=([int](${quote(scenario)} -ne 'loopback'))} }
  switch (${quote(scenario)}) {
    'static' { return [pscustomobject]@{TcpPort='1444'; TcpDynamicPorts='0'} }
    'dynamic' { return [pscustomobject]@{TcpPort=''; TcpDynamicPorts='1555'} }
    'loopback' { return [pscustomobject]@{Enabled=1; IpAddress='127.0.0.1'; TcpPort='14333'; TcpDynamicPorts=''} }
    default { return [pscustomobject]@{TcpPort='bad,65536'; TcpDynamicPorts='0'} }
  }
}
function Get-ChildItem { param($LiteralPath, $ErrorAction); return [pscustomobject]@{PSPath='loopback-address'} }
Resolve-LocalSqlExpressEndpoint
`;
    const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { encoding: "utf8", input: "", env: cleanEnvironment() });
    expect(result.stderr).toBe(""); expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(expected);
  });
});
