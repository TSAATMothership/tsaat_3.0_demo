import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const networkDetailSource = readFileSync(path.join(process.cwd(), "app", "networks", "[networkId]", "page.tsx"), "utf8");
const detailsStart = networkDetailSource.indexOf('activeDetailTab === "network-details"');
const detailsEnd = networkDetailSource.indexOf('{activeDetailTab === "compliance-overview"', detailsStart);
const networkDetailsBlock = networkDetailSource.slice(detailsStart, detailsEnd);

describe("Network Details tab layout", () => {
  it("groups the tab into Details, Impact, and Risk overview sections", () => {
    expect(networkDetailsBlock).toContain("Details Overview");
    expect(networkDetailsBlock).toContain("Impact Overview");
    expect(networkDetailsBlock).toContain("Risk Overview");
    expect(networkDetailsBlock).toContain("xl:grid-cols-[minmax(0,0.92fr)_minmax(18rem,0.62fr)_minmax(0,0.95fr)]");
  });

  it("keeps operational metadata and ATO-only accreditation in Details Overview", () => {
    const detailsOverview = networkDetailsBlock.indexOf("Details Overview");
    const description = networkDetailsBlock.indexOf("Description", detailsOverview);
    const contacts = networkDetailsBlock.indexOf("Operational Contacts", detailsOverview);
    const securityAccreditation = networkDetailsBlock.indexOf("Security Accreditation", detailsOverview);
    const impactOverview = networkDetailsBlock.indexOf("Impact Overview");
    const detailsOverviewBlock = networkDetailsBlock.slice(detailsOverview, impactOverview);

    expect(description).toBeGreaterThan(detailsOverview);
    expect(contacts).toBeGreaterThan(description);
    expect(securityAccreditation).toBeGreaterThan(contacts);
    expect(detailsOverviewBlock).toContain("Service Catalogue Items");
    expect(detailsOverviewBlock).toContain("Support Request");
    expect(detailsOverviewBlock).toContain("Issue Request");
    expect(detailsOverviewBlock).toContain("ATO");
    expect(detailsOverviewBlock).not.toContain("Cyber GRC");
    expect(detailsOverviewBlock).not.toContain("DIIS ID");
    expect(detailsOverviewBlock).not.toContain("Application Portfolio Management");
    expect(detailsOverviewBlock).not.toContain("Defence ICT Inventory System");
    expect(networkDetailsBlock).not.toContain("View in DIIS");
  });

  it("places network impact panels and risk charts in their own overview sections", () => {
    const impactOverview = networkDetailsBlock.indexOf("Impact Overview");
    const linkedSystems = networkDetailsBlock.indexOf("Linked ICT Systems", impactOverview);
    const assetFootprint = networkDetailsBlock.indexOf("Asset Type Footprint", impactOverview);
    const riskOverview = networkDetailsBlock.indexOf("Risk Overview");
    const riskCharts = networkDetailsBlock.indexOf("<NetworkDetailRiskCharts", riskOverview);

    expect(linkedSystems).toBeGreaterThan(impactOverview);
    expect(assetFootprint).toBeGreaterThan(linkedSystems);
    expect(riskOverview).toBeGreaterThan(assetFootprint);
    expect(riskCharts).toBeGreaterThan(riskOverview);
    expect(networkDetailSource).toContain("const networkImpactSystems = dataset.ictSystems");
    expect(networkDetailSource).toContain("const networkAssetTypeFootprint = ([");
    expect(networkDetailsBlock).toContain('target="_blank"');
    expect(networkDetailsBlock).toContain('rel="noreferrer"');
    expect(networkDetailsBlock).toContain("overflow-y-auto overflow-x-hidden");
  });
});
