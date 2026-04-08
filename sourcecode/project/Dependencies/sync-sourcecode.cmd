@echo off
setlocal EnableExtensions

powershell -ExecutionPolicy Bypass -File "%~dp0sync-sourcecode.ps1" %*
exit /b %ERRORLEVEL%
