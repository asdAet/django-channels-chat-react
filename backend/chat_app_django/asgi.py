"""
ASGI config for chat_app_django project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.0/howto/deployment/asgi/
"""


import os  
import django  
from django.core.asgi import get_asgi_application  
 
# Устанавливаем настройки ДО любого импорта Django-кода  
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_app_django.settings')  
# Явно инициализируем Django, чтобы загрузить INSTALLED_APPS  
django.setup()  
 
# Теперь безопасно импортировать Channels и роутинг  
from channels.auth import AuthMiddlewareStack  
from channels.routing import ProtocolTypeRouter, URLRouter  
from channels.security.websocket import AllowedHostsOriginValidator  
import chat.routing  
 
application = ProtocolTypeRouter({  
    "http": get_asgi_application(),  
    "websocket": AllowedHostsOriginValidator(  
        AuthMiddlewareStack(  
            URLRouter(chat.routing.websocket_urlpatterns)  
        )  
    )  
})