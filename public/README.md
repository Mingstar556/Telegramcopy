# TBOT Chat - Public Employee Client Package

This directory contains the public distribution package intended for company employees. It contains **zero backend code, zero database files, zero bot tokens, and zero administrative scripts**.

## 🚀 How to Run

1. **Native Desktop Client**:
   - Double-click `TBOTchat.exe` or run `START_CLIENT.bat`.
2. **Server Connection Setup**:
   - Run `CONNECT_SERVER.bat` to test and configure the backend server IP/URL.
3. **Web Browser Mode**:
   - Double-click `START_WEB_CLIENT.bat` to run the client inside Google Chrome or Microsoft Edge.

## ⚙️ Configuration (`config.json`)
```json
{
  "api_url": "http://127.0.0.1:8000",
  "ws_url": "ws://127.0.0.1:8000/ws/chat/",
  "window_title": "TBOT Chat",
  "window_width": 1280,
  "window_height": 840
}
```
