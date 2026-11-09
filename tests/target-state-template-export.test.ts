import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/discovery-coverage/target-state-template/route";
const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data-loader", () => ({ loadDatasetForDate: load }));
const network = { id: "net-1", name: "A/B Network", targetStateAssets: { server: ["Server One"] } };
beforeEach(() => { load.mockReset(); load.mockResolvedValue({ snapshotDate: "2026-10-31", managedNetworks: [network] }); });
it("returns selected snapshot/template data and a filename without generating workbook bytes", async () => {
  const response = await GET(new NextRequest("http://localhost/api/discovery-coverage/target-state-template?network=net-1&dataDate=2026-11-01"));
  expect(response.headers.get("Content-Type")).toContain("application/json");
  expect(response.headers.get("Content-Disposition")).toBeNull();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ version: 1, kind: "xlsx-target-state", filename: "A B Network target state template.xlsx",
    data: { network, snapshotDate: "2026-10-31" } });
  expect(load).toHaveBeenCalledWith("2026-11-01", { profile: "summary" });
});
it("retains validation for absent and unknown networks", async () => {
  expect((await GET(new NextRequest("http://localhost/api/discovery-coverage/target-state-template"))).status).toBe(400);
  expect(load).not.toHaveBeenCalled();
  expect((await GET(new NextRequest("http://localhost/api/discovery-coverage/target-state-template?network=unknown"))).status).toBe(404);
});
