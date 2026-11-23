@echo off
setlocal
title TBOT Chat - Web Browser Client
color 0a

echo ========================================================================
echo                   TBOT CHAT - WEB BROWSER CLIENT
echo ========================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "DIST_DIR=%SCRIPT_DIR%dist"

if not exist "%DIST_DIR%\index.html" (
    if exist "%SCRIPT_DIR%index.html" (
        set "DIST_DIR=%SCRIPT_DIR%"
    ) else (
        echo [ERROR] Frontend distribution not found in %DIST_DIR%
        echo Please ensure dist/index.html is present.
        pause
        exit /b 1
    )
)

set "PORT=3000"

echo [*] Starting local client server on port %PORT%...
echo [*] Opening default web browser at http://127.0.0.1:%PORT% ...
echo [*] Press Ctrl+C in this window anytime to stop the client.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$port = %PORT%;" ^
    "$folder = '%DIST_DIR%'.TrimEnd('\');" ^
    "$listener = New-Object System.Net.HttpListener;" ^
    "$listener.Prefixes.Add('http://127.0.0.1:' + $port + '/');" ^
    "try { $listener.Start(); } catch { Write-Host 'Port already in use, trying 3001...'; $port = 3001; $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://127.0.0.1:' + $port + '/'); $listener.Start(); }" ^
    "Start-Process ('http://127.0.0.1:' + $port);" ^
    "Write-Host ('[ONLINE] Serving at http://127.0.0.1:' + $port + ' (Press Ctrl+C to stop)') -ForegroundColor Green;" ^
    "while ($listener.IsListening) {" ^
    "    $context = $listener.GetContext();" ^
    "    $req = $context.Request;" ^
    "    $resp = $context.Response;" ^
    "    $urlPath = $req.Url.AbsolutePath.TrimStart('/');" ^
    "    if ([string]::IsNullOrEmpty($urlPath)) { $urlPath = 'index.html'; }" ^
    "    $filePath = [System.IO.Path]::Combine($folder, $urlPath);" ^
    "    if (-not [System.IO.File]::Exists($filePath)) { $filePath = [System.IO.Path]::Combine($folder, 'index.html'); }" ^
    "    try {" ^
    "        $bytes = [System.IO.File]::ReadAllBytes($filePath);" ^
    "        $ext = [System.IO.Path]::GetExtension($filePath).ToLower();" ^
    "        switch ($ext) {" ^
    "            '.html' { $resp.ContentType = 'text/html; charset=utf-8' }" ^
    "            '.js'   { $resp.ContentType = 'application/javascript; charset=utf-8' }" ^
    "            '.mjs'  { $resp.ContentType = 'application/javascript; charset=utf-8' }" ^
    "            '.css'  { $resp.ContentType = 'text/css; charset=utf-8' }" ^
    "            '.json' { $resp.ContentType = 'application/json; charset=utf-8' }" ^
    "            '.svg'  { $resp.ContentType = 'image/svg+xml' }" ^
    "            '.png'  { $resp.ContentType = 'image/png' }" ^
    "            '.ico'  { $resp.ContentType = 'image/x-icon' }" ^
    "            '.woff2'{ $resp.ContentType = 'font/woff2' }" ^
    "            default { $resp.ContentType = 'application/octet-stream' }" ^
    "        }" ^
    "        $resp.ContentLength64 = $bytes.Length;" ^
    "        $resp.OutputStream.Write($bytes, 0, $bytes.Length);" ^
    "    } catch {" ^
    "        $resp.StatusCode = 500;" ^
    "    } finally {" ^
    "        $resp.Close();" ^
    "    }" ^
    "}"
