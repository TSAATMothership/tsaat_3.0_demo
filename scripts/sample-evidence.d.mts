import type { Dataset } from '../lib/types';
import type { DemoDataSummary } from './enrich-demo-dataset.mjs';
export const SAMPLE_EVIDENCE_PROFILE: string;
export function redateSampleDataset(input: Dataset, days: number): Dataset;
export function completeSampleEvidence(input: Dataset): Dataset & { sampleDataProfile: string };
export function auditSampleEvidence(dataset: Dataset): DemoDataSummary & { errors: string[] };
export function auditSampleHistory(datasets: Dataset[]): { dates: string[]; errors: string[] };
