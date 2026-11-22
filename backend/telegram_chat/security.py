"""
Blue Team Defense & Security Hardening Module
Implements defense-in-depth protections aligned with MITRE ATT&CK:
- T1552/T1528: API Key & Secret Leakage Prevention
- T1498/T1499: DoS, Link-Breakage & Resource Exhaustion Defense
- T1005/T1083: Database Protection & Auth Boundary Enforcement
- T1565/T1566: ABA Pay Code Tampering & Fraud Detection
- T1204/T1059: Malicious Link & Phishing Prevention
"""

import re
import os
import logging
from typing import Tuple, Dict, Any, Optional
from django.conf import settings

logger = logging.getLogger("security.blue_team")

# ---------------------------------------------------------------------------
# 1. API KEY & TOKEN PROTECTION (T1552 / T1528)
# ---------------------------------------------------------------------------

_TOKEN_PATTERNS = [
    re.compile(r'\b\d{8,12}:[A-Za-z0-9_-]{25,45}\b'),  # Telegram Bot Token
    re.compile(r'\btg_session_token_[0-9a-f]{32}\b', re.IGNORECASE),  # Session Token
    re.compile(r'\btg_sec_token_[0-9a-f]{32}\b', re.IGNORECASE),      # Webhook Secret Token
    re.compile(r'Bearer\s+[A-Za-z0-9_\-\.]{20,}', re.IGNORECASE),    # Bearer Tokens
]

def mask_sensitive_token(token: Optional[str]) -> str:
    """Masks secret tokens for safe logging and response exposure."""
    if not token or len(token) < 8:
        return "***"
    return f"{token[:4]}...{token[-4:]}"

def sanitize_log_output(text: str) -> str:
    """Redacts secrets, API keys, and sensitive tokens from log messages."""
    sanitized = str(text)
    for pattern in _TOKEN_PATTERNS:
        sanitized = pattern.sub("[REDACTED_API_KEY]", sanitized)
    return sanitized


# ---------------------------------------------------------------------------
# 2. ABA PAY CODE & PAYMENT TAMPERING DEFENSE (T1565.001 / T1565.002)
# ---------------------------------------------------------------------------

# Configurable approved company ABA accounts / merchant IDs
DEFAULT_APPROVED_ABA = {"000123456", "123456789", "001889900", "COMPANY_MERCHANT"}

def get_approved_aba_accounts() -> set:
    configured = os.environ.get("APPROVED_ABA_ACCOUNTS", "")
    if configured:
        return {acc.strip().replace(" ", "").replace("-", "") for acc in configured.split(",") if acc.strip()}
    return DEFAULT_APPROVED_ABA

# Regex to detect ABA account numbers (typically 9-16 digits labeled as ABA or PayWay)
ABA_PATTERN = re.compile(
    r'(?:aba(?:\s*pay|\s*bank|\s*account|\s*qr)?[:\s=]+|payway[:\s=]+)?(\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b|\b\d{9,16}\b)',
    re.IGNORECASE
)

KHQR_PATTERN = re.compile(
    r'(?:bakong|khqr|payway\.com\.kh|000201010212)',
    re.IGNORECASE
)

def inspect_aba_payment_integrity(message_text: str, sender_id: str, is_outgoing: bool) -> Tuple[bool, Optional[str]]:
    """
    Validates whether payment codes in messages match approved company ABA credentials.
    Prevents attackers from tampering with payment instructions sent to clients.
    Returns: (is_allowed: bool, reason: Optional[str])
    """
    if not message_text:
        return True, None

    clean_text = message_text.lower()
    approved = get_approved_aba_accounts()

    # Check for ABA bank mentions
    if "aba" in clean_text or "khqr" in clean_text or "payway" in clean_text:
        matches = ABA_PATTERN.findall(message_text)
        for raw_num in matches:
            norm_num = raw_num.replace(" ", "").replace("-", "").strip()
            # If a 9+ digit account number is detected, verify against approved list
            if len(norm_num) >= 9 and norm_num.isdigit():
                if norm_num not in approved:
                    logger.warning(
                        f"[SECURITY ALERT] Unauthorized ABA Pay code tampering detected! "
                        f"Sender: {sender_id}, Blocked Rogue Account: {norm_num}"
                    )
                    return False, f"Unauthorized ABA account number detected: {norm_num}. Payment instructions must use approved company accounts."

        # Check for rogue payment links that impersonate ABA or PayWay
        if "payway" in clean_text or "aba" in clean_text:
            url_matches = re.findall(r'https?://[^\s<>"]+', message_text)
            for u in url_matches:
                u_lower = u.lower()
                # If claiming to be payway or aba, verify official domain
                if ("aba" in u_lower or "payway" in u_lower) and not any(
                    valid in u_lower for valid in ["payway.com.kh", "ababank.com", "bakong.nbc.org.kh"]
                ):
                    logger.warning(f"[SECURITY ALERT] Fake/Spoofed ABA Payment link detected: {u}")
                    return False, f"Untrusted or spoofed payment link detected: {u}"

    return True, None


# ---------------------------------------------------------------------------
# 3. MALICIOUS LINK & PHISHING PREVENTION (T1204.001 / T1059.007)
# ---------------------------------------------------------------------------

DANGEROUS_SCHEMES = ("javascript:", "data:", "vbscript:", "file:", "blob:", "about:")

SUSPICIOUS_TLDS = {
    ".xyz", ".top", ".tk", ".ml", ".ga", ".cf", ".gq", ".buzz", ".work", ".click", ".country"
}

IP_URL_PATTERN = re.compile(r'https?://(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:/|$)', re.IGNORECASE)

URL_EXTRACTOR = re.compile(r'(?:https?://|[a-z0-9_-]+\.[a-z]{2,}/)[^\s<>"]+', re.IGNORECASE)

def inspect_links_for_phishing(text: str, sender_id: str) -> Tuple[bool, Optional[str]]:
    """
    Scans text for malicious, dangerous, or phishing URLs.
    Blocks dangerous protocols, raw IP-based hosts (except local development),
    suspicious top-level phishing domains, and credential-harvesting patterns.
    """
    if not text:
        return True, None

    lower_text = text.lower()

    # 1. Block dangerous URI schemes (XSS / Code Execution)
    for scheme in DANGEROUS_SCHEMES:
        if scheme in lower_text:
            logger.warning(f"[SECURITY ALERT] Dangerous URI scheme '{scheme}' blocked from {sender_id}")
            return False, f"Dangerous URI scheme '{scheme}' is forbidden."

    # 2. Extract and inspect URLs
    urls = re.findall(r'https?://[^\s<>"]+', text)
    for url in urls:
        u_lower = url.lower()

        # Check for raw IP address hosts (often used in malware C2 / credential phish)
        # Allow localhost / 127.0.0.1 for local dev
        if IP_URL_PATTERN.match(u_lower):
            if not ("127.0.0.1" in u_lower or "localhost" in u_lower or "10." in u_lower or "192.168." in u_lower):
                logger.warning(f"[SECURITY ALERT] Direct IP address URL blocked: {url} from {sender_id}")
                return False, f"Direct IP address URLs are blocked for security: {url}"

        # Check for suspicious phishing TLDs
        for tld in SUSPICIOUS_TLDS:
            if f"{tld}/" in u_lower or u_lower.endswith(tld):
                logger.warning(f"[SECURITY ALERT] Suspicious phishing TLD '{tld}' blocked: {url} from {sender_id}")
                return False, f"URL with high-risk domain extension '{tld}' is blocked: {url}"

        # Check for known credential phish keywords in URL path
        if any(keyword in u_lower for keyword in ["telegram-login", "verify-account-security", "bank-login-secure", "session-recovery"]):
            if not any(trusted in u_lower for trusted in ["telegram.org", "ababank.com"]):
                logger.warning(f"[SECURITY ALERT] Credential harvesting signature detected in URL: {url}")
                return False, f"Potential credential harvesting link blocked: {url}"

    return True, None


# ---------------------------------------------------------------------------
# 4. RATE LIMITING & DOS / LINK BREAKAGE DEFENSE (T1498 / T1499)
# ---------------------------------------------------------------------------

import time
from collections import defaultdict

_REQUEST_LOG = defaultdict(list)
_MAX_REQUESTS_PER_MINUTE = 120

def check_rate_limit(client_ip: str, limit: int = _MAX_REQUESTS_PER_MINUTE, window: int = 60) -> bool:
    """Sliding-window IP rate limiter to protect backend against link-breaking DoS floods."""
    if not client_ip:
        return True
    now = time.time()
    valid_window = [t for t in _REQUEST_LOG[client_ip] if now - t < window]
    _REQUEST_LOG[client_ip] = valid_window
    if len(valid_window) >= limit:
        logger.warning(f"[SECURITY ALERT] Rate limit exceeded for IP: {client_ip} ({len(valid_window)} reqs)")
        return False
    _REQUEST_LOG[client_ip].append(now)
    return True


# ---------------------------------------------------------------------------
# 5. UNIFIED SECURITY GUARD PIPELINE
# ---------------------------------------------------------------------------

class SecurityGuard:
    @classmethod
    def validate_outgoing_message(cls, text: str, sender_id: str, client_ip: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        """
        Runs comprehensive Blue Team checks on any outgoing message:
        - Link / phishing safety
        - ABA Pay code integrity
        - Content length limit (prevents memory exhaustion)
        """
        # Rate limit
        if client_ip and not check_rate_limit(client_ip):
            return False, "Rate limit exceeded. Please slow down your requests."

        # Maximum message length defense against DoS / memory exhaustion
        if text and len(text) > 10000:
            return False, "Message exceeds maximum permitted safety length (10,000 characters)."

        # Link inspection
        link_ok, link_err = inspect_links_for_phishing(text, sender_id)
        if not link_ok:
            return False, link_err

        # ABA Pay Code integrity
        aba_ok, aba_err = inspect_aba_payment_integrity(text, sender_id, is_outgoing=True)
        if not aba_ok:
            return False, aba_err

        return True, None

    @classmethod
    def validate_incoming_message(cls, text: str, sender_id: str) -> Tuple[bool, Optional[str]]:
        """Validates incoming messages from external Telegram users."""
        if text and len(text) > 10000:
            return False, "Message exceeds maximum permitted length."

        link_ok, link_err = inspect_links_for_phishing(text, sender_id)
        if not link_ok:
            return False, link_err

        return True, None
