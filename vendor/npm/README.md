# Offline npm archives

These unmodified upstream package archives are required source inputs, committed as regular Git files so a fresh checkout can install without a network or npm cache. This is the sole dependency-vendoring exception in ADR 0007. Installed node_modules and host runtimes remain excluded.

manifest.json records each archive's original registry URL and SHA-512 integrity. package-lock.json resolves to these files. All locked optional platform archives are included; this is not a promise of cross-platform app runtime support. Upstream package/license notices are preserved inside each archive.

Use npm ci --offline to install, npm run offline:check to verify, and the explicit connected npm run offline:refresh only when maintaining reviewed dependency changes. Never edit archives or hash values to mask corruption. See [the mandatory offline build contract](../../docs/offline-builds.md).
