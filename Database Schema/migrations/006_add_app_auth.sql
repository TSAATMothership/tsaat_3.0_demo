SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'tsaat.app_user', N'U') IS NULL
BEGIN
  CREATE TABLE [tsaat].[app_user] (
    [app_user_id] BIGINT IDENTITY(1,1) NOT NULL,
    [username] NVARCHAR(120) NOT NULL,
    [password_hash] VARBINARY(64) NOT NULL,
    [password_salt] VARBINARY(64) NOT NULL,
    [hash_algorithm] NVARCHAR(50) NOT NULL,
    [iteration_count] INT NOT NULL,
    [password_changed_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_app_user_password_changed_at_utc] DEFAULT (SYSUTCDATETIME()),
    [is_active] BIT NOT NULL CONSTRAINT [DF_app_user_is_active] DEFAULT (1),
    [session_version] INT NOT NULL CONSTRAINT [DF_app_user_session_version] DEFAULT (1),
    [created_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_app_user_created_at_utc] DEFAULT (SYSUTCDATETIME()),
    [created_by] SYSNAME NOT NULL CONSTRAINT [DF_app_user_created_by] DEFAULT (SUSER_SNAME()),
    [updated_at_utc] DATETIME2(3) NOT NULL CONSTRAINT [DF_app_user_updated_at_utc] DEFAULT (SYSUTCDATETIME()),
    [updated_by] SYSNAME NOT NULL CONSTRAINT [DF_app_user_updated_by] DEFAULT (SUSER_SNAME()),
    [row_version] ROWVERSION NOT NULL,
    CONSTRAINT [PK_app_user] PRIMARY KEY CLUSTERED ([app_user_id]),
    CONSTRAINT [UQ_app_user_username] UNIQUE ([username]),
    CONSTRAINT [CK_app_user_algorithm] CHECK ([hash_algorithm] = N'PBKDF2-HMAC-SHA256'),
    CONSTRAINT [CK_app_user_iteration_count] CHECK ([iteration_count] >= 100000),
    CONSTRAINT [CK_app_user_session_version] CHECK ([session_version] >= 1)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM [tsaat].[app_user] WHERE [username] = N'tsaatuser')
BEGIN
  INSERT INTO [tsaat].[app_user] (
    [username],
    [password_hash],
    [password_salt],
    [hash_algorithm],
    [iteration_count],
    [password_changed_at_utc],
    [is_active],
    [session_version]
  )
  VALUES (
    N'tsaatuser',
    0x714F0B781D700E44354CC1BA47A1A9C760A369F5C158C6F3016B7F215D4F7E1A,
    0x9242E317B55876763971A96DD74B4ABA,
    N'PBKDF2-HMAC-SHA256',
    210000,
    SYSUTCDATETIME(),
    1,
    1
  );
END;
GO
