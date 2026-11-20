@echo off
title Stop All UserBot Servers
color 0E

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0stop_all.ps1"
if %ERRORLEVEL% equ 0 exit /b 0

echo.
echo [*] Fallback cleanup...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173"') do taskkill /F /PID %%a >nul 2>&1

timeout /t 2 /nobreak >nul
exit /b 0
