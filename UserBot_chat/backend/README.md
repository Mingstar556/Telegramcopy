# Telegram Customer Service Bot - Scalable Backend Service

This backend powers the **Employee Operator Dashboard** and bridges multiple Telegram bots with internal customer service staff in real-time.

---

## 🏗️ Architecture Overview

```
[ Telegram Customers ] 
       │ (Telegram Bot API: webhook or getUpdates)
       ▼
[ Scalable Telegram Bot Gateway (bot_service.py) ]
       │
   ┌───┴────────────────────────┐
   ▼                            ▼
[ SQLite / PostgreSQL ]   [ Django Channels Layer (Redis) ]
   │                            │
   ▼                            ▼
[ REST API Views ]       [ WebSocket Consumer (consumers.py) ]
   │                            │ (ws://.../ws/chat/?user_id=1234)
   └───────────┬────────────────┘
               ▼
   [ React 19 Operator Dashboard ]
```

### Key Components

1. **Multi-Bot Tenant Isolation (`BotAccount`)**:
   - Each CS agent is provisioned their own `BotAccount` (`user_id`, `password`, `bot_token`).
   - The system dynamically routes customer messages to the assigned CS operator and dispatches outgoing replies using that specific bot token.

2. **Real-time WebSockets (`ChatConsumer`)**:
   - Built on Daphne and Django Channels.
   - Operators connect to `ws://127.0.0.1:8000/ws/chat/?user_id={userId}`.
   - Incoming customer messages from Telegram are pushed instantly to the operator's browser session.

3. **Multi-Bot Gateway (`TelegramBotGateway`)**:
   - Sends text, voice notes (HTML5 MediaRecorder audio), photos, and stickers.
   - Handles media conversion and delivery via Telegram Bot API.

4. **Production Scalability**:
   - **Horizontal Clustering**: Set `REDIS_URL=redis://...` to enable `channels_redis`, allowing multiple Daphne worker pods to share WebSocket state seamlessly.
   - **Telegram Webhook Architecture**: Point webhooks to `/api/telegram/webhook/<user_id>/` for event-driven delivery without polling overhead.
   - **Local Polling Fallback**: Use `python manage.py run_bot_polling --user-id 1234` to develop and test locally without requiring an ngrok tunnel.

---

## 🚀 Quickstart Guide

### 1. Activate Virtual Environment
```bash
# Windows PowerShell
.\backend\venv\Scripts\Activate.ps1
```

### 2. Apply Database Migrations
```bash
cd backend
python manage.py makemigrations telegram_chat
python manage.py migrate
```

### 3. Seed Default Test Operator & Data
```bash
python manage.py init_test_operator
```
*Creates operator `1234` with password `1234` and sample customer chats.*

### 4. Run the ASGI Server
```bash
python manage.py runserver 8000
```
*Daphne handles both HTTP REST endpoints and WebSockets on port 8000.*

### 5. Launch the React Frontend
In a separate terminal:
```bash
cd front-end
npm run dev
```
Open `http://localhost:5173/` and toggle to **Django Live** mode!

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health/` | Health check probe |
| `POST` | `/api/auth/login/` | Operator authentication (`User-ID`, `password`) |
| `GET` | `/api/user/profile/` | Operator profile and status metadata |
| `GET` | `/api/chats/` | Active conversations list with unread counters |
| `GET` | `/api/messages/` | Chat history between operator and Telegram customer |
| `POST` | `/api/messages/send/` | Send message/media/voice to Telegram user |
| `POST` | `/api/media/upload/` | Upload voice notes or image attachments |
| `POST` | `/api/telegram/webhook/<user_id>/` | Webhook receiver for Telegram updates |
