@echo off
REM ==============================================================================
REM Telegram CS Enterprise - High-Speed Production Deployment Script (Windows)
REM ==============================================================================
echo ==========================================================
echo  Starting Telegram CS Enterprise Production Deployment
echo ==========================================================

REM 1. Check environment file
if not exist .env.production (
    if exist .env.production.example (
        echo [INFO] Copying .env.production from template...
        copy .env.production.example .env.production
    )
)

REM 2. Build & start containers
echo [1/4] Building production containers...
docker compose --env-file .env.production build

echo [2/4] Starting PostgreSQL, Redis, ASGI Daphne backend, and Nginx...
docker compose --env-file .env.production up -d

echo [3/4] Running database migrations...
docker compose --env-file .env.production exec -T backend python manage.py migrate --noinput

echo [4/4] Collecting static assets...
docker compose --env-file .env.production exec -T backend python manage.py collectstatic --noinput

echo ==========================================================
echo  DEPLOYMENT COMPLETE!
echo  Web UI:          http://localhost:80
echo  Backend API:     http://localhost:80/api/
echo  WebSocket:       ws://localhost:80/ws/chat/
echo ==========================================================
pause
