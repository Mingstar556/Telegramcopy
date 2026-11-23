#!/usr/bin/env bash
# ==============================================================================
# Telegram CS Enterprise - High-Speed Production Deployment Script
# Supports 100+ concurrent customer service operators & live Telegram traffic
# ==============================================================================
set -euo pipefail

echo "=========================================================="
echo " Starting Telegram CS Enterprise Production Deployment"
echo "=========================================================="

# 1. Check prerequisites
command -v docker >/dev/null 2>&1 || { echo >&2 "[ERROR] Docker is not installed. Aborting."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || { echo >&2 "[ERROR] Docker Compose is not installed. Aborting."; exit 1; }

# 2. Check environment file
if [ ! -f .env.production ]; then
    if [ -f .env.production.example ]; then
        echo "[INFO] Creating .env.production from template..."
        cp .env.production.example .env.production
        echo "[WARNING] Please update .env.production with your strong secrets and bot token!"
    else
        echo "[ERROR] .env.production not found. Please create one."
        exit 1
    fi
fi

# 3. Build & start containers
echo "[1/4] Building production containers..."
docker compose --env-file .env.production build

echo "[2/4] Starting database, redis, daphne backend & nginx..."
docker compose --env-file .env.production up -d

echo "[3/4] Running database migrations..."
docker compose --env-file .env.production exec -T backend python manage.py migrate --noinput

echo "[4/4] Collecting static assets..."
docker compose --env-file .env.production exec -T backend python manage.py collectstatic --noinput || true

# 4. Healthcheck
echo "Verifying service health..."
sleep 3
if docker compose exec -T backend curl -sf http://localhost:8000/api/health/ >/dev/null; then
    echo "=========================================================="
    echo "  DEPLOYMENT SUCCESSFUL!"
    echo "  Frontend Web UI:   http://localhost:80"
    echo "  Backend API:       http://localhost:80/api/"
    echo "  WebSocket Stream:  ws://localhost:80/ws/chat/"
    echo "=========================================================="
else
    echo "[WARNING] Health check probe failed. Check logs: docker compose logs backend"
fi
