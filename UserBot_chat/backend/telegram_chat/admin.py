from django.contrib import admin
from .models import BotAccount, TelegramUser, ChatMessage


@admin.register(BotAccount)
class BotAccountAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'bot_name', 'bot_username', 'created_at')
    search_fields = ('user_id', 'bot_name', 'bot_username')


@admin.register(TelegramUser)
class TelegramUserAdmin(admin.ModelAdmin):
    list_display = ('telegram_id', 'first_name', 'last_name', 'username', 'is_online', 'updated_at')
    search_fields = ('telegram_id', 'first_name', 'last_name', 'username')


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('message_uid', 'sender_id', 'to_user', 'action', 'is_outgoing', 'status', 'created_at')
    list_filter = ('is_outgoing', 'action', 'status', 'created_at')
    search_fields = ('sender_id', 'to_user', 'message', 'message_uid')
