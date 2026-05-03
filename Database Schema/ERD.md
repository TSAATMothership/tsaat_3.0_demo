# TSAAT ERD (SQL Server)

```mermaid
erDiagram
  dataset_snapshot ||--o{ managed_network : "snapshot_id"
  dataset_snapshot ||--o{ ict_system : "snapshot_id"
  dataset_snapshot ||--o{ asset : "snapshot_id"
  dataset_snapshot ||--o{ finding : "snapshot_id"
  dataset_snapshot ||--o{ ci_dependency : "snapshot_id"

  managed_network ||--o{ ict_system : "network_id"
  managed_network ||--o{ network_declared_system : "network_id"
  managed_network ||--o{ network_declared_asset : "network_id"
  managed_network ||--o{ network_target_state_asset : "network_id"
  managed_network ||--o{ managed_network_hierarchy : "parent/child"

  ict_system ||--o{ system_environment : "system_id"
  ict_system ||--o{ system_mission_capability : "system_id"
  ict_system ||--o{ system_business_service : "system_id"
  ict_system ||--o{ ict_system_hierarchy : "parent/child"

  system_environment ||--o{ system_environment_asset : "system_id + environment_id + environment_type"
  asset ||--o{ system_environment_asset : "asset_id"

  asset ||--o{ asset_operating_system : "asset_id"
  asset ||--o{ asset_network_os : "asset_id"
  asset ||--o{ asset_patch_state : "asset_id"
  asset ||--o{ asset_installed_software : "asset_id"
  asset ||--o{ asset_vulnerability : "asset_id"
  asset ||--o{ finding : "asset_id"

  asset ||--o{ ci_dependency : "source_asset_id"
  asset ||--o{ ci_dependency : "target_asset_id"

  measures_settings_version ||--o{ measures_severity_matrix : "settings_version_id"
  measures_settings_version ||--o{ measures_priority_matrix : "settings_version_id"
  spi_definition ||--o{ measures_severity_matrix : "spi_id"
  spi_definition ||--o{ measures_priority_matrix : "spi_id"
```

## CI Dependency Domain
- `ci_dependency` stores directed CI-to-CI links:
  - `source_asset_id -> target_asset_id`
  - `dependency_type`: `Logical Dependency` or `Flow Dependency`
  - Optional flow metadata: protocol/ports/observation fields.
- The model supports both ICT System model and Network model flow visualisations.

## Operational Notes
- Connection/auth settings are external to this ERD and are configured in local encrypted repository root `DB_config`, which `/settings`, `CreateDB.cmd`, and `compileApp.cmd` can confirm, update, or recreate when the local DPAPI file is missing/undecryptable.
- Application login credentials are external to this ERD and are configured in local encrypted repository root `logindetails`.
- `managed_network` includes platform flags:
  - `adf_platform` (`BIT`)
  - `enterprise_platform` (`BIT`)
- `managed_network` includes `modelling_status` (`BIT`) for persisted network model coverage state.
- `managed_network` includes accreditation references:
  - `diis_id` (`NVARCHAR(100)`)
  - `ato_number` (`NVARCHAR(100)`)
  - `apm_number` (`NVARCHAR(100)`)
- `ict_system` includes platform flags:
  - `adf_platform` (`BIT`)
  - `enterprise_platform` (`BIT`)
- `ict_system` includes accreditation/application references:
  - `diis_id` (`NVARCHAR(100)`)
  - `ato_number` (`NVARCHAR(100)`)
  - `apm_number` (`NVARCHAR(100)`)
- Measures settings are versioned:
  - `measures_severity_matrix` maps SPI and asset type to finding severity.
  - `measures_priority_matrix` maps SPI to P1-P7 priority rank for non-compliant findings.
