import os
import sys
import json
import urllib.request
import urllib.error
import subprocess
import time

def get_base_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))

def get_config_path():
    return os.path.join(get_base_dir(), 'config.json')

def load_config():
    config_path = get_config_path()
    default_config = {
        "api_url": "http://127.0.0.1:8000",
        "ws_url": "ws://127.0.0.1:8000/ws/chat/",
        "window_title": "TBOT Chat",
        "window_width": 1280,
        "window_height": 840
    }
    if not os.path.exists(config_path):
        return default_config
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
            return {**default_config, **cfg}
    except Exception:
        return default_config

def save_config(config):
    config_path = get_config_path()
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)

def normalize_urls(raw_input):
    raw = raw_input.strip()
    if not raw:
        return None, None

    # Auto prefix protocol
    if not raw.startswith('http://') and not raw.startswith('https://'):
        has_port = ':' in raw
        # If domain name without explicit port, default to HTTPS / 443 standard
        import re
        is_ip_or_local = raw.startswith('localhost') or bool(re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', raw))
        if not has_port and not is_ip_or_local and '.' in raw:
            raw = f"https://{raw}"
        elif not has_port:
            raw = f"http://{raw}:8000"
        else:
            raw = f"http://{raw}"

    # Strip trailing slash
    api_url = raw.rstrip('/')

    # Derive WebSocket URL
    if api_url.startswith('https://'):
        ws_url = "wss://" + api_url[8:] + "/ws/chat/"
    else:
        ws_url = "ws://" + api_url[7:] + "/ws/chat/"

    return api_url, ws_url

def test_connection(api_url):
    health_endpoint = f"{api_url}/api/health/"
    print(f"\n[*] Testing connection to: {health_endpoint} ...")
    try:
        req = urllib.request.Request(
            health_endpoint,
            headers={"User-Agent": "TBOT-ConnectionTool/1.0"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            status_code = response.getcode()
            body = response.read().decode('utf-8', errors='ignore')
            try:
                data = json.loads(body)
            except Exception:
                data = {}

            if status_code == 200 and data.get("status") == "ok":
                db_status = data.get("database", "ok")
                return True, f"Server online! (Database: {db_status})"
            elif status_code == 200:
                return True, f"Server replied: {data.get('message', 'Online')}"
            else:
                return False, f"Server returned HTTP {status_code}"
    except urllib.error.URLError as e:
        return False, f"Connection failed: {e.reason}"
    except Exception as e:
        return False, f"Error: {e}"

def launch_app():
    base_dir = get_base_dir()
    for candidate in ["TBOTchat.exe", "UserBot_chat.exe"]:
        exe_path = os.path.join(base_dir, candidate)
        if os.path.exists(exe_path):
            print(f"\n[+] Launching {candidate}...")
            subprocess.Popen([exe_path], cwd=base_dir)
            return True
    print("\n[-] Could not locate TBOTchat.exe or UserBot_chat.exe in this directory.")
    return False

def main():
    print("=" * 60)
    print("       TBOT CHAT - SERVER CONNECTION CONFIGURATION TOOL")
    print("=" * 60)

    config = load_config()
    current_api = config.get("api_url", "http://127.0.0.1:8000")

    print(f"\nCurrent configured server: {current_api}")

    # Check if passed via command line argument
    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        print("\nEnter server IP address or domain:")
        print("  - Example LAN:    192.168.1.100")
        print("  - Example Port:   192.168.1.100:8000")
        print("  - Example URL:    http://192.168.1.100:8000")
        print(f"  - Press [Enter] to keep current ({current_api})")
        target = input("\nServer address > ").strip()

    if not target:
        api_url = current_api
        ws_url = config.get("ws_url", "ws://127.0.0.1:8000/ws/chat/")
    else:
        api_url, ws_url = normalize_urls(target)

    success, msg = test_connection(api_url)

    if success:
        print(f"\n[SUCCESS] {msg}")
        config["api_url"] = api_url
        config["ws_url"] = ws_url
        save_config(config)
        print("[+] config.json updated successfully!")
    else:
        print(f"\n[WARNING] {msg}")
        save_anyway = input("\nSave this address to config.json anyway? [y/N] > ").strip().lower()
        if save_anyway in ('y', 'yes'):
            config["api_url"] = api_url
            config["ws_url"] = ws_url
            save_config(config)
            print("[+] config.json updated.")
        else:
            print("[-] Configuration not changed.")

    run_now = input("\nLaunch TBOT Chat now? [Y/n] > ").strip().lower()
    if run_now in ('', 'y', 'yes'):
        launch_app()
    else:
        print("Exiting. You can launch TBOTchat.exe whenever ready.")
        time.sleep(1)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
