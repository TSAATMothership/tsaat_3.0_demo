SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'tsaat.kpi_definition', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[kpi_definition] (
    [kpi_id] NVARCHAR(40) NOT NULL,
    [display_order] INT NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [success_measure] NVARCHAR(1000) NOT NULL,
    [calculation_key] NVARCHAR(100) NOT NULL,
    [report_available] BIT NOT NULL CONSTRAINT [DF_kpi_definition_report_available] DEFAULT (0),
    CONSTRAINT [PK_kpi_definition] PRIMARY KEY CLUSTERED ([kpi_id]),
    CONSTRAINT [UQ_kpi_definition_display_order] UNIQUE ([display_order]),
    CONSTRAINT [CK_kpi_definition_kpi_id] CHECK (LEN(LTRIM(RTRIM([kpi_id]))) > 0),
    CONSTRAINT [CK_kpi_definition_display_order] CHECK ([display_order] > 0),
    CONSTRAINT [CK_kpi_definition_calculation_key] CHECK ([calculation_key] IN (
      N'overall-spi-compliance',
      N'protected-domain-compliance',
      N'secret-domain-compliance',
      N'critical-ict-system-compliance',
      N'critical-exposure-in-production',
      N'discovery-coverage-compliance',
      N'active-ato-coverage',
      N'diis-registration-coverage',
      N'diis-modelled-coverage',
      N'network-discovery-enablement'
    ))
  );
END;
GO

MERGE [tsaat].[kpi_definition] AS target
USING (VALUES
  (N'KPI-1', 1, N'Overall SPI Compliance', N'Share of compliant checks across all applicable SPI evaluations in current filter scope.', N'Target >= 95% compliant checks.', N'overall-spi-compliance', CAST(0 AS BIT)),
  (N'KPI-2', 2, N'Overall DPE Compliance', N'Share of compliant SPI checks for Defence Protected Environment (Protected security domain) assets in scope.', N'Target >= 95% compliant checks for DPE assets.', N'protected-domain-compliance', CAST(0 AS BIT)),
  (N'KPI-3', 3, N'Overall DSE Compliance', N'Share of compliant SPI checks for Defence Secret Environment (Secret security domain) assets in scope.', N'Target >= 95% compliant checks for DSE assets.', N'secret-domain-compliance', CAST(0 AS BIT)),
  (N'KPI-4', 4, N'Critical ICT System Compliance', N'Share of compliant SPI checks for assets assigned to ICT systems marked as Critical.', N'Target >= 95% compliant checks on Critical ICT Systems.', N'critical-ict-system-compliance', CAST(0 AS BIT)),
  (N'KPI-5', 5, N'Critical Exposure in Production', N'Production assets with critical-vulnerability exposure requiring urgent treatment.', N'Target = 0 critical exposure findings.', N'critical-exposure-in-production', CAST(1 AS BIT)),
  (N'KPI-6', 6, N'Discovery Coverage Compliance', N'Share of in-scope assets meeting discovery coverage across required tooling checkpoints.', N'Target = 100% discovery coverage compliance.', N'discovery-coverage-compliance', CAST(1 AS BIT)),
  (N'KPI-7', 7, N'ICT Systems have an active ATO', N'Share of in-scope ICT systems with an active Authority to Operate (ATO) record.', N'Target = 100% of ICT systems with active ATO.', N'active-ato-coverage', CAST(1 AS BIT)),
  (N'KPI-8', 8, N'ICT Systems are registered within DIIS', N'Share of in-scope ICT systems registered in the DIIS register.', N'Target = 100% of ICT systems registered within DIIS.', N'diis-registration-coverage', CAST(1 AS BIT)),
  (N'KPI-9', 9, N'DIIS Systems Modelled Coverage', N'Share of ICT systems defined in DIIS that have been modelled in TSAAT.', N'Target = 100% of DIIS-defined ICT systems are modelled.', N'diis-modelled-coverage', CAST(1 AS BIT)),
  (N'KPI-10', 10, N'Networks Discovery Enablement', N'Share of defined managed networks with discovery status set to Discovery Enabled.', N'Target = 100% of defined networks are Discovery Enabled.', N'network-discovery-enablement', CAST(1 AS BIT))
) AS source (
  [kpi_id],
  [display_order],
  [name],
  [description],
  [success_measure],
  [calculation_key],
  [report_available]
)
ON target.[kpi_id] = source.[kpi_id]
WHEN MATCHED THEN
  UPDATE SET
    [display_order] = source.[display_order],
    [name] = source.[name],
    [description] = source.[description],
    [success_measure] = source.[success_measure],
    [calculation_key] = source.[calculation_key],
    [report_available] = source.[report_available]
WHEN NOT MATCHED BY TARGET THEN
  INSERT (
    [kpi_id],
    [display_order],
    [name],
    [description],
    [success_measure],
    [calculation_key],
    [report_available]
  )
  VALUES (
    source.[kpi_id],
    source.[display_order],
    source.[name],
    source.[description],
    source.[success_measure],
    source.[calculation_key],
    source.[report_available]
  );
GO
