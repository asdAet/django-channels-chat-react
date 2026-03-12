"""URL routes for friend management API."""

from django.urls import path

from friends.interfaces import views

urlpatterns = [
    path("", views.FriendListApiView.as_view(), name="api-friends-list"),
    path("<int:user_id>/", views.RemoveFriendApiView.as_view(), name="api-friends-remove"),
    path("requests/", views.SendRequestApiView.as_view(), name="api-friends-send-request"),
    path("requests/incoming/", views.IncomingRequestsApiView.as_view(), name="api-friends-incoming"),
    path("requests/outgoing/", views.OutgoingRequestsApiView.as_view(), name="api-friends-outgoing"),
    path(
        "requests/<int:friendship_id>/accept/",
        views.AcceptRequestApiView.as_view(),
        name="api-friends-accept",
    ),
    path(
        "requests/<int:friendship_id>/decline/",
        views.DeclineRequestApiView.as_view(),
        name="api-friends-decline",
    ),
    path(
        "requests/<int:friendship_id>/cancel/",
        views.CancelOutgoingRequestApiView.as_view(),
        name="api-friends-cancel",
    ),
    path("blocked/", views.BlockedListApiView.as_view(), name="api-friends-blocked-list"),
    path("block/", views.BlockUserApiView.as_view(), name="api-friends-block"),
    path("block/<int:user_id>/", views.UnblockUserApiView.as_view(), name="api-friends-unblock"),
]
