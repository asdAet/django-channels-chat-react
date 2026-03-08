"""Contains chat API routing."""

from django.urls import include, path

from . import api

urlpatterns = [
    path("public-room/", api.public_room, name="api-public-room"),
    path("direct/start/", api.direct_start, name="api-direct-start"),
    path("direct/chats/", api.direct_chats, name="api-direct-chats"),
    path("rooms/unread/", api.unread_counts, name="api-unread-counts"),
    path("rooms/<str:room_slug>/", include("roles.interfaces.urls")),
    path("rooms/<path:room_slug>/messages/search/", api.search_messages, name="api-search-messages"),
    path("rooms/<path:room_slug>/messages/<int:message_id>/reactions/<str:emoji>/", api.message_reaction_remove, name="api-message-reaction-remove"),
    path("rooms/<path:room_slug>/messages/<int:message_id>/reactions/", api.message_reactions, name="api-message-reactions"),
    path("rooms/<path:room_slug>/messages/<int:message_id>/", api.message_detail, name="api-message-detail"),
    path("rooms/<path:room_slug>/messages/", api.room_messages, name="api-room-messages"),
    path("rooms/<path:room_slug>/attachments/", api.upload_attachments, name="api-upload-attachments"),
    path("rooms/<path:room_slug>/read/", api.mark_read_view, name="api-mark-read"),
    path("rooms/<path:room_slug>/", api.room_details, name="api-room-details"),
]
