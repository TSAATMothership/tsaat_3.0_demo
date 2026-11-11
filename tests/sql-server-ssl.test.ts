import { describe, expect, it } from "vitest";
import { buildSqlcmdSecurityArgs, normalizeSslConfig, resolveSqlcmdServerTarget } from "@/lib/sql-server";

describe("sql-server SSL sqlcmd args", () => {
  it("uses encrypted trust mode for a new runtime connection and retains explicit settings", () => {
    expect(buildSqlcmdSecurityArgs(normalizeSslConfig({}))).toEqual(["-N", "-C"]);
    expect(buildSqlcmdSecurityArgs(normalizeSslConfig({ sslType: "strict" }))).toEqual(["-N"]);
    expect(buildSqlcmdSecurityArgs(normalizeSslConfig({ sslEnabled: false }))).toEqual([]);
  });

  it("requires TCP for encryption and preserves explicit TCP ports", () => {
    expect(resolveSqlcmdServerTarget("localhost\\SQLEXPRESS", true)).toBe("tcp:localhost\\SQLEXPRESS");
    expect(resolveSqlcmdServerTarget("tcp:host,1444", true)).toBe("tcp:host,1444");
    expect(() => resolveSqlcmdServerTarget("lpc:localhost", true)).toThrow("SSL requires a TCP");
    expect(() => resolveSqlcmdServerTarget("np:host", true)).toThrow("SSL requires a TCP");
    expect(resolveSqlcmdServerTarget("localhost", false)).toBe("lpc:localhost");
  });
  it("returns no SSL args when SSL is disabled", () => {
    expect(buildSqlcmdSecurityArgs({ sslEnabled: false, sslType: "strict" })).toEqual([]);
  });

  it("returns strict SSL args", () => {
    expect(buildSqlcmdSecurityArgs({ sslEnabled: true, sslType: "strict" })).toEqual(["-N"]);
  });

  it("returns trust-server-certificate SSL args", () => {
    expect(buildSqlcmdSecurityArgs({ sslEnabled: true, sslType: "trust-server-certificate" })).toEqual([
      "-N",
      "-C"
    ]);
  });
});
