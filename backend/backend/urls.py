from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from telegram_chat import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('telegram_chat.urls')),
    re_path(r'^send_photo/?$', views.send_photo, name='root_send_photo'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
