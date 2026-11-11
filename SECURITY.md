# Security maintenance

Keep credentials, operational databases, mutable JSON stores and generated reports outside Git. DB_config uses Windows DPAPI and belongs to the SQL runtime identity; do not commit plaintext substitutes or copy another identity's encrypted files.

Application login and signed sessions have been removed by explicit product decision. Anyone who can reach the app can use its pages and APIs, including settings and exports. Access restrictions belong to the deployment/network or reverse proxy. Use HTTPS in deployment. Legacy logindetails files are ignored, are not deleted by this change and must remain outside Git.

Report vulnerabilities privately to the repository owner or the organization's security process. Reproduce in isolation, add a regression test and review dependency advisories before a scoped fix. Package modernization is separate from this import; existing app versions were preserved.

Review SQL calculation metadata as executable configuration, restrict database/settings administration and use least-privilege runtime access. See [operations](docs/operations.md) for deployment and recovery.


Both builds use the same direct-access model. No-SQL snapshot/reference/settings files are server-side data, not public static assets. Apply host filesystem access controls to the configured data directory and its backups; JSON content is not encrypted by the app. The No-SQL build rejects SQL administration and execution, while SQL retains strict TLS. See [data storage](docs/data-providers.md).
