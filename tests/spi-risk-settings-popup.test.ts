import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/measures/settings/route";
import SettingsPage from "@/app/settings/page";
import { SettingsTabs } from "@/components/settings-tabs";
import { SettingsRoutePopup } from "@/components/settings-route-popup";
import { loadMeasuresSettings, loadSpiDefinitions, loadSeverityDefinitions, loadFindingPriorityDefinitions, saveMeasuresSettings } from "@/lib/data-loader";
import { measuresHref } from "@/lib/measures-explorer";
import { WORKSPACE_GROUPS } from "@/lib/workspace-navigation";
import { testSpiDefinitions, testSeverityDefinitions, testPriorityDefinitions, testMeasuresSettings } from "./spi-definition-fixtures";
vi.mock("@/lib/data-loader", () => ({ loadMeasuresSettings: vi.fn(), loadSpiDefinitions: vi.fn(), loadSeverityDefinitions: vi.fn(), loadFindingPriorityDefinitions: vi.fn(), saveMeasuresSettings: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("React", React);
  vi.mocked(loadSpiDefinitions).mockResolvedValue(testSpiDefinitions);
  vi.mocked(loadSeverityDefinitions).mockResolvedValue(testSeverityDefinitions);
  vi.mocked(loadFindingPriorityDefinitions).mockResolvedValue(testPriorityDefinitions);
  vi.mocked(loadMeasuresSettings).mockResolvedValue(testMeasuresSettings);
});
afterEach(() => vi.unstubAllGlobals());
describe("SPI risk settings popup", () => {
  it("loads global settings with the catalogs needed by both matrix tabs and omits SQL rule metadata", async () => {
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.settings).toEqual(testMeasuresSettings);
    expect(payload.spiDefinitions).toEqual(testSpiDefinitions.map(({ spiId, description }) => ({ spiId, description })));
    expect(payload.severityDefinitions).toEqual(testSeverityDefinitions);
    expect(payload.priorityDefinitions).toEqual(testPriorityDefinitions);
    expect(loadMeasuresSettings).toHaveBeenCalledWith(testSpiDefinitions, testSeverityDefinitions, testPriorityDefinitions);
  });
  it("returns a retryable error without database details when the catalog cannot load", async () => {
    vi.mocked(loadSpiDefinitions).mockRejectedValue(new Error("Database connection failure"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to load SPI risk matrix settings." });
  });
  it("preserves the existing save payload for both severity and priority matrices", async () => {
    const payload = { severityMatrix: testMeasuresSettings.severityMatrix, priorityMatrix: testMeasuresSettings.priorityMatrix };
    vi.mocked(saveMeasuresSettings).mockResolvedValue(testMeasuresSettings);
    const response = await PUT(new NextRequest("http://localhost/api/measures/settings", { method: "PUT", body: JSON.stringify(payload) }));
    expect(response.status).toBe(200);
    expect(saveMeasuresSettings).toHaveBeenCalledWith(payload);
    expect(await response.json()).toEqual({ settings: testMeasuresSettings });
  });
  it("opens a direct Settings link on the new tab without a workspace scope", async () => {
    const result = await SettingsPage({ searchParams: { settingsTab: "spi-risk-matrix" } });
    const popup = result.props.children.find((item: React.ReactElement) => item.type === SettingsRoutePopup);
    expect(popup.props.initialTab).toBe("spi-risk-matrix");
    expect(loadMeasuresSettings).not.toHaveBeenCalled();
  });
  it("exposes the accessible Settings tab and removes it from the Observed Measures sidebar", () => {
    const html = renderToStaticMarkup(React.createElement(SettingsTabs, { activeTab: "spi-risk-matrix", onSelect: () => {} }));
    expect(html).toContain('id="settings-tab-spi-risk-matrix"');
    expect(html).toContain('aria-controls="settings-panel-spi-risk-matrix"');
    expect(html).toContain("SPI Risk Matrix");
    expect(WORKSPACE_GROUPS.find((group) => group.label === "Observed Measures")?.items.map((item) => item.label)).not.toContain("SPI Risk Matrix");
  });
  it("sends generated risk matrix links to Settings and preserves scope and snapshot", () => {
    const url = new URL(measuresHref("spi-settings", { managedNetwork: "net-1" }, "2026-10-31"), "http://localhost");
    expect(url.pathname).toBe("/settings");
    expect(Object.fromEntries(url.searchParams)).toEqual({ settingsTab: "spi-risk-matrix", network: "net-1", dataDate: "2026-10-31" });
  });
});
