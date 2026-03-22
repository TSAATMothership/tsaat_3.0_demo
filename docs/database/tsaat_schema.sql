-- TSAAT relational schema generated from:
-- data/current.json
-- data/snapshots/week-*.json
-- data/spi-definitions.json
-- data/discovery-tools-settings.json
-- data/measures-settings.json
--
-- Target dialect: PostgreSQL 14+
-- Design notes:
-- 1) Snapshot-aware data is modeled with (snapshot_id, business_id) composite keys.
-- 2) Referential integrity is enforced with foreign keys across all nested structures.
-- 3) JSON objects with variable keys (e.g. finding evidence) are stored as JSONB.

BEGIN;

CREATE SCHEMA IF NOT EXISTS tsaat;
SET search_path TO tsaat, public;

CREATE TYPE asset_type_enum AS ENUM ('server', 'workstation', 'network-device');
CREATE TYPE environment_type_enum AS ENUM ('Production', 'Development', 'UAT', 'Test');
CREATE TYPE security_domain_enum AS ENUM ('Secret', 'Protected', 'Unclassified');
CREATE TYPE support_status_enum AS ENUM ('Supported', 'OutOfSupport', 'Unknown');
CREATE TYPE compliance_status_enum AS ENUM ('Compliant', 'Non-compliant', 'Unknown');
CREATE TYPE vulnerability_severity_enum AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE eol_status_enum AS ENUM ('Supported', 'EOL', 'Unknown');
CREATE TYPE warranty_status_enum AS ENUM ('InWarranty', 'OutOfWarranty', 'Unknown');
CREATE TYPE criticality_enum AS ENUM ('Critical', 'Non-Critical');
CREATE TYPE network_discovery_status_enum AS ENUM ('Discovery Enabled', 'Discovery Non Enabled');
CREATE TYPE finding_severity_enum AS ENUM ('High Risk', 'Critical Exposure', 'Major', 'Moderate', 'Data Gap');
CREATE TYPE finding_workflow_status_enum AS ENUM ('open', 'closed');
CREATE TYPE discovery_tool_asset_setting_enum AS ENUM ('required', 'na');

CREATE TABLE dataset_snapshot (
  snapshot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE spi_definition (
  spi_id SMALLINT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  success_measure TEXT NOT NULL,
  priority_order INTEGER NOT NULL,
  recommended_action TEXT NOT NULL
);

CREATE TABLE spi_applicable_asset_type (
  spi_id SMALLINT NOT NULL,
  asset_type asset_type_enum NOT NULL,
  PRIMARY KEY (spi_id, asset_type),
  FOREIGN KEY (spi_id) REFERENCES spi_definition (spi_id) ON DELETE CASCADE
);

CREATE TABLE managed_network (
  snapshot_id BIGINT NOT NULL,
  network_id TEXT NOT NULL,
  name TEXT NOT NULL,
  criticality criticality_enum NOT NULL,
  classification TEXT NULL,
  discovery_status network_discovery_status_enum NOT NULL,
  PRIMARY KEY (snapshot_id, network_id),
  FOREIGN KEY (snapshot_id) REFERENCES dataset_snapshot (snapshot_id) ON DELETE CASCADE
);

CREATE TABLE ict_system (
  snapshot_id BIGINT NOT NULL,
  system_id TEXT NOT NULL,
  network_id TEXT NOT NULL,
  name TEXT NOT NULL,
  modelling_status BOOLEAN NOT NULL,
  diis_defined BOOLEAN NOT NULL,
  criticality criticality_enum NOT NULL,
  security_domain security_domain_enum NOT NULL,
  PRIMARY KEY (snapshot_id, system_id),
  UNIQUE (snapshot_id, system_id, network_id),
  FOREIGN KEY (snapshot_id) REFERENCES dataset_snapshot (snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, network_id) REFERENCES managed_network (snapshot_id, network_id) ON DELETE CASCADE
);

CREATE TABLE network_declared_system (
  snapshot_id BIGINT NOT NULL,
  network_id TEXT NOT NULL,
  system_id TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, network_id, system_id),
  FOREIGN KEY (snapshot_id, network_id) REFERENCES managed_network (snapshot_id, network_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, system_id, network_id)
    REFERENCES ict_system (snapshot_id, system_id, network_id) ON DELETE CASCADE
);

CREATE TABLE system_mission_capability (
  snapshot_id BIGINT NOT NULL,
  system_id TEXT NOT NULL,
  mission_capability_id TEXT NOT NULL,
  name TEXT NOT NULL,
  criticality criticality_enum NOT NULL,
  PRIMARY KEY (snapshot_id, system_id, mission_capability_id),
  FOREIGN KEY (snapshot_id, system_id) REFERENCES ict_system (snapshot_id, system_id) ON DELETE CASCADE
);

CREATE TABLE system_business_service (
  snapshot_id BIGINT NOT NULL,
  system_id TEXT NOT NULL,
  business_service_id TEXT NOT NULL,
  name TEXT NOT NULL,
  criticality criticality_enum NOT NULL,
  PRIMARY KEY (snapshot_id, system_id, business_service_id),
  FOREIGN KEY (snapshot_id, system_id) REFERENCES ict_system (snapshot_id, system_id) ON DELETE CASCADE
);

CREATE TABLE system_environment (
  snapshot_id BIGINT NOT NULL,
  system_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  name TEXT NOT NULL,
  environment_type environment_type_enum NOT NULL,
  PRIMARY KEY (snapshot_id, system_id, environment_id),
  UNIQUE (snapshot_id, system_id, environment_type),
  UNIQUE (snapshot_id, system_id, environment_id, environment_type),
  FOREIGN KEY (snapshot_id, system_id) REFERENCES ict_system (snapshot_id, system_id) ON DELETE CASCADE
);

CREATE TABLE asset (
  snapshot_id BIGINT NOT NULL,
  asset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  asset_type asset_type_enum NOT NULL,
  network_id TEXT NOT NULL,
  security_domain security_domain_enum NOT NULL,
  system_id TEXT NULL,
  environment_type environment_type_enum NULL,
  lifecycle_eol_status eol_status_enum NOT NULL,
  lifecycle_warranty_status warranty_status_enum NOT NULL,
  PRIMARY KEY (snapshot_id, asset_id),
  UNIQUE (snapshot_id, network_id, asset_id),
  UNIQUE (snapshot_id, system_id, asset_id),
  UNIQUE (snapshot_id, system_id, environment_type, asset_id),
  CHECK (
    (system_id IS NULL AND environment_type IS NULL)
    OR (system_id IS NOT NULL AND environment_type IS NOT NULL)
  ),
  FOREIGN KEY (snapshot_id) REFERENCES dataset_snapshot (snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, network_id) REFERENCES managed_network (snapshot_id, network_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, system_id) REFERENCES ict_system (snapshot_id, system_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, system_id, network_id)
    REFERENCES ict_system (snapshot_id, system_id, network_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, system_id, environment_type)
    REFERENCES system_environment (snapshot_id, system_id, environment_type) ON DELETE CASCADE
);

CREATE TABLE network_declared_asset (
  snapshot_id BIGINT NOT NULL,
  network_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, network_id, asset_id),
  FOREIGN KEY (snapshot_id, network_id) REFERENCES managed_network (snapshot_id, network_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, network_id, asset_id) REFERENCES asset (snapshot_id, network_id, asset_id) ON DELETE CASCADE
);

CREATE TABLE system_environment_asset (
  snapshot_id BIGINT NOT NULL,
  system_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  environment_type environment_type_enum NOT NULL,
  asset_id TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, system_id, environment_id, asset_id),
  FOREIGN KEY (snapshot_id, system_id, environment_id, environment_type)
    REFERENCES system_environment (snapshot_id, system_id, environment_id, environment_type) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, system_id, environment_type, asset_id)
    REFERENCES asset (snapshot_id, system_id, environment_type, asset_id) ON DELETE CASCADE
);

CREATE TABLE asset_operating_system (
  snapshot_id BIGINT NOT NULL,
  asset_id TEXT NOT NULL,
  family TEXT NOT NULL,
  vendor TEXT NOT NULL,
  major_version INTEGER NULL,
  version TEXT NOT NULL,
  support_status support_status_enum NOT NULL,
  current_supported_major INTEGER NULL,
  n_minus INTEGER NULL,
  PRIMARY KEY (snapshot_id, asset_id),
  FOREIGN KEY (snapshot_id, asset_id) REFERENCES asset (snapshot_id, asset_id) ON DELETE CASCADE
);

CREATE TABLE asset_network_os (
  snapshot_id BIGINT NOT NULL,
  asset_id TEXT NOT NULL,
  family TEXT NOT NULL,
  vendor TEXT NOT NULL,
  major_version INTEGER NULL,
  version TEXT NOT NULL,
  support_status support_status_enum NOT NULL,
  current_supported_major INTEGER NULL,
  n_minus INTEGER NULL,
  PRIMARY KEY (snapshot_id, asset_id),
  FOREIGN KEY (snapshot_id, asset_id) REFERENCES asset (snapshot_id, asset_id) ON DELETE CASCADE
);

CREATE TABLE asset_patch_state (
  snapshot_id BIGINT NOT NULL,
  asset_id TEXT NOT NULL,
  is_latest BOOLEAN NULL,
  last_patched_date DATE NULL,
  PRIMARY KEY (snapshot_id, asset_id),
  FOREIGN KEY (snapshot_id, asset_id) REFERENCES asset (snapshot_id, asset_id) ON DELETE CASCADE
);

CREATE TABLE asset_installed_software (
  snapshot_id BIGINT NOT NULL,
  asset_id TEXT NOT NULL,
  software_ordinal INTEGER NOT NULL CHECK (software_ordinal > 0),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  support_status support_status_enum NOT NULL,
  PRIMARY KEY (snapshot_id, asset_id, software_ordinal),
  FOREIGN KEY (snapshot_id, asset_id) REFERENCES asset (snapshot_id, asset_id) ON DELETE CASCADE
);

CREATE TABLE asset_vulnerability (
  snapshot_id BIGINT NOT NULL,
  asset_id TEXT NOT NULL,
  vulnerability_id TEXT NOT NULL,
  cve TEXT NOT NULL,
  severity vulnerability_severity_enum NOT NULL,
  detected_date DATE NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, asset_id, vulnerability_id),
  FOREIGN KEY (snapshot_id, asset_id) REFERENCES asset (snapshot_id, asset_id) ON DELETE CASCADE
);

CREATE TABLE finding (
  snapshot_id BIGINT NOT NULL,
  finding_id TEXT NOT NULL,
  spi_id SMALLINT NOT NULL,
  priority_rank INTEGER NOT NULL,
  severity finding_severity_enum NOT NULL,
  compliance_status compliance_status_enum NOT NULL,
  network_id TEXT NOT NULL,
  system_id TEXT NULL,
  environment_type environment_type_enum NULL,
  asset_id TEXT NOT NULL,
  title TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_action TEXT NOT NULL,
  workflow_status finding_workflow_status_enum NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (snapshot_id, finding_id),
  CHECK (
    (system_id IS NULL AND environment_type IS NULL)
    OR (system_id IS NOT NULL AND environment_type IS NOT NULL)
  ),
  CHECK (
    (workflow_status = 'open' AND closed_at IS NULL)
    OR (workflow_status = 'closed' AND closed_at IS NOT NULL)
  ),
  FOREIGN KEY (snapshot_id) REFERENCES dataset_snapshot (snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, network_id) REFERENCES managed_network (snapshot_id, network_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, asset_id) REFERENCES asset (snapshot_id, asset_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, network_id, asset_id) REFERENCES asset (snapshot_id, network_id, asset_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, system_id) REFERENCES ict_system (snapshot_id, system_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, system_id, network_id)
    REFERENCES ict_system (snapshot_id, system_id, network_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, system_id, asset_id)
    REFERENCES asset (snapshot_id, system_id, asset_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, system_id, environment_type)
    REFERENCES system_environment (snapshot_id, system_id, environment_type) ON DELETE CASCADE,
  FOREIGN KEY (spi_id) REFERENCES spi_definition (spi_id)
);

CREATE TABLE discovery_tools_settings_version (
  settings_version_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL UNIQUE
);

CREATE TABLE discovery_tool (
  settings_version_id BIGINT NOT NULL,
  tool_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  el2_owner TEXT NOT NULL DEFAULT '',
  el2_operations_manager TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (settings_version_id, tool_id),
  FOREIGN KEY (settings_version_id)
    REFERENCES discovery_tools_settings_version (settings_version_id) ON DELETE CASCADE
);

CREATE TABLE discovery_tool_asset_scope (
  settings_version_id BIGINT NOT NULL,
  tool_id TEXT NOT NULL,
  asset_type asset_type_enum NOT NULL,
  scope_setting discovery_tool_asset_setting_enum NOT NULL,
  PRIMARY KEY (settings_version_id, tool_id, asset_type),
  FOREIGN KEY (settings_version_id, tool_id)
    REFERENCES discovery_tool (settings_version_id, tool_id) ON DELETE CASCADE
);

CREATE TABLE measures_settings_version (
  settings_version_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL UNIQUE
);

CREATE TABLE measures_severity_matrix (
  settings_version_id BIGINT NOT NULL,
  spi_id SMALLINT NOT NULL,
  asset_type asset_type_enum NOT NULL,
  severity finding_severity_enum NOT NULL,
  PRIMARY KEY (settings_version_id, spi_id, asset_type),
  FOREIGN KEY (settings_version_id)
    REFERENCES measures_settings_version (settings_version_id) ON DELETE CASCADE,
  FOREIGN KEY (spi_id) REFERENCES spi_definition (spi_id)
);

CREATE INDEX idx_ict_system_network ON ict_system (snapshot_id, network_id);
CREATE INDEX idx_asset_network ON asset (snapshot_id, network_id);
CREATE INDEX idx_asset_system ON asset (snapshot_id, system_id);
CREATE INDEX idx_asset_type ON asset (snapshot_id, asset_type);
CREATE INDEX idx_finding_scope ON finding (snapshot_id, network_id, system_id, asset_id);
CREATE INDEX idx_finding_spi ON finding (snapshot_id, spi_id);
CREATE INDEX idx_finding_status ON finding (snapshot_id, workflow_status, compliance_status);

COMMIT;
