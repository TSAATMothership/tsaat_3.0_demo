# Security maintenance

Keep credentials, operational databases, mutable JSON stores and generated reports outside Git. DB_config and logindetails use Windows DPAPI and belong to the runtime identity; do not commit plaintext substitutes or copy another identity's encrypted files.

The current app uses file-backed application credentials and signed sessions. It is not an enterprise identity provider or a multi-role authorization system. Production requires HTTPS for secure cookies. Rotate credentials through supported Settings flows and verify session expiry/logout behavior.

Report vulnerabilities privately to the repository owner or the organization's security process. Reproduce in isolation, add a regression test and review dependency advisories before a scoped fix. Package modernization is separate from this import; existing app versions were preserved.

Review SQL calculation metadata as executable configuration, restrict database/settings administration and use least-privilege runtime access. See [operations](docs/operations.md) for deployment and recovery.


Both builds retain the same authentication and session boundary. No-SQL snapshot/reference/settings files are server-side data, not public static assets. Apply host filesystem access controls to the configured data directory and its backups; JSON content is not encrypted by the app. The No-SQL build rejects SQL administration and execution, while SQL retains strict TLS. See [data storage](docs/data-providers.md).
