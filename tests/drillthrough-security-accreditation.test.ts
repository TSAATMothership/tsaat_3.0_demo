import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const networkDetailSource = readFileSync(path.join(process.cwd(), "app", "networks", "[networkId]", "page.tsx"), "utf8");
const systemDetailSource = readFileSync(path.join(process.cwd(), "app", "systems", "[systemId]", "page.tsx"), "utf8");

describe("Drill-through Security Accreditation containers", () => {
  it("shows stored network DIIS ID or Missing without a DIIS link", () => {
    expect(networkDetailSource).toContain('const networkDiisId = network.diisId?.trim() || "Missing";');
    expect(networkDetailSource).toContain("<th className=\"px-2 py-1.5\">DIIS ID</th>");
    expect(networkDetailSource).toContain("{networkDiisId}");
    expect(networkDetailSource).not.toContain("View in DIIS");
    expect(networkDetailSource).not.toContain("networkDetailFields.diisUrl");
  });

  it("shows stored ICT system DIIS ID or Missing without a DIIS link", () => {
    expect(systemDetailSource).toContain('const systemDiisId = system.diisId?.trim() || "Missing";');
    expect(systemDetailSource).toContain("<th className=\"px-2 py-1.5\">DIIS ID</th>");
    expect(systemDetailSource).toContain("{systemDiisId}");
    expect(systemDetailSource).not.toContain("View in DIIS");
    expect(systemDetailSource).not.toContain("systemDiisUrl");
  });
});
