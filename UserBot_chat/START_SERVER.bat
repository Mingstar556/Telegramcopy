@echo off
title UserBot Server & Database Host
color 0B
echo ========================================================
echo       UserBot Server and Database Host Launcher
echo ========================================================
echo.

set PYTHON_CMD=

:: Check for local venv in backend
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set PYTHON_CMD="%~dp0backend\venv\Scripts\python.exe"
    set MANAGE_DIR="%~dp0backend"
    goto FOUND_PYTHON
)

:: Check for parent project venv
if exist "%~dp0..\..\backend\venv\Scripts\python.exe" (
    set PYTHON_CMD="%~dp0..\..\backend\venv\Scripts\python.exe"
    if exist "%~dp0backend\manage.py" (
        set MANAGE_DIR="%~dp0backend"
    ) else (
        set MANAGE_DIR="%~dp0..\..\backend"
    )
    goto FOUND_PYTHON
)

:: Check for one-level parent venv
if exist "%~dp0..\backend\venv\Scripts\python.exe" (
    set PYTHON_CMD="%~dp0..\backend\venv\Scripts\python.exe"
    if exist "%~dp0backend\manage.py" (
        set MANAGE_DIR="%~dp0backend"
    ) else (
        set MANAGE_DIR="%~dp0..\backend"
    )
    goto FOUND_PYTHON
)

:: Fallback to system python
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=python
    if exist "%~dp0backend\manage.py" (
        set MANAGE_DIR="%~dp0backend"
    ) else if exist "%~dp0..\..\backend\manage.py" (
        set MANAGE_DIR="%~dp0..\..\backend"
    ) else (
        set MANAGE_DIR="backend"
    )
    goto FOUND_PYTHON
)

echo [ERROR] Python environment was not found!
echo Please make sure Python 3.10+ is installed or backend venv is available.
pause
exit /b 1

:FOUND_PYTHON
echo [*] Using Python: %PYTHON_CMD%
echo [*] Working Directory: %MANAGE_DIR%
echo.

cd /d %MANAGE_DIR%

echo [*] Checking and applying database migrations...
%PYTHON_CMD% manage.py migrate --noinput
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Migration check encountered an issue, proceeding...
)

echo [*] Initializing / verifying demo operator accounts...
%PYTHON_CMD% manage.py init_test_operator

echo.
echo ========================================================
echo [*] Starting ASGI / Django Live Server at:
echo     Local:    http://127.0.0.1:8000
echo     Network:  http://0.0.0.0:8000
echo     Websocket: ws://127.0.0.1:8000/ws/chat/
echo ========================================================
echo.
echo Launch UserBot_chat.exe now - it will auto-connect!
echo Press Ctrl+C to stop the host server.
echo.

%PYTHON_CMD% manage.py runserver 0.0.0.0:8000
pause
