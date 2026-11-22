@echo off
title TBOTchat - Automatic Bot Account Generator
color 0b
cd /d "%~dp0"

echo =======================================================================
echo          TBOTCHAT - AUTOMATIC WEB OPERATOR ACCOUNT GENERATOR
echo =======================================================================
echo.
echo This tool lets you enter your Telegram Bot keys and automatically
echo generates the corresponding User-IDs and Passwords for the web app!
echo.

IF EXIST "backend\venv\Scripts\python.exe" (
    SET "PY_CMD=backend\venv\Scripts\python.exe"
) ELSE (
    SET "PY_CMD=python"
)

%PY_CMD% batch_account_generator.py %*

echo.
echo =======================================================================
echo Generation complete.
echo =======================================================================
pause
