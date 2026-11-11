export interface FindingsExportContext {
  scope: { network: string[]; system: string[]; securityDomain?: string; dataDate: string };
  asOf: string;
  status: "open" | "closed";
}
