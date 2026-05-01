import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listTrackedFiles(patterns: string[]): string[] {
  const result = spawnSync("git", ["ls-files", "--", ...patterns], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((relativePath) => path.join(REPO_ROOT, relativePath));
}

function hasOnlyCrlfNewlines(filePath: string): boolean {
  const content = readFileSync(filePath, "utf8");
  return content.includes("\r\n") && !/(?<!\r)\n/.test(content) && !/\r(?!\n)/.test(content);
}

describe("Windows database setup scripts", () => {
  it("keeps Windows-facing setup files in CRLF format", () => {
    const files = listTrackedFiles([
      "*.cmd",
      "*.bat",
      "scripts/*.ps1",
      "Database Schema/**/*.ps1",
      "Database Schema/**/*.sql"
    ]);

    expect(files.length).toBeGreaterThan(0);

    const nonCrlfFiles = files
      .filter((filePath) => !hasOnlyCrlfNewlines(filePath))
      .map((filePath) => path.relative(REPO_ROOT, filePath));

    expect(nonCrlfFiles).toEqual([]);
  });

  it("keeps CreateDB defaults and data-load option aliases Windows-safe", () => {
    const createDb = readFileSync(path.join(REPO_ROOT, "CreateDB.cmd"), "utf8");

    expect(createDb).toContain('set "DB_SERVER=localhost\\SQLEXPRESS"');
    expect(createDb).not.toContain('set "DB_SERVER=localhost\\\\SQLEXPRESS"');
    expect(createDb).toContain('if /I "%MODE_TO_NORMALIZE%"=="1" set "DATA_LOAD_MODE_ARG=ClientPayload"');
    expect(createDb).toContain('if /I "%MODE_TO_NORMALIZE%"=="client-payload" set "DATA_LOAD_MODE_ARG=ClientPayload"');
    expect(createDb).toContain('if /I "%MODE_TO_NORMALIZE%"=="2" set "DATA_LOAD_MODE_ARG=SqlServerFiles"');
    expect(createDb).toContain('if /I "%MODE_TO_NORMALIZE%"=="sql-server-files" set "DATA_LOAD_MODE_ARG=SqlServerFiles"');
  });

  it("parses database PowerShell setup scripts", () => {
    if (!existsSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")) {
      return;
    }

    const scriptPaths = listTrackedFiles(["scripts/*.ps1", "Database Schema/loaders/*.ps1"]);

    const command = [
      "$ErrorActionPreference = 'Stop'",
      "$scripts = @(",
      ...scriptPaths.map((filePath) => `  '${filePath.replace(/'/g, "''")}'`),
      ")",
      "foreach ($script in $scripts) {",
      "  $tokens = $null",
      "  $errors = $null",
      "  [System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$tokens, [ref]$errors) > $null",
      "  if ($errors.Count -gt 0) {",
      "    throw \"$script parse errors: $($errors | ForEach-Object { $_.Message } | Out-String)\"",
      "  }",
      "}"
    ].join("\r\n");

    const result = spawnSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { cwd: REPO_ROOT, encoding: "utf8" }
    );

    expect(`${result.stdout}\n${result.stderr}`).toBe("\n");
    expect(result.status).toBe(0);
  });
});
