# Explorer demonstration data

`populate-explorer-demo-data.sql` fills missing/blank fields for the End Point Explorer and Installed Software Explorer in already-loaded demo snapshots. Run it explicitly against a demonstration database after migrations 020 and 021. It is intentionally outside the automatic migration/import path so real CMDB imports do not receive synthetic values.

The script preserves populated attributes, CI/software counts, IDs, relationships, snapshot dates and existing OS metadata. It adds an OS row only for a software-hosting endpoint with neither endpoint nor network OS data. Filling absent OS records changes Explorer completeness counts and is only appropriate for labelled demonstration data.

Demo values include private IP addresses, locally administered MAC addresses, CI-type-specific device models, several discovery sources, discovery ages across all four age bands, Windows/Linux installation paths and clearly marked mock patch baselines. Installation ordinals remain intact. Addresses and models are stable for the same CI across the existing snapshots. Existing values are never regenerated on rerun. Only changed snapshots receive a new `generated_at` data version so application caches refresh; historical snapshot dates remain unchanged.

Before running, save the original `asset`, `asset_installed_software`, `asset_operating_system`, `asset_network_os`, managed-network labels and snapshot version fields. The local execution backup and verification report are stored in `.local/cmdb-demo/` (ignored by Git). Run `audit-explorer-data.sql` before and after to verify all 18 displayed fields. Export timestamps are created at download time rather than stored as CMDB source attributes.

After reloading the packaged demo JSON into SQL, rerun this explicit demo-only enrichment to restore these attributes. Source fixtures remain unchanged. A second run against the same data should report zero changed rows.

## Shadow IT observations

After migration 022, run `populate-shadow-it-demo-data.sql` to add the IP Node observations used by Shadow IT Explorer. It adds IP Scan nodes per populated network and ARP nodes linked to representative identified endpoints across network and system scopes. The existing demo produced 240 distinct nodes across 8 snapshots (1,920 rows), split into 144 scans and 96 ARP observations per snapshot. Existing CIs, software and relationships are preserved; reruns insert no duplicates.

IP Nodes are deliberately unidentified. The known-endpoint enrichment and completeness audit exclude them so they never receive invented MAC addresses, device models, OS or software. Their own discovery details are stored on the node; ARP-owner details come from the identified endpoint in that snapshot. IP Scan owner columns are N/A. Demo IP addresses use the private 10.88 range and discovery dates stay within their snapshot date. Seed backups and validation results use `shadow-` filenames in `.local/cmdb-demo/`.
