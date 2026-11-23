import os
import sys
import time
import json
import statistics
import concurrent.futures
import requests

BASE = "http://127.0.0.1:8000"

def get_db_count():
    try:
        import django
        sys.path.append(r'C:\Users\linda\Documents\project\TBOTchat\TBOTchat-server\backend')
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
        django.setup()
        from telegram_chat.models import ChatMessage
        return ChatMessage.objects.count()
    except Exception as e:
        return -1

def run_batch_test(test_name, payload_builder, concurrency, total_requests, operator_ids):
    print(f"\n>>> Running: {test_name} (Concurrency={concurrency}, Total={total_requests})")
    
    latencies = []
    errors = []
    status_codes = {}
    
    start_time = time.time()
    
    def worker(i):
        op_id = operator_ids[i % len(operator_ids)]
        payload = payload_builder(i, op_id)
        url = f"{BASE}/api/telegram/webhook/{op_id}/"
        t0 = time.time()
        try:
            resp = requests.post(url, json=payload, timeout=10)
            elapsed = (time.time() - t0) * 1000
            return resp.status_code, elapsed, None
        except Exception as e:
            elapsed = (time.time() - t0) * 1000
            return 0, elapsed, str(e)

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(worker, i) for i in range(total_requests)]
        for f in concurrent.futures.as_completed(futures):
            code, lat, err = f.result()
            latencies.append(lat)
            status_codes[code] = status_codes.get(code, 0) + 1
            if err or code != 200:
                errors.append(f"Code {code}: {err or 'Non-200'}")

    total_duration = time.time() - start_time
    rps = total_requests / total_duration if total_duration > 0 else 0
    
    sorted_lat = sorted(latencies)
    p50 = sorted_lat[int(len(sorted_lat) * 0.50)] if sorted_lat else 0
    p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if sorted_lat else 0
    p99 = sorted_lat[int(len(sorted_lat) * 0.99)] if sorted_lat else 0
    avg_lat = statistics.mean(latencies) if latencies else 0

    success_count = status_codes.get(200, 0)
    error_rate = (len(errors) / total_requests) * 100 if total_requests > 0 else 0

    print(f"    Duration    : {total_duration:.2f}s | RPS: {rps:.1f} req/s")
    print(f"    Success     : {success_count}/{total_requests} ({(success_count/total_requests)*100:.1f}%) | Error Rate: {error_rate:.1f}%")
    print(f"    Latency(ms) : Avg={avg_lat:.1f} | Min={min(latencies):.1f} | p50={p50:.1f} | p95={p95:.1f} | p99={p99:.1f} | Max={max(latencies):.1f}")
    if errors:
        print(f"    First 3 errors: {errors[:3]}")

    return {
        "test": test_name,
        "concurrency": concurrency,
        "total": total_requests,
        "duration_sec": round(total_duration, 2),
        "rps": round(rps, 1),
        "success_rate": round((success_count / total_requests) * 100, 1),
        "avg_ms": round(avg_lat, 1),
        "p50_ms": round(p50, 1),
        "p95_ms": round(p95, 1),
        "p99_ms": round(p99, 1),
        "max_ms": round(max(latencies), 1),
        "status_codes": status_codes,
        "error_count": len(errors)
    }

def main():
    print("=" * 80)
    print("      TELEGRAM ENTERPRISE FULL-STACK STRESS & BREAKING POINT BENCHMARK")
    print("=" * 80)

    operators = ['1234', 'ahfu', 'bingo', 'mrlioma']
    initial_db_count = get_db_count()
    print(f"[*] Initial ChatMessage rows in SQLite: {initial_db_count}")

    bench_results = []

    # 1. Message (Text) Baseline & Scaling
    def text_payload(i, op_id):
        client_id = 900000000 + (i % 300) # 300 unique simulated clients
        return {
            "update_id": 200000 + i,
            "message": {
                "message_id": 700000 + i,
                "from": {"id": client_id, "first_name": f"Client_{client_id}", "username": f"user_{client_id}"},
                "chat": {"id": client_id, "type": "private"},
                "date": int(time.time()),
                "text": f"Stress test message payload #{i} from client {client_id}"
            }
        }

    # 10 workers - Baseline
    bench_results.append(run_batch_test("1. Text Messages (10 workers, 100 msgs)", text_payload, 10, 100, operators))
    
    # 50 workers - 50 staff scale
    bench_results.append(run_batch_test("2. Text Messages (50 workers, 500 msgs)", text_payload, 50, 500, operators))
    
    # 100 workers - 100 staff peak scale
    bench_results.append(run_batch_test("3. Text Messages (100 workers, 1000 msgs)", text_payload, 100, 1000, operators))

    # 2. Photo Media Messages
    def photo_payload(i, op_id):
        client_id = 910000000 + (i % 200)
        return {
            "update_id": 300000 + i,
            "message": {
                "message_id": 800000 + i,
                "from": {"id": client_id, "first_name": f"ClientPhoto_{client_id}"},
                "chat": {"id": client_id, "type": "private"},
                "date": int(time.time()),
                "photo": [
                    {"file_id": f"thumb_{i}", "width": 320, "height": 240},
                    {"file_id": f"full_photo_hires_{i}", "width": 1920, "height": 1080}
                ],
                "caption": f"Order invoice screenshot #{i}"
            }
        }

    bench_results.append(run_batch_test("4. Photo Media (50 workers, 300 photos)", photo_payload, 50, 300, operators))

    # 3. Video Media Messages
    def video_payload(i, op_id):
        client_id = 920000000 + (i % 200)
        return {
            "update_id": 400000 + i,
            "message": {
                "message_id": 900000 + i,
                "from": {"id": client_id, "first_name": f"ClientVideo_{client_id}"},
                "chat": {"id": client_id, "type": "private"},
                "date": int(time.time()),
                "video": {
                    "file_id": f"video_stream_{i}",
                    "file_name": f"session_recording_{i}.mp4",
                    "duration": 25,
                    "width": 1280,
                    "height": 720
                },
                "caption": f"Video proof walkthrough #{i}"
            }
        }

    bench_results.append(run_batch_test("5. Video Media (50 workers, 300 videos)", video_payload, 50, 300, operators))

    # 4. Operator Outbound Sending API Under Load
    print("\n>>> Testing Outbound Operator Dispatch Under Load...")
    # Get session token for ahfu
    login_res = requests.post(f"{BASE}/api/auth/login/", json={"userId": "ahfu", "password": "ahfu1234"})
    token = login_res.json().get('token')
    headers = {"Authorization": f"Bearer {token}"}
    
    outbound_latencies = []
    outbound_codes = {}
    t0 = time.time()
    def send_worker(i):
        target_client = 900000000 + (i % 50)
        p = {
            "User-ID": "ahfu",
            "to-user": str(target_client),
            "message": f"Operator reply #{i} to client",
            "action": "send_message"
        }
        res = requests.post(f"{BASE}/api/messages/send/", headers=headers, json=p, timeout=5)
        return res.status_code

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futs = [executor.submit(send_worker, i) for i in range(100)]
        for f in concurrent.futures.as_completed(futs):
            c = f.result()
            outbound_codes[c] = outbound_codes.get(c, 0) + 1
    
    out_dur = time.time() - t0
    print(f"    Outbound Dispatch: 100 messages sent across 50 clients in {out_dur:.2f}s ({100/out_dur:.1f} msgs/s)")
    print(f"    Outbound Status  : {outbound_codes}")

    # 5. STRESS TEST TO BREAKING POINT (Ramping concurrency: 150 -> 250 -> 500)
    print("\n" + "=" * 80)
    print("           PUSHING CONCURRENCY UNTIL PERFORMANCE BREAKING POINT")
    print("=" * 80)

    for stress_concurrency in [150, 250, 400, 600]:
        total_stress = stress_concurrency * 4
        res = run_batch_test(
            f"Breaking Point Stress Test (Concurrency={stress_concurrency}, Load={total_stress})",
            text_payload,
            concurrency=stress_concurrency,
            total_requests=total_stress,
            operator_ids=operators
        )
        bench_results.append(res)
        time.sleep(0.5)

    # Database Verification
    time.sleep(1.0)
    final_db_count = get_db_count()
    net_written = final_db_count - initial_db_count
    print("\n" + "=" * 80)
    print("                      DATABASE AUDIT & PERSISTENCE")
    print("=" * 80)
    print(f"[*] Starting DB Rows : {initial_db_count}")
    print(f"[*] Final DB Rows    : {final_db_count}")
    print(f"[*] Net Verified Rows: +{net_written} records saved to SQLite successfully")

    # Export Report JSON
    report_path = r"C:\Users\linda\Documents\project\TBOTchat\TBOTchat-server\BENCHMARK_REPORT.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "initial_db_rows": initial_db_count,
            "final_db_rows": final_db_count,
            "net_db_written": net_written,
            "results": bench_results
        }, f, indent=2)

    print(f"\n[+] Full benchmark results saved to: {report_path}")

if __name__ == '__main__':
    main()
