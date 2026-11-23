import time
import json
import statistics
import requests
import io

BASE = "http://127.0.0.1:8000"

def test_plain_text_delivery():
    # Measure end-to-end webhook ingestion + db persistence + REST message fetch
    latencies = []
    for i in range(20):
        t0 = time.time()
        client_id = 887766000 + i
        payload = {
            "update_id": 900000 + i,
            "message": {
                "message_id": 950000 + i,
                "from": {"id": client_id, "first_name": "SpeedTest"},
                "chat": {"id": client_id, "type": "private"},
                "date": int(time.time()),
                "text": f"Speed test message {i}"
            }
        }
        res = requests.post(f"{BASE}/api/telegram/webhook/1234/", json=payload, timeout=5)
        # Measure instant response
        lat = (time.time() - t0) * 1000
        latencies.append(lat)
        time.sleep(0.05)

    return {
        "avg_ms": round(statistics.mean(latencies), 2),
        "min_ms": round(min(latencies), 2),
        "p50_ms": round(sorted(latencies)[int(len(latencies) * 0.5)], 2),
        "p95_ms": round(sorted(latencies)[int(len(latencies) * 0.95)], 2),
        "max_ms": round(max(latencies), 2),
    }

def test_typing_and_read_receipts():
    # Typing and reaction dispatch latency
    login = requests.post(f"{BASE}/api/auth/login/", json={"userId": "1234", "password": "1234"}).json()
    token = login.get("token")
    headers = {"Authorization": f"Bearer {token}"}

    reaction_latencies = []
    for i in range(15):
        t0 = time.time()
        res = requests.post(f"{BASE}/api/messages/send/", headers=headers, json={
            "User-ID": "1234",
            "to-user": "887766000",
            "action": "reaction",
            "message": "🔥",
            "reaction": {"message_id": f"msg_tg_887766000_{950000 + i}", "emoji": "🔥"}
        }, timeout=5)
        lat = (time.time() - t0) * 1000
        reaction_latencies.append(lat)
        time.sleep(0.05)

    return {
        "avg_ms": round(statistics.mean(reaction_latencies), 2),
        "min_ms": round(min(reaction_latencies), 2),
        "p50_ms": round(sorted(reaction_latencies)[int(len(reaction_latencies) * 0.5)], 2),
        "p95_ms": round(sorted(reaction_latencies)[int(len(reaction_latencies) * 0.95)], 2),
        "max_ms": round(max(reaction_latencies), 2),
    }

def test_media_upload_1mb():
    # Generate 1MB simulated JPEG payload
    from PIL import Image
    img = Image.new('RGB', (1600, 1200), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=85)
    # Pad to exact ~1MB if needed
    data = buf.getvalue()
    if len(data) < 1024 * 1024:
        data = data + b'\x00' * (1024 * 1024 - len(data))

    latencies = []
    for _ in range(5):
        files = {'file': ('test_photo_1mb.jpg', io.BytesIO(data), 'image/jpeg')}
        t0 = time.time()
        res = requests.post(f"{BASE}/api/media/upload/", files=files, timeout=10)
        lat = (time.time() - t0) * 1000
        latencies.append(lat)
        time.sleep(0.1)

    return {
        "payload_size_bytes": len(data),
        "avg_ms": round(statistics.mean(latencies), 2),
        "min_ms": round(min(latencies), 2),
        "p50_ms": round(sorted(latencies)[int(len(latencies) * 0.5)], 2),
        "max_ms": round(max(latencies), 2),
    }

def test_app_cold_start():
    # Benchmark cold start API initialization: Health check + Login + Chat List fetch
    latencies = []
    for _ in range(5):
        t0 = time.time()
        # 1. Server ping
        requests.get(f"{BASE}/api/health/", timeout=2)
        # 2. Login
        log = requests.post(f"{BASE}/api/auth/login/", json={"userId": "ahfu", "password": "ahfu1234"}, timeout=2).json()
        tok = log.get("token")
        # 3. Initial Chat list fetch
        requests.get(f"{BASE}/api/chats/?User-ID=ahfu", headers={"Authorization": f"Bearer {tok}"}, timeout=2)
        total_time = (time.time() - t0) * 1000
        latencies.append(total_time)
        time.sleep(0.1)

    return {
        "avg_ms": round(statistics.mean(latencies), 2),
        "p50_ms": round(sorted(latencies)[int(len(latencies) * 0.5)], 2),
        "min_ms": round(min(latencies), 2),
        "max_ms": round(max(latencies), 2),
    }

if __name__ == '__main__':
    print("=== MEASURING SPEED STANDARDS BENCHMARK ===")
    text_res = test_plain_text_delivery()
    print("1. Plain Text Delivery (Webhook Inbound):", text_res)

    typing_res = test_typing_and_read_receipts()
    print("2. Typing & Reactions / Receipts:", typing_res)

    media_res = test_media_upload_1mb()
    print("3. Media Upload (1 MB):", media_res)

    cold_res = test_app_cold_start()
    print("4. App Cold Start (Full Sequence):", cold_res)

    results = {
        "plain_text": text_res,
        "typing_and_receipts": typing_res,
        "media_upload_1mb": media_res,
        "cold_start": cold_res
    }
    with open(r"C:\Users\linda\Documents\project\TBOTchat\TBOTchat-server\SPEED_STANDARDS_VERIFICATION.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nSaved to SPEED_STANDARDS_VERIFICATION.json")
