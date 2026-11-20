@echo off
title Initialize UserBot Database
color 0E
echo ========================================================
echo       Initialize / Reset UserBot Operator Accounts
echo ========================================================
echo.

set PYTHON_CMD=

if exist "%~dp0backend\venv\Scripts\python.exe" (
    set PYTHON_CMD="%~dp0backend\venv\Scripts\python.exe"
    set MANAGE_DIR="%~dp0backend"
    goto RUN_INIT
)

if exist "%~dp0..\..\backend\venv\Scripts\python.exe" (
    set PYTHON_CMD="%~dp0..\..\backend\venv\Scripts\python.exe"
    if exist "%~dp0backend\manage.py" (
        set MANAGE_DIR="%~dp0backend"
    ) else (
        set MANAGE_DIR="%~dp0..\..\backend"
    )
    goto RUN_INIT
)

where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=python
    if exist "%~dp0backend\manage.py" (
        set MANAGE_DIR="%~dp0backend"
    ) else (
        set MANAGE_DIR="%~dp0..\..\backend"
    )
    goto RUN_INIT
)

echo [ERROR] Python not found.
pause
exit /b 1

:RUN_INIT
cd /d %MANAGE_DIR%
echo [*] Applying migrations...
%PYTHON_CMD% manage.py migrate
echo.
echo [*] Seeding demo operator bot accounts...
%PYTHON_CMD% manage.py init_test_operator
echo.
echo [*] Database initialization complete!
pause
