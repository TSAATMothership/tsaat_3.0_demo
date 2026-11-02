# Mandatory offline installation and compilation

## Acceptance contract

A complete checkout must install and compile both SQL and JSON-backed No-SQL versions without network access, an existing node_modules directory, a populated npm cache, a sibling checkout or an external artifact store. All application code, build assets, development tools and native compiler packages required by the locked graph are committed as regular files. This applies to every future change.

The host supplies Windows, Node 24.13.1/npm and PowerShell. These platform tools are prerequisites, not downloaded by the build. CI validates Windows x64; archives for all optional platforms in the lockfile are retained, but this does not claim other operating systems support Windows DPAPI authentication. Chrome/Edge is a preinstalled prerequisite for the browser smoke. SQL runtime needs sqlcmd, its configured SQL Server and trusted TLS; compilation does not. No-SQL uses local JSON and the same local authentication. External business links still require their destination services when clicked.

## Disconnected use

From the repository root, after transferring the complete checkout and provisioning the host tools:

~~~powershell
npm ci --offline
npm run docs:generate
npm run check
npm run build:all
npm run test:nosql
~~~

compileApp.cmd sql, nosql or all performs archive verification, npm ci --offline, checks and the selected compilation. It reinstalls node_modules; stop local app processes before using it. Ordinary npm run build/build:sql/build:nosql/build:all expect npm ci first. Run the selected artifact using start:sql or start:nosql and provision login/storage as described in the main README. Builds keep existing NoSQL/data and never seed an operational SQL database.

The repository .npmrc sets offline=true, ignore-scripts=true, audit=false, update-notifier=false and the existing legacy-peer-deps policy. npm ci remains the installation contract. The lockfile resolves every package, including its legacy v2 dependency table, to file:vendor/npm archives. Native SWC, esbuild, Rollup and resolver binaries are packaged dependencies; no compiler or browser download is needed. Current dependencies work without install lifecycle scripts. A future package requiring a lifecycle-generated artifact needs an explicit reviewed local preparation step and new offline evidence; do not simply enable dependency scripts.

To demonstrate independence from a previous cache, choose a new cache directory:

~~~powershell
npm ci --offline --ignore-scripts --cache .local/offline-proof-unique
npm run check
npm run build:all
npm run test:nosql
~~~

Use a never-before-used cache path for each proof. CI performs this using a GUID-named cache on a clean runner. Do not call a warm-cache install evidence of a fresh offline install.

## Enforcement

- npm run offline:check verifies every archive's SHA-512 against the lockfile and provenance manifest, rejects remote/missing/unused entries and unexpected vendor files, and runs as part of npm run check and each production build.
- Build wrappers disable telemetry and preload scripts/offline-network.cjs into Node and inherited children/workers. HTTP(S), fetch, TCP (including loopback), TLS, DNS and UDP attempts throw. Local named-pipe IPC remains available. An attempt log makes caught/suppressed requests fail the overall build too. The guard is build-only; runtime provider networking is unchanged.
- CI installs with an empty cache and uses a temporary Windows outbound firewall rule for the Node executable during npm ci, source checks and both compilations. It removes that exact rule in finally, then runs the authenticated No-SQL browser smoke. Host checkout and Node provisioning occur before this gate. The Node preload is a regression guard, not an OS sandbox for arbitrary native executables; reviewers must reject download subprocesses too.
- Documentation impact checks cover the manifest, lockfile, tooling and CI. Required PR review includes offline evidence. Never store the archives as Git LFS pointers or replace them with external download links.

CI firewall setup is for the disposable Windows runner only. Developers need not modify their workstation firewall. Local guarded builds and the fresh empty-cache install are testable without administrator access once the host tools are available.

## Dependency changes (explicit connected maintenance)

Network access is allowed to acquire reviewed dependencies during maintenance, never during installation/compilation. Keep package versions unchanged unless the task calls for an upgrade. For an intended package change, update the manifest and lockfile using an explicit connected command, for example:

~~~powershell
npm install package-name@reviewed-version --package-lock-only --offline=false --ignore-scripts --no-audit
npm run offline:refresh
npm run offline:check
~~~

The placeholder must be replaced with the selected package and version. offline:refresh uses only Node built-ins and retrieves exact HTTPS registry.npmjs.org tarball URLs already recorded in the lockfile or previous manifest. It verifies SHA-512 before writing, rewrites local lockfile resolutions, records upstream provenance and removes only obsolete archive files in vendor/npm. Existing corrupt archives fail verification; investigate and replace the identified file from the reviewed original source rather than changing its integrity value to match unexpected bytes. The refresh command does not select versions, run package lifecycle scripts or compile the app.

Review package/license notices, transitive changes, native binaries and lifecycle requirements. Preserve the original unmodified archives and their included notices. Commit package.json, package-lock.json, vendor/npm/manifest.json, changed archives, meaningful tests and affected documentation together. Then prove a fresh offline install, run docs:generate, check, both builds and test:nosql. Missing artifacts or unsupported installation behavior must be fixed before merging. Online dependency/advisory review is separate from the offline release build.

## Failure and recovery

Missing/corrupt archive: restore the reviewed archive from the compatible repository commit or run the explicit connected maintenance process before transferring a new complete checkout. Do not fall back to the registry in a build.

Network attempt: remove the build-time fetch/download, commit the required asset/code, and add regression coverage. Do not disable the guard or clear attempt evidence to make the build pass.

Dependency rollback: restore the previous package manifest, lockfile and vendor archives as one change, reinstall offline and rebuild both providers. No SQL schema, JSON format or data migration is associated with this packaging change. Runtime credentials, JSON stores and build outputs remain excluded from Git.
