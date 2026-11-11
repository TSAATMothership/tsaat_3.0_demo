import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";

it.skipIf(!process.env.TSAAT_SETUP_LOGIN_TEST_DATABASE)("verifies existing SQL login reuse and identity guards on disposable targets", () => {
  const database = process.env.TSAAT_SETUP_LOGIN_TEST_DATABASE!;
  expect(database).toMatch(/^TSAAT_SetupLoginTest_[A-Za-z0-9_]{1,60}$/);
  expect(process.env.TSAAT_SETUP_LOGIN_TEST_SERVER).toBeTruthy();
  const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(process.cwd(), "tests/fixtures/database-login-reuse.ps1"),
    "-DatabaseName", database, "-ServerInstance", process.env.TSAAT_SETUP_LOGIN_TEST_SERVER!,
    "-ConfigureScript", path.join(process.cwd(), "scripts/configure-database-user.ps1")
  ], { encoding: "utf8", timeout: 120000, windowsHide: true });
  expect(result.stderr).toBe("");
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout).toContain("Existing-login reuse and all rejection/preservation checks passed.");
}, 130000);
