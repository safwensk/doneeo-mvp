@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\Start-Doneeo.ps1"
pause
