import fs from "node:fs";
const { profiles } = JSON.parse(fs.readFileSync(new URL("../data/sample-patch-profiles.json", import.meta.url), "utf8"));
export const PATCH_SAMPLE_PROFILE = "tsaat-sample-server-patches-v1";
export function enrichPatchManagement(input) {
  const dataset = structuredClone(input);
  const date = offset => offset === null ? null : new Date(Date.parse(dataset.snapshotDate + "T00:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
  const time = offset => date(offset) ? date(offset) + "T00:00:00.000Z" : null;
  for (const asset of dataset.assets) {
    if (asset.type !== "server" || asset.patchManagement != null) continue;
    const bucket = asset.id.charCodeAt(asset.id.length - 1) % profiles.length;
    const profile = profiles[bucket];
    const installed = asset.operatingSystem?.patchLevel?.trim() || "Sample installed baseline";
    asset.patchManagement = {
      assessmentDate: time(profile.assessmentDays), assessmentValidUntil: date(profile.validDays),
      lastPatchedDate: time(profile.patchDays), lastRestartedDate: time(profile.restartDays), verifiedDate: time(profile.verifiedDays),
      installedPatchLevel: installed, targetPatchLevel: [0,4].includes(bucket) ? installed : "Sample baseline " + dataset.snapshotDate.slice(0,7),
      missingUpdates: profile.missing, missingCriticalUpdates: profile.critical, restartRequired: profile.restart, deploymentStatus: profile.status,
      dueDate: date(profile.dueDays), plannedDate: date(profile.plannedDays), owner: "Sample Server Operations",
      maintenanceWindow: "Sample window: Sunday 02:00-04:00 UTC", changeReference: "SAMPLE-PATCH-" + asset.id,
      exceptionReason: profile.exceptionDays !== null ? "Sample exception: business owner accepted a short maintenance deferral; review before expiry." : null,
      exceptionExpiresDate: date(profile.exceptionDays), source: "Sample patch-management observation"
    };
  }
  return dataset;
}
