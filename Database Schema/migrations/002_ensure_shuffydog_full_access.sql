SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF SUSER_ID(N'shuffydog') IS NOT NULL
BEGIN
  IF DATABASE_PRINCIPAL_ID(N'shuffydog') IS NULL
  BEGIN
    CREATE USER [shuffydog] FOR LOGIN [shuffydog];
  END;

  IF IS_ROLEMEMBER(N'db_owner', N'shuffydog') <> 1
  BEGIN
    ALTER ROLE [db_owner] ADD MEMBER [shuffydog];
  END;
END
ELSE
BEGIN
  PRINT 'Login [shuffydog] not found at server scope. Skipping [shuffydog] database user mapping.';
END;
GO
