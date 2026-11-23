import os
import sys
import time
import json
import hashlib
import django

sys.path.insert(0, r"C:\Users\linda\Documents\project\TBOTchat\TBOTchat-server\backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from rest_framework.test import APIClient
from telegram_chat.models import MediaAsset, ChatMessage, EmployeeAccount

client = APIClient()

def test_telegram_architecture():
    print("=== TESTING TELEGRAM-INSPIRED HIGH-SPEED MESSAGING ARCHITECTURE ===")
    
    # 1. Test SHA-256 Deduplication check-hash
    test_content = b"TELEGRAM_FAST_MEDIA_PAYLOAD_TEST_DATA_12345"
    sha256_hash = hashlib.sha256(test_content).hexdigest()
    
    # Ensure clean slate
    MediaAsset.objects.filter(file_hash=sha256_hash).delete()
    
    # Query before registration
    res1 = client.post('/api/media/check-hash/', {'file_hash': sha256_hash}, format='json')
    assert res1.status_code == 200, f"check-hash failed: {res1.status_code}"
    assert res1.json().get('exists') is False, f"Should not exist yet: {res1.json()}"
    print("[PASS] Check-hash non-existent asset returned exists=False")
    
    # Register MediaAsset
    MediaAsset.objects.update_or_create(
        file_hash=sha256_hash,
        defaults={
            'media_url': 'http://127.0.0.1:8000/media/uploads/test_fast.jpg',
            'media_type': 'photo',
            'file_name': 'test_fast.jpg',
            'file_size': len(test_content),
            'preview_blur': 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        }
    )
    
    # Query after registration (0-byte transfer simulation)
    t0 = time.time()
    res2 = client.post('/api/media/check-hash/', {'file_hash': sha256_hash}, format='json')
    t_hash_lookup = (time.time() - t0) * 1000
    assert res2.status_code == 200
    assert res2.json().get('exists') is True
    assert res2.json().get('url') == 'http://127.0.0.1:8000/media/uploads/test_fast.jpg'
    assert 'preview_blur' in res2.json()
    print(f"[PASS] Instant SHA-256 deduplication hit in {t_hash_lookup:.2f}ms (0 byte file transfer)")
    
    # 2. Test Monotonic Sequence Allocation (pts / seqno)
    ChatMessage.objects.filter(sender_id='test_emp_99', to_user='test_client_99').delete()
    
    from telegram_chat.consumers import ChatConsumer
    consumer = ChatConsumer()
    
    # Helper to invoke save_outgoing_message sync
    import asyncio
    msg_uid1, id1, seq1 = asyncio.run(consumer.save_outgoing_message(
        operator_id='test_emp_99',
        to_user='test_client_99',
        text='Message 1',
        action='send_message'
    ))
    assert seq1 == 1, f"Expected seqno=1, got {seq1}"
    
    msg_uid2, id2, seq2 = asyncio.run(consumer.save_outgoing_message(
        operator_id='test_emp_99',
        to_user='test_client_99',
        text='Message 2',
        action='send_message'
    ))
    assert seq2 == 2, f"Expected seqno=2, got {seq2}"
    print(f"[PASS] Monotonic seqno/pts allocation verified (seq1={seq1}, seq2={seq2})")
    
    # 3. Test Serializer payload format includes seqno, pts, file_hash, preview_blur
    from telegram_chat.serializers import format_message_dict
    m = ChatMessage.objects.get(id=id2)
    m.file_hash = sha256_hash
    m.preview_blur = 'data:image/jpeg;base64,blurred'
    m.save()
    
    m_dict = format_message_dict(m)
    assert m_dict.get('seqno') == 2
    assert m_dict.get('pts') == 2
    assert m_dict.get('file_hash') == sha256_hash
    assert m_dict.get('preview_blur') == 'data:image/jpeg;base64,blurred'
    print("[PASS] ChatMessage serialization contains seqno, pts, file_hash, preview_blur")
    
    # Cleanup
    ChatMessage.objects.filter(sender_id='test_emp_99', to_user='test_client_99').delete()
    MediaAsset.objects.filter(file_hash=sha256_hash).delete()
    print("=== ALL TELEGRAM ARCHITECTURE TESTS PASSED ===")

if __name__ == '__main__':
    test_telegram_architecture()
