@echo off
setlocal enabledelayedexpansion
title TBOT Chat - Server Connection Setup
color 0b

echo ========================================================================
echo                   TBOT CHAT - SERVER CONNECTION SETUP
echo ========================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "CONFIG_FILE=%SCRIPT_DIR%config.json"

if not exist "%CONFIG_FILE%" (
    echo {"api_url": "http://127.0.0.1:8000", "ws_url": "ws://127.0.0.1:8000/ws/chat/", "window_title": "TBOT Chat", "window_width": 1280, "window_height": 840} > "%CONFIG_FILE%"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$cf = Get-Content -Raw '%CONFIG_FILE%' | ConvertFrom-Json;" ^
    "Write-Host '  Current Server Address : ' -NoNewline -ForegroundColor Gray;" ^
    "Write-Host $cf.api_url -ForegroundColor Yellow;"
echo.
echo ------------------------------------------------------------------------
echo  Enter your company server address:
echo    - Office LAN      : http://192.168.1.100:8000
echo    - Localhost       : http://127.0.0.1:8000
echo    - Cloud / Domain  : https://chat.company.com
echo  (Or press Enter to keep current server address)
echo ------------------------------------------------------------------------
echo.
set /p "TARGET_URL=  Server Address: "

if "%TARGET_URL%"=="" (
    for /f "tokens=*" %%a in ('powershell -NoProfile -Command "(Get-Content -Raw '%CONFIG_FILE%' | ConvertFrom-Json).api_url"') do set "TARGET_URL=%%a"
)

echo.
echo [*] Testing server connectivity and health...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$raw = '%TARGET_URL%'.Trim().TrimEnd('/');" ^
    "if (-not $raw.StartsWith('http://') -and -not $raw.StartsWith('https://')) {" ^
    "    if ($raw.Contains(':')) { $raw = 'http://' + $raw; }" ^
    "    elseif ($raw.Contains('localhost') -or $raw -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}') { $raw = 'http://' + $raw + ':8000'; }" ^
    "    else { $raw = 'https://' + $raw; }" ^
    "}" ^
    "$api = $raw.TrimEnd('/');" ^
    "if ($api.StartsWith('https://')) { $ws = 'wss://' + $api.Substring(8) + '/ws/chat/'; }" ^
    "else { $ws = 'ws://' + $api.Substring(7) + '/ws/chat/'; }" ^
    "Write-Host '    Target Endpoint : ' -NoNewline; Write-Host $api -ForegroundColor Cyan;" ^
    "$healthUrl = $api + '/api/health/';" ^
    "try {" ^
    "    $req = [System.Net.HttpWebRequest]::Create($healthUrl);" ^
    "    $req.Timeout = 5000;" ^
    "    $res = $req.GetResponse();" ^
    "    $sr = New-Object System.IO.StreamReader($res.GetResponseStream());" ^
    "    $body = $sr.ReadToEnd();" ^
    "    $res.Close();" ^
    "    $online = $true;" ^
    "} catch {" ^
    "    $online = $false;" ^
    "    $err = $_.Exception.Message;" ^
    "}" ^
    "$cfg = Get-Content -Raw '%CONFIG_FILE%' | ConvertFrom-Json;" ^
    "$cfg.api_url = $api;" ^
    "$cfg.ws_url = $ws;" ^
    "$cfg | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 '%CONFIG_FILE%';" ^
    "if ($online) {" ^
    "    Write-Host '    Status          : [ONLINE] Server is healthy!' -ForegroundColor Green;" ^
    "    exit 0;" ^
    "} else {" ^
    "    Write-Host '    Status          : [STANDBY] Server unreachable right now.' -ForegroundColor Yellow;" ^
    "    Write-Host '    Detail          : ' $err -ForegroundColor DarkYellow;" ^
    "    Write-Host '    (Server address has still been saved to config.json)' -ForegroundColor Gray;" ^
    "    exit 1;" ^
    "}"

set "STATUS_CODE=%ERRORLEVEL%"
echo.
echo ========================================================================
if "%STATUS_CODE%"=="0" (
    echo  [SUCCESS] Server connection configured and verified!
) else (
    echo  [SAVED] Address saved. Make sure your server is running or VPN is on.
)
echo ========================================================================
echo.

set /p "LAUNCH_NOW=Launch TBOT Chat now? (Y/N) [default=Y]: "
if /i "%LAUNCH_NOW%"=="N" goto finish

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

:finish
echo Done. Press any key to exit.
pause >nul
