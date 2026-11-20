@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\Start-Java.ps1"
if errorlevel 1 pause
