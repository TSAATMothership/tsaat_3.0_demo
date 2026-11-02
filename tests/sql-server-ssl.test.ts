import { describe, expect, it } from "vitest";
import { buildSqlcmdSecurityArgs } from "@/lib/sql-server";

describe("sql-server SSL sqlcmd args", () => {
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
