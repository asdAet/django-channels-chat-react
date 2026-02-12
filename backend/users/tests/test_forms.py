from django.contrib.auth import get_user_model
from django.test import TestCase

from users.forms import ProfileUpdateForm, UserUpdateForm

User = get_user_model()


class UserUpdateFormTests(TestCase):
    def test_allows_same_username_for_current_user(self):
        user = User.objects.create_user(username='user1', password='pass12345')
        form = UserUpdateForm(data={'username': 'user1', 'email': ''}, instance=user)
        self.assertTrue(form.is_valid())

    def test_rejects_duplicate_username(self):
        User.objects.create_user(username='user1', password='pass12345')
        user2 = User.objects.create_user(username='user2', password='pass12345')
        form = UserUpdateForm(data={'username': 'user1', 'email': ''}, instance=user2)
        self.assertFalse(form.is_valid())
        self.assertIn('username', form.errors)

    def test_rejects_duplicate_email_case_insensitive(self):
        User.objects.create_user(username='user1', password='pass12345', email='mail@example.com')
        user2 = User.objects.create_user(username='user2', password='pass12345', email='other@example.com')
        form = UserUpdateForm(data={'username': 'user2', 'email': 'MAIL@example.com'}, instance=user2)
        self.assertFalse(form.is_valid())
        self.assertIn('email', form.errors)


class ProfileUpdateFormTests(TestCase):
    def test_clean_bio_strips_html_tags(self):
        user = User.objects.create_user(username='bio_user', password='pass12345')
        profile = user.profile
        form = ProfileUpdateForm(
            data={'bio': '<b>Hello</b> <script>alert(1)</script>'},
            instance=profile,
        )
        self.assertTrue(form.is_valid())
        self.assertEqual(form.cleaned_data['bio'], 'Hello alert(1)')
