@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-demo-database.ps1" %*
exit /b %errorlevel%
