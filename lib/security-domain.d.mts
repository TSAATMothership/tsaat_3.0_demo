export type SecurityDomain = "PROTECTED" | "SECRET" | "UNKNOWN";
export const SECURITY_DOMAINS: readonly SecurityDomain[];
export function normalizeSecurityDomain(value: unknown): SecurityDomain;
export function normalizeNetworkSecurityDomain(value: unknown, classification: unknown): SecurityDomain;
export function securityDomainSelection(value?: string | string[] | null): SecurityDomain[];
export function securityDomainFilter(value?: string | string[] | null): string | undefined;
export function parseSecurityDomainScope(value: unknown): string | undefined;
export function matchesSecurityDomain(value: unknown, filter?: string | string[] | null): boolean;
export function normalizeDatasetSecurityDomains<T extends {
  managedNetworks: Array<{ securityDomain?: unknown; classification?: unknown }>;
  ictSystems: Array<{ securityDomain?: unknown }>;
  assets: Array<{ securityDomain?: unknown }>;
}>(dataset: T): Omit<T, "managedNetworks" | "ictSystems" | "assets"> & {
  managedNetworks: Array<T["managedNetworks"][number] & { securityDomain: SecurityDomain }>;
  ictSystems: Array<T["ictSystems"][number] & { securityDomain: SecurityDomain }>;
  assets: Array<T["assets"][number] & { securityDomain: SecurityDomain }>;
};
