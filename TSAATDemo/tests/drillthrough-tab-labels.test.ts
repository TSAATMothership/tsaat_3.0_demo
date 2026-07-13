import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const networkTabsSource = readFileSync(path.join(process.cwd(), "components", "network-detail-tabs.tsx"), "utf8");
const systemTabsSource = readFileSync(path.join(process.cwd(), "components", "system-detail-tabs.tsx"), "utf8");

describe("Drill-through tab labels", () => {
  it("labels the default network drill-through tab as Details", () => {
    expect(networkTabsSource).toContain('{ id: "network-details", label: "Details" }');
    expect(networkTabsSource).not.toContain('{ id: "network-details", label: "Network Details" }');
  });

  it("labels the default ICT system drill-through tab as Details", () => {
    expect(systemTabsSource).toContain('{ id: "system-details", label: "Details" }');
    expect(systemTabsSource).not.toContain('{ id: "system-details", label: "System Details" }');
  });
});
