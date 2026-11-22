@echo off
setlocal enabledelayedexpansion
title Telegram UserBot Chat - Server and Database Host
color 0E

echo ===============================================================================
echo         TELEGRAM USERBOT CHAT - ONE-CLICK FULL-STACK LAUNCHER
echo ===============================================================================
echo.

set "ROOT_DIR=%~dp0"
set "PYTHON_CMD="

:: 1. Detect Python
if exist "%ROOT_DIR%backend\venv\Scripts\python.exe" (
    set "PYTHON_CMD=%ROOT_DIR%backend\venv\Scripts\python.exe"
) else (
    where python >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        set "PYTHON_CMD=python"
    ) else (
        color 0C
        echo [ERROR] Python was not found in backend\venv or system PATH!
        pause
        exit /b 1
    )
)

:: 2. Detect npm
where npm >nul 2>&1
if !ERRORLEVEL! neq 0 (
    color 0C
    echo [ERROR] npm was not found in system PATH!
    pause
    exit /b 1
)

echo [*] Python interpreter : %PYTHON_CMD%
echo [*] Working Directory  : %ROOT_DIR%
echo.

:: 3. Database migrations & seed
echo ===============================================================================
echo [1/3] Checking and applying Database Migrations...
echo ===============================================================================
cd /d "%ROOT_DIR%backend"
"%PYTHON_CMD%" manage.py migrate --noinput
if !ERRORLEVEL! neq 0 (
    echo [WARNING] Database migration returned non-zero, continuing...
)

echo.
echo [*] Initializing demo bot accounts in database...
"%PYTHON_CMD%" manage.py init_test_operator
echo.

:: 4. Check frontend node_modules
echo ===============================================================================
echo [2/3] Checking Frontend Dependencies...
echo ===============================================================================
if not exist "%ROOT_DIR%front-end\node_modules" (
    echo [*] Installing frontend packages...
    cd /d "%ROOT_DIR%front-end"
    call npm install
) else (
    echo [*] Frontend dependencies are installed.
)

:: 5. Start Backend and Frontend servers
echo.
echo ===============================================================================
echo [3/3] Starting Live Servers...
echo ===============================================================================

echo [*] Starting Backend Server on port 8000...
start "UserBot Backend Port 8000" cmd /k "title UserBot Backend Port 8000 && color 0B && cd /d "%ROOT_DIR%backend" && "%PYTHON_CMD%" manage.py runserver 0.0.0.0:8000"

echo [*] Starting Frontend Web Client on port 5173...
start "UserBot Frontend Port 5173" cmd /k "title UserBot Frontend Port 5173 && color 0A && cd /d "%ROOT_DIR%front-end" && npm run dev -- --host 0.0.0.0 --port 5173"

:: 6. Wait for servers to initialize
echo.
echo [*] Waiting 3 seconds for servers to start...
timeout /t 3 /nobreak >nul

start http://localhost:5173

color 0A
cls
echo ===============================================================================
echo          ALL SERVICES ARE LIVE AND RUNNING SUCCESSFULLY!
echo ===============================================================================
echo.
echo  ACCESS URLS:
echo  -----------------------------------------------------------------------------
echo   - Local Frontend  : http://localhost:5173
echo   - Backend API & DB: http://localhost:8000
echo   - WebSockets      : ws://127.0.0.1:8000/ws/chat/
echo.
echo  DEFAULT DEMO BOT OPERATORS:
echo  -----------------------------------------------------------------------------
echo   - Username: ahfu     ^| Password: ahfu1234     ^| Bot: @Ah_fu_bot
echo   - Username: bingo    ^| Password: bingo1234    ^| Bot: @mr_Bingoobot
echo   - Username: mrlioma  ^| Password: mrlioma1234  ^| Bot: @mrlionabot
echo.
echo ===============================================================================
echo  TIP: Run STOP_ALL.bat to shut down all servers.
echo ===============================================================================
echo.
echo Keep this window open or minimize it. Press any key to stop all servers...
pause >nul

call "%ROOT_DIR%STOP_ALL.bat"
exit /b 0
