export interface FindingsExportContext {
  scope: { network: string[]; system: string[]; dataDate: string };
  asOf: string;
  status: "open" | "closed";
}
