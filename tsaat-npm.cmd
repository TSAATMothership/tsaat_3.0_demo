@echo off
setlocal
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\offline-npm.ps1" %*
exit /b %errorlevel%
