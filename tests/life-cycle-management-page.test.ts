import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DiscoveryPage from "@/app/discovery-coverage/page";
import { loadLifeCycleManagement } from "@/lib/life-cycle-management-data";
import { buildLifeCycleManagement } from "@/lib/life-cycle-management";
vi.mock("@/lib/life-cycle-management-data", () => ({ loadLifeCycleManagement: vi.fn() }));
vi.mock("@/components/life-cycle-management", () => ({ LifeCycleManagement: ({ model }: { model: { snapshotDate: string } }) => React.createElement("section", { "data-lifecycle-snapshot": model.snapshotDate }) }));
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("React", React); });
afterEach(() => vi.unstubAllGlobals());
it("waits for header scope before reading lifecycle inventory", async () => {
  const html = renderToStaticMarkup(await DiscoveryPage({ searchParams: { discoveryView: "life-cycle-management" } }));
  expect(loadLifeCycleManagement).not.toHaveBeenCalled(); expect(html).toContain("data-route-ready-key");
});
it("renders the resolved snapshot and passes the applied scope to the shared loader", async () => {
  const model = buildLifeCycleManagement({ assets: [], managedNetworks: [], ictSystems: [], spiEvaluations: [], snapshotDate: "2026-03-05", generatedAt: "2026-03-05" }, {});
  vi.mocked(loadLifeCycleManagement).mockResolvedValue(model);
  const params = { discoveryView: "life-cycle-management", network: "net-1,net-2", securityDomain: "SECRET", dataDate: "2026-03-06" };
  const html = renderToStaticMarkup(await DiscoveryPage({ searchParams: params }));
  expect(loadLifeCycleManagement).toHaveBeenCalledWith(params); expect(html).toContain('data-lifecycle-snapshot="2026-03-05"');
});
it("shows a sanitized retry state retaining scope and snapshot on storage failure", async () => {
  vi.mocked(loadLifeCycleManagement).mockRejectedValue(new Error("secret server configuration"));
  const html = renderToStaticMarkup(await DiscoveryPage({ searchParams: { discoveryView: "life-cycle-management", system: ["sys-1", "sys-2"], dataDate: "2026-03-05", securityDomain: "SECRET" } }));
  expect(html).toContain("temporarily unavailable"); expect(html).not.toContain("secret server configuration");
  expect(html).toContain("system=sys-1%2Csys-2"); expect(html).toContain("dataDate=2026-03-05"); expect(html).toContain("securityDomain=SECRET");
});
