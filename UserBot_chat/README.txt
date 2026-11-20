========================================================================
                     USERBOT CHAT DESKTOP APP
========================================================================

Welcome to UserBot Chat!
This is a self-hosted desktop client that connects directly to your
company Telegram bots, operator accounts, and customers in real-time.

------------------------------------------------------------------------
[ QUICK START GUIDE ]
------------------------------------------------------------------------

1. LAUNCH THE DESKTOP APP:
   Double-click "UserBot_chat.exe" to open the application.

2. AUTO-CONNECT BEHAVIOR:
   - When launched, the app automatically checks connectivity to the
     backend server and database at the configured host address
     (Default: http://127.0.0.1:8000).

   - IF THE SERVER & DATABASE ARE HOSTED:
     The app auto-connects immediately and opens the Login screen.
     You can log in with any configured bot operator account:

     Account 1:  User ID: ahfu     | Password:  ahfu1234
     Account 2:  User ID: bingo    | Password:  bingo1234
     Account 3:  User ID: mrlioma  | Password:  mrlioma1234
     Fallback:   User ID: 1234     | Password:  1234

   - IF THE SERVER IS NOT BEING HOSTED:
     The app displays a retro "NO SIGNAL" screen with real-time radar,
     showing that the server or database is unreachable.
     
     * It will continuously auto-probe the host every 4 seconds.
     * The moment you host or start the server, the app detects it
       and automatically connects without needing to restart!
     * You can also click "Launch Offline Demo Mode" to explore the
       UI offline without a server.

------------------------------------------------------------------------
[ HOW TO HOST THE SERVER LOCALLY ]
------------------------------------------------------------------------

If you want to host the server on this machine:
1. Double-click "START_SERVER.bat" in this folder.
2. The server will start on http://127.0.0.1:8000.
3. Your "UserBot_chat.exe" window will immediately detect the signal
   and connect within 4 seconds!
4. To stop the server at any time, run "STOP_SERVER.bat".

------------------------------------------------------------------------
[ CONNECTING TO A REMOTE HOSTED SERVER ]
------------------------------------------------------------------------

If your server is hosted on another computer, local network IP, or VPS:
1. Open "config.json" in this folder with Notepad.
2. Change "api_url" and "ws_url" to your server's address:
   Example:
   {
     "api_url": "http://192.168.1.100:8000",
     "ws_url": "ws://192.168.1.100:8000/ws/chat/"
   }
3. Save the file and open "UserBot_chat.exe".
   (You can also change the host IP directly from the "NO SIGNAL" screen
    by clicking "Change" next to Target Host!)

------------------------------------------------------------------------
[ FILE OVERVIEW ]
------------------------------------------------------------------------

- UserBot_chat.exe   : The main desktop application executable.
- config.json        : Host URL and window settings.
- START_SERVER.bat   : One-click launcher for the local backend server.
- STOP_SERVER.bat    : One-click script to stop the local server.
- INIT_DATABASE.bat  : Seeds or resets demo bot accounts in db.sqlite3.
- backend/           : Python ASGI backend & SQLite database.
- dist/              : Client frontend web assets.
- _internal/         : Embedded runtimes and native webview components.

========================================================================
