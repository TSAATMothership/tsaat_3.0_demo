import { describe, expect, it } from "vitest";
import {
  formatDatabaseConnectionString,
  normalizeEditableDatabaseConnectionInput,
  parseConnectionString
} from "@/lib/db-config";

describe("db-config SSL handling", () => {
  it("defaults to encrypted trust-server-certificate mode when omitted", () => {
    const result = normalizeEditableDatabaseConnectionInput({
      server: "localhost",
      database: "TSAAT",
      authMode: "trusted",
      userId: "",
      password: ""
    });

    expect(result.sslEnabled).toBe(true);
    expect(result.sslType).toBe("trust-server-certificate");
  });

  it.each([
    [{ sslType: "strict" }, true, "strict"],
    [{ trustServerCertificate: false }, true, "strict"],
    [{ sslEnabled: false }, false, "strict"],
    [{ encrypt: false }, false, "strict"]
  ])("preserves an explicit TLS policy %j", (tls, enabled, mode) => {
    const result = normalizeEditableDatabaseConnectionInput({ server: "localhost", database: "TSAAT", authMode: "trusted", ...tls });
    expect(result.sslEnabled).toBe(enabled);
    expect(result.sslType).toBe(mode);
  });

  it("forces SSL enabled trust mode when sslType is trust-server-certificate", () => {
    const result = normalizeEditableDatabaseConnectionInput({
      server: "localhost",
      database: "TSAAT",
      authMode: "trusted",
      userId: "",
      password: "",
      sslEnabled: false,
      sslType: "trust-server-certificate"
    });

    expect(result.sslEnabled).toBe(true);
    expect(result.sslType).toBe("trust-server-certificate");
  });

  it("normalizes trust server certificate to SSL enabled", () => {
    const result = normalizeEditableDatabaseConnectionInput({
      server: "localhost",
      database: "TSAAT",
      authMode: "trusted",
      userId: "",
      password: "",
      encrypt: false,
      trustServerCertificate: true
    });

    expect(result.sslEnabled).toBe(true);
    expect(result.sslType).toBe("trust-server-certificate");
  });

  it("parses Encrypt and TrustServerCertificate values from connection strings", () => {
    const parsed = parseConnectionString(
      "Server=localhost;Database=TSAAT;Trusted_Connection=True;Encrypt=True;TrustServerCertificate=True;"
    );

    expect(parsed.encrypt).toBe(true);
    expect(parsed.trustServerCertificate).toBe(true);
  });

  it("writes SSL settings to DB_config connection string", () => {
    const connectionString = formatDatabaseConnectionString({
      server: "localhost",
      database: "TSAAT",
      authMode: "trusted",
      userId: "",
      password: "",
      sslEnabled: true,
      sslType: "trust-server-certificate"
    });

    expect(connectionString).toContain("Encrypt=True");
    expect(connectionString).toContain("TrustServerCertificate=True");
  });
});
