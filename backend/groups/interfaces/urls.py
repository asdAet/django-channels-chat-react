"""URL routing for the groups API."""

from django.urls import path

from . import views

app_name = "groups"

urlpatterns = [
    # Group CRUD
    path("", views.GroupCreateInteractiveView.as_view(), name="create"),
    path("public/", views.list_public_groups, name="list-public"),
    path("<slug:slug>/", views.GroupDetailInteractiveView.as_view(), name="detail"),

    # Members
    path("<slug:slug>/join/", views.join_group, name="join"),
    path("<slug:slug>/leave/", views.leave_group, name="leave"),
    path("<slug:slug>/members/", views.list_members, name="members"),
    path("<slug:slug>/members/<int:user_id>/", views.kick_member, name="kick"),
    path("<slug:slug>/members/<int:user_id>/ban/", views.BanMemberInteractiveView.as_view(), name="ban"),
    path("<slug:slug>/members/<int:user_id>/unban/", views.unban_member, name="unban"),
    path("<slug:slug>/members/<int:user_id>/mute/", views.MuteMemberInteractiveView.as_view(), name="mute"),
    path("<slug:slug>/members/<int:user_id>/unmute/", views.unmute_member, name="unmute"),
    path("<slug:slug>/banned/", views.list_banned, name="banned"),

    # Invite links
    path("<slug:slug>/invites/", views.GroupInvitesInteractiveView.as_view(), name="invites"),
    path("<slug:slug>/invites/<str:code>/", views.revoke_invite, name="revoke-invite"),

    # Join requests
    path("<slug:slug>/requests/", views.list_join_requests, name="join-requests"),
    path("<slug:slug>/requests/<int:request_id>/approve/", views.approve_join_request, name="approve-request"),
    path("<slug:slug>/requests/<int:request_id>/reject/", views.reject_join_request, name="reject-request"),

    # Pinned messages
    path("<slug:slug>/pins/", views.GroupPinsInteractiveView.as_view(), name="pins"),
    path("<slug:slug>/pins/<int:message_id>/", views.unpin_message, name="unpin"),

    # Ownership
    path("<slug:slug>/transfer-ownership/", views.TransferOwnershipInteractiveView.as_view(), name="transfer-ownership"),
]

# Invite preview & join (top-level, not nested under group slug)
invite_urlpatterns = [
    path("invite/<str:code>/", views.invite_preview, name="invite-preview"),
    path("invite/<str:code>/join/", views.join_via_invite, name="invite-join"),
]
