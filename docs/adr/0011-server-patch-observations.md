# 0011: Server patch evidence separate from device patch rules

Status: Accepted, 2026-11-03.

The Patch Management Explorer needs installation, restart, verification and planning evidence. Existing `asset_patch_state` belongs to network-device rule evaluation, and OS patch-level labels cannot establish server compliance.

Add optional typed `ServerAsset.patchManagement` evidence and the snapshot-keyed SQL `server_patch_observation` table through migration 029. Both provider facades hydrate the same record and share the projection/status code. Current affirmative evidence is required for Patched; stale, missing or contradictory observations remain Unknown. Preserve existing configurable measures, network-device patch rules, findings and CMDB mappings.

Alternatives rejected: treating every OS label as patched, inferring installation/reboot dates from discovery or CVE detection, using uptime as a mandatory restart deadline, or changing an existing SPI's semantics. These would imply evidence or policy not present in the source data.

Show three table views with common identity, independent filters and canonical full-field export. Retain ownership, deadlines, maintenance windows, change references and expiring exceptions as source evidence; do not implement remote patch execution or invent a universal compliance deadline.

The user requested labelled sample observations. Generate deterministic local profiles only for missing server records, during fresh initialization or explicit backed-up maintenance. SQL sample population is separately opted into and preserves observations. Operational data remains imported tool evidence. This adds no dependency or network requirement and uses the existing offline install/build contract.

Consequences: SQL upgrades require 029 before running the updated full loader; old JSON records stay compatible. A source must provide assessment validity and verification for a positive patched status. See [feature/data/recovery](../patch-management-explorer.md), [providers](../data-providers.md) and [offline builds](../offline-builds.md).
