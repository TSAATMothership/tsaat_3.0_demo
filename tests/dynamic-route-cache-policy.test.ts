import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("dynamic route cache policy", () => {
  it("keeps auth and settings routes dynamic/no-store", () => {
    const authSession = readRepoFile("app/api/auth/session/route.ts");
    const authLogin = readRepoFile("app/api/auth/login/route.ts");
    const authLogout = readRepoFile("app/api/auth/logout/route.ts");
    const measuresSettings = readRepoFile("app/api/measures/settings/route.ts");
    const discoveryToolsSettings = readRepoFile("app/api/discovery-tools/settings/route.ts");

    for (const source of [authSession, authLogin, authLogout, measuresSettings, discoveryToolsSettings]) {
      expect(source).toContain('export const dynamic = "force-dynamic"');
    }
    for (const source of [authSession, authLogin, authLogout]) {
      expect(source).toContain('"Cache-Control"');
      expect(source).toContain('"no-store"');
    }
  });

  it("keeps report and generated-file routes dynamic", () => {
    const routePaths = [
      "app/api/tasking-report/route.ts",
      "app/api/discovery-coverage/network-report/route.ts",
      "app/api/discovery-coverage/target-state-template/route.ts",
      "app/api/cyber-cop/impact-analyser-2/route.ts",
      "app/api/cyber-cop/impact-analyser-2/dependencies/route.ts",
      "app/api/cyber-cop/impact-analyser-2/findings/route.ts",
      "app/api/networks/[networkId]/impact-analyser/route.ts",
      "app/api/networks/[networkId]/impact-analyser/findings/route.ts",
      "app/api/systems/[systemId]/impact-analyser/route.ts",
      "app/api/systems/[systemId]/impact-analyser/findings/route.ts",
      "app/api/networks/performance-report/route.ts",
      "app/api/systems/performance-report/route.ts",
      "app/api/systems/remediation-report/route.ts",
      "app/api/systems/[systemId]/discovery-coverage-export/route.ts",
      "app/api/networks/[networkId]/discovery-coverage-export/route.ts",
      "app/api/findings/export/route.ts",
      "app/api/report/summary/route.ts"
    ];

    for (const routePath of routePaths) {
      const source = readRepoFile(routePath);
      expect(source).toContain('export const dynamic = "force-dynamic"');
      expect(source).not.toContain("unstable_cache");
      expect(source).not.toContain("s-maxage");
    }
  });
});
