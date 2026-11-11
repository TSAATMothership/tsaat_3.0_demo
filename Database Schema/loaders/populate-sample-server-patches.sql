-- Explicit SAMPLE-only population. Never execute this loader on an operational database.
-- Migration 029 is required. Existing observations (including partial records) are authoritative.
SET XACT_ABORT ON;
IF COALESCE(TRY_CONVERT(INT, SESSION_CONTEXT(N'TSAAT_SAMPLE_PATCH_MANAGEMENT')), 0) <> 1
  THROW 51031, 'Set TSAAT_SAMPLE_PATCH_MANAGEMENT=1 in this session on an explicitly selected sample database.', 1;
BEGIN TRANSACTION;
DECLARE @profiles NVARCHAR(MAX) = N'[{"bucket":0,"patchDays":-6,"restartDays":-5,"verifiedDays":-4,"assessmentDays":-1,"validDays":6,"missing":0,"critical":0,"restart":false,"status":"Succeeded","dueDays":null,"plannedDays":null,"exceptionDays":null},{"bucket":1,"patchDays":-45,"restartDays":-40,"verifiedDays":-39,"assessmentDays":-1,"validDays":6,"missing":5,"critical":1,"restart":false,"status":"Scheduled","dueDays":-7,"plannedDays":1,"exceptionDays":null},{"bucket":2,"patchDays":-2,"restartDays":-40,"verifiedDays":null,"assessmentDays":-1,"validDays":6,"missing":0,"critical":0,"restart":true,"status":"Succeeded","dueDays":-1,"plannedDays":0,"exceptionDays":null},{"bucket":3,"patchDays":-50,"restartDays":-48,"verifiedDays":null,"assessmentDays":-1,"validDays":6,"missing":7,"critical":2,"restart":false,"status":"Failed","dueDays":-3,"plannedDays":1,"exceptionDays":null},{"bucket":4,"patchDays":-90,"restartDays":-80,"verifiedDays":-79,"assessmentDays":-20,"validDays":-13,"missing":0,"critical":0,"restart":false,"status":"Succeeded","dueDays":null,"plannedDays":null,"exceptionDays":null},{"bucket":5,"patchDays":-1,"restartDays":-30,"verifiedDays":null,"assessmentDays":0,"validDays":7,"missing":2,"critical":0,"restart":false,"status":"In progress","dueDays":1,"plannedDays":0,"exceptionDays":null},{"bucket":6,"patchDays":-60,"restartDays":-59,"verifiedDays":null,"assessmentDays":-1,"validDays":6,"missing":3,"critical":0,"restart":false,"status":"Scheduled","dueDays":-5,"plannedDays":5,"exceptionDays":7},{"bucket":7,"patchDays":null,"restartDays":null,"verifiedDays":null,"assessmentDays":null,"validDays":null,"missing":null,"critical":null,"restart":null,"status":"Unknown","dueDays":null,"plannedDays":null,"exceptionDays":null}]';
INSERT INTO [tsaat].[server_patch_observation] ([snapshot_id], [asset_id],
  [assessment_date], [assessment_valid_until], [last_patched_date], [last_restarted_date], [verified_date], [installed_patch_level], [target_patch_level], [missing_updates], [missing_critical_updates], [restart_required], [deployment_status], [due_date], [planned_date], [owner], [maintenance_window], [change_reference], [exception_reason], [exception_expires_date], [source])
SELECT a.snapshot_id, a.asset_id,
  CAST(DATEADD(DAY, p.assessmentDays, s.snapshot_date) AS DATETIME2(3)),
  DATEADD(DAY, p.validDays, s.snapshot_date),
  CAST(DATEADD(DAY, p.patchDays, s.snapshot_date) AS DATETIME2(3)),
  CAST(DATEADD(DAY, p.restartDays, s.snapshot_date) AS DATETIME2(3)),
  CAST(DATEADD(DAY, p.verifiedDays, s.snapshot_date) AS DATETIME2(3)),
  COALESCE(NULLIF(LTRIM(RTRIM(os.patch_level)), N''), N'Sample installed baseline'),
  CASE WHEN p.bucket IN (0,4) THEN COALESCE(NULLIF(LTRIM(RTRIM(os.patch_level)), N''), N'Sample installed baseline') ELSE N'Sample baseline ' + CONVERT(NVARCHAR(7), s.snapshot_date, 126) END,
  p.missing,
  p.critical,
  p.restart,
  p.status,
  DATEADD(DAY, p.dueDays, s.snapshot_date),
  DATEADD(DAY, p.plannedDays, s.snapshot_date),
  N'Sample Server Operations',
  N'Sample window: Sunday 02:00-04:00 UTC',
  N'SAMPLE-PATCH-' + a.asset_id,
  CASE WHEN p.exceptionDays IS NOT NULL THEN N'Sample exception: business owner accepted a short maintenance deferral; review before expiry.' END,
  DATEADD(DAY, p.exceptionDays, s.snapshot_date),
  N'Sample patch-management observation'
FROM tsaat.asset a
INNER JOIN tsaat.dataset_snapshot s ON s.snapshot_id = a.snapshot_id
LEFT JOIN tsaat.asset_operating_system os ON os.snapshot_id = a.snapshot_id AND os.asset_id = a.asset_id
CROSS APPLY OPENJSON(@profiles) WITH (
  [bucket] INT '$.bucket',
  [patchDays] INT '$.patchDays',
  [restartDays] INT '$.restartDays',
  [verifiedDays] INT '$.verifiedDays',
  [assessmentDays] INT '$.assessmentDays',
  [validDays] INT '$.validDays',
  [missing] INT '$.missing',
  [critical] INT '$.critical',
  [restart] BIT '$.restart',
  [status] NVARCHAR(20) '$.status',
  [dueDays] INT '$.dueDays',
  [plannedDays] INT '$.plannedDays',
  [exceptionDays] INT '$.exceptionDays'
) p
WHERE a.asset_type = N'server'
  AND p.bucket = UNICODE(RIGHT(a.asset_id COLLATE Latin1_General_100_BIN2, 1)) % 8
  AND NOT EXISTS (SELECT 1 FROM tsaat.server_patch_observation existing WITH (UPDLOCK, HOLDLOCK)
    WHERE existing.snapshot_id = a.snapshot_id AND existing.asset_id = a.asset_id);
COMMIT TRANSACTION;
GO

