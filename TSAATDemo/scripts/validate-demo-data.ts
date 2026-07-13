import { promises as fs } from "node:fs";
import path from "node:path";
import type { Dataset } from "../lib/types";

type RuntimeConfig = {
  severityDefinitions?: unknown[];
  priorityDefinitions?: unknown[];
  spiDefinitions?: unknown[];
  kpiDefinitions?: unknown[];
  discoveryToolsSettings?: { tools?: unknown[] };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

async function main() {
  const dataDirectory = path.join(process.cwd(), "data");
  const snapshotsDirectory = path.join(dataDirectory, "snapshots");
  const snapshotFiles = (await fs.readdir(snapshotsDirectory))
    .filter((fileName) => /^week-\d+\.json$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right));

  assert(snapshotFiles.length === 8, `Expected 8 bundled snapshots; found ${snapshotFiles.length}.`);

  const snapshots: Dataset[] = [];
  for (const fileName of snapshotFiles) {
    const dataset = await readJson<Dataset>(path.join(snapshotsDirectory, fileName));
    assert(Number.isInteger(dataset.snapshotId), `${fileName} is missing a numeric snapshotId.`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(dataset.snapshotDate), `${fileName} has an invalid snapshotDate.`);
    assert(dataset.managedNetworks.length >= 14, `${fileName} is missing managed networks.`);
    assert(dataset.ictSystems.length === 60, `${fileName} must contain 60 ICT systems.`);
    assert(dataset.assets.length === 1000, `${fileName} must contain 1,000 assets.`);
    assert(dataset.spiEvaluations.length === 5320, `${fileName} must contain 5,320 SPI evaluations.`);
    assert(
      dataset.discoveryCoverageEvaluations?.length === 1000,
      `${fileName} must contain 1,000 discovery coverage evaluations.`
    );
    assert(dataset.ciDependencies?.length === 27441, `${fileName} must contain 27,441 CI dependencies.`);
    assert(Array.isArray(dataset.findings) && dataset.findings.length > 0, `${fileName} is missing findings.`);
    snapshots.push(dataset);
  }

  const sortedDates = snapshots.map((snapshot) => snapshot.snapshotDate).sort();
  assert(
    snapshots.every((snapshot, index) => snapshot.snapshotDate === sortedDates[index]),
    "Bundled snapshot dates are not in ascending order."
  );

  const current = await readJson<Dataset>(path.join(dataDirectory, "current.json"));
  const latest = snapshots[snapshots.length - 1];
  assert(current.snapshotId === latest.snapshotId, "current.json does not match the latest snapshot id.");
  assert(current.snapshotDate === latest.snapshotDate, "current.json does not match the latest snapshot date.");

  const config = await readJson<RuntimeConfig>(path.join(dataDirectory, "runtime-config.json"));
  assert(config.severityDefinitions?.length === 5, "Runtime config must contain 5 severity definitions.");
  assert(config.priorityDefinitions?.length === 8, "Runtime config must contain 8 priority definitions.");
  assert(config.spiDefinitions?.length === 10, "Runtime config must contain 10 SPI definitions.");
  assert(config.kpiDefinitions?.length === 10, "Runtime config must contain 10 KPI definitions.");
  assert(config.discoveryToolsSettings?.tools?.length === 7, "Runtime config must contain 7 discovery tools.");

  process.stdout.write(
    `Validated ${snapshots.length} database-free snapshots (${snapshots[0].snapshotDate} to ${latest.snapshotDate}).\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
