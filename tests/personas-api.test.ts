import { beforeEach, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/settings/personas/route";
import { loadPersonaSettings, savePersonaSettings } from "@/lib/data-loader";
import { defaultPersonaSettings } from "@/lib/personas";
vi.mock("@/lib/data-loader", () => ({ loadPersonaSettings: vi.fn(), savePersonaSettings: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("reads shared persona settings without an application identity and prevents stale caching", async () => {
  vi.mocked(loadPersonaSettings).mockResolvedValue(defaultPersonaSettings());
  const response = await GET();
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ settings: defaultPersonaSettings() });
});
it("rejects writes without invoking either provider", async () => {
  const response = await PUT();
  expect(response.status).toBe(405);
  expect(response.headers.get("Allow")).toBe("GET");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "These settings are read-only." });
  expect(savePersonaSettings).not.toHaveBeenCalled();
  expect(loadPersonaSettings).not.toHaveBeenCalled();
});
it("sanitizes load failures", async () => {
  vi.mocked(loadPersonaSettings).mockRejectedValue(new Error("secret file path"));
  const response = await GET();
  expect(response.status).toBe(500); expect(await response.text()).not.toContain("secret");
});
it("reads source-defined and intentionally empty catalogues unchanged", async () => {
  for (const personas of [[{ id: "custom", label: "Source-defined", sections: [], pages: [], popups: [] }], []]) {
    const settings = { ...defaultPersonaSettings(), personas };
    vi.mocked(loadPersonaSettings).mockResolvedValue(settings);
    expect(await (await GET()).json()).toEqual({ settings });
  }
});
