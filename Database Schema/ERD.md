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
```

`app_user` is a standalone authentication table (no foreign keys) that stores salted password-hash credentials, active flag, and session-version invalidation metadata.

## CI Dependency Domain
- `ci_dependency` stores directed CI-to-CI links:
  - `source_asset_id -> target_asset_id`
  - `dependency_type`: `Logical Dependency` or `Flow Dependency`
  - Optional flow metadata: protocol/ports/observation fields.
- The model supports both ICT System model and Network model flow visualisations.

## Operational Notes
- Connection/auth settings are external to this ERD and are configured in encrypted repository root `DB_config`.
- `managed_network` includes platform flags:
  - `adf_platform` (`BIT`)
  - `enterprise_platform` (`BIT`)
- `ict_system` includes platform flags:
  - `adf_platform` (`BIT`)
  - `enterprise_platform` (`BIT`)
