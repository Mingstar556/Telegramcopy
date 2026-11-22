from django.urls import path, re_path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/sessions/', views.active_sessions_view, name='active_sessions'),
    path('user/profile/', views.user_profile, name='user_profile'),
    path('chats/', views.chats_list, name='chats_list'),
    path('messages/', views.messages_history, name='messages_history'),
    path('messages/send/', views.send_message, name='send_message'),
    path('media/upload/', views.media_upload, name='media_upload'),
    path('telegram/sync/', views.sync_telegram_view, name='sync_telegram'),
    path('telegram/webhook/', views.telegram_webhook, name='telegram_webhook_default'),
    path('telegram/webhook/<str:user_id>/', views.telegram_webhook, name='telegram_webhook'),
    path('send_photo/', views.send_photo, name='send_photo'),
    re_path(r'^send_photo/?$', views.send_photo, name='send_photo_flexible'),
]
