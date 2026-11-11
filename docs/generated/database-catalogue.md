# Generated database catalogue

Generated from the base schema and migration inventory. Do not edit by hand. This is source DDL, not an assertion about a deployed database. Read the migration README and database lifecycle before execution.

Base schema declares **26 tables**. [Schema source](../../Database%20Schema/database-schema.sql) · [Maintained ERD](../../Database%20Schema/ERD.md) · [Database lifecycle](../database.md).

## tsaat.dataset_snapshot

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT IDENTITY(1,1) NOT NULL |
| snapshot_date | DATE NOT NULL |
| generated_at | DATETIMEOFFSET(7) NOT NULL |
| source_label | NVARCHAR(100) NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_dataset_snapshot_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_dataset_snapshot_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_dataset_snapshot_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_dataset_snapshot_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_dataset_snapshot] PRIMARY KEY CLUSTERED ([snapshot_id]),
CONSTRAINT [UQ_dataset_snapshot_snapshot_date] UNIQUE ([snapshot_date])
```

## tsaat.managed_network

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |
| adf_platform | BIT NOT NULL |
| enterprise_platform | BIT NOT NULL |
| modelling_status | BIT NOT NULL |
| classification | NVARCHAR(255) NULL |
| security_domain | NVARCHAR(20) NOT NULL CONSTRAINT [DF_managed_network_security_domain] DEFAULT (N'UNKNOWN') |
| description | NVARCHAR(2000) NULL |
| owner | NVARCHAR(255) NULL |
| support_email | NVARCHAR(320) NULL |
| service_catalogue_url | NVARCHAR(1024) NULL |
| diis_id | NVARCHAR(100) NULL |
| ato_number | NVARCHAR(100) NULL |
| diis_url | NVARCHAR(1024) NULL |
| grc_url | NVARCHAR(1024) NULL |
| discovery_status | NVARCHAR(40) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_managed_network_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_managed_network_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_managed_network] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id]),
CONSTRAINT [FK_managed_network_snapshot]
FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
CONSTRAINT [CK_managed_network_security_domain]
CHECK ([security_domain] COLLATE Latin1_General_100_BIN2 IN (N'PROTECTED', N'SECRET', N'UNKNOWN')),
CONSTRAINT [CK_managed_network_criticality]
CHECK ([criticality] IN (N'Critical', N'Non-Critical')),
CONSTRAINT [CK_managed_network_discovery_status]
CHECK ([discovery_status] IN (N'Discovery Enabled', N'Discovery Non Enabled'))
```

## tsaat.managed_network_hierarchy

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| parent_network_id | NVARCHAR(255) NOT NULL |
| child_network_id | NVARCHAR(255) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_hierarchy_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_managed_network_hierarchy_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_managed_network_hierarchy_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_managed_network_hierarchy_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_managed_network_hierarchy] PRIMARY KEY CLUSTERED ([snapshot_id], [parent_network_id], [child_network_id]),
CONSTRAINT [FK_managed_network_hierarchy_parent]
FOREIGN KEY ([snapshot_id], [parent_network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [FK_managed_network_hierarchy_child]
FOREIGN KEY ([snapshot_id], [child_network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [CK_managed_network_hierarchy_not_self] CHECK ([parent_network_id] <> [child_network_id])
```

## tsaat.ict_system

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| adf_platform | BIT NOT NULL |
| enterprise_platform | BIT NOT NULL |
| description | NVARCHAR(2000) NULL |
| diis_id | NVARCHAR(100) NULL |
| owner | NVARCHAR(255) NULL |
| support_email | NVARCHAR(320) NULL |
| service_catalogue_url | NVARCHAR(1024) NULL |
| ato_number | NVARCHAR(100) NULL |
| apm_number | NVARCHAR(100) NULL |
| diis_url | NVARCHAR(1024) NULL |
| grc_url | NVARCHAR(1024) NULL |
| modelling_status | BIT NOT NULL |
| diis_defined | BIT NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |
| security_domain | NVARCHAR(20) NOT NULL CONSTRAINT [DF_ict_system_security_domain] DEFAULT (N'UNKNOWN') |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_ict_system_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_ict_system_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_ict_system] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id]),
CONSTRAINT [UQ_ict_system_snapshot_system_network] UNIQUE ([snapshot_id], [system_id], [network_id]),
CONSTRAINT [FK_ict_system_snapshot]
FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
CONSTRAINT [FK_ict_system_network]
FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [CK_ict_system_criticality]
CHECK ([criticality] IN (N'Critical', N'Non-Critical')),
CONSTRAINT [CK_ict_system_security_domain]
CHECK ([security_domain] COLLATE Latin1_General_100_BIN2 IN (N'PROTECTED', N'SECRET', N'UNKNOWN'))
```

## tsaat.ict_system_hierarchy

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| parent_system_id | NVARCHAR(255) NOT NULL |
| child_system_id | NVARCHAR(255) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_hierarchy_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_ict_system_hierarchy_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ict_system_hierarchy_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_ict_system_hierarchy_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_ict_system_hierarchy] PRIMARY KEY CLUSTERED ([snapshot_id], [parent_system_id], [child_system_id]),
CONSTRAINT [FK_ict_system_hierarchy_parent]
FOREIGN KEY ([snapshot_id], [parent_system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [FK_ict_system_hierarchy_child]
FOREIGN KEY ([snapshot_id], [child_system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [CK_ict_system_hierarchy_not_self] CHECK ([parent_system_id] <> [child_system_id])
```

## tsaat.network_declared_system

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_network_declared_system] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id], [system_id]),
CONSTRAINT [FK_network_declared_system_network]
FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [FK_network_declared_system_system]
FOREIGN KEY ([snapshot_id], [system_id], [network_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id], [network_id])
```

## tsaat.system_mission_capability

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| mission_capability_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_system_mission_capability] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [mission_capability_id]),
CONSTRAINT [FK_system_mission_capability_system]
FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [CK_system_mission_capability_criticality]
CHECK ([criticality] IN (N'Critical', N'Non-Critical'))
```

## tsaat.system_business_service

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| business_service_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_system_business_service] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [business_service_id]),
CONSTRAINT [FK_system_business_service_system]
FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [CK_system_business_service_criticality]
CHECK ([criticality] IN (N'Critical', N'Non-Critical'))
```

## tsaat.system_environment

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| environment_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| environment_type | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_system_environment] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [environment_id]),
CONSTRAINT [UQ_system_environment_type] UNIQUE ([snapshot_id], [system_id], [environment_type]),
CONSTRAINT [UQ_system_environment_full] UNIQUE ([snapshot_id], [system_id], [environment_id], [environment_type]),
CONSTRAINT [FK_system_environment_system]
FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [CK_system_environment_type]
CHECK ([environment_type] IN (N'Production', N'Development', N'UAT', N'Test'))
```

## tsaat.cmdb_attribute_definition

| Column | Source definition |
| --- | --- |
| attribute_key | NVARCHAR(64) NOT NULL |
| label | NVARCHAR(100) NOT NULL |
| asset_type | NVARCHAR(20) NOT NULL |
| attribute_key | NVARCHAR(64) NOT NULL |
| display_order | INT NOT NULL |
| is_enabled | BIT NOT NULL CONSTRAINT [DF_cmdb_asset_type_attribute_enabled] DEFAULT (1) |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| hostname | NVARCHAR(255) NOT NULL |
| ip_address | NVARCHAR(64) NULL |
| mac_address | NVARCHAR(64) NULL |
| device_model | NVARCHAR(255) NULL |
| last_discovered_date | DATETIME2(3) NULL |
| discovered_by | NVARCHAR(255) NULL |
| discovery_approach | NVARCHAR(20) NULL |
| arp_owner_asset_id | NVARCHAR(255) NULL |
| cmdb_record_url | NVARCHAR(1024) NULL |
| asset_type | NVARCHAR(20) NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| security_domain | NVARCHAR(20) NOT NULL CONSTRAINT [DF_asset_security_domain] DEFAULT (N'UNKNOWN') |
| system_id | NVARCHAR(255) NULL |
| environment_type | NVARCHAR(20) NULL |
| lifecycle_eol_status | NVARCHAR(20) NOT NULL |
| lifecycle_warranty_status | NVARCHAR(20) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_asset_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_asset_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_asset_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_asset_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_cmdb_attribute_definition] PRIMARY KEY ([attribute_key]),
CONSTRAINT [CK_cmdb_attribute_definition_key] CHECK ([attribute_key] IN (
CONSTRAINT [CK_cmdb_attribute_definition_label] CHECK (LEN(LTRIM(RTRIM([label]))) > 0)
CONSTRAINT [PK_cmdb_asset_type_attribute] PRIMARY KEY ([asset_type], [attribute_key]),
CONSTRAINT [FK_cmdb_asset_type_attribute_definition] FOREIGN KEY ([attribute_key])
REFERENCES [tsaat].[cmdb_attribute_definition] ([attribute_key]),
CONSTRAINT [CK_cmdb_asset_type_attribute_type] CHECK ([asset_type] IN (
CONSTRAINT [CK_cmdb_asset_type_attribute_order] CHECK ([display_order] >= 0)
CONSTRAINT [PK_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
CONSTRAINT [UQ_asset_snapshot_network_asset] UNIQUE ([snapshot_id], [network_id], [asset_id]),
CONSTRAINT [UQ_asset_snapshot_system_asset] UNIQUE ([snapshot_id], [system_id], [asset_id]),
CONSTRAINT [UQ_asset_snapshot_system_env_asset] UNIQUE ([snapshot_id], [system_id], [environment_type], [asset_id]),
CONSTRAINT [FK_asset_arp_owner] FOREIGN KEY ([snapshot_id], [network_id], [arp_owner_asset_id])
REFERENCES [tsaat].[asset]([snapshot_id], [network_id], [asset_id]),
CONSTRAINT [CK_asset_ip_node_discovery] CHECK (
CONSTRAINT [FK_asset_snapshot]
FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
CONSTRAINT [FK_asset_network]
FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [FK_asset_system]
FOREIGN KEY ([snapshot_id], [system_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id]),
CONSTRAINT [FK_asset_system_network]
FOREIGN KEY ([snapshot_id], [system_id], [network_id]) REFERENCES [tsaat].[ict_system]([snapshot_id], [system_id], [network_id]),
CONSTRAINT [FK_asset_system_environment]
FOREIGN KEY ([snapshot_id], [system_id], [environment_type]) REFERENCES [tsaat].[system_environment]([snapshot_id], [system_id], [environment_type]),
CONSTRAINT [CK_asset_type]
CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node')),
CONSTRAINT [CK_asset_security_domain]
CHECK ([security_domain] COLLATE Latin1_General_100_BIN2 IN (N'PROTECTED', N'SECRET', N'UNKNOWN')),
CONSTRAINT [CK_asset_environment_type]
CHECK ([environment_type] IS NULL OR [environment_type] IN (N'Production', N'Development', N'UAT', N'Test')),
CONSTRAINT [CK_asset_lifecycle_eol_status]
CHECK ([lifecycle_eol_status] IN (N'Supported', N'EOL', N'Unknown')),
CONSTRAINT [CK_asset_lifecycle_warranty_status]
CHECK ([lifecycle_warranty_status] IN (N'InWarranty', N'OutOfWarranty', N'Unknown')),
CONSTRAINT [CK_asset_system_environment_pair]
CHECK (
```

## tsaat.network_declared_asset

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| network_id | NVARCHAR(255) NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_network_declared_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [network_id], [asset_id]),
CONSTRAINT [FK_network_declared_asset_network]
FOREIGN KEY ([snapshot_id], [network_id]) REFERENCES [tsaat].[managed_network]([snapshot_id], [network_id]),
CONSTRAINT [FK_network_declared_asset_asset]
FOREIGN KEY ([snapshot_id], [network_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [network_id], [asset_id])
```

## tsaat.system_environment_asset

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| system_id | NVARCHAR(255) NOT NULL |
| environment_id | NVARCHAR(255) NOT NULL |
| environment_type | NVARCHAR(20) NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_system_environment_asset] PRIMARY KEY CLUSTERED ([snapshot_id], [system_id], [environment_id], [asset_id]),
CONSTRAINT [FK_system_environment_asset_environment]
FOREIGN KEY ([snapshot_id], [system_id], [environment_id], [environment_type])
REFERENCES [tsaat].[system_environment]([snapshot_id], [system_id], [environment_id], [environment_type]),
CONSTRAINT [FK_system_environment_asset_asset]
FOREIGN KEY ([snapshot_id], [system_id], [environment_type], [asset_id])
REFERENCES [tsaat].[asset]([snapshot_id], [system_id], [environment_type], [asset_id]),
CONSTRAINT [CK_system_environment_asset_environment_type]
CHECK ([environment_type] IN (N'Production', N'Development', N'UAT', N'Test'))
```

## tsaat.ci_dependency

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| dependency_id | NVARCHAR(255) NOT NULL |
| source_asset_id | NVARCHAR(255) NOT NULL |
| target_asset_id | NVARCHAR(255) NOT NULL |
| dependency_type | NVARCHAR(30) NOT NULL |
| flow_protocol | NVARCHAR(20) NULL |
| source_port | INT NULL |
| target_port | INT NULL |
| observation_method | NVARCHAR(255) NULL |
| observed_at | DATETIMEOFFSET(7) NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ci_dependency_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_ci_dependency_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_ci_dependency_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_ci_dependency_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_ci_dependency] PRIMARY KEY CLUSTERED ([snapshot_id], [dependency_id]),
CONSTRAINT [FK_ci_dependency_snapshot]
FOREIGN KEY ([snapshot_id]) REFERENCES [tsaat].[dataset_snapshot]([snapshot_id]),
CONSTRAINT [FK_ci_dependency_source_asset]
FOREIGN KEY ([snapshot_id], [source_asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [FK_ci_dependency_target_asset]
FOREIGN KEY ([snapshot_id], [target_asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [CK_ci_dependency_not_self] CHECK ([source_asset_id] <> [target_asset_id]),
CONSTRAINT [CK_ci_dependency_type]
CHECK ([dependency_type] IN (N'Logical Dependency', N'Flow Dependency')),
CONSTRAINT [CK_ci_dependency_source_port]
CHECK ([source_port] IS NULL OR ([source_port] BETWEEN 1 AND 65535)),
CONSTRAINT [CK_ci_dependency_target_port]
CHECK ([target_port] IS NULL OR ([target_port] BETWEEN 1 AND 65535))
```

## tsaat.asset_operating_system

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| family | NVARCHAR(255) NOT NULL |
| vendor | NVARCHAR(255) NOT NULL |
| version | NVARCHAR(255) NOT NULL |
| patch_level | NVARCHAR(255) NULL |
| support_status | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_operating_system] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
CONSTRAINT [FK_asset_operating_system_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [CK_asset_operating_system_support_status]
CHECK ([support_status] IN (N'Supported', N'OutOfSupport', N'Unknown'))
```

## tsaat.asset_network_os

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| family | NVARCHAR(255) NOT NULL |
| vendor | NVARCHAR(255) NOT NULL |
| version | NVARCHAR(255) NOT NULL |
| patch_level | NVARCHAR(255) NULL |
| support_status | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_network_os] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
CONSTRAINT [FK_asset_network_os_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [CK_asset_network_os_support_status]
CHECK ([support_status] IN (N'Supported', N'OutOfSupport', N'Unknown'))
```

## tsaat.asset_patch_state

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| is_latest | BIT NULL |
| last_patched_date | DATE NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_patch_state] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id]),
CONSTRAINT [FK_asset_patch_state_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id])
```

## tsaat.asset_installed_software

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| software_ordinal | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| version | NVARCHAR(255) NOT NULL |
| file_path | NVARCHAR(2048) NULL |
| last_discovered_date | DATETIME2(3) NULL |
| discovered_by | NVARCHAR(255) NULL |
| support_status | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_installed_software] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id], [software_ordinal]),
CONSTRAINT [FK_asset_installed_software_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [CK_asset_installed_software_ordinal] CHECK ([software_ordinal] > 0),
CONSTRAINT [CK_asset_installed_software_support_status]
CHECK ([support_status] IN (N'Supported', N'OutOfSupport', N'Unknown'))
```

## tsaat.asset_vulnerability

| Column | Source definition |
| --- | --- |
| snapshot_id | BIGINT NOT NULL |
| asset_id | NVARCHAR(255) NOT NULL |
| vulnerability_id | NVARCHAR(255) NOT NULL |
| cve | NVARCHAR(255) NOT NULL |
| cve_name | NVARCHAR(500) NULL |
| cve_created_date | DATE NULL |
| software_name | NVARCHAR(255) NULL |
| software_version | NVARCHAR(100) NULL |
| reference_url | NVARCHAR(2048) NULL |
| description | NVARCHAR(MAX) NOT NULL |
| remediation_guidance | NVARCHAR(MAX) NOT NULL |
| criticality | NVARCHAR(20) NOT NULL |
| severity | NVARCHAR(20) NOT NULL |
| exploitability | NVARCHAR(30) NOT NULL |
| detected_date | DATE NOT NULL |
| captured_at | DATETIMEOFFSET(7) NOT NULL |
| source | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_asset_vulnerability] PRIMARY KEY CLUSTERED ([snapshot_id], [asset_id], [vulnerability_id]),
CONSTRAINT [FK_asset_vulnerability_asset]
FOREIGN KEY ([snapshot_id], [asset_id]) REFERENCES [tsaat].[asset]([snapshot_id], [asset_id]),
CONSTRAINT [CK_asset_vulnerability_criticality]
CHECK ([criticality] IN (N'Low', N'Medium', N'High', N'Critical')),
CONSTRAINT [CK_asset_vulnerability_severity]
CHECK ([severity] IN (N'Low', N'Medium', N'High', N'Critical')),
CONSTRAINT [CK_asset_vulnerability_exploitability]
CHECK ([exploitability] IN (N'No Known Exploit', N'Proof of Concept', N'Exploitable', N'Known Exploited'))
```

## tsaat.discovery_tools_settings_version

| Column | Source definition |
| --- | --- |
| settings_version_id | BIGINT IDENTITY(1,1) NOT NULL |
| updated_at | DATETIMEOFFSET(7) NOT NULL |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_discovery_tools_settings_version_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tools_settings_version] PRIMARY KEY CLUSTERED ([settings_version_id]),
CONSTRAINT [UQ_discovery_tools_settings_version_updated_at] UNIQUE ([updated_at])
```

## tsaat.discovery_tool

| Column | Source definition |
| --- | --- |
| settings_version_id | BIGINT NOT NULL |
| tool_id | NVARCHAR(255) NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL CONSTRAINT [DF_discovery_tool_description] DEFAULT (N'') |
| el2_owner | NVARCHAR(255) NOT NULL CONSTRAINT [DF_discovery_tool_el2_owner] DEFAULT (N'') |
| el2_operations_manager | NVARCHAR(255) NOT NULL CONSTRAINT [DF_discovery_tool_el2_operations_manager] DEFAULT (N'') |
| created_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tool_created_at_utc] DEFAULT (SYSUTCDATETIME()) |
| created_by | SYSNAME NOT NULL CONSTRAINT [DF_discovery_tool_created_by] DEFAULT (SUSER_SNAME()) |
| updated_at_utc | DATETIME2(3) NOT NULL CONSTRAINT [DF_discovery_tool_updated_at_utc] DEFAULT (SYSUTCDATETIME()) |
| updated_by | SYSNAME NOT NULL CONSTRAINT [DF_discovery_tool_updated_by] DEFAULT (SUSER_SNAME()) |
| row_version | ROWVERSION NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool] PRIMARY KEY CLUSTERED ([settings_version_id], [tool_id]),
CONSTRAINT [FK_discovery_tool_version]
FOREIGN KEY ([settings_version_id]) REFERENCES [tsaat].[discovery_tools_settings_version]([settings_version_id])
```

## tsaat.discovery_tool_asset_scope

| Column | Source definition |
| --- | --- |
| settings_version_id | BIGINT NOT NULL |
| tool_id | NVARCHAR(255) NOT NULL |
| asset_type | NVARCHAR(20) NOT NULL |
| scope_setting | NVARCHAR(20) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool_asset_scope] PRIMARY KEY CLUSTERED ([settings_version_id], [tool_id], [asset_type]),
CONSTRAINT [FK_discovery_tool_asset_scope_tool]
FOREIGN KEY ([settings_version_id], [tool_id]) REFERENCES [tsaat].[discovery_tool]([settings_version_id], [tool_id]),
CONSTRAINT [CK_discovery_tool_asset_scope_asset_type]
CHECK ([asset_type] IN (N'server', N'workstation', N'network-device', N'storage-device', N'printer-device', N'other', N'ip-node')),
CONSTRAINT [CK_discovery_tool_asset_scope_setting]
CHECK ([scope_setting] IN (N'required', N'na'))
```

## tsaat.discovery_coverage_source

| Column | Source definition |
| --- | --- |
| source_key | NVARCHAR(100) NOT NULL |
| source_object_name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_discovery_coverage_source_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_coverage_source] PRIMARY KEY CLUSTERED ([source_key]),
CONSTRAINT [CK_discovery_coverage_source_key] CHECK (LEN(LTRIM(RTRIM([source_key]))) > 0)
```

## tsaat.discovery_tool_detection_definition

| Column | Source definition |
| --- | --- |
| tool_id | NVARCHAR(255) NOT NULL |
| display_order | INT NOT NULL |
| name | NVARCHAR(255) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_discovery_tool_detection_definition_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool_detection_definition] PRIMARY KEY CLUSTERED ([tool_id]),
CONSTRAINT [UQ_discovery_tool_detection_definition_display_order] UNIQUE ([display_order]),
CONSTRAINT [CK_discovery_tool_detection_definition_display_order] CHECK ([display_order] > 0)
```

## tsaat.discovery_tool_detection_rule

| Column | Source definition |
| --- | --- |
| detection_rule_id | BIGINT IDENTITY(1,1) NOT NULL |
| tool_id | NVARCHAR(255) NOT NULL |
| display_order | INT NOT NULL |
| condition_key | NVARCHAR(80) NOT NULL |
| description | NVARCHAR(1000) NOT NULL |
| enabled | BIT NOT NULL CONSTRAINT [DF_discovery_tool_detection_rule_enabled] DEFAULT (1) |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool_detection_rule] PRIMARY KEY CLUSTERED ([detection_rule_id]),
CONSTRAINT [FK_discovery_tool_detection_rule_tool]
FOREIGN KEY ([tool_id]) REFERENCES [tsaat].[discovery_tool_detection_definition]([tool_id]),
CONSTRAINT [UQ_discovery_tool_detection_rule_order] UNIQUE ([tool_id], [display_order]),
CONSTRAINT [CK_discovery_tool_detection_rule_display_order] CHECK ([display_order] > 0),
CONSTRAINT [CK_discovery_tool_detection_rule_condition]
CHECK ([condition_key] IN (
```

## tsaat.discovery_tool_detection_rule_value

| Column | Source definition |
| --- | --- |
| detection_rule_id | BIGINT NOT NULL |
| value_order | INT NOT NULL |
| value_text | NVARCHAR(255) NOT NULL |

Declared constraints:

```sql
CONSTRAINT [PK_discovery_tool_detection_rule_value] PRIMARY KEY CLUSTERED ([detection_rule_id], [value_order]),
CONSTRAINT [FK_discovery_tool_detection_rule_value_rule]
FOREIGN KEY ([detection_rule_id]) REFERENCES [tsaat].[discovery_tool_detection_rule]([detection_rule_id]),
CONSTRAINT [CK_discovery_tool_detection_rule_value_order] CHECK ([value_order] > 0)
```

## tsaat.storage_schema_version

| Column | Source definition |
| --- | --- |
| version | INT NOT NULL CONSTRAINT [PK_storage_schema_version] PRIMARY KEY |
| applied_at_utc | DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME() |

Declared constraints:

```sql
CONSTRAINT [CK_storage_schema_version] CHECK ([version] = 2)
```

## Routines

- PROCEDURE tsaat.usp_evaluate_discovery_coverage_snapshot

## Ordered migrations

Apply approved missing upgrades only; 026 contains demonstration metadata.

| Migration | SHA-256 |
| --- | --- |
| [001_add_ci_dependency.sql](../../Database%20Schema/migrations/001_add_ci_dependency.sql) | a9213c08f10013408e778365f889a67e8d18d003c38abc4e10a79976b33ea3aa |
| [002_ensure_shuffydog_full_access.sql](../../Database%20Schema/migrations/002_ensure_shuffydog_full_access.sql) | 7b1417fb48588180723d2f32b712c2aecfe5509a972bb3871cc38fb26e0f4516 |
| [003_add_platform_flags.sql](../../Database%20Schema/migrations/003_add_platform_flags.sql) | c6678de304cd1a9eaa0094ba46b69217bd2bebd43e9c3d82f64a878c7bfd26ac |
| [004_expand_asset_type_taxonomy.sql](../../Database%20Schema/migrations/004_expand_asset_type_taxonomy.sql) | ac058efeeeff348e7882fbee6d2def97c27571cfb92ed8c4eeefc813bd795f69 |
| [005_add_network_target_state_asset.sql](../../Database%20Schema/migrations/005_add_network_target_state_asset.sql) | 113b4957ceb583cac61784371635cabe9206e5778358166c0153f3972898bfcb |
| [006_add_app_auth.sql](../../Database%20Schema/migrations/006_add_app_auth.sql) | 6625d57fce5f0e6fac861c447d4b141aa6dc739e26b29d9ddb948b4ac446a75d |
| [007_drop_app_auth.sql](../../Database%20Schema/migrations/007_drop_app_auth.sql) | 5e581f850a4cce458e95a6458206f38d7618774c45d5810482926c6f7750be8a |
| [008_add_network_modelling_status.sql](../../Database%20Schema/migrations/008_add_network_modelling_status.sql) | 661f275d8e593b047ca814f44d1599bba514febcbcf5e2fb6b16d9dd2ecec72a |
| [009_add_network_diis_id_and_ato_backfill.sql](../../Database%20Schema/migrations/009_add_network_diis_id_and_ato_backfill.sql) | 473a62cf197f7a0a767a032a68e880a1d4315260092577147d728e463460f2f0 |
| [010_add_apm_numbers_and_reference_backfill.sql](../../Database%20Schema/migrations/010_add_apm_numbers_and_reference_backfill.sql) | d987cc1bd097f702848311c67399de623ebc5b9143d90ed5796f62634b43a787 |
| [011_add_measures_priority_matrix.sql](../../Database%20Schema/migrations/011_add_measures_priority_matrix.sql) | 90e604e6c1e7460f9ec4acf2462545ce46f85054ae7e1ae294652d832fa58336 |
| [012_add_kpi_definition.sql](../../Database%20Schema/migrations/012_add_kpi_definition.sql) | e744dad6f623070a7cc22a26020db0251cb398b87aacd0b24b323d55ce0dafef |
| [013_database_driven_spi_measures.sql](../../Database%20Schema/migrations/013_database_driven_spi_measures.sql) | f6958d27bd6b401db8065f4ef92520a1614ed6d4f056bec25fd69630f322109f |
| [014_spi_rule_catalogues_and_classification.sql](../../Database%20Schema/migrations/014_spi_rule_catalogues_and_classification.sql) | 47eac0f6ae864ee5837c342a110257b9fc5061ca07c0d46b26166cf284ae6e79 |
| [015_sql_driven_spi_measure_engine.sql](../../Database%20Schema/migrations/015_sql_driven_spi_measure_engine.sql) | c8d28b73aae555fc69d13bb5c013ac77d763d17f578f66b2144ad886928e4d16 |
| [016_database_driven_findings_features.sql](../../Database%20Schema/migrations/016_database_driven_findings_features.sql) | 237a6855f649c8fb55285a9d3415d47e544f66f7eb6178f3648d318278213c76 |
| [017_sql_driven_kpi_and_discovery_measure_engine.sql](../../Database%20Schema/migrations/017_sql_driven_kpi_and_discovery_measure_engine.sql) | 03864001a4291f4420607f5cb863af1f84ab970e3ac9db1003e53a39c3647b1c |
| [018_performance_optimized_sql_runtime.sql](../../Database%20Schema/migrations/018_performance_optimized_sql_runtime.sql) | 14af9427bb8d02e88a4bc211484dc6e0f13b6e390209779d060e6466d2e82b9a |
| [019_add_asset_cmdb_record_url.sql](../../Database%20Schema/migrations/019_add_asset_cmdb_record_url.sql) | c9859303e41fa008dabaf231c5ec7a56ea55c45fb4d9e88a3b39d6d6ae449b36 |
| [020_add_endpoint_discovery_fields.sql](../../Database%20Schema/migrations/020_add_endpoint_discovery_fields.sql) | 6a3cdd5cd05ac45ee0956330b23dd3ac3a1e7b303d9e5c08bb2faee3e1d6d96b |
| [021_add_software_inventory_fields.sql](../../Database%20Schema/migrations/021_add_software_inventory_fields.sql) | e78d247e682c4512c991f07aa6fb170dd442175cd31d2aa1975ba830a9b36eba |
| [022_add_ip_node_discovery.sql](../../Database%20Schema/migrations/022_add_ip_node_discovery.sql) | 9831f08e07d26168ea8c673531edbeb6309abb4cf7439c64db0afa75d6b79c16 |
| [023_system_ato_diis_kpis.sql](../../Database%20Schema/migrations/023_system_ato_diis_kpis.sql) | ac37e2679a9e33398f6d09048bd2b43a074de64f527852d7b9199b29f3e3f6b0 |
| [024_remove_ci_assignment_and_owner_fields.sql](../../Database%20Schema/migrations/024_remove_ci_assignment_and_owner_fields.sql) | aaf74a392898466306defbac5b5addb927b1ed276fd43eef225bb36ab60f8f1a |
| [025_cmdb_asset_type_attributes.sql](../../Database%20Schema/migrations/025_cmdb_asset_type_attributes.sql) | 341d5881bd67ff101089f056377b8fefa1e0ebce1792f3349a923f6f0c8d1551 |
| [026_populate_demo_entity_panel_details.sql](../../Database%20Schema/migrations/026_populate_demo_entity_panel_details.sql) | a8335a7fcb19b1a21c3764690637ee2f313dd7051ae606fcdc13f39fada66dcf |
| [027_remove_retired_runtime_structures.sql](../../Database%20Schema/migrations/027_remove_retired_runtime_structures.sql) | c6db131b85b452ff7b95b140dcf41fff46b38079f8017e2ea91384a85ffa334e |
| [028_security_vulnerability_explorer.sql](../../Database%20Schema/migrations/028_security_vulnerability_explorer.sql) | ed0b97849ea1239d01f4f07e0cfeb23e53ab2db97239cdb8c1edbba59b2842da |
| [029_patch_management_explorer.sql](../../Database%20Schema/migrations/029_patch_management_explorer.sql) | 2be23efa47df491ead314674ed95d7abfe784245942c355ad525c0e438bb466c |
| [030_security_domains.sql](../../Database%20Schema/migrations/030_security_domains.sql) | e408cbb2f53a8ccf75a2c2e68215be71916e432f253ee819a527fa2db2ac1a60 |
| [031_persona_navigation_settings.sql](../../Database%20Schema/migrations/031_persona_navigation_settings.sql) | 0c5dabbd96dc120e4238533777c8bac3c19a742c6b9de0b6e8950a0f55be7436 |
| [032_model_ci_cmdb_attributes.sql](../../Database%20Schema/migrations/032_model_ci_cmdb_attributes.sql) | ea8b0ec1e93febdfe99b525c564d5e22dd0d7ffc1c74d61d85292ef27598f2f8 |
| [033_retire_analytics_features.sql](../../Database%20Schema/migrations/033_retire_analytics_features.sql) | 5dbb457c78f2981e5ccd54a90ba10d8b22141fe962e39b9b9c5654e7fe5154d1 |
