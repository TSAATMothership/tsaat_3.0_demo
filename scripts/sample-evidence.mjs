import { enrichDemoDataset, summarizeDemoDataset, validateDemoDataset } from './enrich-demo-dataset.mjs';
import { enrichVulnerabilityMetadata } from './enrich-vulnerability-metadata.mjs';

export const SAMPLE_EVIDENCE_PROFILE = 'tsaat-aligned-evidence-v1';
const observationDates = new Set(['snapshotDate', 'generatedAt', 'timestamp', 'closedTimestamp', 'detectedDate', 'capturedAt', 'lastDiscoveredDate', 'lastPatchedDate', 'lastRestartedDate', 'verifiedDate', 'assessmentDate', 'assessmentValidUntil', 'dueDate', 'plannedDate', 'exceptionExpiresDate', 'observedAt']);
const present = value => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');

/** Explicit sample-authoring operation. Public CVE dates/versions are never shifted. */
export function redateSampleDataset(input, days) {
  function visit(value, key) {
    if (typeof value === 'string' && observationDates.has(key) && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
      const date = Date.parse(value);
      if (!Number.isFinite(date)) throw new Error('Invalid sample observation date: ' + key);
      const shifted = new Date(date + days * 86400000).toISOString();
      return value.length === 10 ? shifted.slice(0, 10) : shifted;
    }
    if (Array.isArray(value)) return value.map(item => visit(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, visit(item, name)]));
    return value;
  }
  return visit(input);
}

/** For explicitly selected demonstration fixtures only; never an operational read fallback. */
export function completeSampleEvidence(input) {
  let dataset = enrichDemoDataset(input);
  const unassigned = dataset.ictSystems.filter(system => !system.networkId?.trim());
  if (unassigned.length) {
    for (const system of unassigned) system.networkId = 'net-unassigned';
    if (!dataset.managedNetworks.some(network => network.id === 'net-unassigned')) dataset.managedNetworks.push({
      id: 'net-unassigned', name: 'Unassigned Systems', securityDomain: 'UNKNOWN', criticality: 'Non-Critical',
      adfPlatform: false, enterprisePlatform: false, modellingStatus: false, classification: 'Unclassified',
      description: 'Sample holding network for unmodelled systems; no managed network assignment is asserted.',
      owner: 'Not assigned (sample)', supportEmail: 'unassigned@support.example.test',
      serviceCatalogueUrl: 'https://service-catalogue.example.test/networks/net-unassigned',
      diisId: 'DIIS-NET-000', atoNumber: 'ATO-NET-000', diisUrl: 'https://diis.example.test/networks/net-unassigned',
      grcUrl: 'https://grc.example.test/networks/net-unassigned', discoveryStatus: 'Discovery Non Enabled', ictSystemIds: [], assetIds: []
    });
  }
  for (const asset of dataset.assets) {
    if (asset.type === 'ip-node') continue; // Unidentified nodes must retain unknown identity.
    // Older baseline fixtures carried some observations from later snapshots.
    // A historical inventory must only contain vulnerability evidence available by its date.
    asset.vulnerabilities = asset.vulnerabilities.filter(vulnerability => vulnerability.detectedDate <= dataset.snapshotDate && vulnerability.capturedAt.slice(0, 10) <= dataset.snapshotDate);
    const property = asset.type === 'network-device' ? 'networkOs' : ['server', 'workstation'].includes(asset.type) ? 'operatingSystem' : null;
    if (property) {
      asset[property] ??= { family: 'Sample Network OS', vendor: 'Sample vendor', version: '1.0', supportStatus: 'Unknown' };
      const os = asset[property];
      os.patchLevel ||= `DEMO-${dataset.snapshotDate.slice(0, 7)}-R1`;
    }
    // The original seed generator uses fictional CVE codes and scanner observations.
    // Give those scenarios an explicit synthetic identity instead of inventing public CVE facts.
    for (const vulnerability of asset.vulnerabilities) {
      if (!/^VULN-\d+$/.test(vulnerability.id) || vulnerability.id.startsWith('sample-cve-')) continue;
      if (!vulnerability.cve.startsWith('SAMPLE-')) vulnerability.cve = 'SAMPLE-' + vulnerability.cve;
      vulnerability.cveName ||= 'Sample scenario: ' + vulnerability.description;
      vulnerability.cveCreatedDate ||= '2024-01-01';
      const software = asset.installedSoftware?.[0], os = asset.operatingSystem ?? asset.networkOs;
      vulnerability.softwareName ||= software?.name ?? os?.family ?? 'Sample device firmware';
      vulnerability.softwareVersion ||= software?.version ?? os?.version ?? '1.0-sample';
      vulnerability.referenceUrl ||= 'https://sample.example.test/vulnerabilities/' + encodeURIComponent(vulnerability.cve);
    }
  }
  dataset = enrichVulnerabilityMetadata(dataset);
  dataset.sampleDataProfile = SAMPLE_EVIDENCE_PROFILE;
  validateDemoDataset(dataset);
  return dataset;
}

export function auditSampleEvidence(dataset) {
  validateDemoDataset(dataset);
  const summary = summarizeDemoDataset(dataset), errors = [];
  for (const group of ['missingEndpointFields', 'missingSoftwareFields', 'missingNetworkFields', 'missingSystemFields']) {
    for (const [key, count] of Object.entries(summary[group])) if (count) errors.push(`${group}.${key}: ${count}`);
  }
  for (const asset of dataset.assets) {
    if (asset.type === 'ip-node') {
      for (const key of ['ipAddress', 'lastDiscoveredDate', 'discoveredBy', 'discoveryApproach']) if (!present(asset[key])) errors.push(`${asset.id}.${key}`);
      if (asset.macAddress || asset.deviceModel || asset.operatingSystem || asset.installedSoftware?.length) errors.push(`${asset.id}: invented Shadow IT identity`);
      continue;
    }
    const os = asset.operatingSystem ?? asset.networkOs;
    if (['server', 'workstation', 'network-device'].includes(asset.type)) {
      for (const key of ['family', 'vendor', 'version', 'supportStatus', 'patchLevel']) if (!present(os?.[key])) errors.push(`${asset.id}.os.${key}`);
    }
    for (const software of asset.installedSoftware ?? []) if (!present(software.supportStatus)) errors.push(`${asset.id}.software.supportStatus`);
    for (const vulnerability of asset.vulnerabilities) {
      for (const key of ['cve', 'cveName', 'cveCreatedDate', 'softwareName', 'softwareVersion', 'referenceUrl', 'description', 'remediationGuidance', 'severity', 'criticality', 'exploitability', 'detectedDate', 'capturedAt', 'source']) if (!present(vulnerability[key])) errors.push(`${vulnerability.id}.${key}`);
      if (vulnerability.cveCreatedDate > vulnerability.detectedDate || vulnerability.detectedDate > dataset.snapshotDate || vulnerability.capturedAt.slice(0, 10) > dataset.snapshotDate) errors.push(`${vulnerability.id}: inconsistent observation dates`);
    }
  }
  for (const dependency of dataset.ciDependencies ?? []) {
    for (const key of ['observationMethod', 'observedAt', ...(dependency.dependencyType === 'Flow Dependency' ? ['protocol', 'sourcePort', 'targetPort'] : [])]) if (!present(dependency[key])) errors.push(`${dependency.id}.${key}`);
  }
  return { ...summary, errors };
}

export function auditSampleHistory(datasets) {
  const dates = datasets.map(dataset => dataset.snapshotDate).sort();
  const errors = [];
  if (new Set(dates).size !== dates.length) errors.push('Duplicate snapshot dates');
  if (dates.length < 5 || Date.parse(dates.at(-1)) - Date.parse(dates[0]) < 28 * 86400000) errors.push('At least four complete weeks of weekly evidence are required');
  for (let index = 1; index < dates.length; index++) if (Date.parse(dates[index]) - Date.parse(dates[index - 1]) !== 7 * 86400000) errors.push('Snapshots must be exactly one week apart');
  return { dates, errors };
}
