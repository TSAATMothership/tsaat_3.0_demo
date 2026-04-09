@echo off
setlocal
set "REPO_ROOT=%~dp0"
call "%REPO_ROOT%Database Schema\loaders\build-and-load-database.cmd" %*
if errorlevel 1 exit /b %errorlevel%
endlocal

