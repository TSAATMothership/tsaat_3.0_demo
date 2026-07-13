import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const networkDetailSource = readFileSync(path.join(process.cwd(), "app", "networks", "[networkId]", "page.tsx"), "utf8");
const systemDetailSource = readFileSync(path.join(process.cwd(), "app", "systems", "[systemId]", "page.tsx"), "utf8");

describe("Network and ICT system drill-through headers", () => {
  it("does not render header pills under the network heading", () => {
    expect(networkDetailSource).not.toContain("PostureBadge");
    expect(networkDetailSource).not.toContain("Classification: {network.classification}");
    expect(networkDetailSource).not.toContain("Assets: {filteredAssets.length}");
  });

  it("does not render header pills under the ICT system heading", () => {
    expect(systemDetailSource).not.toContain("PostureBadge");
    expect(systemDetailSource).not.toContain("Network: {system.networkId}");
    expect(systemDetailSource).not.toContain("Assets: {filteredAssets.length}");
    expect(systemDetailSource).not.toContain("Scope: {selectedLabel}");
    expect(systemDetailSource).not.toContain("Server search: {serverSearchTerm}");
    expect(systemDetailSource).not.toContain("KPI filter: {KPI_FILTER_LABELS[selectedKpiFilter]}");
  });
});
