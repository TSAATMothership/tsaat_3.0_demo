PRINT 'Applying migration: 019_add_asset_cmdb_record_url.sql';
GO

IF COL_LENGTH(N'tsaat.asset', N'cmdb_record_url') IS NULL
BEGIN
  ALTER TABLE [tsaat].[asset]
    ADD [cmdb_record_url] NVARCHAR(1024) NULL;
END;
GO
