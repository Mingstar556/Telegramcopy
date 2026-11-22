"""
================================================================================
          TELEGRAM BOT ACCOUNT GENERATOR FOR WEB OPERATOR PORTAL
================================================================================
Administrative tool to automatically generate web operator user accounts for
given Telegram bot keys (tokens).
- Probes Telegram Bot API getMe for real bot name, username, and profile photo
- Generates unique employee User-ID and secure password
- Creates EmployeeAccount & BotAccount records directly in SQLite database
- Exports credentials to formatted TXT and CSV for easy distribution to staff
"""

import os
import sys
import re
import csv
import secrets
import argparse
import datetime
from typing import List, Dict, Any, Optional

# Setup Django Environment
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, 'backend')
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

try:
    import django
    django.setup()
    from django.contrib.auth.hashers import make_password
    from telegram_chat.models import EmployeeAccount, BotAccount
    from telegram_chat.security import mask_sensitive_token
    import requests
except ImportError as e:
    print(f"[!] Error loading Django or dependencies: {e}")
    print("[!] Ensure you run this with the virtual environment:")
    print("    .\\backend\\venv\\Scripts\\python.exe batch_account_generator.py")
    sys.exit(1)


def probe_telegram_bot(token: str) -> Dict[str, Any]:
    """Verify bot token with Telegram getMe and retrieve name, username, and photo."""
    bot_id = token.split(":", 1)[0] if ":" in token else ""
    info = {
        "bot_id": bot_id,
        "first_name": f"Bot {bot_id or 'Operator'}",
        "username": f"bot_{bot_id or 'operator'}",
        "avatar_url": "",
        "verified": False,
        "error": None
    }

    try:
        url = f"https://api.telegram.org/bot{token}/getMe"
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and isinstance(data.get('result'), dict):
                r = data['result']
                info["first_name"] = r.get('first_name') or info["first_name"]
                info["username"] = r.get('username') or info["username"]
                info["verified"] = True

                # Try fetching avatar
                try:
                    photos_url = f"https://api.telegram.org/bot{token}/getUserProfilePhotos?user_id={bot_id}&limit=1"
                    p_resp = requests.get(photos_url, timeout=4)
                    if p_resp.status_code == 200:
                        p_data = p_resp.json()
                        photos = p_data.get('result', {}).get('photos', [])
                        if photos and photos[0]:
                            file_id = photos[0][-1].get('file_id')
                            if file_id:
                                f_resp = requests.get(f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}", timeout=4)
                                if f_resp.status_code == 200 and f_resp.json().get('ok'):
                                    file_path = f_resp.json()['result'].get('file_path')
                                    if file_path:
                                        info["avatar_url"] = f"https://api.telegram.org/file/bot{token}/{file_path}"
                except Exception:
                    pass
        else:
            info["error"] = f"Telegram HTTP {resp.status_code}"
    except Exception as e:
        info["error"] = str(e)[:60]

    return info


def generate_accounts(
    tokens: List[str],
    id_prefix: str = "auto",
    password_type: str = "memorable",
    custom_password: str = "",
    overwrite: bool = True
) -> List[Dict[str, Any]]:
    """Process a list of tokens and create corresponding web operator accounts."""
    results = []

    for index, raw_token in enumerate(tokens, start=1):
        token = raw_token.strip()
        if not token:
            continue

        print(f"[*] Processing Token #{index} ({mask_sensitive_token(token)})...", end=" ", flush=True)

        tg_info = probe_telegram_bot(token)
        if tg_info["verified"]:
            print(f"[VERIFIED: @{tg_info['username']}]")
        else:
            print(f"[OFFLINE/FALLBACK: {tg_info.get('error') or 'Unreachable'}]")

        # Determine user_id
        if id_prefix == "auto":
            clean_username = re.sub(r'[^a-zA-Z0-9_]', '', tg_info['username'].lower())
            candidate_id = clean_username or f"bot_{tg_info['bot_id'] or index}"
        elif id_prefix.endswith("_") or id_prefix.endswith("-"):
            candidate_id = f"{id_prefix}{index}"
        else:
            candidate_id = f"{id_prefix}_{index}"

        user_id = candidate_id
        suffix_num = 1
        while not overwrite and EmployeeAccount.objects.filter(user_id=user_id).exists():
            user_id = f"{candidate_id}_{suffix_num}"
            suffix_num += 1

        # Determine password
        if password_type == "custom" and custom_password:
            raw_password = custom_password
        elif password_type == "random":
            raw_password = secrets.token_urlsafe(9)
        else:
            # Memorable 4-digit code e.g. BotPass_8421
            raw_password = f"BotPass_{secrets.randbelow(9000) + 1000}"

        password_hash = make_password(raw_password)

        # Database upsert
        emp, emp_created = EmployeeAccount.objects.update_or_create(
            user_id=user_id,
            defaults={
                'username': tg_info['first_name'],
                'password': password_hash,
                'avatar': tg_info['avatar_url'] or "",
                'role': 'operator',
                'is_active': True
            }
        )

        bot, bot_created = BotAccount.objects.update_or_create(
            user_id=user_id,
            defaults={
                'employee': emp,
                'password': password_hash,
                'bot_name': tg_info['first_name'],
                'bot_username': tg_info['username'],
                'bot_token': token,
                'avatar': tg_info['avatar_url'] or "",
                'description': f"Automated Web Operator linked to Telegram @{tg_info['username']}"
            }
        )

        results.append({
            "index": index,
            "user_id": user_id,
            "password": raw_password,
            "bot_name": tg_info['first_name'],
            "bot_username": tg_info['username'],
            "bot_token": token,
            "bot_token_masked": mask_sensitive_token(token),
            "status": "CREATED" if emp_created else "UPDATED",
            "verified": "YES" if tg_info["verified"] else "NO"
        })

    return results


def export_files(accounts: List[Dict[str, Any]]) -> Dict[str, str]:
    """Export credentials to TXT and CSV files for distribution."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    txt_filename = f"generated_accounts_{timestamp}.txt"
    csv_filename = f"generated_accounts_{timestamp}.csv"

    txt_path = os.path.join(BASE_DIR, txt_filename)
    csv_path = os.path.join(BASE_DIR, csv_filename)

    # 1. Write TXT
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write("=" * 75 + "\n")
        f.write("             TELEGRAM WEB OPERATOR ACCOUNTS - CREDENTIAL LIST\n")
        f.write(f" Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f" Total Accounts: {len(accounts)}\n")
        f.write("=" * 75 + "\n\n")

        for acc in accounts:
            f.write(f"Account #{acc['index']}:\n")
            f.write(f"  * Web User-ID : {acc['user_id']}\n")
            f.write(f"  * Web Password: {acc['password']}\n")
            f.write(f"  * Bot Name    : {acc['bot_name']}\n")
            f.write(f"  * Bot Username: @{acc['bot_username']}\n")
            f.write(f"  * Telegram Key: {acc['bot_token']}\n")
            f.write(f"  * Verified    : {acc['verified']}\n")
            f.write("-" * 50 + "\n")

    # 2. Write CSV
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Index", "User-ID", "Password", "Bot Name", "Bot Username", "Telegram Bot Key", "Status", "Verified"])
        for acc in accounts:
            writer.writerow([
                acc["index"],
                acc["user_id"],
                acc["password"],
                acc["bot_name"],
                acc["bot_username"],
                acc["bot_token"],
                acc["status"],
                acc["verified"]
            ])

    return {"txt": txt_path, "csv": csv_path}


def main():
    parser = argparse.ArgumentParser(description="Generate web operator accounts from Telegram bot keys.")
    parser.add_argument('--count', type=int, help="Number of bot keys you want to configure.")
    parser.add_argument('--tokens', type=str, help="Comma-separated or newline-separated bot tokens.")
    parser.add_argument('--file', type=str, help="Path to text file containing bot tokens (one per line).")
    parser.add_argument('--prefix', type=str, default="auto", help="User-ID prefix ('auto' uses bot username, or e.g. 'op_').")
    parser.add_argument('--password-type', choices=['memorable', 'random', 'custom'], default='memorable', help="Password generation style.")
    parser.add_argument('--custom-password', type=str, default="", help="Custom password if password-type=custom.")

    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("      TELEGRAM WEB OPERATOR ACCOUNT GENERATOR (ADMIN TOOL)")
    print("=" * 70)

    tokens = []

    # Priority 1: CLI File
    if args.file and os.path.exists(args.file):
        with open(args.file, 'r', encoding='utf-8') as f:
            tokens = [line.strip() for line in f if line.strip() and not line.strip().startswith('#')]
        print(f"[+] Loaded {len(tokens)} token(s) from file: {args.file}")

    # Priority 2: CLI Tokens String
    elif args.tokens:
        tokens = [t.strip() for t in re.split(r'[,;\n]+', args.tokens) if t.strip()]
        print(f"[+] Loaded {len(tokens)} token(s) from arguments.")

    # Priority 3: Interactive Prompt
    else:
        print("\nHow many Telegram-Bot keys do you have?")
        try:
            count_input = input("Enter count [e.g. 1, 3, 5] (or press Enter to paste keys directly): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(0)

        num_keys = 0
        if count_input.isdigit():
            num_keys = int(count_input)

        print("\nPlease paste your Telegram Bot token(s):")
        print("  - One token per line (format: 123456789:AAH...)")
        print("  - When done, press Enter on an empty line.")
        print("-" * 50)

        while True:
            try:
                line = input(f"Key #{len(tokens) + 1}: " if num_keys and len(tokens) < num_keys else "Key (or Enter to finish): ").strip()
                if not line:
                    if num_keys and len(tokens) < num_keys:
                        # User pressed enter early
                        confirm = input(f"You entered {len(tokens)} of {num_keys} keys. Finish now? [y/N]: ").strip().lower()
                        if confirm == 'y':
                            break
                        continue
                    break
                tokens.append(line)
                if num_keys and len(tokens) >= num_keys:
                    break
            except (KeyboardInterrupt, EOFError):
                break

    if not tokens:
        print("[!] No tokens entered. Exiting.")
        sys.exit(0)

    print(f"\n[*] Starting account generation for {len(tokens)} Telegram bot key(s)...")
    print("-" * 70)

    accounts = generate_accounts(
        tokens=tokens,
        id_prefix=args.prefix,
        password_type=args.password_type,
        custom_password=args.custom_password
    )

    if not accounts:
        print("[!] No accounts generated.")
        sys.exit(1)

    print("\n" + "=" * 80)
    print("                      GENERATED WEB OPERATOR ACCOUNTS")
    print("=" * 80)
    header = f"{'No':<4} | {'User-ID':<16} | {'Password':<14} | {'Bot Name':<18} | {'Username':<16} | {'Status':<7}"
    print(header)
    print("-" * len(header))

    for a in accounts:
        print(f"{a['index']:<4} | {a['user_id']:<16} | {a['password']:<14} | {a['bot_name'][:18]:<18} | {'@' + a['bot_username'][:15]:<16} | {a['status']:<7}")

    print("=" * 80)

    # Export to files
    export_res = export_files(accounts)
    print(f"\n[+] Credentials exported to files:")
    print(f"    * Text File: {export_res['txt']}")
    print(f"    * CSV File : {export_res['csv']}")
    print("\n[✓] Web operators can now log into the web app using their User-ID and Password!")
    print("    Server URL: http://127.0.0.1:8000 (or your configured server domain)")


if __name__ == '__main__':
    main()
