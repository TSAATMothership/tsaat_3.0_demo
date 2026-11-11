import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PersonasSettingsPanel } from "@/components/personas-settings-panel";
import { MeasuresSettingsMatrix } from "@/components/measures-settings-matrix";
import { usePersona } from "@/components/persona-provider";
import { defaultPersonaSettings } from "@/lib/personas";
import { PUT as discoveryPut } from "@/app/api/discovery-tools/settings/route";
import { GET as databaseGet, PUT as databasePut } from "@/app/api/settings/database/route";
import { POST as connectionPost } from "@/app/api/settings/database/test-connection/route";
import { POST as schemaPost } from "@/app/api/settings/database/test-schema/route";
import { POST as sslPost } from "@/app/api/settings/database/test-ssl/route";
import { saveDiscoveryToolsSettings } from "@/lib/data-loader";
import { testSpiDefinitions, testSeverityDefinitions, testPriorityDefinitions, testMeasuresSettings } from "./spi-definition-fixtures";

vi.mock("@/components/persona-provider", () => ({ usePersona: vi.fn() }));
vi.mock("@/lib/data-loader", () => ({ loadDiscoveryToolsSettings: vi.fn(), saveDiscoveryToolsSettings: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("React", React); });
afterEach(() => vi.unstubAllGlobals());
function personaContext(overrides: Partial<ReturnType<typeof usePersona>> = {}) {
  vi.mocked(usePersona).mockReturnValue({
    activePersona: "analyst", selectPersona: vi.fn(), settings: defaultPersonaSettings(), error: "",
    loading: false, reload: vi.fn(), selectionError: "",
    ...overrides
  });
}
it("shows saved persona permissions without any editing controls", () => {
  personaContext();
  const html = renderToStaticMarkup(React.createElement(PersonasSettingsPanel));
  expect(html).toContain("Read-only configuration");
  expect(html).toContain('data-persona-name="true">Analyst');
  const checkboxes = html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
  expect(checkboxes.length).toBeGreaterThan(30);
  for (const checkbox of checkboxes) expect(checkbox).toContain('disabled=""');
  expect(html).toContain("Active persona");
  expect(html).not.toContain('data-add-persona');
  expect(html).not.toContain('data-remove-persona');
  expect(html).not.toContain('data-save-personas');
  expect(html).not.toContain('type="text"');
});
it("retains no-persona, loading and retry states", () => {
  personaContext({ activePersona: null });
  expect(renderToStaticMarkup(React.createElement(PersonasSettingsPanel))).toContain("Select an existing persona");
  personaContext({ settings: null, loading: true });
  expect(renderToStaticMarkup(React.createElement(PersonasSettingsPanel))).toContain('role="status">Loading personas');
  personaContext({ settings: null, error: "Unable to load personas." });
  const html = renderToStaticMarkup(React.createElement(PersonasSettingsPanel));
  expect(html).toContain('role="alert">Unable to load personas.');
  expect(html).toContain("Retry loading personas");
});
it("renders saved risk and priority values without substituting an editable default", () => {
  const settings = structuredClone(testMeasuresSettings);
  settings.severityMatrix["1:server"] = "Data Gap";
  settings.priorityMatrix["1"] = 90;
  const html = renderToStaticMarkup(React.createElement(MeasuresSettingsMatrix, { activeMatrix: "severity", initialSettings: settings, spiDefinitions: testSpiDefinitions, severityDefinitions: testSeverityDefinitions, priorityDefinitions: testPriorityDefinitions }));
  expect(html).toMatch(/data-spi-risk="1:server">Data Gap/);
  expect(html).toContain('data-spi-priority="1"');
  expect(html).toContain('aria-label="SPI Risk Matrix table" tabindex="0"');
  expect(html).not.toContain("<select"); expect(html).not.toContain("<button");
});
it("rejects discovery writes without reaching storage", async () => {
  const response = await discoveryPut();
  expect(response.status).toBe(405); expect(response.headers.get("Allow")).toBe("GET");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(saveDiscoveryToolsSettings).not.toHaveBeenCalled();
});
it.each([databaseGet, databasePut, connectionPost, schemaPost, sslPost])("retires database operations without connecting or saving", async handler => {
  const response = await handler();
  expect(response.status).toBe(410);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "Database Settings is no longer available in the application." });
});
