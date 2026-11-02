SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH(N'tsaat.managed_network', N'apm_number') IS NULL
BEGIN
  ALTER TABLE [tsaat].[managed_network]
  ADD [apm_number] NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH(N'tsaat.ict_system', N'apm_number') IS NULL
BEGIN
  ALTER TABLE [tsaat].[ict_system]
  ADD [apm_number] NVARCHAR(100) NULL;
END;
GO

;WITH ordered_networks AS (
  SELECT
    [snapshot_id],
    [network_id],
    ROW_NUMBER() OVER (
      PARTITION BY [snapshot_id]
      ORDER BY
        CASE
          WHEN [network_id] LIKE N'net-[0-9]%' AND [network_id] NOT LIKE N'net-new-%' THEN 1
          WHEN [network_id] LIKE N'net-new-[0-9]%' THEN 2
          ELSE 3
        END,
        CASE
          WHEN [network_id] LIKE N'net-[0-9]%' AND [network_id] NOT LIKE N'net-new-%'
            THEN TRY_CONVERT(INT, SUBSTRING([network_id], 5, 32))
          WHEN [network_id] LIKE N'net-new-[0-9]%'
            THEN TRY_CONVERT(INT, SUBSTRING([network_id], 9, 32))
          ELSE NULL
        END,
        [network_id]
    ) AS [network_ordinal]
  FROM [tsaat].[managed_network]
  WHERE [network_id] <> N'net-unassigned'
),
network_backfill AS (
  SELECT
    mn.[snapshot_id],
    mn.[network_id],
    CASE
      WHEN mn.[network_id] = N'net-unassigned' THEN N'DIIS-NET-000'
      ELSE CONCAT(N'DIIS-NET-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), onw.[network_ordinal])), 3))
    END AS [generated_diis_id],
    CASE
      WHEN mn.[network_id] = N'net-unassigned' THEN N'ATO-NET-000'
      ELSE CONCAT(N'ATO-NET-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), onw.[network_ordinal])), 3))
    END AS [generated_ato_number],
    CASE
      WHEN mn.[network_id] = N'net-unassigned' THEN N'APM-NET-000'
      ELSE CONCAT(N'APM-NET-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), onw.[network_ordinal])), 3))
    END AS [generated_apm_number]
  FROM [tsaat].[managed_network] mn
  LEFT JOIN ordered_networks onw
    ON onw.[snapshot_id] = mn.[snapshot_id]
   AND onw.[network_id] = mn.[network_id]
)
UPDATE mn
SET
  [diis_id] =
    CASE
      WHEN NULLIF(LTRIM(RTRIM(mn.[diis_id])), N'') IS NULL THEN b.[generated_diis_id]
      ELSE mn.[diis_id]
    END,
  [ato_number] =
    CASE
      WHEN NULLIF(LTRIM(RTRIM(mn.[ato_number])), N'') IS NULL THEN b.[generated_ato_number]
      ELSE mn.[ato_number]
    END,
  [apm_number] =
    CASE
      WHEN NULLIF(LTRIM(RTRIM(mn.[apm_number])), N'') IS NULL THEN b.[generated_apm_number]
      ELSE mn.[apm_number]
    END
FROM [tsaat].[managed_network] mn
JOIN network_backfill b
  ON b.[snapshot_id] = mn.[snapshot_id]
 AND b.[network_id] = mn.[network_id]
WHERE NULLIF(LTRIM(RTRIM(mn.[diis_id])), N'') IS NULL
   OR NULLIF(LTRIM(RTRIM(mn.[ato_number])), N'') IS NULL
   OR NULLIF(LTRIM(RTRIM(mn.[apm_number])), N'') IS NULL;
GO

;WITH ordered_systems AS (
  SELECT
    [snapshot_id],
    [system_id],
    ROW_NUMBER() OVER (
      PARTITION BY [snapshot_id]
      ORDER BY
        CASE
          WHEN [system_id] LIKE N'sys-[0-9]%' THEN 1
          ELSE 2
        END,
        CASE
          WHEN [system_id] LIKE N'sys-[0-9]%' THEN TRY_CONVERT(INT, SUBSTRING([system_id], 5, 32))
          ELSE NULL
        END,
        [system_id]
    ) AS [system_ordinal]
  FROM [tsaat].[ict_system]
),
system_backfill AS (
  SELECT
    s.[snapshot_id],
    s.[system_id],
    CONCAT(N'DIIS-SYS-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), os.[system_ordinal])), 3)) AS [generated_diis_id],
    CONCAT(N'ATO-SYS-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), os.[system_ordinal])), 3)) AS [generated_ato_number],
    CONCAT(N'APM-SYS-', RIGHT(CONCAT(N'000', CONVERT(NVARCHAR(10), os.[system_ordinal])), 3)) AS [generated_apm_number]
  FROM [tsaat].[ict_system] s
  JOIN ordered_systems os
    ON os.[snapshot_id] = s.[snapshot_id]
   AND os.[system_id] = s.[system_id]
)
UPDATE s
SET
  [diis_id] =
    CASE
      WHEN NULLIF(LTRIM(RTRIM(s.[diis_id])), N'') IS NULL THEN b.[generated_diis_id]
      ELSE s.[diis_id]
    END,
  [ato_number] =
    CASE
      WHEN NULLIF(LTRIM(RTRIM(s.[ato_number])), N'') IS NULL THEN b.[generated_ato_number]
      ELSE s.[ato_number]
    END,
  [apm_number] =
    CASE
      WHEN NULLIF(LTRIM(RTRIM(s.[apm_number])), N'') IS NULL THEN b.[generated_apm_number]
      ELSE s.[apm_number]
    END
FROM [tsaat].[ict_system] s
JOIN system_backfill b
  ON b.[snapshot_id] = s.[snapshot_id]
 AND b.[system_id] = s.[system_id]
WHERE NULLIF(LTRIM(RTRIM(s.[diis_id])), N'') IS NULL
   OR NULLIF(LTRIM(RTRIM(s.[ato_number])), N'') IS NULL
   OR NULLIF(LTRIM(RTRIM(s.[apm_number])), N'') IS NULL;
GO
