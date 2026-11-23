@echo off
setlocal
title Launching TBOT Chat...
set "SCRIPT_DIR=%~dp0"

if not exist "%SCRIPT_DIR%config.json" (
    echo {"api_url": "http://127.0.0.1:8000", "ws_url": "ws://127.0.0.1:8000/ws/chat/", "window_title": "TBOT Chat", "window_width": 1280, "window_height": 840} > "%SCRIPT_DIR%config.json"
)

if exist "%SCRIPT_DIR%TBOTchat.exe" (
    start "" "%SCRIPT_DIR%TBOTchat.exe"
    exit /b 0
)

if exist "%SCRIPT_DIR%UserBot_chat.exe" (
    start "" "%SCRIPT_DIR%UserBot_chat.exe"
    exit /b 0
)

if exist "%SCRIPT_DIR%START_WEB_CLIENT.bat" (
    call "%SCRIPT_DIR%START_WEB_CLIENT.bat"
    exit /b 0
)

echo [!] Could not locate TBOTchat.exe or web client launcher in:
echo     %SCRIPT_DIR%
echo.
pause
