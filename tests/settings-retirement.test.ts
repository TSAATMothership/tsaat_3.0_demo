import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET as discoveryGet, PUT as discoveryPut } from "@/app/api/discovery-tools/settings/route";
import { GET as databaseGet, PUT as databasePut } from "@/app/api/settings/database/route";
import { POST as connectionPost } from "@/app/api/settings/database/test-connection/route";
import { POST as schemaPost } from "@/app/api/settings/database/test-schema/route";
import { POST as sslPost } from "@/app/api/settings/database/test-ssl/route";
import { usePersona } from "@/components/persona-provider";
import { PersonaSelector } from "@/components/persona-selector";
import { WorkspaceHeaderControls } from "@/components/workspace-header-controls";
import { WorkspaceShell } from "@/components/workspace-shell";
import { loadDiscoveryToolsSettings, saveDiscoveryToolsSettings } from "@/lib/data-loader";
import { defaultPersonaSettings } from "@/lib/personas";
import SettingsPage from "@/app/settings/page";

vi.mock("@/components/persona-provider", () => ({ usePersona: vi.fn() }));
vi.mock("@/lib/data-loader", () => ({ loadDiscoveryToolsSettings: vi.fn(), saveDiscoveryToolsSettings: vi.fn() }));
vi.mock("@/components/route-ready-marker", () => ({ RouteReadyMarker: () => React.createElement("i", { "data-route-ready-key": "/settings" }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/discovery-coverage", useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("network=net-1&dataDate=2026-09-19&securityDomain=SECRET") }));
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("React", React); context(); });
afterEach(() => vi.unstubAllGlobals());
function context(overrides: Partial<ReturnType<typeof usePersona>> = {}) {
  vi.mocked(usePersona).mockReturnValue({ activePersona: "analyst", selectPersona: vi.fn(), settings: defaultPersonaSettings(), error: "",
    loading: false, reload: vi.fn(), selectionError: "", ...overrides });
}
it("keeps date/domain/scope and persona controls without a Menu or Settings entry", () => {
  const html = renderToStaticMarkup(React.createElement(WorkspaceHeaderControls));
  for (const label of ['aria-label="Data date"', 'value="2026-09-19"', 'Security Domain', 'Managed Network', 'ICT System', 'aria-label="Active persona"']) expect(html).toContain(label);
  for (const label of ['>Menu<', '>Settings<', 'Main menu', 'settings-popup', 'workspace-header-menu']) expect(html).not.toContain(label);
});
it.each([undefined, "personas", "discovery-tools-settings", "database-settings", "password-settings", "invalid"])("retires old Settings tab %s with scoped navigation and readiness", settingsTab => {
  const html = renderToStaticMarkup(React.createElement(SettingsPage, { searchParams: { settingsTab, network: "net-1", system: "sys-1", securityDomain: "SECRET", dataDate: "2026-09-19" } }));
  expect(html).toContain("This feature has been retired"); expect(html).toContain('data-route-ready-key=');
  for (const selection of ["network=net-1", "system=sys-1", "securityDomain=SECRET", "dataDate=2026-09-19"]) expect(html).toContain(selection);
  expect(html).not.toContain('role="tab"'); expect(html).not.toContain('<dialog');
});
it("retains source persona labels, All sections and recovery without Settings", () => {
  const settings = defaultPersonaSettings(); settings.personas = [{ id: "custom", label: "Custom reviewer", sections: [], pages: [], popups: [] }];
  context({ settings, activePersona: "custom" });
  const html = renderToStaticMarkup(React.createElement(PersonaSelector));
  expect(html).toContain('value="custom" selected=""'); expect(html).toContain("Custom reviewer"); expect(html).toContain("All sections (no persona)");
  context({ settings: null, loading: true }); expect(renderToStaticMarkup(React.createElement(PersonaSelector))).toContain("Loading personas...");
  context({ settings: null, error: "Unable to load personas." });
  const error = renderToStaticMarkup(React.createElement(PersonaSelector));
  expect(error).not.toContain("Unable to load personas."); expect(error).not.toContain('aria-describedby='); expect(error).toContain("Retry loading personas");
  const sidebar = renderToStaticMarkup(React.createElement(WorkspaceShell, { children: null }));
  expect(sidebar).toContain("Retry loading personas button in the header.");
  expect(sidebar).not.toContain("Using previously loaded persona settings.");
  context({ selectionError: "Selection applies for this visit." }); expect(renderToStaticMarkup(React.createElement(PersonaSelector))).toContain("Selection applies for this visit.");
});
it.each([discoveryGet, discoveryPut])("retires discovery-settings requests without loading or writing shared rules", async handler => {
  const response = await handler(); expect(response.status).toBe(410); expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(loadDiscoveryToolsSettings).not.toHaveBeenCalled(); expect(saveDiscoveryToolsSettings).not.toHaveBeenCalled();
});
it.each([databaseGet, databasePut, connectionPost, schemaPost, sslPost])("keeps database operations retired", async handler => {
  const response = await handler(); expect(response.status).toBe(410); expect(response.headers.get("Cache-Control")).toBe("no-store");
});
