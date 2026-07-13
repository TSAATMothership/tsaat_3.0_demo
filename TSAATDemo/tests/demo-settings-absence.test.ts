import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function repoPath(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

describe("TSAATDemo settings removal", () => {
  it("does not expose Settings in the application menu", () => {
    const source = fs.readFileSync(repoPath("components/menu-navigation.tsx"), "utf8");

    expect(source).not.toContain('href: "/settings"');
    expect(source).not.toContain('label: "Settings"');
  });

  it("does not include the top-level settings page or settings APIs", () => {
    expect(fs.existsSync(repoPath("app/settings/page.tsx"))).toBe(false);
    expect(fs.existsSync(repoPath("app/api/settings/password/route.ts"))).toBe(false);
    expect(fs.existsSync(repoPath("app/api/settings/database/route.ts"))).toBe(false);
    expect(fs.existsSync(repoPath("app/api/settings/database/test-connection/route.ts"))).toBe(false);
    expect(fs.existsSync(repoPath("app/api/settings/database/test-schema/route.ts"))).toBe(false);
    expect(fs.existsSync(repoPath("app/api/settings/database/test-ssl/route.ts"))).toBe(false);
  });

  it("does not include mutable credential or database settings UI modules", () => {
    const removedModules = [
      "components/settings-tabs.tsx",
      "components/database-settings-panel.tsx",
      "components/password-settings-panel.tsx",
      "lib/database-settings.ts",
      "lib/database-settings-save-gating.ts",
      "lib/login-details.ts",
      "lib/auth-password.ts",
      "lib/db-config.ts",
      "lib/sql-server.ts",
      "scripts/emit-db-config-env.ps1",
      "scripts/ensure-db-config.ps1",
      "scripts/ensure-logindetails.ps1",
      "scripts/ensure-sqlcmd-offline.ps1",
      "scripts/invoke-dpapi.ps1",
      "scripts/stage-db-load-files.ps1"
    ];

    for (const relativePath of removedModules) {
      expect(fs.existsSync(repoPath(relativePath)), relativePath).toBe(false);
    }
  });
});
