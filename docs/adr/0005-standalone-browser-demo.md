# ADR 0005: Shared UI with a self-contained browser demo

Status: Superseded by [ADR 0006](0006-dual-data-provider-builds.md), 2026-11-02. The user rejected this approach; its Demo folder and build tooling were removed. The historical decision below is not current guidance.

## Context

The user requested a demo in TSAAT_UI_3/Demo that opens in a browser with JSON data and no SQL or backend. It must evolve with the operational app. A second hand-maintained UI would drift; a normal static export would retain dependencies on server-side loaders and report endpoints.

## Decision

Bundle the existing page compositions, client components, pure models and compatible API/report handlers with esbuild. Replace the SQL/Next server boundary using explicit browser adapters. Embed compressed synthetic JSON snapshots, reference configuration, styles, images, workbook template and worker code in one HTML file. Use hash routes so scope/date links and new tabs work under file://. Persist demo settings locally.

Track the reproducible HTML and manifest as a deliberate distribution exception. Make demo freshness part of check and direct-file browser validation part of CI. Pin reviewed SQL calculation contracts and require implementation/test review whenever they change. Keep production SQL and authentication paths intact.

## Consequences

Users can copy one file and open it offline. Shared UI and report changes automatically enter the next demo build. Browser-specific data calculations still require maintenance and explicit parity tests. The packaged data is historical synthetic data, and there is no live ingestion, operational login or shared persistence. Build tools are needed only by developers. New backend-dependent features need a documented browser implementation or explicit demo limitation before release.
