import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "components", "network-compliance-overview.tsx"), "utf8");

describe("Compliance overview details panel layout", () => {
  it("keeps the details table status column limited to workflow pills", () => {
    expect(source).toContain('{entry.asOfStatus === "open" ? "Open" : "Closed"}');
    expect(source).not.toContain("Finding {entry.finding.complianceStatus}");
    expect(source).not.toContain("Eval {entry.finding.evaluationStatus}");
  });

  it("keeps details table timestamps on one line with a fixed readable width", () => {
    expect(source).toContain('className="w-[12.5rem] min-w-[12.5rem] whitespace-nowrap px-3 py-2"');
    expect(source).toContain('className="w-[12.5rem] min-w-[12.5rem] whitespace-nowrap px-3 py-2 text-slate-200"');
  });

  it("scopes affected CIs to the selected compliance detail row", () => {
    expect(source).toContain("const selectedFinding = selectedFindingForAssets.finding;");
    expect(source).toContain("return [selectedFinding]");
    expect(source).not.toContain("entry.finding.spiId === selectedFindingForAssets.finding.spiId");
    expect(source).not.toContain("entry.finding.title === selectedFindingForAssets.finding.title");
  });
});
