"""DRF views for friend management."""

from __future__ import annotations

from rest_framework import status as http_status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from friends.application import friend_service
from friends.application.errors import FriendServiceError
from friends.interfaces.serializers import (
    BlockedOutputSerializer,
    FriendOutputSerializer,
    IncomingRequestOutputSerializer,
    OutgoingRequestOutputSerializer,
    UsernameInputSerializer,
)


def _service_error_response(exc: FriendServiceError) -> Response:
    return Response(
        {"error": exc.message, "code": exc.code},
        status=exc.status_code,
    )


class FriendListApiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            items = friend_service.list_friends(request.user)
        except FriendServiceError as exc:
            return _service_error_response(exc)
        serializer = FriendOutputSerializer(items, many=True, context={"request": request})
        return Response({"items": serializer.data})


class IncomingRequestsApiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            items = friend_service.list_incoming_requests(request.user)
        except FriendServiceError as exc:
            return _service_error_response(exc)
        serializer = IncomingRequestOutputSerializer(items, many=True, context={"request": request})
        return Response({"items": serializer.data})


class OutgoingRequestsApiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            items = friend_service.list_outgoing_requests(request.user)
        except FriendServiceError as exc:
            return _service_error_response(exc)
        serializer = OutgoingRequestOutputSerializer(items, many=True, context={"request": request})
        return Response({"items": serializer.data})


class SendRequestApiView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UsernameInputSerializer

    def get(self, _request):
        return Response({"detail": "Используйте POST с именем пользователя"})

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        try:
            friendship = friend_service.send_request(
                request.user,
                username,
            )
        except FriendServiceError as exc:
            return _service_error_response(exc)
        output = OutgoingRequestOutputSerializer(friendship, context={"request": request})
        return Response({"item": output.data}, status=http_status.HTTP_201_CREATED)


class AcceptRequestApiView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, friendship_id: int):
        try:
            friendship = friend_service.accept_request(request.user, int(friendship_id))
        except FriendServiceError as exc:
            return _service_error_response(exc)
        output = IncomingRequestOutputSerializer(friendship, context={"request": request})
        return Response({"item": output.data})


class DeclineRequestApiView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, friendship_id: int):
        try:
            friendship = friend_service.decline_request(request.user, int(friendship_id))
        except FriendServiceError as exc:
            return _service_error_response(exc)
        output = IncomingRequestOutputSerializer(friendship, context={"request": request})
        return Response({"item": output.data})


class CancelOutgoingRequestApiView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, friendship_id: int):
        try:
            friendship = friend_service.cancel_outgoing_request(request.user, int(friendship_id))
        except FriendServiceError as exc:
            return _service_error_response(exc)
        output = OutgoingRequestOutputSerializer(friendship, context={"request": request})
        return Response({"item": output.data})


class RemoveFriendApiView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id: int):
        try:
            friend_service.remove_friend(request.user, int(user_id))
        except FriendServiceError as exc:
            return _service_error_response(exc)
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class BlockedListApiView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            items = friend_service.list_blocked(request.user)
        except FriendServiceError as exc:
            return _service_error_response(exc)
        serializer = BlockedOutputSerializer(items, many=True, context={"request": request})
        return Response({"items": serializer.data})


class BlockUserApiView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UsernameInputSerializer

    def get(self, _request):
        return Response({"detail": "Используйте POST с именем пользователя"})

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        try:
            friendship = friend_service.block_user(
                request.user,
                username,
            )
        except FriendServiceError as exc:
            return _service_error_response(exc)
        return Response(
            {"item": {"id": friendship.pk, "status": friendship.status}},
            status=http_status.HTTP_201_CREATED,
        )


class UnblockUserApiView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id: int):
        try:
            friend_service.unblock_user(request.user, int(user_id))
        except FriendServiceError as exc:
            return _service_error_response(exc)
        return Response(status=http_status.HTTP_204_NO_CONTENT)
