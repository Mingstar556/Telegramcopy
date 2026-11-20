# PowerShell One-Click Full-Stack Launcher for Telegram UserBot
$ErrorActionPreference = "Stop"

Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host "         TELEGRAM USERBOT CHAT - ONE-CLICK FULL-STACK LAUNCHER (PS)            " -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host ""

$rootDir = $PSScriptRoot
$pythonCmd = ""

# 1. Detect Python
if (Test-Path "$rootDir\backend\venv\Scripts\python.exe") {
    $pythonCmd = "$rootDir\backend\venv\Scripts\python.exe"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} else {
    Write-Host "[ERROR] Python environment was not found!" -ForegroundColor Red
    pause
    exit 1
}

# 2. Detect Node & npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm was not found in PATH! Please install Node.js 18+." -ForegroundColor Red
    pause
    exit 1
}

# 3. Detect LAN IP
$hostIp = "127.0.0.1"
try {
    $ipObj = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.InterfaceAlias -notmatch 'Loopback' -and 
        $_.IPAddress -notmatch '^169\.254\.' -and 
        $_.IPAddress -notmatch '^192\.168\.56\.'
    } | Select-Object -First 1
    if ($ipObj) { $hostIp = $ipObj.IPAddress }
} catch {
    $hostIp = "127.0.0.1"
}

Write-Host "[*] Python interpreter : $pythonCmd"
Write-Host "[*] Node.js package mgr: Available"
Write-Host "[*] Network Host IP    : $hostIp"
Write-Host ""

# 4. Database Setup & Migrations
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "[1/3] Checking and applying Database Migrations..." -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Set-Location "$rootDir\backend"
& $pythonCmd manage.py migrate --noinput

Write-Host ""
Write-Host "[1.1] Seeding/verifying Demo Bot Accounts in Database..." -ForegroundColor Cyan
& $pythonCmd manage.py init_test_operator
Write-Host ""

# 5. Frontend Dependencies Check
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "[2/3] Checking Frontend Dependencies..." -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
if (-not (Test-Path "$rootDir\front-end\node_modules")) {
    Write-Host "[*] Installing frontend packages..."
    Set-Location "$rootDir\front-end"
    npm install
} else {
    Write-Host "[*] Frontend dependencies are already installed."
}

# 6. Launch Servers
Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "[3/3] Starting Live Servers..." -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan

Start-Process cmd -ArgumentList "/k title UserBot Backend & Database [Port 8000] && color 0B && cd /d `"$rootDir\backend`" && `"$pythonCmd`" manage.py runserver 0.0.0.0:8000"
Start-Process cmd -ArgumentList "/k title UserBot Frontend Client [Port 5173] && color 0A && cd /d `"$rootDir\front-end`" && npm run dev -- --host 0.0.0.0 --port 5173"

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Clear-Host
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "          ALL SERVICES ARE LIVE AND RUNNING SUCCESSFULLY!                      " -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host " ACCESS URLS:"
Write-Host " -----------------------------------------------------------------------------"
Write-Host "  - Local Frontend  : http://localhost:5173"
Write-Host "  - Network Frontend: http://$($hostIp):5173  (Share with other PCs/phones)"
Write-Host "  - Backend API & DB: http://localhost:8000  (Network: http://$($hostIp):8000)"
Write-Host "  - WebSockets      : ws://$($hostIp):8000/ws/chat/"
Write-Host ""
Write-Host " DEFAULT DEMO BOT OPERATORS:"
Write-Host " -----------------------------------------------------------------------------"
Write-Host "  - Username: ahfu     | Password: ahfu1234     | Bot: @Ah_fu_bot"
Write-Host "  - Username: bingo    | Password: bingo1234    | Bot: @mr_Bingoobot"
Write-Host "  - Username: mrlioma  | Password: mrlioma1234  | Bot: @mrlionabot"
Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host " TIP: Run ./stop_all.ps1 or STOP_ALL.bat to stop all servers." -ForegroundColor Yellow
Write-Host "      Or press Enter in this window to stop both servers now..." -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host ""
$null = Read-Host "Press [Enter] to stop all servers"
Write-Host ""
& "$rootDir\stop_all.ps1"

