
"""Содержит логику модуля `admin` подсистемы `users`."""


from django import forms
from django.contrib import admin
from django.contrib.admin.sites import NotRegistered
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django.utils.html import format_html

from .models import Profile


class ProfileInlineForm(forms.ModelForm):
    """Инкапсулирует логику класса `ProfileInlineForm`."""
    email = forms.EmailField(required=False, label="Email")
    is_staff = forms.BooleanField(required=False, label="Модератор/админ")


    class Meta:
        """Инкапсулирует логику класса `Meta`."""
        model = Profile
        fields = ("image", "bio")

    def __init__(self, *args, **kwargs):
        """Инициализирует экземпляр `ProfileInlineForm`."""
        super().__init__(*args, **kwargs)
        user = getattr(self.instance, "user", None)
        if user:
            self.fields["is_staff"].initial = user.is_staff

    def save(self, commit=True):
        """Выполняет логику `save` с параметрами из сигнатуры."""
        profile = super().save(commit=False)
        user = getattr(profile, "user", None)
        if user:
            user.is_staff = bool(self.cleaned_data.get("is_staff"))
            if commit:
                user.save()
        if commit:
            profile.save()
        return profile


class ProfileInline(admin.StackedInline):
    """Инкапсулирует логику класса `ProfileInline`."""
    model = Profile
    form = ProfileInlineForm
    can_delete = False
    verbose_name_plural = "Profile"
    fields = (
        "username_display",
        "is_staff",
        "image",
        "bio",
        "last_seen",
        "avatar_preview",
    )
    readonly_fields = ("username_display", "last_seen", "avatar_preview")
    extra = 0

    @admin.display(description="Логин")
    def username_display(self, obj):
        """Выполняет логику `username_display` с параметрами из сигнатуры."""
        return getattr(obj.user, "username", "—")

    @admin.display(description="Avatar")
    def avatar_preview(self, obj):
        """Выполняет логику `avatar_preview` с параметрами из сигнатуры."""
        if obj and getattr(obj, "image", None):
            try:
                return format_html(
                    '<img src="{}" style="height:60px;width:60px;object-fit:cover;border-radius:50%;">',
                    obj.image.url,
                )
            except ValueError:
                pass
        return "—"


# Заменяем стандартный UserAdmin, добавляя Profile inline
try:
    admin.site.unregister(User)
except NotRegistered:
    pass


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Инкапсулирует логику класса `UserAdmin`."""
    inlines = [ProfileInline]
    list_display = (
        "username",
        "is_staff",
        "profile_last_seen",
    )
    list_select_related = ("profile",)
    search_fields = ("username", "email", "first_name", "last_name")
    list_filter = ("is_staff", "is_active", "is_superuser", "date_joined")
    ordering = ("-date_joined",)

    @admin.display(description="Last seen", ordering="profile__last_seen")
    def profile_last_seen(self, obj):
        """Выполняет логику `profile_last_seen` с параметрами из сигнатуры."""
        profile = getattr(obj, "profile", None)
        return profile.last_seen if profile else "—"


class ProfileAdminForm(ProfileInlineForm):
    """Инкапсулирует логику класса `ProfileAdminForm`."""
    class Meta(ProfileInlineForm.Meta):
        """Инкапсулирует логику класса `Meta`."""
        model = Profile
        fields = ("user", "image", "bio")


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """Инкапсулирует логику класса `ProfileAdmin`."""
    form = ProfileAdminForm
    list_display = ("user", "is_staff", "last_seen", "avatar_preview")
    list_select_related = ("user",)
    list_filter = ("user__is_staff",)
    readonly_fields = ("last_seen", "avatar_preview")
    fields = ("user", "is_staff", "image", "bio", "last_seen", "avatar_preview")

    @admin.display(boolean=True, description="Модератор/админ", ordering="user__is_staff")
    def is_staff(self, obj):
        """Выполняет логику `is_staff` с параметрами из сигнатуры."""
        return getattr(obj.user, "is_staff", False)

    @admin.display(description="Avatar")
    def avatar_preview(self, obj):
        """Выполняет логику `avatar_preview` с параметрами из сигнатуры."""
        if obj and getattr(obj, "image", None):
            try:
                return format_html(
                    '<img src="{}" style="height:60px;width:60px;object-fit:cover;border-radius:50%;">',
                    obj.image.url,
                )
            except ValueError:
                pass
        return "—"
