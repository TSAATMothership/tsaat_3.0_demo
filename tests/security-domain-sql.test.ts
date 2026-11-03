import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import { executeSqlJsonWithConnection } from "@/lib/sql-server";
import { normalizeDatasetSecurityDomains } from "@/lib/security-domain.mjs";
const server=process.env.TSAAT_DOMAIN_PARITY_SERVER?.trim(),database=process.env.TSAAT_DOMAIN_PARITY_DATABASE?.trim();
describe.runIf(Boolean(server&&database))("security domain SQL migration parity",()=>{
 it("migrates a legacy schema twice and matches JSON normalization inside a rolled-back transaction",async()=>{
  if(!database?.startsWith("TSAAT_DomainParity_")) throw Error("Select an explicit disposable TSAAT_DomainParity_* database.");
  const migration=readFileSync("Database Schema/migrations/030_security_domains.sql","utf8");
  const result=await executeSqlJsonWithConnection<{managedNetworks:Array<{securityDomain:string;classification:string}>;ictSystems:Array<{securityDomain:string}>;assets:Array<{securityDomain:string}>;constraints:number}>(
    "SET XACT_ABORT ON; BEGIN TRANSACTION;\n"+
    "IF SCHEMA_ID(N'tsaat') IS NOT NULL THROW 51033,'Use an empty disposable domain parity database.',1;\n"+
    "EXEC(N'CREATE SCHEMA tsaat');\n"+
    "CREATE TABLE tsaat.managed_network(id INT,classification NVARCHAR(40));\n"+
    "CREATE TABLE tsaat.ict_system(id INT,security_domain NVARCHAR(20) NOT NULL, CONSTRAINT CK_ict_system_security_domain CHECK(security_domain IN(N'Secret',N'Protected',N'Unclassified')));\n"+
    "CREATE TABLE tsaat.asset(id INT,security_domain NVARCHAR(20) NOT NULL, CONSTRAINT CK_asset_security_domain CHECK(security_domain IN(N'Secret',N'Protected',N'Unclassified')));\n"+
    "INSERT tsaat.managed_network VALUES(1,N'Restricted'),(2,N'Protected'),(3,NULL);\n"+
    "INSERT tsaat.ict_system VALUES(1,N'Secret'),(2,N'Unclassified'); INSERT tsaat.asset VALUES(1,N'Protected'),(2,N'Unclassified');\nGO\n"+
    migration+"\nGO\n"+migration+"\nGO\n"+
    "SELECT JSON_QUERY((SELECT security_domain AS securityDomain,classification FROM tsaat.managed_network ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)) AS managedNetworks,\n"+
    "JSON_QUERY((SELECT security_domain AS securityDomain FROM tsaat.ict_system ORDER BY id FOR JSON PATH)) AS ictSystems,\n"+
    "JSON_QUERY((SELECT security_domain AS securityDomain FROM tsaat.asset ORDER BY id FOR JSON PATH)) AS assets,\n"+
    "(SELECT COUNT(*) FROM sys.check_constraints WHERE name IN(N'CK_managed_network_security_domain',N'CK_ict_system_security_domain',N'CK_asset_security_domain') AND is_disabled=0 AND is_not_trusted=0) AS constraints FOR JSON PATH,WITHOUT_ARRAY_WRAPPER; ROLLBACK TRANSACTION;",
    {server:server!,database,trustedConnection:true,sslEnabled:true,sslType:"strict"});
  expect(result).toEqual({...normalizeDatasetSecurityDomains({managedNetworks:[{classification:"Restricted"},{classification:"Protected"},{classification:null}],ictSystems:[{securityDomain:"Secret"},{securityDomain:"Unclassified"}],assets:[{securityDomain:"Protected"},{securityDomain:"Unclassified"}]}),constraints:3});
 },120000);
});
