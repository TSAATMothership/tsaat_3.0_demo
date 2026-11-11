export const INVENTORY_SCHEMA_VERSION: 2;
export const RETAINED_REFERENCE_FILES: readonly string[];
export const RETIRED_DATASET_FIELDS: readonly string[];
export const RETIRED_OS_FIELDS: readonly string[];
export function retireDatasetFields<T>(input: T): T;
export function assertRetainedDataset(input: unknown): void;
