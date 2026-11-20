@echo off
title Telegram UserBot Chat - Full-Stack + Desktop App Launcher
color 0E

echo [*] Starting Backend, Database, and Frontend servers...
start "" "%~dp0START_ALL.bat"

timeout /t 4 /nobreak >nul

echo [*] Launching Desktop Client...
if exist "%~dp0UserBot_chat\UserBot_chat.exe" (
    start "" "%~dp0UserBot_chat\UserBot_chat.exe"
) else if exist "%~dp0desktop_app.py" (
    start "" "%~dp0backend\venv\Scripts\python.exe" "%~dp0desktop_app.py"
)

exit /b 0
