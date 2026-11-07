import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.join(process.cwd(), "scripts/configure-database-user.ps1").replaceAll("'", "''");

describe("database login administrator preflight", () => {
  it("binds a preserved login SID as binary data for SQL Server", () => {
    const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `
$ErrorActionPreference='Stop'
function New-Object {
  param([string]$TypeName, [object[]]$ArgumentList)
  if ($TypeName -ne 'System.Data.SqlClient.SqlConnection') { return Microsoft.PowerShell.Utility\\New-Object @PSBoundParameters }
  $connection=[pscustomobject]@{}
  $connection | Add-Member ScriptMethod Open { }
  $connection | Add-Member ScriptMethod Dispose { }
  $connection | Add-Member ScriptMethod CreateCommand {
    $command=[pscustomobject]@{CommandText='';Parameters=(Microsoft.PowerShell.Utility\\New-Object System.Data.SqlClient.SqlCommand).Parameters}
    $command | Add-Member ScriptMethod ExecuteScalar {
      if ($this.Parameters.Contains('@verifiedSid')) {
        $value=$this.Parameters['@verifiedSid'].Value
        if ($value -isnot [byte[]] -or ($value -join ',') -ne '1,2,3') { throw 'SID was not bound as byte[]' }
        Write-Host 'Binary SID verified'
      }
      return 0
    }
    return $command
  }
  return $connection
}
$settings=[pscustomobject]@{server='test';database='TSAATDB';authMode='sql';userId='app';password='app-secret'}
$administrator=[pscustomobject]@{server='test';authMode='trusted'}
& '${script}' -Settings $settings -Administrator $administrator -CheckOnly -VerifiedLoginSid ([byte[]]@(1,2,3))
`], { encoding: "utf8", input: "" });
    expect(result.stderr).toBe(""); expect(result.status).toBe(0);
    expect(result.stdout).toContain("Binary SID verified");
  });

  it.each([
    [1, "mixed mode"],
    [2, "must be a SQL Server sysadmin"]
  ])("refuses server state %s before login or database changes", (state, message) => {
    const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `
$ErrorActionPreference='Stop'
function New-Object {
  param([string]$TypeName, [object[]]$ArgumentList)
  if ($TypeName -ne 'System.Data.SqlClient.SqlConnection') { return Microsoft.PowerShell.Utility\\New-Object @PSBoundParameters }
  $connection=[pscustomobject]@{}
  $connection | Add-Member ScriptMethod Open { }
  $connection | Add-Member ScriptMethod Dispose { Write-Host 'disposed' }
  $connection | Add-Member ScriptMethod CreateCommand {
    $command=[pscustomobject]@{CommandText=''}
    $command | Add-Member ScriptMethod ExecuteScalar { return ${state} }
    $command | Add-Member ScriptMethod ExecuteNonQuery { throw 'Unexpected SQL mutation' }
    return $command
  }
  return $connection
}
$settings=[pscustomobject]@{server='test';database='TSAATDB';authMode='sql';userId='app';password='app-secret'}
$administrator=[pscustomobject]@{server='test';authMode='trusted'}
& '${script}' -Settings $settings -Administrator $administrator -CheckOnly
`], { encoding: "utf8", input: "" });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(message);
    expect(result.stdout + result.stderr).not.toContain("Unexpected SQL mutation");
    expect(result.stdout + result.stderr).not.toContain("app-secret");
    expect(result.stdout).toContain("disposed");
  });
});
