/** Storage v2: retired analytics are removed at explicit upgrade/import boundaries. */
export const INVENTORY_SCHEMA_VERSION = 2;
export const RETAINED_REFERENCE_FILES = ['discovery-coverage-rules.json', 'discovery-tools-settings.json', 'personas.json', 'cmdb-attributes.json'];
export const RETIRED_DATASET_FIELDS = ['findings', 'spiEvaluations', 'kpiEvaluations', 'referenceVersions'];
export const RETIRED_OS_FIELDS = ['majorVersion', 'currentSupportedMajor', 'nMinus'];

/** Preserve all unrelated source evidence, including null/unknown values and observation dates. */
export function retireDatasetFields(input) {
  const result = structuredClone(input);
  if (!result || !Array.isArray(result.assets) || !Array.isArray(result.managedNetworks) || !Array.isArray(result.ictSystems)) throw new Error('Invalid inventory dataset.');
  for (const key of RETIRED_DATASET_FIELDS) delete result[key];
  for (const network of result.managedNetworks) delete network.targetStateAssets;
  for (const asset of result.assets) {
    delete asset.patchManagement;
    for (const os of [asset.operatingSystem, asset.networkOs]) if (os) for (const key of RETIRED_OS_FIELDS) delete os[key];
  }
  return result;
}

export function assertRetainedDataset(input) {
  const retired = [];
  for (const key of RETIRED_DATASET_FIELDS) if (Object.hasOwn(input, key)) retired.push(key);
  for (const network of input.managedNetworks ?? []) if (Object.hasOwn(network, 'targetStateAssets')) retired.push('targetStateAssets');
  for (const asset of input.assets ?? []) {
    if (Object.hasOwn(asset, 'patchManagement')) retired.push('patchManagement');
    for (const os of [asset.operatingSystem, asset.networkOs]) if (os) for (const key of RETIRED_OS_FIELDS) if (Object.hasOwn(os, key)) retired.push(key);
  }
  if (retired.length) throw new Error('Retired storage fields require the explicit v2 upgrade: ' + [...new Set(retired)].join(', '));
}
