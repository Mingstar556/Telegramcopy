# PowerShell Script to Stop All UserBot Servers
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host "                 STOPPING ALL USERBOT SERVERS & SERVICES                       " -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host ""

$ports = @(8000, 5173)
$stopped = 0

foreach ($port in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($conn in $conns) {
                $procId = $conn.OwningProcess
                Write-Host "[*] Found process with PID $procId on port $port. Stopping..." -ForegroundColor Cyan
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                $stopped++
            }
        }
    } catch {
        # Fallback via netstat
        $lines = netstat -aon | Select-String ":$port\s+.*LISTENING\s+(\d+)"
        foreach ($line in $lines) {
            if ($line -match "LISTENING\s+(\d+)") {
                $procId = $matches[1]
                Write-Host "[*] Found process PID $procId on port $port via netstat. Stopping..." -ForegroundColor Cyan
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                $stopped++
            }
        }
    }
}

if ($stopped -gt 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Stopped $stopped server process(es)." -ForegroundColor Green
} else {
    Write-Host "[*] No active servers found listening on port 8000 or 5173." -ForegroundColor Gray
}

Start-Sleep -Seconds 2
