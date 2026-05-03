import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const networkDetailSource = readFileSync(path.join(process.cwd(), "app", "networks", "[networkId]", "page.tsx"), "utf8");
const systemDetailSource = readFileSync(path.join(process.cwd(), "app", "systems", "[systemId]", "page.tsx"), "utf8");

describe("Drill-through Security Accreditation containers", () => {
  it("shows network ATO without a DIIS detail field or DIIS link", () => {
    expect(networkDetailSource).toContain("Security Accreditation");
    expect(networkDetailSource).toContain("networkDetailFields.atoNumber");
    expect(networkDetailSource).toContain("Cyber GRC");
    expect(networkDetailSource).not.toContain("networkDiisId");
    expect(networkDetailSource).not.toContain("DIIS ID");
    expect(networkDetailSource).not.toContain("View in DIIS");
    expect(networkDetailSource).not.toContain("networkDetailFields.diisUrl");
  });

  it("shows stored ICT system DIIS ID or Missing without a DIIS link", () => {
    expect(systemDetailSource).toContain('const systemDiisId = system.diisId?.trim() || "Missing";');
    expect(systemDetailSource).toContain("DIIS ID");
    expect(systemDetailSource).toContain("{systemDiisId}");
    expect(systemDetailSource).not.toContain("View in DIIS");
    expect(systemDetailSource).not.toContain("systemDiisUrl");
  });
});
