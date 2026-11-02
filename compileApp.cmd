@echo off
setlocal
cd /d "%~dp0"
set "TSAAT_BUILD_PATH=%~1"
if "%TSAAT_BUILD_PATH%"=="" set "TSAAT_BUILD_PATH=sql"
if /i "%TSAAT_BUILD_PATH%"=="sql" goto validate
if /i "%TSAAT_BUILD_PATH%"=="nosql" goto validate
if /i "%TSAAT_BUILD_PATH%"=="all" goto validate
echo Usage: compileApp.cmd [sql^|nosql^|all]
exit /b 2
:validate
call npm run check
if errorlevel 1 exit /b %errorlevel%
if /i "%TSAAT_BUILD_PATH%"=="all" (
  call npm run build:all
) else (
  call npm run build:%TSAAT_BUILD_PATH%
)
exit /b %errorlevel%
