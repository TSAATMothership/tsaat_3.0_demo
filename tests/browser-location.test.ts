import { describe, expect, it } from "vitest";
import { browserWorkspaceSearch } from "@/lib/browser-location";
describe("workspace queries across hosting modes", () => {
  it("keeps scope and snapshot in direct-file hash routes", () => {
    expect(browserWorkspaceSearch({ href: "file:///C:/Demo/index.html#/measures?system=sys-2&dataDate=2026-04-23",
      hash: "#/measures?system=sys-2&dataDate=2026-04-23", search: "" })).toBe("?system=sys-2&dataDate=2026-04-23");
  });
  it("preserves hosted app queries and ordinary fragment anchors", () => {
    expect(browserWorkspaceSearch({ href: "https://app.example/measures?network=net-1#row", hash: "#row", search: "?network=net-1" })).toBe("?network=net-1");
  });
});
