@echo off
title Telegram UserBot Chat - Full-Stack Launcher & Host
color 0E

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start_all.ps1"
if %ERRORLEVEL% equ 0 exit /b 0

echo.
echo [ERROR] Launcher encountered an issue.
pause
exit /b 1
