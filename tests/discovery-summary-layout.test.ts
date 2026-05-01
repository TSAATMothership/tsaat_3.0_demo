import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(process.cwd(), "app", "discovery-coverage", "page.tsx"), "utf8");

describe("Discovery summary layout", () => {
  it("keeps the Discovery Tool Coverage tab focused on coverage content", () => {
    expect(pageSource).not.toContain("Generate Remediation Report");
    expect(pageSource).not.toContain("remediationReportHref");
    expect(pageSource).not.toContain("toQueryEntries");
    expect(pageSource).toContain("grid-rows-[auto_minmax(0,1fr)]");
  });
});
