import { describe, expect, it } from "vitest";
import { canSaveDatabaseSettings } from "@/lib/database-settings-save-gating";

describe("database settings save gating", () => {
  it("allows save when SSL is disabled and connection/schema passed", () => {
    const result = canSaveDatabaseSettings({
      sslEnabled: false,
      hasConnectionSuccess: true,
      hasSslSuccess: false,
      hasSchemaSuccess: true,
      isSaving: false,
      isTestingConnection: false,
      isTestingSsl: false,
      isTestingSchema: false
    });

    expect(result).toBe(true);
  });

  it("blocks save when SSL is enabled but SSL test is not successful", () => {
    const result = canSaveDatabaseSettings({
      sslEnabled: true,
      hasConnectionSuccess: true,
      hasSslSuccess: false,
      hasSchemaSuccess: true,
      isSaving: false,
      isTestingConnection: false,
      isTestingSsl: false,
      isTestingSchema: false
    });

    expect(result).toBe(false);
  });

  it("blocks save while any validation is running", () => {
    const result = canSaveDatabaseSettings({
      sslEnabled: true,
      hasConnectionSuccess: true,
      hasSslSuccess: true,
      hasSchemaSuccess: true,
      isSaving: false,
      isTestingConnection: false,
      isTestingSsl: true,
      isTestingSchema: false
    });

    expect(result).toBe(false);
  });
});
