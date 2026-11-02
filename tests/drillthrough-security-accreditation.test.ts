import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const sharedPanel = readFileSync(path.join(process.cwd(), "components", "risk-entity-details-panel.tsx"), "utf8");

describe("Network and ICT system accreditation details", () => {
  it("shows stored ATO and DIIS metadata with explicit missing values", () => {
    expect(sharedPanel).toContain("ATO Details");
    expect(sharedPanel).toContain('details.atoNumber || "Not provided"');
    expect(sharedPanel).toContain("DIIS Details");
    expect(sharedPanel).toContain('details.diisId || "Not provided"');
    expect(sharedPanel).not.toContain("Cyber GRC Record");
    expect(sharedPanel).not.toContain("DIIS Record");
  });
});
