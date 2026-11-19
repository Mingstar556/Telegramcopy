from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('auth/login/', views.login_view, name='login'),
    path('user/profile/', views.user_profile, name='user_profile'),
    path('chats/', views.chats_list, name='chats_list'),
    path('messages/', views.messages_history, name='messages_history'),
    path('messages/send/', views.send_message, name='send_message'),
    path('media/upload/', views.media_upload, name='media_upload'),
    path('telegram/webhook/<str:user_id>/', views.telegram_webhook, name='telegram_webhook'),
]
