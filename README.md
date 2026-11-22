# 💬 Telegram Web Customer Chat & Bot Management System

A self-hosted, multi-device web chat platform connecting directly to company Telegram bots. Employees log in to the web interface as dedicated bots, auto-sync conversations in real time, and chat directly with company clients on Telegram.

> 🤖 **Working with an AI Coding Assistant?** Please consult [AI_README.md](file:///c:/Users/linda/Documents/project/Telegramplugin-front/AI_README.md) for full architectural guidelines, component boundaries, and strict non-regression rules.

---

## ⚡ 1-Click Fast Host (Backend + Frontend + Database)

Simply double-click the one-click launcher in the project root:

- **`START_ALL.bat`** (or **`HOST_ALL.bat`**):
  - Automatically verifies and migrates the SQLite Database (`manage.py migrate`)
  - Automatically seeds and verifies all demo bot accounts (`manage.py init_test_operator`)
  - Automatically starts the **Django / Daphne Backend ASGI Server** on `0.0.0.0:8000`
  - Automatically starts the **React Vite Frontend Web Client** on `0.0.0.0:5173`
  - Automatically opens `http://localhost:5173` in your default browser
  - Displays your machine's **LAN Network IP** so other PCs or phones on the network can connect immediately
- **`STOP_ALL.bat`**: Double-click to instantly terminate all running backend and frontend server processes on ports 8000 & 5173.
- **`START_ALL_WITH_DESKTOP.bat`**: Starts the full stack AND launches the `UserBot_chat` desktop window.

*(PowerShell users can alternatively run `./start_all.ps1` and `./stop_all.ps1`, or `npm start`)*

---

## ⚡ Standalone Windows Desktop App (`UserBot_chat`)

The application is completely packaged into a self-contained folder ready to run:

📁 **`UserBot_chat/`** (located in the project root and in `dist/UserBot_chat/`)
- **`UserBot_chat.exe`**: Double-click to launch the native desktop client.
- **Auto-Connect & Health Detection**:
  - Automatically probes the server & SQLite/PostgreSQL database at startup.
  - If the server/DB is hosted and active, the app automatically connects and displays the Login screen.
  - If the server/DB is NOT being hosted, the app displays a retro **"NO SIGNAL"** screen with real-time radar, auto-reconnecting every 4 seconds as soon as the server is brought online.
  - Allows editing the server host URL (e.g. `http://192.168.x.x:8000`) on the fly.
- **`START_SERVER.bat`**: One-click script to start the local backend server & database host.
- **`config.json`**: Easily configure the remote or local API/WebSocket endpoint.

---

## ✨ AI Conversation Summarizer & Security Layer

- **AI Chat Summary**: Click the **Summarize** button (`Sparkles` icon) in any active chat header to generate an instant executive summary of the client's questions, discussion points, and resolution status, with 1-click **Copy** or **Post as Note** into your private Saved Messages room.
- **Enterprise Security Hardening**:
  - Transparent PBKDF2 password hashing & auto-upgrade (`_verify_and_upgrade_password`)
  - Media upload sanitization with strict extension whitelist & 25MB limit
  - Telegram Webhook secret token validation (`X-Telegram-Bot-Api-Secret-Token`)
  - Login brute-force sliding rate-limiter (15 attempts/60s returning HTTP 429)
  - PyWebView local path traversal protection
  - Untracked database and environment credentials from git

---

## 🚀 Quick Start (Local Machine)

### Prerequisites
- **Python 3.12+**
- **Node.js 18+** & npm

---

### Step 1: Start the Backend (Django + Channels)
Open a terminal in the root folder:

```bash
cd backend

# 1. Activate Python virtual environment (if not already active)
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 2. Run database migrations
python manage.py migrate

# 3. Seed bot accounts & employee profiles
python manage.py init_test_operator

# 4. Start the ASGI / Django server
python manage.py runserver 0.0.0.0:8000
```
> The backend server runs at `http://127.0.0.1:8000` with WebSocket support at `ws://127.0.0.1:8000/ws/chat/`.

---

### Step 2: Start the Frontend (React + Vite)
Open a second terminal in the root folder:

```bash
cd front-end

# 1. Install dependencies (first time only)
npm install

# 2. Start the Vite development server
npm run dev
```
> The frontend web client will be live at `http://localhost:5173`.

---

## 🔑 Demo Accounts & Telegram Bots

You can log in immediately using any of the 3 configured bot operator accounts:

| Bot Name | Telegram Handle | Web User ID | Password | Notes |
|:---|:---|:---|:---|:---|
| **ah fu** | `@Ah_fu_bot` | `ahfu` | `ahfu1234` | Dedicated bot chats & saved notes |
| **Bingo** | `@mr_Bingoobot` | `bingo` | `bingo1234` | Dedicated bot chats & saved notes |
| **mrlioma** | `@mrlionabot` | `mrlioma` | `mrlioma1234` | Dedicated bot chats & saved notes |

*(Fallback operator `1234` / `1234` is also seeded for backwards-compatible testing)*

---

## 🌟 Core Features

1. **Telegram Bot Auto-Fetching & Live Sync**
   - Automatically polls updates on login and chat list load (`/api/chats/?sync=true`).
   - Bi-directional text, photo, video, and audio messaging.
   - Clean, natural chatting without robotic placeholder captions.

2. **Account Chat Isolation**
   - Each bot operator only sees conversations that occurred with **their specific Telegram bot**.
   - No data leak between accounts.

3. **Private "Saved Messages" Per Bot**
   - Every bot has its own pinned **Saved Messages** cloud storage for private notes, files, or saved client messages.
   - Never visible to any other operator account.

4. **Multi-Device Concurrent Logins**
   - Employees can be logged into the same bot from desktop, tablet, and mobile simultaneously.
   - Independent session tokens with active session tracking (`/api/auth/sessions/`).

5. **Modern Telegram UI & Audio Engine**
   - High-fidelity dark mode & black-gold theme.
   - Cross-browser microphone voice recorder with interactive audio waveforms.
   - Clean categorized Emoji drawer.
   - Group creation feature completely removed for a focused 1-on-1 customer service experience.

---

## 📂 Project Directory Structure

```text
Telegramplugin-front/
├── backend/
│   ├── backend/               # Django core settings, asgi, wsgi, urls
│   ├── telegram_chat/         # Core chat application
│   │   ├── migrations/        # Database schema migrations
│   │   ├── management/        # Seeding command (init_test_operator)
│   │   ├── tests/             # 118-test offline mock automated test suite
│   │   ├── models.py          # EmployeeAccount, DeviceSession, BotAccount, etc.
│   │   ├── views.py           # REST API endpoints (Auth, Chats, Sync, Sessions)
│   │   ├── bot_service.py     # Telegram Bot Gateway & sync logic
│   │   ├── consumers.py       # WebSocket streaming consumer
│   │   └── urls.py            # API routes
│   ├── media/                 # Bot avatars and uploaded media
│   ├── .env.example           # Example environment template
│   ├── manage.py              # Django management CLI
│   └── requirements.txt       # Python dependencies
│
├── front-end/
│   ├── src/
│   │   ├── components/        # ChatArea, Sidebar, MessageBubble, EmojiPicker
│   │   ├── contexts/          # AuthContext, ChatContext, ThemeContext
│   │   ├── services/          # API client, WebSocket manager, audioRecorder
│   │   ├── types/             # TypeScript interfaces
│   │   └── index.css          # Modern Tailwind styling & animations
│   ├── package.json           # Frontend dependencies
│   └── vite.config.ts         # Vite build configuration
│
├── APP_EXPLANATION.txt        # Deep technical architecture manual
└── README.md                  # This operations guide
```

---

## 🧪 Running Automated Tests

Run the full offline test suite (118 tests covering multi-device sessions, authentication, Telegram sync, and WebSocket events with zero network dependencies):

```bash
cd backend
python manage.py test telegram_chat.tests
```
