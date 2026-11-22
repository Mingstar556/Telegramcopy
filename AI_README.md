# 🤖 AI SYSTEM COMPREHENSIVE ONBOARDING & ARCHITECTURE GUIDE (AI_README)

> **Purpose for Incoming AI Agents**: This document is the single source of truth for the **Telegram Web Customer Chat & Bot Management System**. Read this file first before touching any code. It details the system architecture, component boundaries, state flow, API contracts, deployment configurations, and non-negotiable architectural constraints to prevent regressions.

---

## 1. Executive Summary & Purpose

This system is a **self-hosted, multi-device enterprise customer service platform** that bridges company Telegram Bots to an internal web terminal. Company employees log into the web terminal as dedicated Telegram bot operators to converse directly with real clients on Telegram in real time.

```text
               +----------------------------------+
               |        Telegram Platform         |
               | (Real Customers on Telegram App) |
               +-----------------+----------------+
                                 |
                                 | Telegram Bot API (getUpdates / Webhook / Outbound)
                                 v
+-----------------------------------------------------------------------+
| Backend Server (Django 5 + Channels + Daphne ASGI on Port 8000)       |
|  - Multi-Device Session Auth (Bearer Device Tokens)                   |
|  - Auto-Sync Engine (Offset-based Telegram Ingestion)                  |
|  - WebSocket Streaming Group: chat_<user_id>                          |
|  - SQLite Database (Isolated by BotAccount)                           |
+-----------------------------------------------------------------------+
        ^                                                ^
        | HTTP REST & Native WebSocket                   | Local Embedded Server
        v                                                v
+-------------------------------+      +--------------------------------+
| Web Browser Client            |      | Standalone Windows Desktop App |
| (React 19 + TypeScript + Vite |      | (pywebview + Edge WebView2     |
| on Port 5173 - Port 8000 API) |      | UserBot_chat.exe + No Signal)  |
+-------------------------------+      +--------------------------------+
```

---

## 2. Tech Stack

| Layer | Technologies | Key Responsibilities |
|:---|:---|:---|
| **Frontend** | React 19, TypeScript (~5.7), Vite 6, Tailwind CSS 3, Lucide React | Single Page Application, real-time message stream, optimistic state, custom audio recorder with waveforms, theme engine, eye-toggle password security. |
| **Backend** | Python 3.12+, Django 5.x, Django Channels, Daphne (ASGI) | REST API endpoints, WebSocket server, multi-device session validation, Telegram Bot synchronization daemon. |
| **Database** | SQLite 3 (`backend/db.sqlite3`) | Self-hosted zero-config relational store for employees, sessions, bot accounts, contacts, and chat history. |
| **Desktop Wrapper** | Python `pywebview` + Microsoft Edge WebView2, PyInstaller | Native Windows client (`UserBot_chat.exe`), dynamic server host detection, retro CRT "No Signal" reconnect radar. |
| **Testing** | Django TestCase with 100% offline mocked Telegram Gateway | 118 automated tests in `backend/telegram_chat/tests/` running without live network dependency. |

---

## 3. Core Features & Business Logic

### A. Authentication & Operator Terminal
- **Login Modal** (`front-end/src/components/auth/LoginModal.tsx`):
  - Form requires `Employee User ID` and `Operator Password`.
  - Includes an **interactive Eye icon** (`Eye` / `EyeOff` from `lucide-react`) enabling users to toggle showing/masking typed passwords.
  - **Deployment-Ready**: All demo autofill buttons and hardcoded test credential boxes have been permanently removed. Standard `autoComplete="username"` and `autoComplete="current-password"` semantics are enforced.
  - Authenticates via `POST /api/auth/login/` returning an employee account payload and unique device session Bearer token.

### B. Multi-Device Concurrent Logins
- Every login generates an independent `DeviceSession` record in the database.
- An employee can be logged in simultaneously from multiple machines (office PC, mobile web, desktop client) without invalidating other active sessions.
- Sessions are audited with IP address, device type, user agent, and `last_activity`.
- Users can view and selectively revoke sessions via `GET /api/auth/sessions/` and `DELETE /api/auth/sessions/<token>/`.

### C. Tenant & Account Isolation
- Operators only see chats belonging to the bot they logged in as.
- Customer chats are partitioned by `bot_account_id`. Messages and client data from one bot are never visible or accessible to another bot operator.
- **Group chats were intentionally removed**: The platform strictly enforces 1-on-1 customer service interactions.

### D. Private "Saved Messages" Cloud
- Every bot account possesses a private, persistent `Saved Messages` room.
- Used by operators to store internal notes, files, checklists, or pinned client data. This room is strictly isolated to that specific bot account.

### E. Telegram Sync Engine (`bot_service.py`)
- Automatically triggered on employee login and when fetching the chat list (`GET /api/chats/?sync=true`).
- Queries the Telegram Bot API `getUpdates` with offset management to ingest new customer chats and messages into the SQLite DB.
- Dispatches outgoing messages to Telegram via `sendMessage`, `sendPhoto`, `sendDocument`, `sendVoice`, etc., and echoes them to all connected device sessions over WebSocket.

### F. Real-Time WebSocket Streaming (`consumers.py` & `websocket.ts`)
- Connection URI: `ws://<host>:8000/ws/chat/?token=<device_session_token>`.
- Authenticates token during handshake; unauthenticated connections are rejected with code `4001`.
- Channels group: `chat_<employee_user_id>`.
- Client and server exchange typed JSON payloads (`chat_message`, `message_sent`, `typing`, `read_receipt`).

### G. Audio Engine & Media Support
- In-browser microphone audio recorder (`front-end/src/services/audioRecorder.ts`) capturing high-fidelity voice notes with live visualization.
- Custom `VoiceMessagePlayer` with scrubbable waveform playback.
- Media upload modal supporting photos, videos, and file attachments stored under `backend/media/`.
- Built-in SVG sticker packs (`stickerPacks.ts`) and custom emoji drawer.

### H. Dual Luxury Theme Engine
- **Simple Black Theme**: Clean, modern dark Obsidian aesthetic.
- **Black & Gold Theme**: Stealth luxury palette with gold accents (`#d4af37`, `#f3c853`).
- Toggled in the UI header and persisted in localStorage.

### I. Connection Health & "No Signal" Desktop Resilience
- Standalone desktop client checks `GET /api/health/`.
- If the backend or database is offline, it transitions into an animated retro CRT "NO SIGNAL" screen with a rotating radar animation.
- Automatically polls every 4 seconds to reconnect immediately once the server comes online.
- Allows editing the backend IP/port on the fly without restarting.

### J. AI Chat & Conversation Summarizer Feature
- **Component**: `front-end/src/components/chat/ChatSummaryModal.tsx` integrated directly into the `ChatArea.tsx` header (`Sparkles` icon).
- **Executive Dialogue Summary**: Extracts key discussion points, customer inquiries, and operator responses from `activeMessages`.
- **Metrics & Engagement Dashboard**: Tracks total message count, incoming client messages, outbound operator replies, and shared attachments.
- **One-Click Notes Workflow**: Allows operators to immediately copy the summary or click **"Post as Note"** to save it as an internal reference note in the bot's private `Saved Messages` room.

### K. Multi-Layer Defensive Security Hardening
- **Password Protection**: Implemented `_verify_and_upgrade_password()` in `views.py` using Django PBKDF2 (`make_password`, `check_password`). Automatically upgrades plaintext credentials to cryptographic hashes on login without invalidating existing accounts.
- **File Upload Safeguards**: Hardened `POST /api/media/upload/` with a 25MB ceiling, strict extension whitelisting (`ALLOWED_UPLOAD_EXTENSIONS`), and filename sanitization via `os.path.basename` + alphanumeric filtering.
- **Telegram Webhook Verification**: `POST /api/telegram/webhook/` verifies `X-Telegram-Bot-Api-Secret-Token` via constant-time `secrets.compare_digest` against `TELEGRAM_WEBHOOK_SECRET` to prevent forged message injection.
- **Rate Limiting Defense**: In-memory sliding rate limiter (15 failed requests per 60 seconds) on `/api/auth/login/` returning HTTP 429 to mitigate credential stuffing.
- **Desktop Path Traversal Guard**: Conconfined `translate_path()` in `desktop_app.py` via `os.path.normpath` and boundary verification ensuring no arbitrary file reads outside `dist_dir`.
- **Secrets & Git Protection**: Git tracking permanently untracked from `.env` and `db.sqlite3` across `UserBot_chat/backend/`. Added comprehensive rules to `.gitignore` and sanitized `.env.example` templates.


---

## 4. Directory Structure & Key Files Map

```text
Telegramplugin-front/
├── AI_README.md                    <-- YOU ARE HERE: Master architecture guide for AI assistants
├── README.md                       <-- User-facing operations manual & quick start
├── APP_EXPLANATION.txt             <-- Deep architectural manual
├── config.json                     <-- Server endpoint config for Desktop App
├── desktop_app.py                  <-- PyWebView desktop application launcher
├── UserBot_chat.spec               <-- PyInstaller build specification
│
├── backend/                        <-- Django 5 ASGI Backend
│   ├── manage.py                   <-- Django management CLI
│   ├── requirements.txt            <-- Python dependencies
│   ├── db.sqlite3                  <-- Primary SQLite database
│   ├── backend/
│   │   ├── asgi.py                 <-- Daphne ASGI entrypoint routing HTTP and Channels WebSocket
│   │   ├── settings.py             <-- Django configuration (CORS, Channels, Media, Auth)
│   │   └── urls.py                 <-- Root URL dispatcher
│   └── telegram_chat/
│       ├── models.py               <-- Database Schema: EmployeeAccount, DeviceSession, BotAccount, TelegramUser, ChatMessage
│       ├── views.py                <-- REST API controllers (Auth, Chats, Messages, Sync, Health)
│       ├── consumers.py            <-- Django Channels WebSocket consumer (ChatConsumer)
│       ├── bot_service.py          <-- TelegramBotGateway: getUpdates sync, sendMessage, webhook dispatch
│       ├── serializers.py          <-- DRF serializers for API payloads
│       ├── urls.py                 <-- App route definitions (/api/...)
│       ├── management/commands/
│       │   └── init_test_operator.py <-- Seeds default bot operators (ahfu, bingo, mrlioma, 1234)
│       └── tests/                  <-- 118-test offline test suite
│
└── front-end/                      <-- React 19 + TypeScript + Vite SPA
    ├── package.json                <-- Frontend dependencies (lucide-react, tailwindcss, vite)
    ├── vite.config.ts              <-- Vite config with proxy to backend :8000
    └── src/
        ├── App.tsx                 <-- Root container, conditional LoginModal / NoSignalScreen / Main UI
        ├── index.css               <-- Tailwind utilities, CSS variables for themes, animations
        ├── types/
        │   ├── auth.ts             <-- BotAccount, DeviceSession, LoginCredentials interfaces
        │   ├── chat.ts             <-- Chat, Message, TelegramUser, MediaAttachment interfaces
        │   └── theme.ts            <-- Theme types ('simple-black' | 'black-gold')
        ├── contexts/
        │   ├── AuthContext.tsx     <-- Authentication state, token storage, login/logout, session tracking
        │   ├── ChatContext.tsx     <-- Active chat, messages, optimistic sending, WebSocket listener
        │   └── ThemeContext.tsx    <-- Theme switching and persistence
        ├── services/
        │   ├── api.ts              <-- Centralized HTTP client for backend REST endpoints
        │   ├── websocket.ts        <-- WebSocket reconnection manager, heartbeat, message emitter
        │   └── audioRecorder.ts    <-- MediaRecorder wrapper for voice notes
        └── components/
            ├── auth/
            │   └── LoginModal.tsx  <-- Production login screen with eye toggle
            ├── chat/
            │   ├── ChatBar.tsx     <-- Text input, voice recorder button, sticker picker trigger
            │   ├── MessageList.tsx <-- Virtualized/scrollable message thread
            │   ├── MessageBubble.tsx <-- Speech bubbles (text, media, audio waveform, status ticks)
            │   ├── VoiceMessagePlayer.tsx <-- Interactive audio player with custom canvas waveform
            │   └── StickerPicker.tsx   <-- SVG sticker catalog
            ├── layout/
            │   ├── Sidebar.tsx     <-- Conversation list, search, bot switcher, theme toggle
            │   ├── ChatArea.tsx    <-- Active chat header, call buttons, message area container
            │   └── BottomNavBar.tsx <-- Mobile navigation bar
            ├── common/
            │   ├── Avatar.tsx      <-- Telegram circular avatar with fallback colors and badges
            │   └── NoSignalScreen.tsx <-- CRT retro disconnected screen
            └── modals/
                ├── AccountModal.tsx   <-- Operator profile & multi-device session manager
                └── SettingsModal.tsx  <-- General terminal settings
```

---

## 5. Seeded Operator Accounts

These accounts are initialized via `python manage.py init_test_operator`:

| Bot Name | Telegram Handle | User ID | Password | Bot Token |
|:---|:---|:---|:---|:---|
| **ah fu** | `@Ah_fu_bot` | `ahfu` | `ahfu1234` | `9197397912:AAHC1HOhNvV-exC9uzRBsHZ6BJbmTFEoXyo` |
| **Bingo** | `@mr_Bingoobot` | `bingo` | `bingo1234` | `9273467556:AAGsimmiJEQIoiuep62Xtuw_VcXOzaHWB3U` |
| **mrlioma** | `@mrlionabot` | `mrlioma` | `mrlioma1234` | `9020018332:AAHLzQTJ04TUzqWOx5x-k8ydYRRQCOKBvQ0` |
| **Operator (Fallback)** | System Demo | `1234` | `1234` | Internal Demo Token |

---

## 6. Critical API Endpoints

| Endpoint | Method | Headers / Auth | Description |
|:---|:---:|:---|:---|
| `/api/health/` | `GET` | Public | System status, database connection, uptime check. |
| `/api/auth/login/` | `POST` | Public (`User-ID`, `password`) | Returns `{ account, token, session_id }`. |
| `/api/auth/sessions/` | `GET` | `Authorization: Bearer <token>` | Lists all active device sessions for current employee. |
| `/api/auth/sessions/<token>/` | `DELETE` | `Authorization: Bearer <token>` | Revokes a specific device session. |
| `/api/chats/` | `GET` | `Authorization: Bearer <token>`, `?sync=true` | Returns chats for the authenticated bot; triggers sync. |
| `/api/messages/` | `GET` | `Authorization: Bearer <token>`, `?chat_id=<id>` | Fetches message history for a conversation. |
| `/api/messages/send/` | `POST` | `Authorization: Bearer <token>` | Dispatches outgoing text/voice/media to Telegram & DB. |
| `/api/send_photo/` | `POST` | Public / Key-Value / JSON / Multipart | Dispatches photos to Telegram & DB (`employee_id`, `to_userid`, `file`, `Action`, `caption`). |
| `/api/telegram/webhook/` | `POST` | Telegram Secret Header | Ingests incoming Telegram updates if webhooks are configured. |
| `ws://<host>:8000/ws/chat/` | `WS` | `?token=<token>` | Real-time bi-directional message streaming. |
| `http://127.0.0.1:<local_port>/api/save_config` | `POST` | Local Desktop Only | Persists new server `api_url` and auto-derived `ws_url` to `config.json` on disk. |

---

## 7. 24/7 Server PC Hosting & Public Client Architecture

### A. Strict Two-Tier Repository Boundary
The project is strictly split into two folders:
1. **`TBOTchat-server/`** (Server Only):
   - Hosts Django + Daphne ASGI + Telegram Bot gateway 24/7 on `0.0.0.0:8000`.
   - Holds sensitive data: `db.sqlite3`, `backend/`, migrations, bot tokens, `.env`.
   - **NEVER distribute this folder or any backend files to employees.**
2. **`TBOTchat-pubilc/`** (Employee Distribution):
   - Zero-sensitive footprint. Contains no source code, no database, and no credentials.
   - Contains ONLY the packed single-file standalone client `TBOTchat.exe` (17MB), `config.json`, `Connect_Server.exe`, and `EMPLOYEE_GUIDE.txt`.

### B. Remote Connectivity (Connecting From Anywhere)
Because the server is hosted 24/7, remote operators connect across WAN/Internet:
- **Cloudflare Tunnel (Standard)**: `cloudflared tunnel --url http://127.0.0.1:8000` -> yields `https://chat.company.com`. Zero router port forwarding, free SSL, native WSS support.
- **Port Forwarding**: Router forwards external port 8000 -> Server LAN IP port 8000.
- **VPN / Tailscale**: Private mesh network linking employee devices to the server machine.
- Backend `settings.py` is pre-configured with `ALLOWED_HOSTS = ['*']` and `CORS_ALLOW_ALL_ORIGINS = True` to support remote access out of the box.

### C. Single-File Standalone Client & 1-Time Setup Flow
- **Packed Executable**: Built using `TBOTchat_onefile.spec` via PyInstaller `--onefile`. Embeds the compiled React bundle, Python runtime, and WebView2 bindings into a single portable binary (`TBOTchat.exe`). No loose `_internal/` DLL directories needed.
- **1-Time Connection Lifecycle**:
  1. On first launch on a new employee PC, if the configured server is unreachable, the retro "NO SIGNAL" screen displays an active input box immediately.
  2. Employee pastes the company server address (e.g. `https://chat.company.com` or `http://192.168.1.50:8000`) and clicks **Save & Connect**.
  3. App verifies connectivity via `/api/health/`.
  4. Local HTTP server in `desktop_app.py` catches `POST /api/save_config`, auto-derives the WebSocket protocol (`ws://` vs `wss://`), and writes the updated address to `config.json` next to the executable.
  5. The UI automatically transitions into the Login screen.
  6. On all subsequent runs, `TBOTchat.exe` connects straight to the 24/7 server without prompting.

---

## 8. ⚠️ Strict Guardrails for Future AI Agents ("DOs and DON'Ts")

To prevent bugs, performance degradations, or accidental reverts of production features, adhere strictly to these rules:

### ❌ What NEVER to Do:
1. **DO NOT leak server files or database into `TBOTchat-pubilc`**:
   - Never copy `backend/`, `db.sqlite3`, `*.env`, `manage.py`, `START_ALL.bat`, or `INIT_DATABASE.bat` to `TBOTchat-pubilc`. Employees must only have client binaries.
2. **DO NOT reintroduce demo autofill buttons or credentials to the UI**:
   - The login screen in `LoginModal.tsx` has been hardened for deployment. Do not add hardcoded "Autofill 1234" buttons or show test passwords on error screens.
3. **DO NOT add group chat creation back**:
   - Group functionality was intentionally removed to guarantee a focused 1-on-1 customer service architecture.
4. **DO NOT bypass session authentication**:
   - All protected backend APIs require validation against `DeviceSession`. Do not remove Bearer token validation or allow unauthenticated users to enumerate messages or device sessions.
5. **DO NOT leak media files in automated tests**:
   - In `backend/telegram_chat/tests/`, media operations MUST use `@override_settings(MEDIA_ROOT=temp_path)` with `tempfile.TemporaryDirectory()`. Never let test files escape into `backend/media/`.
6. **DO NOT break the eye toggle for password fields**:
   - The password field in `LoginModal.tsx` must maintain the `Eye` / `EyeOff` visibility toggle, preserving the dynamic input type and right padding (`pr-11`) so text never clips under the toggle button.
7. **DO NOT use external network calls in backend unit tests**:
   - The test suite must remain 100% offline and fast, using `unittest.mock` for Telegram Bot API calls.

### ✅ What ALWAYS to Do:
1. **Always verify the frontend build before finishing**:
   ```bash
   npm --prefix front-end run build
   ```
   Ensures TypeScript compiles with 0 errors (`tsc -b`) and Vite production bundle generates cleanly.
2. **Always verify the backend test suite after backend edits**:
   ```bash
   cd backend
   python manage.py test telegram_chat.tests
   ```
   All 118 automated tests must pass with 0 failures and 0 errors.
3. **Rebuilding the single-file client**:
   When updating the desktop client, always use the onefile spec:
   ```bash
   backend\venv\Scripts\python.exe -m PyInstaller --noconfirm TBOTchat_onefile.spec
   ```
   And copy the output `dist/TBOTchat.exe` to `TBOTchat-pubilc/`.
4. **Preserve theme variable compatibility**:
   - Always style new components using either the established Tailwind classes or CSS variables (`var(--color-bg-base)`, `var(--color-accent)`, etc.) so they render seamlessly in both `simple-black` and `black-gold` themes.

---

## 9. Common Developer Commands

```bash
# Start everything with one script (Windows):
START_ALL.bat

# Stop all background servers (ports 8000 & 5173):
STOP_ALL.bat

# Run Backend manually:
cd backend
.\venv\Scripts\activate
python manage.py migrate
python manage.py runserver 0.0.0.0:8000

# Run Frontend manually:
cd front-end
npm run dev

# Run Automated Test Suite:
cd backend
python manage.py test telegram_chat.tests
```
