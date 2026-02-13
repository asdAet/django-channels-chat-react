
"""Содержит логику модуля forms подсистемы chat."""

from django import forms


class RoomForm(forms.Form):
    """Инкапсулирует логику класса RoomForm."""
    room_name = forms.CharField()
