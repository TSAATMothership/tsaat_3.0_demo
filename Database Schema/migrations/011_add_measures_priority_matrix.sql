SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'tsaat.measures_priority_matrix', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[measures_priority_matrix] (
    [settings_version_id] BIGINT NOT NULL,
    [spi_id] SMALLINT NOT NULL,
    [priority_rank] INT NOT NULL,
    CONSTRAINT [PK_measures_priority_matrix] PRIMARY KEY CLUSTERED ([settings_version_id], [spi_id]),
    CONSTRAINT [FK_measures_priority_matrix_version]
      FOREIGN KEY ([settings_version_id]) REFERENCES [tsaat].[measures_settings_version]([settings_version_id]),
    CONSTRAINT [FK_measures_priority_matrix_spi]
      FOREIGN KEY ([spi_id]) REFERENCES [tsaat].[spi_definition]([spi_id]),
    CONSTRAINT [CK_measures_priority_matrix_priority_rank]
      CHECK ([priority_rank] BETWEEN 1 AND 7)
  );
END;
GO

INSERT INTO [tsaat].[measures_priority_matrix] (
  [settings_version_id],
  [spi_id],
  [priority_rank]
)
SELECT
  msv.[settings_version_id],
  sd.[spi_id],
  sd.[priority_order]
FROM [tsaat].[measures_settings_version] AS msv
CROSS JOIN [tsaat].[spi_definition] AS sd
WHERE sd.[priority_order] BETWEEN 1 AND 7
  AND NOT EXISTS (
    SELECT 1
    FROM [tsaat].[measures_priority_matrix] AS existing
    WHERE existing.[settings_version_id] = msv.[settings_version_id]
      AND existing.[spi_id] = sd.[spi_id]
  );
GO
