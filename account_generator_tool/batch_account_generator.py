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

# Setup Dynamic Django Environment Path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
candidate_paths = [
    os.path.join(BASE_DIR, 'backend'),
    os.path.join(BASE_DIR, '..', 'TBOTchat-server', 'backend'),
    os.path.join(BASE_DIR, '..', 'backend'),
]
BACKEND_DIR = next((p for p in candidate_paths if os.path.isdir(p)), os.path.join(BASE_DIR, 'backend'))

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
        "avatar": "",
        "verified": False,
        "error": None
    }

    try:
        url = f"https://api.telegram.org/bot{token}/getMe"
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and isinstance(data.get("result"), dict):
                res = data["result"]
                info["first_name"] = res.get("first_name") or info["first_name"]
                info["username"] = res.get("username") or info["username"]
                info["verified"] = True

                # Retrieve profile photo if available
                try:
                    p_url = f"https://api.telegram.org/bot{token}/getUserProfilePhotos"
                    p_resp = requests.get(p_url, params={"limit": 1}, timeout=3)
                    if p_resp.status_code == 200:
                        p_data = p_resp.json()
                        photos = p_data.get("result", {}).get("photos", [])
                        if photos and isinstance(photos[0], list) and photos[0]:
                            file_id = photos[0][-1].get("file_id")
                            if file_id:
                                f_url = f"https://api.telegram.org/bot{token}/getFile"
                                f_resp = requests.get(f_url, params={"file_id": file_id}, timeout=3)
                                f_path = f_resp.json().get("result", {}).get("file_path")
                                if f_path:
                                    info["avatar"] = f"https://api.telegram.org/file/bot{token}/{f_path}"
                except Exception:
                    pass
        else:
            info["error"] = f"HTTP {resp.status_code}"
    except Exception as e:
        info["error"] = str(e)

    return info


def generate_memorable_password() -> str:
    """Generate clean, memorable password format: Word_Number (e.g., Tiger_9482)"""
    adjectives = ["Fast", "Swift", "Bright", "Grand", "Super", "Alpha", "Hyper", "Prime", "Ultra", "Elite"]
    nouns = ["Tiger", "Falcon", "Eagle", "Nova", "Pulse", "Storm", "Apex", "Orbit", "Shield", "Vanguard"]
    adj = secrets.choice(adjectives)
    noun = secrets.choice(nouns)
    digits = f"{secrets.randbelow(9000) + 1000}"
    return f"{adj}{noun}_{digits}"


def generate_random_password(length: int = 14) -> str:
    """Generate high-entropy random password with alphanumeric and punctuation characters."""
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_accounts_for_tokens(
    tokens: List[str],
    id_prefix: str = "auto",
    password_type: str = "memorable",
    custom_password: Optional[str] = None,
    overwrite_existing: bool = True
) -> List[Dict[str, Any]]:
    """Process a list of bot tokens and insert/update web operator accounts."""
    results = []
    used_user_ids = set(EmployeeAccount.objects.values_list('user_id', flat=True))

    for idx, raw_token in enumerate(tokens, start=1):
        clean_token = raw_token.strip()
        if not clean_token:
            continue

        # Probe bot details via Telegram Bot API
        probe = probe_telegram_bot(clean_token)
        bot_id = probe["bot_id"] or f"{idx}"
        bot_username = probe["username"]
        bot_name = probe["first_name"]
        avatar = probe["avatar"]

        # Determine unique User-ID
        if id_prefix == "auto":
            candidate_id = re.sub(r'[^a-zA-Z0-9_-]', '', bot_username.lower())
            if not candidate_id or len(candidate_id) < 3:
                candidate_id = f"op_{bot_id}"
        else:
            candidate_id = f"{id_prefix}_{idx}"

        user_id = candidate_id
        counter = 1
        while user_id in used_user_ids and not overwrite_existing:
            user_id = f"{candidate_id}_{counter}"
            counter += 1
        used_user_ids.add(user_id)

        # Determine password
        if password_type == "custom" and custom_password:
            raw_password = custom_password
        elif password_type == "random":
            raw_password = generate_random_password()
        else:
            raw_password = generate_memorable_password()

        hashed_password = make_password(raw_password)

        # Upsert EmployeeAccount & BotAccount
        employee, created = EmployeeAccount.objects.update_or_create(
            user_id=user_id,
            defaults={
                "username": bot_name,
                "password": hashed_password,
                "role": "agent",
                "is_active": True,
                "avatar": avatar or None
            }
        )

        bot_acc, b_created = BotAccount.objects.update_or_create(
            user_id=user_id,
            defaults={
                "employee": employee,
                "bot_name": bot_name,
                "bot_username": bot_username,
                "bot_token": clean_token,
                "password": hashed_password,
                "avatar": avatar or None,
                "description": f"Automated Web Operator linked to @{bot_username}"
            }
        )

        results.append({
            "index": idx,
            "user_id": user_id,
            "password": raw_password,
            "bot_name": bot_name,
            "bot_username": f"@{bot_username}",
            "bot_token": clean_token,
            "bot_token_masked": mask_sensitive_token(clean_token),
            "status": "Created" if created else "Updated",
            "telegram_verified": probe["verified"]
        })

    return results


def export_results_to_files(results: List[Dict[str, Any]], out_dir: str = ".") -> Dict[str, str]:
    """Save generated account credentials to timestamped TXT and CSV files."""
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    txt_path = os.path.join(out_dir, f"generated_accounts_{ts}.txt")
    csv_path = os.path.join(out_dir, f"generated_accounts_{ts}.csv")

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write("        TBOTCHAT WEB OPERATOR ACCOUNTS - CREDENTIALS SHEET\n")
        f.write(f"        Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 80 + "\n\n")

        for r in results:
            f.write(f"[{r['index']}] {r['bot_name']} ({r['bot_username']})\n")
            f.write(f"    User-ID : {r['user_id']}\n")
            f.write(f"    Password: {r['password']}\n")
            f.write(f"    Token   : {r['bot_token_masked']}\n")
            f.write(f"    Verified: {'YES [Telegram Verified]' if r['telegram_verified'] else 'NO (Offline/Fallback)'}\n")
            f.write("-" * 80 + "\n")

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Index", "User-ID", "Password", "Bot Name", "Bot Username", "Token Masked", "Telegram Verified"])
        for r in results:
            writer.writerow([
                r["index"],
                r["user_id"],
                r["password"],
                r["bot_name"],
                r["bot_username"],
                r["bot_token_masked"],
                r["telegram_verified"]
            ])

    return {"txt": txt_path, "csv": csv_path}


def interactive_prompt() -> None:
    """Friendly interactive CLI wizard."""
    print("=" * 72)
    print("     TBOTCHAT AUTOMATIC BOT ACCOUNT GENERATOR WIZARD")
    print("=" * 72)
    print("This utility converts your Telegram Bot Tokens into ready-to-login")
    print("web operator accounts for the customer service dashboard.\n")

    print("How would you like to provide the bot tokens?")
    print("  [1] Enter token count, then paste each token one by one")
    print("  [2] Bulk paste all tokens (empty line to finish)")
    print("  [3] Load tokens from a file")

    mode = input("\nSelect option [1/2/3] (default 1): ").strip() or "1"
    tokens = []

    if mode == "1":
        count_str = input("How many bot keys do you have? ").strip()
        try:
            count = max(1, int(count_str))
        except ValueError:
            count = 1
        print(f"\nPlease enter your {count} Telegram Bot Token(s):")
        for i in range(count):
            t = input(f"  Token {i+1}/{count}: ").strip()
            if t:
                tokens.append(t)
    elif mode == "2":
        print("Paste your tokens below (one per line, finish with empty line):")
        while True:
            line = input().strip()
            if not line:
                break
            tokens.append(line)
    elif mode == "3":
        filepath = input("Enter path to file with tokens: ").strip()
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                tokens = [line.strip() for line in f if line.strip()]
        else:
            print(f"[!] File not found: {filepath}")
            return

    if not tokens:
        print("[!] No tokens entered. Exiting.")
        return

    print(f"\n[+] Loaded {len(tokens)} token(s). Processing...")
    results = generate_accounts_for_tokens(tokens)

    # Print Summary Table
    print("\n" + "=" * 80)
    print(f"{'User-ID':<20} | {'Password':<18} | {'Bot Name':<20} | Status")
    print("-" * 80)
    for r in results:
        status = "Verified" if r['telegram_verified'] else "Offline"
        print(f"{r['user_id']:<20} | {r['password']:<18} | {r['bot_name'][:18]:<20} | {status}")
    print("=" * 80)

    # Export to files
    out = export_results_to_files(results, out_dir=BASE_DIR)
    print(f"\n[+] Credentials successfully exported to:")
    print(f"    - TXT: {out['txt']}")
    print(f"    - CSV: {out['csv']}")
    print("\n[+] Operators can now immediately log in with these User-IDs and Passwords!")


def main():
    parser = argparse.ArgumentParser(description="TBOTchat Automatic Bot Account Generator")
    parser.add_argument("--tokens", nargs="+", help="One or more bot tokens separated by space")
    parser.add_argument("--file", help="Path to text file containing tokens")
    parser.add_argument("--prefix", default="auto", help="ID prefix: 'auto' or custom e.g. 'op'")
    parser.add_argument("--password-type", default="memorable", choices=["memorable", "random", "custom"])
    parser.add_argument("--custom-password", help="Custom password if password-type is custom")
    parser.add_argument("--out", default=".", help="Directory to export output files")

    args = parser.parse_args()

    if args.tokens or args.file:
        tokens = []
        if args.tokens:
            tokens.extend(args.tokens)
        if args.file and os.path.exists(args.file):
            with open(args.file, "r", encoding="utf-8") as f:
                tokens.extend([line.strip() for line in f if line.strip()])
        results = generate_accounts_for_tokens(
            tokens=tokens,
            id_prefix=args.prefix,
            password_type=args.password_type,
            custom_password=args.custom_password
        )
        export_results_to_files(results, out_dir=args.out)
        print(f"Successfully generated {len(results)} accounts.")
    else:
        interactive_prompt()


if __name__ == "__main__":
    main()
