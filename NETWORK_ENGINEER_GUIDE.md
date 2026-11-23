# 🛠️ Network & Systems Engineer Production Hosting Manual

> **System Overview**: High-concurrency self-hosted Telegram customer service platform connecting **50–100 operator staff** to **3,000+ active Telegram client conversations** simultaneously in real-time.

---

## 1. System Architecture & Port Map

```text
       Internet / Telegram Cloud
                   │
    HTTPS (443) / HTTP (80)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Nginx / Caddy Edge Reverse Proxy                            │
│  - SSL Termination (Let's Encrypt automated)                │
│  - Static Asset Delivery (Vite React 19 Frontend)           │
│  - Gzip / Brotli compression                                │
└──────────────┬──────────────────────────────┬───────────────┘
               │ /api/ (REST)                 │ /ws/ (WebSockets)
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Application Cluster (Daphne ASGI Server :8000)      │
│  - Python 3.12 + Django 5 + Django Channels                 │
│  - Auto-Poller Engine / Telegram Webhook Ingestion          │
│  - Outbound Rate Limiter & Message Priority Queue           │
│  - Multi-Device Session Token Manager                       │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│ PostgreSQL 16 DB (:5432)     │ │ Redis 7 Cluster (:6379)    │
│  - Persistent relational     │ │  - Channels Pub/Sub Layer  │
│  - Connection pooling (600s) │ │  - Sub-10ms state sync     │
└──────────────────────────────┘ └────────────────────────────┘
```

### Network Port Allocation

| Port | Protocol | Scope | Purpose |
|:---|:---|:---|:---|
| **80** | TCP (HTTP) | Public | HTTP redirect to HTTPS / ACME challenge |
| **443** | TCP (HTTPS) | Public | Main operator web interface & Telegram webhook |
| **8000** | TCP (HTTP/WS)| Internal/Docker | Daphne ASGI server (API & WebSockets) |
| **6379** | TCP | Internal/Docker | Redis real-time Pub/Sub broker |
| **5432** | TCP | Internal/Docker | PostgreSQL relational store |

---

## 2. Hardware & Capacity Sizing (50–100 Operators, 3,000+ Clients)

| Component | Minimum Spec | Recommended Production |
|:---|:---|:---|
| **CPU** | 4 vCPUs (x86_64 or ARM64) | 8 vCPUs |
| **RAM** | 8 GB | 16 GB |
| **Disk** | 50 GB SSD (NVMe preferred) | 200 GB SSD with automatic media volume backup |
| **Bandwidth** | 50 Mbps symmetric | 100+ Mbps symmetric |
| **OS** | Ubuntu 22.04 LTS / 24.04 LTS | Debian 12 / Ubuntu 24.04 LTS / Windows Server 2022 |

---

## 3. Fast Deployment via Docker Compose (Recommended)

### Prerequisites
- Docker Engine 24+ & Docker Compose v2+
- Domain pointed to server IP (e.g. `chat.yourcompany.com -> 1.2.3.4`)

### Step-by-Step Launch
1. **Clone or transfer repository files** to `/opt/tbotchat`:
   ```bash
   cd /opt/tbotchat
   ```
2. **Prepare Environment File**:
   ```bash
   cp .env.production.example .env
   nano .env
   ```
   * Set your `TELEGRAM_BOT_TOKEN`.
   * Set strong passwords for `POSTGRES_PASSWORD` and `DJANGO_SECRET_KEY`.

3. **Build & Start All Services**:
   ```bash
   docker compose up -d --build
   ```

4. **Verify Container Health**:
   ```bash
   docker compose ps
   docker compose logs -f backend
   ```

---

## 4. Bare-Metal Linux Deployment (Alternative without Docker)

### 1. Install System Dependencies
```bash
sudo apt update && sudo apt install -y python3.12 python3.12-venv python3-pip redis-server postgresql nginx
```

### 2. Configure PostgreSQL
```sql
sudo -u postgres psql
CREATE DATABASE tbotchat;
CREATE USER tbot WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE tbotchat TO tbot;
\q
```

### 3. Setup Python Backend Environment
```bash
cd /opt/tbotchat/backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://tbot:your_secure_password@localhost:5432/tbotchat"
export REDIS_URL="redis://localhost:6379/0"
python manage.py migrate
python manage.py collectstatic --noinput
```

### 4. Setup Systemd Service (`/etc/systemd/system/tbotchat.service`)
```ini
[Unit]
Description=Telegram Customer Service Daphne ASGI Server
After=network.target redis-server.service postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/tbotchat/backend
Environment="PATH=/opt/tbotchat/backend/venv/bin"
EnvironmentFile=/opt/tbotchat/.env
ExecStart=/opt/tbotchat/backend/venv/bin/daphne -b 127.0.0.1 -p 8000 backend.asgi:application
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tbotchat
```

---

## 5. Telegram Webhook Configuration

When hosting on a public domain with SSL, Telegram Webhook can be registered in one command:

```bash
curl -F "url=https://chat.yourcompany.com/api/telegram/webhook/" \
     -F "secret_token=your_custom_webhook_secret_string" \
     -F "max_connections=100" \
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

### Verifying Webhook Status
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

> **Note**: If your server cannot have a public IP or domain (behind strict corporate NAT), do **not** set a webhook! The built-in `AutoPollerEngine` will automatically long-poll Telegram with zero incoming firewall configuration needed!

---

## 6. Firewall & Security Rules (UFW / iptables)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow Web & WebSocket traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny external access to database and cache (accessible locally only)
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp
sudo ufw deny 8000/tcp

sudo ufw enable
```

Telegram IP Ranges for Webhooks (if locking down port 443 strictly):
- `149.154.160.0/20`
- `91.108.4.0/22`

---

## 7. Backups & Disaster Recovery

### Automated Daily Database Backup (Cron)
Add to `/etc/cron.daily/tbot-db-backup`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/tbotchat"
mkdir -p "$BACKUP_DIR"
docker exec -t tbot_postgres pg_dump -U tbot tbotchat | gzip > "$BACKUP_DIR/tbot_$(date +\%F_\%H\%M).sql.gz"
find "$BACKUP_DIR" -type f -mtime +14 -delete
```
chmod +x:
```bash
sudo chmod +x /etc/cron.daily/tbot-db-backup
```
