
"""Содержит логику модуля `views` подсистемы `chat`."""


from django.contrib import messages
from django.shortcuts import render
from django.contrib.auth.decorators import login_required

from .constants import PUBLIC_ROOM_NAME, PUBLIC_ROOM_SLUG
from .forms import RoomForm
from .models import Message, Room


def _get_room_display_name(room_slug: str) -> str:
    """Выполняет логику `_get_room_display_name` с параметрами из сигнатуры."""
    room_name = Room.objects.filter(slug=room_slug).values_list('name', flat=True).first()
    return room_name or room_slug


def _public_room():
    """Выполняет логику `_public_room` с параметрами из сигнатуры."""
    room, _ = Room.objects.get_or_create(
        slug=PUBLIC_ROOM_SLUG,
        defaults={"name": PUBLIC_ROOM_NAME},
    )
    return room


@login_required()
def chat_home(request):
    """Выполняет логику `chat_home` с параметрами из сигнатуры."""

    form = RoomForm(request.POST or None)

    if request.method == 'POST' and form.is_valid():
        room_name = form.cleaned_data['room_name']
        db_messages = Message.objects.filter(room=room_name)[:]
        messages.success(request, f"Joined: {room_name}")
        return render(
            request,
            'chat/chatroom.html',
            {
                'room_name': room_name,
                'room_display_name': _get_room_display_name(room_name),
                'title': room_name,
                'db_messages': db_messages,
            },
        )

    public_room = _public_room()
    return render(
        request,
        'chat/index.html',
        {
            'form': form,
            'public_room_slug': public_room.slug,
            'public_room_name': public_room.name,
        },
    )


@login_required
def chat_room(request, room_name):
    """Выполняет логику `chat_room` с параметрами из сигнатуры."""
    db_messages = Message.objects.filter(room=room_name)[:]

    messages.success(request, f"Joined: {room_name}")
    return render(request, 'chat/chatroom.html', {
        'room_name': room_name,
        'room_display_name': _get_room_display_name(room_name),
        'title': room_name,
        'db_messages': db_messages,
    })


@login_required
def public_chat(request):
    """Выполняет логику `public_chat` с параметрами из сигнатуры."""
    room = _public_room()
    db_messages = Message.objects.filter(room=room.slug)[:]
    messages.success(request, f"Joined: {room.name}")
    return render(
        request,
        'chat/chatroom.html',
        {
            'room_name': room.slug,
            'room_display_name': room.name,
            'title': room.name,
            'db_messages': db_messages,
        },
    )
