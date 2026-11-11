@echo off
setlocal
call "%~dp0tsaat-npm.cmd" run install:offline -- %*
exit /b %errorlevel%
