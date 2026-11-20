@echo off
title Stop UserBot Server
color 0C
echo ========================================================
echo       Stopping UserBot Server on Port 8000...
echo ========================================================
echo.

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [*] Found process with PID %%a using port 8000. Terminating...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [*] Done. If any server was running on port 8000, it has been stopped.
timeout /t 3 >nul
exit /b 0
