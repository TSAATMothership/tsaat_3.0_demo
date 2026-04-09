@echo off
setlocal
set "REPO_ROOT=%~dp0"
call "%REPO_ROOT%compileApp.cmd" %*
if errorlevel 1 exit /b %errorlevel%
endlocal
