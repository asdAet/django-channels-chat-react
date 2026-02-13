
"""Содержит логику модуля `forms` подсистемы `users`."""


from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.utils.html import strip_tags

from .models import Profile


USERNAME_MAX_LENGTH = 13


class UserRegisterForm(UserCreationForm):
    """Инкапсулирует логику класса `UserRegisterForm`."""
    class Meta:
        """Инкапсулирует логику класса `Meta`."""
        model = User
        fields = ["username", "password1", "password2"]

    def clean_username(self):
        """Выполняет логику `clean_username` с параметрами из сигнатуры."""
        username = (self.cleaned_data.get("username") or "").strip()
        if not username:
            return username
        if len(username) > USERNAME_MAX_LENGTH:
            raise forms.ValidationError(
                f"Максимум {USERNAME_MAX_LENGTH} символов."
            )
        if User.objects.filter(username=username).exists():
            raise forms.ValidationError("Имя пользователя уже занято")
        return username


class UserUpdateForm(forms.ModelForm):
    """Инкапсулирует логику класса `UserUpdateForm`."""
    email = forms.EmailField(required=False)

    class Meta:
        """Инкапсулирует логику класса `Meta`."""
        model = User
        fields = ["username", "email"]

    def clean_username(self):
        """Выполняет логику `clean_username` с параметрами из сигнатуры."""
        username = self.cleaned_data.get("username", "").strip()
        if not username:
            return username
        if len(username) > USERNAME_MAX_LENGTH:
            raise forms.ValidationError(
                f"Максимум {USERNAME_MAX_LENGTH} символов."
            )
        qs = User.objects.filter(username=username)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("Имя пользователя уже занято")
        return username

    def clean_email(self):
        """Выполняет логику `clean_email` с параметрами из сигнатуры."""
        email = (self.cleaned_data.get("email") or "").strip()
        if not email:
            return ""
        qs = User.objects.filter(email__iexact=email)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("Email уже используется")
        return email


class ProfileUpdateForm(forms.ModelForm):
    """Инкапсулирует логику класса `ProfileUpdateForm`."""
    class Meta:
        """Инкапсулирует логику класса `Meta`."""
        model = Profile
        fields = ["image", "bio"]
        widgets = {
            "bio": forms.Textarea(attrs={"rows": 4, "maxlength": 1000}),
        }

    def clean_bio(self):
        """Выполняет логику `clean_bio` с параметрами из сигнатуры."""
        bio = self.cleaned_data.get("bio") or ""
        return strip_tags(bio).strip()
