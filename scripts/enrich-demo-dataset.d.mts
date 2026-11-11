import type { Dataset } from "../lib/types";
export const DEMO_DATA_PROFILE: string;
export function validateDemoDataset(dataset: Dataset): void;
export function enrichDemoDataset(dataset: Dataset): Dataset;
export interface DemoDataSummary {
  date: string; networks: number; systems: number; assets: number; knownEndpoints: number; shadowNodes: number;
  installations: number; dependencies: number; vulnerabilities: number;
  missingEndpointFields: Record<string, number>; missingSoftwareFields: Record<string, number>;
  missingNetworkFields: Record<string, number>; missingSystemFields: Record<string, number>;
}
export function summarizeDemoDataset(dataset: Dataset): DemoDataSummary;
