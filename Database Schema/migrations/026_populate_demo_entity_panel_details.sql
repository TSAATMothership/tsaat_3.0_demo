-- Populate missing descriptive/contact details in the TSAAT demonstration dataset.
-- Example addresses and URLs are sample data, not real operational contacts.
-- Existing values, accreditation identifiers, compliance flags and relationships
-- are preserved. Apply after loading data when rebuilding demonstration data.
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  UPDATE n
  SET [description] = CASE WHEN NULLIF(LTRIM(RTRIM(n.[description])), N'') IS NULL
        THEN CONCAT(N'Sample network profile for ', n.[name], N'. Recorded criticality: ', n.[criticality],
          CASE WHEN NULLIF(LTRIM(RTRIM(n.[classification])), N'') IS NULL THEN N''
            ELSE CONCAT(N'. Classification: ', n.[classification]) END, N'.')
        ELSE n.[description] END,
      [owner] = CASE WHEN NULLIF(LTRIM(RTRIM(n.[owner])), N'') IS NULL
        THEN CONCAT(LEFT(n.[name], 215), N' Network Operations (Sample)') ELSE n.[owner] END,
      [support_email] = CASE WHEN NULLIF(LTRIM(RTRIM(n.[support_email])), N'') IS NULL
        THEN CONCAT(N'demo-', reference.[key], N'@support.example.test') ELSE n.[support_email] END,
      [service_catalogue_url] = CASE WHEN NULLIF(LTRIM(RTRIM(n.[service_catalogue_url])), N'') IS NULL
        THEN CONCAT(N'https://service-catalogue.example.test/networks/', reference.[key]) ELSE n.[service_catalogue_url] END,
      [updated_at_utc] = SYSUTCDATETIME(),
      [updated_by] = SUSER_SNAME()
  FROM [tsaat].[managed_network] n
  CROSS APPLY (SELECT CASE WHEN LEN(n.[network_id]) BETWEEN 1 AND 50
      AND n.[network_id] COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Za-z0-9-]%'
      THEN LOWER(n.[network_id])
      ELSE LOWER(LEFT(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', n.[network_id]), 2), 40)) END AS [key]) reference
  WHERE NULLIF(LTRIM(RTRIM(n.[description])), N'') IS NULL
     OR NULLIF(LTRIM(RTRIM(n.[owner])), N'') IS NULL
     OR NULLIF(LTRIM(RTRIM(n.[support_email])), N'') IS NULL
     OR NULLIF(LTRIM(RTRIM(n.[service_catalogue_url])), N'') IS NULL;

  UPDATE s
  SET [description] = CASE WHEN NULLIF(LTRIM(RTRIM(s.[description])), N'') IS NULL
        THEN CONCAT(N'Sample ICT system profile for ', s.[name], N'. Recorded criticality: ', s.[criticality],
          N'. Security domain: ', s.[security_domain], N'.',
          CASE WHEN s.[network_id] = N'net-unassigned' THEN N' No managed network is assigned.'
            ELSE CONCAT(N' Assigned network: ', n.[name], N'.') END)
        ELSE s.[description] END,
      [owner] = CASE WHEN NULLIF(LTRIM(RTRIM(s.[owner])), N'') IS NULL
        THEN CONCAT(LEFT(s.[name], 215), N' Service Operations (Sample)') ELSE s.[owner] END,
      [support_email] = CASE WHEN NULLIF(LTRIM(RTRIM(s.[support_email])), N'') IS NULL
        THEN CONCAT(N'demo-', reference.[key], N'@support.example.test') ELSE s.[support_email] END,
      [service_catalogue_url] = CASE WHEN NULLIF(LTRIM(RTRIM(s.[service_catalogue_url])), N'') IS NULL
        THEN CONCAT(N'https://service-catalogue.example.test/ict-systems/', reference.[key]) ELSE s.[service_catalogue_url] END,
      [updated_at_utc] = SYSUTCDATETIME(),
      [updated_by] = SUSER_SNAME()
  FROM [tsaat].[ict_system] s
  JOIN [tsaat].[managed_network] n ON n.[snapshot_id] = s.[snapshot_id] AND n.[network_id] = s.[network_id]
  CROSS APPLY (SELECT CASE WHEN LEN(s.[system_id]) BETWEEN 1 AND 50
      AND s.[system_id] COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Za-z0-9-]%'
      THEN LOWER(s.[system_id])
      ELSE LOWER(LEFT(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', s.[system_id]), 2), 40)) END AS [key]) reference
  WHERE NULLIF(LTRIM(RTRIM(s.[description])), N'') IS NULL
     OR NULLIF(LTRIM(RTRIM(s.[owner])), N'') IS NULL
     OR NULLIF(LTRIM(RTRIM(s.[support_email])), N'') IS NULL
     OR NULLIF(LTRIM(RTRIM(s.[service_catalogue_url])), N'') IS NULL;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
