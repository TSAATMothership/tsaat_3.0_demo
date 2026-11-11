@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-and-load-database.ps1" %*
exit /b %errorlevel%
