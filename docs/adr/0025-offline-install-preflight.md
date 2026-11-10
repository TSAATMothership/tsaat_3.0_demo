# ADR 0025: Explicit offline installation preflight

Status: Accepted. Date: 2026-11-10.

## Context

On Windows a running Next.js server holds its native SWC module open. npm ci cannot remove that file and leaves an incomplete installation. npm removes node_modules before project preinstall hooks run; lifecycle scripts are also intentionally disabled by ADR 0007. A repository hook cannot make bare npm ci stop the server in time.

## Decision

Provide `npm run install:offline`, implemented using preinstalled Node built-ins and PowerShell. Verify local archive integrity before stopping servers, refuse an active checkout build, stop only exact checkout Next.js dev/start/server entry points and captured descendants, recheck process identity, then invoke npm ci with offline/lifecycle/audit protections and development/optional packages included. Block Node network access during installation and reject even caught attempts. compileApp.cmd and CI use this entry point.

Use an exclusive local install lock to prevent overlapping managed installers and new launcher calls. Leave servers stopped and retain network-failure evidence. Document manual recovery for an interrupted installer or unrecognized custom launcher. Do not replace global npm, change the user's shell profile/PATH, terminate every Node process or add packages. Bare npm ci remains supported after manual server shutdown.

## Consequences and validation

The automatic-shutdown command differs from bare npm ci, but preserves npm's exact lockfile installation contract and works before node_modules exists. Windows, Node 24/npm and PowerShell remain host prerequisites supplied separately; runtime SQL/browser prerequisites are unchanged. Existing SQL/JSON stores and credentials are unaffected.

Regression tests cover process isolation, descendants, active builds, lock/error handling, npm policy arguments and network attempts. Acceptance also requires archive verification, a fresh empty-cache guarded install, full source checks, both guarded builds and compiled No-SQL smoke. No SQL parity run is selected because provider/data/calculation behavior is unchanged.
