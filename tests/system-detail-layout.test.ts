import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const systemDetailSource = readFileSync(path.join(process.cwd(), "app", "systems", "[systemId]", "page.tsx"), "utf8");
const detailsStart = systemDetailSource.indexOf('activeDetailTab === "system-details"');
const detailsEnd = systemDetailSource.indexOf('{activeDetailTab === "discovery-compliance"', detailsStart);
const systemDetailsBlock = systemDetailSource.slice(detailsStart, detailsEnd);

describe("ICT system Details tab layout", () => {
  it("groups the tab into Details, Impact, and Risk overview sections", () => {
    expect(systemDetailsBlock).toContain("Details Overview");
    expect(systemDetailsBlock).toContain("Impact Overview");
    expect(systemDetailsBlock).toContain("Risk Overview");
    expect(systemDetailsBlock).toContain("xl:grid-cols-[minmax(0,0.92fr)_minmax(18rem,0.62fr)_minmax(0,0.95fr)]");
  });

  it("keeps operational metadata and accreditation tiles in Details Overview", () => {
    const detailsOverview = systemDetailsBlock.indexOf("Details Overview");
    const description = systemDetailsBlock.indexOf("Description", detailsOverview);
    const contacts = systemDetailsBlock.indexOf("Operational Contacts", detailsOverview);
    const securityAccreditation = systemDetailsBlock.indexOf("Security Accreditation", detailsOverview);
    const applicationPortfolio = systemDetailsBlock.indexOf("Application Portfolio Management", detailsOverview);
    const defenceInventory = systemDetailsBlock.indexOf("Defence ICT Inventory System", detailsOverview);
    const securityAccreditationBlock = systemDetailsBlock.slice(securityAccreditation, applicationPortfolio);
    const defenceInventoryBlock = systemDetailsBlock.slice(defenceInventory);

    expect(description).toBeGreaterThan(detailsOverview);
    expect(contacts).toBeGreaterThan(description);
    expect(securityAccreditation).toBeGreaterThan(contacts);
    expect(applicationPortfolio).toBeGreaterThan(securityAccreditation);
    expect(defenceInventory).toBeGreaterThan(applicationPortfolio);
    expect(securityAccreditationBlock).toContain("ATO");
    expect(securityAccreditationBlock).not.toContain("DIIS ID");
    expect(defenceInventoryBlock).toContain("DIIS ID");
    expect(systemDetailsBlock).toContain("h-36 shrink-0");
    expect(systemDetailsBlock).toContain("flex-1 overflow-auto pr-1");
    expect(systemDetailsBlock).toContain("Cyber GRC");
    expect(systemDetailsBlock).not.toContain("View APM");
    expect(systemDetailSource).toContain("const systemAtoNumber = system.atoNumber?.trim() || missingReferenceLabel;");
    expect(systemDetailSource).toContain("const systemGrcUrl = system.grcUrl?.trim();");
    expect(systemDetailSource).toContain("const systemApmNumber = system.apmNumber?.trim() || missingReferenceLabel;");
    expect(systemDetailSource).not.toContain("ATO-${system.id");
    expect(systemDetailSource).not.toContain("APM-${system.id");
  });

  it("places impact lists and risk charts in their own overview sections", () => {
    const impactOverview = systemDetailsBlock.indexOf("Impact Overview");
    const missionCapabilities = systemDetailsBlock.indexOf("Mission Capabilities", impactOverview);
    const businessServices = systemDetailsBlock.indexOf("Business Services", impactOverview);
    const riskOverview = systemDetailsBlock.indexOf("Risk Overview");
    const riskCharts = systemDetailsBlock.indexOf("<NetworkDetailRiskCharts", riskOverview);

    expect(missionCapabilities).toBeGreaterThan(impactOverview);
    expect(businessServices).toBeGreaterThan(missionCapabilities);
    expect(riskOverview).toBeGreaterThan(businessServices);
    expect(riskCharts).toBeGreaterThan(riskOverview);
    expect(systemDetailsBlock).toContain("grid-rows-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(systemDetailsBlock).toContain("overflow-y-auto overflow-x-hidden");
  });
});
