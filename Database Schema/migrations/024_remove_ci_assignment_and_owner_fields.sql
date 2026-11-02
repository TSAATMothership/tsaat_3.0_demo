-- Remove obsolete CI display definitions. CI records and finding evidence are unchanged.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DELETE FROM [tsaat].[finding_evidence_field_definition]
WHERE [purpose_key] IN (N'change_assignment_group', N'incident_assignment_group', N'owner');

COMMIT TRANSACTION;
GO
