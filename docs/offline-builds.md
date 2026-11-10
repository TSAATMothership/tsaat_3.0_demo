# Mandatory offline installation and compilation

## Acceptance contract

A complete checkout must install and compile both SQL and JSON-backed No-SQL versions without network access, an existing node_modules directory, a populated npm cache, a sibling checkout or an external artifact store. All application code, build assets, development tools and native compiler packages required by the locked graph are committed as regular files. Preserve this capability for every change. Repeat the full proof for dependency/build changes and release candidates; unrelated UI, documentation or tooling changes use the [SDLC impact assessment](sdlc.md).

The host supplies Windows, Node 24.13.1/npm and PowerShell. These platform tools are prerequisites, not downloaded by the build. CI validates Windows x64; archives for all optional platforms in the lockfile are retained, but this does not claim other operating systems support SQL Windows DPAPI configuration. Chrome/Edge is a preinstalled prerequisite for the browser smoke. SQL runtime needs sqlcmd, its configured SQL Server and the selected TLS policy; compilation does not. No-SQL uses local JSON and direct workspace access. External business links still require their destination services when clicked.

The explicit `setup:database` workflow uses the already pinned tsx/Next packages and local schema/reference/sample files. It contacts only the selected SQL Server and downloads nothing. It uses a separate administrator connection to create the database and a dedicated application login, with SSL disabled. Its CLI-only TypeScript path mapping resolves Next's server-only marker for server execution; application compilation is unchanged. Builds never invoke database setup.

Routine CI uses changed-area validation; workflow_dispatch, validation:full and dependency/build changes select the full offline gate. A clean CI runner still installs local dependencies when selected tests require them. Existing production build guards remain enforced whenever a build is run.

## Browser document assets

PDF and Excel rendering uses repository-local worker code and the existing pinned dependencies. Workers fetch only same-installation assets: `/tsaat-logo.png`, the five PNG illustrations under `/insights-report-art/`, and `/document-assets/network-target-state-template.xlsx`. Deploy these public assets with both artifacts. The workbook template is the reviewed three-sheet source template copied into public assets; its reference sheets remain intact while the selected network populates the editable sheet. No report renderer needs Node filesystem access, an installed office suite, a headless browser service, remote fonts/images or package downloads.

The migration introduces no dependency version or vendor-archive change. Browser ZIP/XML code uses byte arrays rather than Node buffers/zlib, and report generation runs in a worker to keep the progress/cancel interface responsive. Local HTTP asset reads during app use are distinct from compilation: both guarded builds must remain free of network access. The broad client-bundle/worker change selects archive verification, fresh empty-cache offline installation, both builds and compiled browser/provider checks; completed results belong in validation evidence rather than being inferred from unchanged dependencies. See [document runtime contract](client-document-generation.md).

## Disconnected use

The legacy `/Dependencies/` exclusion is anchored at the repository root. It must not hide application API folders named `dependencies`, including the existing impact-analyser dependency route, from complete checkouts. Governance Insights uses repository-local TSAAT branding, topography and an original cyber-terrain SVG with inline icons; it adds no package, remote font, asset download or storage requirement.

The Discovery Overview vulnerability/patch summaries reuse existing provider operations, projections and local navigation. They add no packages, build assets, external services or data population. The lockfile/vendor set and existing-store retention contract remain unchanged; the SDLC assessment selects validation; fresh empty-cache installation and both builds are not required solely for presentation edits.

Patch Management Explorer uses existing packages and local sample-patch-profiles.json data. The shared projector, workbook and explicit sample maintenance command require no network, agent download or remote patch catalogue. Existing JSON stores are retained during either build; the explicit population command alone appends missing sample observations with backup. The dependency lockfile and vendor archive set are unchanged.

The Security Vulnerability Explorer catalogue contains reviewed CVE/vendor facts and exact software-version matches as local JSON. Source research is an explicit maintenance activity; installation, compilation, population and page loads do not fetch CVEs. No dependency/archive changes are needed. See [CVE provenance and population](security-vulnerability-explorer.md).

From the repository root, after transferring the complete checkout and provisioning the host tools:

~~~powershell
npm run install:offline
npm run docs:generate
npm run check
npm run build:all
npm run test:nosql
~~~

compileApp.cmd sql, nosql or all runs the same `install:offline` command, checks and the selected compilation. Installation verifies archives, stops this checkout's active app servers, then reinstalls node_modules using `npm ci --offline`. Ordinary npm run build/build:sql/build:nosql/build:all expect installation first. Run the selected artifact using start:sql or start:nosql and configure storage as described in the main README. Builds keep existing NoSQL/data and never seed an operational SQL database.

The installer uses only Node built-ins and Windows PowerShell, so it works with missing or partially installed node_modules. It identifies Node entry points by the exact absolute Next.js CLI/server paths for this checkout, including commands launched through dev/start aliases, both providers and custom ports. Windows parses command-line arguments; substring, port-only and global node.exe matching are not used. Identified server descendants are stopped too, with PID/creation-time/command-line checks before termination. Other checkouts and unrelated Node processes remain running. An active build or a process-inspection/termination failure aborts before dependency removal. Servers remain stopped after installation; restart the desired dev/start command when ready. A process started through an unrecognizable custom/relative launcher must be stopped manually if it retains a file lock.

Bare `npm ci --offline` remains the underlying locked installation contract, but cannot automatically stop servers through package hooks: npm removes node_modules before running preinstall, and dependency lifecycle scripts are deliberately disabled. Use `npm run install:offline` or `compileApp.cmd` for automatic shutdown. No global npm binary, PATH or PowerShell profile is modified. See [ADR 0025](adr/0025-offline-install-preflight.md).

JSON sample enrichment, SQL-export conversion and population use local source files and Node built-ins. No export or database connection is attempted during either build; pre-existing JSON stores remain intact.

Application login and credential provisioning are retired. SQL DB_config continues to use the existing local PowerShell/DPAPI implementation.

The repository .npmrc sets offline=true, ignore-scripts=true, audit=false, update-notifier=false and the existing legacy-peer-deps policy. npm ci remains the installation contract. The lockfile resolves every package, including its legacy v2 dependency table, to file:vendor/npm archives. Native SWC, esbuild, Rollup and resolver binaries are packaged dependencies; no compiler or browser download is needed. Current dependencies work without install lifecycle scripts. A future package requiring a lifecycle-generated artifact needs an explicit reviewed local preparation step and new offline evidence; do not simply enable dependency scripts.

To demonstrate independence from a previous cache, choose a new cache directory:

~~~powershell
npm run install:offline -- --cache .local/offline-proof-unique
npm run check
npm run build:all
npm run test:nosql
~~~

Use a never-before-used cache path for each proof. CI performs this using a GUID-named cache on a clean runner. Do not call a warm-cache install evidence of a fresh offline install.

## Enforcement

- npm run offline:check verifies every archive's SHA-512 against the lockfile and provenance manifest, rejects remote/missing/unused entries and unexpected vendor files, and runs as part of npm run check and each production build.
- The installer and build wrappers disable telemetry and preload scripts/offline-network.cjs into npm/Next and inherited Node children/workers. HTTP(S), fetch, TCP (including loopback), TLS, DNS and UDP attempts throw. Local named-pipe IPC remains available. An attempt log makes caught/suppressed requests fail installation/compilation too. Runtime provider networking is unchanged. Installation forces offline mode, disabled lifecycle scripts/audit, and inclusion of development/optional compiler packages even if the host has production-only npm settings. Its only optional argument is `--cache`; callers cannot disable these protections through forwarded flags.
- Full validation CI installs with an empty cache and uses a temporary Windows outbound firewall rule for the Node executable during npm ci, source checks and both compilations. It removes that exact rule in finally, then runs the No-SQL browser smoke without application credentials. Host checkout and Node provisioning occur before this gate. The Node preload is a regression guard, not an OS sandbox for arbitrary native executables; reviewers must reject download subprocesses too.
- Review documentation impacts for manifest, lockfile, tooling and CI changes. Require fresh offline evidence for dependency/build changes and releases; routine PRs record their assessed checks. Never store the archives as Git LFS pointers or replace them with external download links.

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

Missing Next.js CLI, partial `node_modules`, or Windows `EPERM unlink` on the SWC native compiler: run `npm run install:offline` from the repository root, then retry the original dev/start/build command. It stops the recognized checkout servers before npm removes dependencies. All six provider commands check the Next.js CLI before storage initialization or build setup and print this recovery command on failure. Installation remains explicit; the launcher never downloads or installs dependencies automatically. If an editor/custom launcher or another account still holds a file, close that specific process and retry; do not delete the lockfile/vendor archives or disable antivirus protections.

Concurrent or interrupted installation: `.local/offline-install.lock` prevents a second managed installer and rejects app dev/start/build commands while installation is active. If an installer was forcibly terminated, inspect the PID/start time recorded in that file and confirm it has exited before deleting only that lock file and rerunning `npm run install:offline`. The installer otherwise removes its lock in finally, including on failure. A network failure retains its `.local/offline-install-attempts-*.log` for investigation. Existing stores, credentials and package-lock.json are never recovery deletion targets.

Missing/corrupt archive: restore the reviewed archive from the compatible repository commit or run the explicit connected maintenance process before transferring a new complete checkout. Do not fall back to the registry in a build.

Network attempt: remove the build-time fetch/download, commit the required asset/code, and add regression coverage. Do not disable the guard or clear attempt evidence to make the build pass.

Dependency rollback: restore the previous package manifest, lockfile and vendor archives as one change, reinstall offline and rebuild both providers. No SQL schema, JSON format or data migration is associated with this packaging change. Runtime credentials, JSON stores and build outputs remain excluded from Git.

The explicit `enrich:nosql` command uses the already pinned local tsx package and shared TypeScript rule code. It adds no packages or network calls, and builds do not invoke it against existing stores.

Risk-profile explorer new-tab links use the existing Next/React packages and local routes; no dependency or build asset changes are required. These navigation changes use focused validation unless the assessed scope also affects data/build behavior.


Discovery Insights PDF uses the pinned pdf-lib package, standard embedded fonts, vector drawing and its bundled illustration in the browser worker. Artwork is served from this installation; generation requires no external network service. Archive integrity and offline compilation remain supported; repeat the full install/build proof when dependency/build impact or release validation requires it.
