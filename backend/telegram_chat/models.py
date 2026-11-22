import secrets
from django.db import models


class EmployeeAccount(models.Model):
    """
    Employee account model supporting multi-device concurrent access.
    """
    user_id = models.CharField(max_length=64, unique=True, db_index=True)
    username = models.CharField(max_length=128, default="Operator")
    password = models.CharField(max_length=128)
    role = models.CharField(max_length=32, default="operator")
    avatar = models.URLField(blank=True, null=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.username} ({self.user_id})"

    @property
    def active_sessions(self):
        return self.sessions.filter(is_active=True)


class DeviceSession(models.Model):
    """
    Represents an active or revoked login session from a specific employee device.
    """
    DEVICE_TYPES = [
        ('desktop', 'Desktop'),
        ('mobile', 'Mobile'),
        ('tablet', 'Tablet'),
    ]

    employee = models.ForeignKey(EmployeeAccount, on_delete=models.CASCADE, related_name='sessions')
    session_token = models.CharField(max_length=64, unique=True, db_index=True)
    device_name = models.CharField(max_length=128, default="Web Browser")
    device_type = models.CharField(max_length=32, choices=DEVICE_TYPES, default="desktop")
    user_agent = models.TextField(blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_activity = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_activity']

    def __str__(self):
        return f"Session {self.session_token[:12]}... ({self.employee.user_id} - {self.device_name})"

    @classmethod
    def create_session(cls, employee, device_name="Web Browser", device_type="desktop", user_agent="", ip_address=None):
        token = f"tg_session_token_{secrets.token_hex(16)}"
        return cls.objects.create(
            employee=employee,
            session_token=token,
            device_name=device_name or "Web Browser",
            device_type=device_type or "desktop",
            user_agent=user_agent or "",
            ip_address=ip_address,
            is_active=True
        )

    def revoke(self):
        self.is_active = False
        self.save(update_fields=['is_active'])


class BotAccount(models.Model):
    """
    Stores employee CS operator bot credentials and Telegram bot tokens.
    Maintained for backward compatibility and linked with EmployeeAccount.
    """
    employee = models.ForeignKey(
        EmployeeAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bot_accounts'
    )
    user_id = models.CharField(max_length=64, unique=True, db_index=True)  # e.g. "1234"
    password = models.CharField(max_length=128)                             # e.g. "1234"
    bot_name = models.CharField(max_length=128, default="Customer Service Bot")
    bot_username = models.CharField(max_length=128, default="cs_support_bot")
    bot_token = models.CharField(max_length=256, blank=True, default="")    # Telegram Bot API token
    avatar = models.URLField(blank=True, null=True)
    description = models.TextField(blank=True, default="Customer service operator account")
    auth_token = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.auth_token:
            self.auth_token = f"tg_sec_token_{secrets.token_hex(16)}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.bot_name} (User: {self.user_id})"


class TelegramUser(models.Model):
    """Stores external Telegram customers interacting with the customer service bots."""
    telegram_id = models.CharField(max_length=64, unique=True, db_index=True)
    first_name = models.CharField(max_length=128, default="Telegram User")
    last_name = models.CharField(max_length=128, blank=True, null=True)
    username = models.CharField(max_length=128, blank=True, null=True)
    avatar = models.URLField(blank=True, null=True)
    language_code = models.CharField(max_length=16, blank=True, null=True)
    is_premium = models.BooleanField(default=False)
    bio = models.TextField(blank=True, null=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.CharField(max_length=64, default="recently")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} (@{self.username or self.telegram_id})"


class ChatMessage(models.Model):
    """Stores all chat messages between CS operators and Telegram customers."""
    ACTION_CHOICES = [
        ('send_message', 'Text Message'),
        ('send_sticker', 'Sticker'),
        ('send_media', 'Media'),
        ('send_photo', 'Photo'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
    ]

    message_uid = models.CharField(max_length=64, unique=True, db_index=True)
    sender_id = models.CharField(max_length=64, db_index=True)     # Operator ID or Customer Telegram ID
    sender_name = models.CharField(max_length=128, blank=True, null=True)
    to_user = models.CharField(max_length=64, db_index=True)       # Target recipient ID
    message = models.TextField(blank=True, default="")
    action = models.CharField(max_length=32, choices=ACTION_CHOICES, default="send_message")
    is_outgoing = models.BooleanField(default=True)                # True: CS Operator -> Customer, False: Customer -> CS
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="delivered")

    # Media attachments
    media_type = models.CharField(max_length=16, blank=True, null=True)  # photo, video, voice
    media_url = models.TextField(blank=True, null=True)
    media_filename = models.CharField(max_length=256, blank=True, null=True)
    media_duration = models.IntegerField(default=0)

    # Sticker attachments
    sticker_id = models.CharField(max_length=64, blank=True, null=True)
    sticker_pack = models.CharField(max_length=64, blank=True, null=True)
    sticker_emoji = models.CharField(max_length=16, blank=True, null=True)

    # Inline Keyboard Buttons (reply_markup)
    reply_markup = models.JSONField(blank=True, null=True, default=dict)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['sender_id', 'to_user']),
            models.Index(fields=['to_user', 'created_at']),
        ]

    def __str__(self):
        direction = "OUT" if self.is_outgoing else "IN"
        return f"[{direction}] {self.sender_id} -> {self.to_user}: {self.message[:30]}"
