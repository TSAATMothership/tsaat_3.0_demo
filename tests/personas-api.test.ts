import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/settings/personas/route";
import { loadPersonaSettings, savePersonaSettings } from "@/lib/data-loader";
import { defaultPersonaSettings, PersonaConflictError } from "@/lib/personas";
vi.mock("@/lib/data-loader", () => ({ loadPersonaSettings: vi.fn(), savePersonaSettings: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const request = (body: string) => new NextRequest("http://localhost/api/settings/personas", { method: "PUT", body });
it("opens the shared persona configuration without an application identity and prevents stale caching", async () => {
  vi.mocked(loadPersonaSettings).mockResolvedValue(defaultPersonaSettings());
  const response = await GET();
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ settings: defaultPersonaSettings() });
});
it.each(["not-json", "{}", JSON.stringify({ ...defaultPersonaSettings(), schemaVersion: 9 })])("rejects invalid input before persistence: %s", async body => {
  expect((await PUT(request(body))).status).toBe(400);
  expect(savePersonaSettings).not.toHaveBeenCalled();
});
it("returns saved settings and sanitizes provider errors", async () => {
  vi.mocked(savePersonaSettings).mockResolvedValue(defaultPersonaSettings());
  expect((await PUT(request(JSON.stringify(defaultPersonaSettings())))).status).toBe(200);
  vi.mocked(savePersonaSettings).mockRejectedValue(new Error("secret connection details"));
  const failed = await PUT(request(JSON.stringify(defaultPersonaSettings())));
  expect(failed.status).toBe(500); expect(await failed.text()).not.toContain("secret");
  vi.mocked(loadPersonaSettings).mockRejectedValue(new Error("secret file path"));
  const unavailable = await GET(); expect(unavailable.status).toBe(500); expect(await unavailable.text()).not.toContain("secret");
});
it("rejects stale four-persona writes instead of resetting Business Reporting", async () => {
  const current = defaultPersonaSettings();
  const stale = { ...current, schemaVersion: 2, personas: current.personas.filter(persona => persona.id !== "business-reporting") };
  const response = await PUT(request(JSON.stringify(stale)));
  expect(response.status).toBe(400);
  expect(await response.text()).toContain("Reload the application");
  expect(savePersonaSettings).not.toHaveBeenCalled();
});
it("accepts an older page catalogue but strips only the retired permission before persistence", async () => {
  const legacy = defaultPersonaSettings(); legacy.personas[0].pages = ["governance-overview"];
  const normalized = defaultPersonaSettings(); normalized.personas[0].pages = [];
  vi.mocked(savePersonaSettings).mockResolvedValue(normalized);
  const response = await PUT(request(JSON.stringify(legacy)));
  expect(response.status).toBe(200);
  expect(savePersonaSettings).toHaveBeenCalledExactlyOnceWith(normalized);
});
it("returns a retryable conflict rather than overwriting newer settings", async () => {
  vi.mocked(savePersonaSettings).mockRejectedValue(new PersonaConflictError());
  const response = await PUT(request(JSON.stringify(defaultPersonaSettings())));
  expect(response.status).toBe(409); expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.text()).toContain("Reload saved personas");
});
it("accepts a custom or intentionally empty catalogue", async () => {
  for (const personas of [[{ id: "custom", label: "Source-defined", sections: [], pages: [], popups: [] }], []]) {
    const settings = { ...defaultPersonaSettings(), personas };
    vi.mocked(savePersonaSettings).mockResolvedValue(settings);
    const response = await PUT(request(JSON.stringify(settings)));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ settings });
  }
});
