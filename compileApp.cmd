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
if /i "%TSAAT_BUILD_PATH%"=="sql" set "TSAAT_BUILD_PATH=sql"
if /i "%TSAAT_BUILD_PATH%"=="nosql" set "TSAAT_BUILD_PATH=nosql"
call "%~dp0install-offline.cmd"
if errorlevel 1 exit /b %errorlevel%
if not exist "%~dp0.git" goto packagechecks
call "%~dp0tsaat-npm.cmd" run check
if errorlevel 1 exit /b %errorlevel%
goto compile
:packagechecks
rem Git hygiene and Git-dependent test fixtures are checked before packaging.
call "%~dp0tsaat-npm.cmd" run docs:check
if errorlevel 1 exit /b %errorlevel%
call "%~dp0tsaat-npm.cmd" run storage:check
if errorlevel 1 exit /b %errorlevel%
:compile
rem Both build wrappers enforce archive integrity, lint and TypeScript checks.
if /i "%TSAAT_BUILD_PATH%"=="all" (
  call "%~dp0tsaat-npm.cmd" run build:all
) else (
  call "%~dp0tsaat-npm.cmd" run build:%TSAAT_BUILD_PATH%
)
exit /b %errorlevel%
