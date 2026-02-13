
"""Содержит логику модуля `asgi` подсистемы `chat_app_django`."""


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