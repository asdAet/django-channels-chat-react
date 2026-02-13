"""Содержит тесты модуля `test_models` подсистемы `users`."""


import io
import tempfile

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from users.models import Profile

User = get_user_model()


class ProfileModelTests(TestCase):
    """Группирует тестовые сценарии класса `ProfileModelTests`."""
    def test_str_representation_contains_username(self):
        """Проверяет сценарий `test_str_representation_contains_username`."""
        user = User.objects.create_user(username='model_user', password='pass12345')
        self.assertIn('model_user', str(user.profile))

    def test_save_strips_html_from_bio(self):
        """Проверяет сценарий `test_save_strips_html_from_bio`."""
        user = User.objects.create_user(username='bio_model_user', password='pass12345')
        profile = user.profile
        profile.bio = '<b>Hello</b> <script>alert(1)</script>'
        profile.save()
        profile.refresh_from_db()
        self.assertEqual(profile.bio, 'Hello alert(1)')


class ProfileImageProcessingTests(TestCase):
    """Группирует тестовые сценарии класса `ProfileImageProcessingTests`."""
    def setUp(self):
        """Проверяет сценарий `setUp`."""
        self.temp_media = tempfile.TemporaryDirectory()
        self.override_media = override_settings(MEDIA_ROOT=self.temp_media.name)
        self.override_media.enable()

    def tearDown(self):
        """Проверяет сценарий `tearDown`."""
        self.override_media.disable()
        self.temp_media.cleanup()

    @staticmethod
    def _make_rgba_upload_with_jpg_name() -> SimpleUploadedFile:
        """Проверяет сценарий `_make_rgba_upload_with_jpg_name`."""
        image = Image.new('RGBA', (800, 600), (255, 0, 0, 120))
        buff = io.BytesIO()
        image.save(buff, format='PNG')
        buff.seek(0)
        return SimpleUploadedFile('avatar.jpg', buff.getvalue(), content_type='image/png')

    def test_profile_save_handles_rgba_source_without_crash(self):
        """Проверяет сценарий `test_profile_save_handles_rgba_source_without_crash`."""
        user = User.objects.create_user(username='imguser', password='pass12345')
        profile = user.profile
        profile.image = self._make_rgba_upload_with_jpg_name()

        profile.save()
        profile.refresh_from_db()

        with Image.open(profile.image.path) as saved:
            self.assertEqual(saved.width, 800)
            self.assertEqual(saved.height, 600)
            self.assertEqual(saved.mode, 'RGBA')

    def test_replacing_avatar_deletes_previous_file(self):
        """Проверяет сценарий `test_replacing_avatar_deletes_previous_file`."""
        user = User.objects.create_user(username='replace_user', password='pass12345')
        profile = user.profile

        first = SimpleUploadedFile('first.png', self._png_bytes((255, 0, 0)), content_type='image/png')
        second = SimpleUploadedFile('second.png', self._png_bytes((0, 255, 0)), content_type='image/png')

        profile.image = first
        profile.save()
        first_name = profile.image.name

        profile.image = second
        profile.save()
        second_name = profile.image.name

        self.assertNotEqual(first_name, second_name)

    @staticmethod
    def _png_bytes(color) -> bytes:
        """Проверяет сценарий `_png_bytes`."""
        image = Image.new('RGB', (16, 16), color)
        buff = io.BytesIO()
        image.save(buff, format='PNG')
        return buff.getvalue()
