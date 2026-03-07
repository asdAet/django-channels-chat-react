"""REST API views for the groups subsystem."""

from typing import Any, cast

from rest_framework import status as http_status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from groups.application import (
    group_service,
    invite_service,
    member_service,
    ownership_service,
    pin_service,
)
from groups.application.group_service import (
    GroupConflictError,
    GroupError,
    GroupForbiddenError,
    GroupNotFoundError,
)

from .serializers import (
    BanInputSerializer,
    GroupCreateInputSerializer,
    GroupListItemSerializer,
    GroupOutputSerializer,
    GroupUpdateInputSerializer,
    InviteCreateInputSerializer,
    InviteOutputSerializer,
    InvitePreviewSerializer,
    JoinRequestOutputSerializer,
    MuteInputSerializer,
    PinInputSerializer,
    PinOutputSerializer,
    TransferOwnershipInputSerializer,
)


def _error(msg: str, code: int = 400) -> Response:
    return Response({"error": msg}, status=code)


def _validated_data(serializer: Any) -> dict[str, Any]:
    return cast(dict[str, Any], serializer.validated_data)


def _handle_group_errors(func):
    """Decorator to handle common group service errors."""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except GroupNotFoundError as exc:
            return _error(str(exc), http_status.HTTP_404_NOT_FOUND)
        except GroupForbiddenError as exc:
            return _error(str(exc), http_status.HTTP_403_FORBIDDEN)
        except GroupConflictError as exc:
            return _error(str(exc), http_status.HTTP_409_CONFLICT)
        except (GroupError, ValueError) as exc:
            return _error(str(exc), http_status.HTTP_400_BAD_REQUEST)
    wrapper.__name__ = func.__name__
    wrapper.__module__ = func.__module__
    return wrapper


# ── Group CRUD ─────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def create_group(request):
    ser = GroupCreateInputSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = _validated_data(ser)
    room = group_service.create_group(
        request.user,
        name=data["name"],
        description=data.get("description", ""),
        is_public=bool(data.get("isPublic", False)),
        username=data.get("username"),
    )
    info = group_service.get_group_info(room.slug, request.user)
    return Response(GroupOutputSerializer(info).data, status=http_status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([AllowAny])
@_handle_group_errors
def list_public_groups(request):
    search = request.query_params.get("search")
    page = int(request.query_params.get("page", 1))
    page_size = min(int(request.query_params.get("pageSize", 20)), 100)
    result = group_service.list_public_groups(search=search, page=page, page_size=page_size)
    result["items"] = GroupListItemSerializer(result["items"], many=True).data
    return Response(result)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([AllowAny])
@_handle_group_errors
def group_detail(request, slug):
    if request.method == "GET":
        user = getattr(request, "user", None)
        actor = user if user and getattr(user, "is_authenticated", False) else None
        info = group_service.get_group_info(slug, actor)
        return Response(GroupOutputSerializer(info).data)

    if request.method == "PATCH":
        if not getattr(request.user, "is_authenticated", False):
            return _error("Authentication required", 401)
        ser = GroupUpdateInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = _validated_data(ser)
        kwargs = {}
        if "name" in d:
            kwargs["name"] = d["name"]
        if "description" in d:
            kwargs["description"] = d["description"]
        if "isPublic" in d:
            kwargs["is_public"] = d["isPublic"]
        if "username" in d:
            kwargs["username"] = d["username"]
        if "slowModeSeconds" in d:
            kwargs["slow_mode_seconds"] = d["slowModeSeconds"]
        if "joinApprovalRequired" in d:
            kwargs["join_approval_required"] = d["joinApprovalRequired"]
        room = group_service.update_group(request.user, slug, **kwargs)
        info = group_service.get_group_info(room.slug, request.user)
        return Response(GroupOutputSerializer(info).data)

    # DELETE
    if not getattr(request.user, "is_authenticated", False):
        return _error("Authentication required", 401)
    group_service.delete_group(request.user, slug)
    return Response(status=http_status.HTTP_204_NO_CONTENT)


# ── Members ────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def join_group(request, slug):
    membership = member_service.join_group(request.user, slug)
    return Response({"roomSlug": slug, "status": "joined"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def leave_group(request, slug):
    member_service.leave_group(request.user, slug)
    return Response(status=http_status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def list_members(request, slug):
    page = int(request.query_params.get("page", 1))
    page_size = min(int(request.query_params.get("pageSize", 50)), 200)
    result = member_service.list_members(request.user, slug, page=page, page_size=page_size)
    return Response(result)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def kick_member(request, slug, user_id):
    member_service.kick_member(request.user, slug, int(user_id))
    return Response(status=http_status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def ban_member(request, slug, user_id):
    ser = BanInputSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = _validated_data(ser)
    member_service.ban_member(
        request.user, slug, int(user_id), reason=data.get("reason", "")
    )
    return Response(status=http_status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def unban_member(request, slug, user_id):
    member_service.unban_member(request.user, slug, int(user_id))
    return Response(status=http_status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def mute_member(request, slug, user_id):
    ser = MuteInputSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = _validated_data(ser)
    member_service.mute_member(
        request.user, slug, int(user_id),
        duration_seconds=data["durationSeconds"],
    )
    return Response(status=http_status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def unmute_member(request, slug, user_id):
    member_service.unmute_member(request.user, slug, int(user_id))
    return Response(status=http_status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def list_banned(request, slug):
    items = member_service.list_banned(request.user, slug)
    return Response({"items": items})


# ── Invite Links ───────────────────────────────────────────────────────

@api_view(["POST", "GET"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def group_invites(request, slug):
    if request.method == "POST":
        ser = InviteCreateInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = _validated_data(ser)
        invite = invite_service.create_invite(
            request.user,
            slug,
            name=data.get("name", ""),
            expires_in_seconds=data.get("expiresInSeconds"),
            max_uses=data.get("maxUses", 0),
        )
        return Response(InviteOutputSerializer(invite).data, status=http_status.HTTP_201_CREATED)

    # GET
    invites = invite_service.list_invites(request.user, slug)
    return Response({"items": InviteOutputSerializer(invites, many=True).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def revoke_invite(request, slug, code):
    invite_service.revoke_invite(request.user, slug, code)
    return Response(status=http_status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([AllowAny])
@_handle_group_errors
def invite_preview(request, code):
    info = invite_service.get_invite_info(code)
    return Response(InvitePreviewSerializer(info).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def join_via_invite(request, code):
    result = invite_service.join_via_invite(request.user, code)
    return Response(result)


# ── Join Requests ──────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def list_join_requests(request, slug):
    items = member_service.list_join_requests(request.user, slug)
    return Response({"items": JoinRequestOutputSerializer(items, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def approve_join_request(request, slug, request_id):
    member_service.approve_join_request(request.user, slug, int(request_id))
    return Response({"status": "approved"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def reject_join_request(request, slug, request_id):
    member_service.reject_join_request(request.user, slug, int(request_id))
    return Response({"status": "rejected"})


# ── Pinned Messages ───────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([AllowAny])
@_handle_group_errors
def group_pins(request, slug):
    if request.method == "POST":
        if not getattr(request.user, "is_authenticated", False):
            return _error("Authentication required", 401)
        ser = PinInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = _validated_data(ser)
        pin = pin_service.pin_message(
            request.user, slug, data["messageId"]
        )
        return Response(
            {"messageId": pin.message_id, "pinnedAt": pin.pinned_at.isoformat()},
            status=http_status.HTTP_201_CREATED,
        )

    # GET
    user = getattr(request, "user", None)
    actor = user if user and getattr(user, "is_authenticated", False) else None
    items = pin_service.list_pinned(slug, actor)
    return Response({"items": PinOutputSerializer(items, many=True).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def unpin_message(request, slug, message_id):
    pin_service.unpin_message(request.user, slug, int(message_id))
    return Response(status=http_status.HTTP_204_NO_CONTENT)


# ── Ownership ──────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@_handle_group_errors
def transfer_ownership(request, slug):
    ser = TransferOwnershipInputSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = _validated_data(ser)
    ownership_service.transfer_ownership(
        request.user, slug, data["userId"]
    )
    return Response({"status": "transferred"})


class _HandledGroupAPIView(GenericAPIView):
    def _execute(self, handler):
        try:
            return handler()
        except GroupNotFoundError as exc:
            return _error(str(exc), http_status.HTTP_404_NOT_FOUND)
        except GroupForbiddenError as exc:
            return _error(str(exc), http_status.HTTP_403_FORBIDDEN)
        except GroupConflictError as exc:
            return _error(str(exc), http_status.HTTP_409_CONFLICT)
        except (GroupError, ValueError) as exc:
            return _error(str(exc), http_status.HTTP_400_BAD_REQUEST)


class GroupCreateInteractiveView(_HandledGroupAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = GroupCreateInputSerializer

    def post(self, request):
        def _impl():
            ser = self.get_serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = _validated_data(ser)
            room = group_service.create_group(
                request.user,
                name=data["name"],
                description=data.get("description", ""),
                is_public=bool(data.get("isPublic", False)),
                username=data.get("username"),
            )
            info = group_service.get_group_info(room.slug, request.user)
            return Response(
                GroupOutputSerializer(info).data,
                status=http_status.HTTP_201_CREATED,
            )

        return self._execute(_impl)


class GroupDetailInteractiveView(_HandledGroupAPIView):
    permission_classes = [AllowAny]
    serializer_class = GroupUpdateInputSerializer

    def get(self, request, slug):
        def _impl():
            user = getattr(request, "user", None)
            actor = user if user and getattr(user, "is_authenticated", False) else None
            info = group_service.get_group_info(slug, actor)
            return Response(GroupOutputSerializer(info).data)

        return self._execute(_impl)

    def patch(self, request, slug):
        def _impl():
            if not getattr(request.user, "is_authenticated", False):
                return _error("Authentication required", 401)
            ser = self.get_serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = _validated_data(ser)
            kwargs = {}
            if "name" in data:
                kwargs["name"] = data["name"]
            if "description" in data:
                kwargs["description"] = data["description"]
            if "isPublic" in data:
                kwargs["is_public"] = data["isPublic"]
            if "username" in data:
                kwargs["username"] = data["username"]
            if "slowModeSeconds" in data:
                kwargs["slow_mode_seconds"] = data["slowModeSeconds"]
            if "joinApprovalRequired" in data:
                kwargs["join_approval_required"] = data["joinApprovalRequired"]

            room = group_service.update_group(request.user, slug, **kwargs)
            info = group_service.get_group_info(room.slug, request.user)
            return Response(GroupOutputSerializer(info).data)

        return self._execute(_impl)

    def delete(self, request, slug):
        def _impl():
            if not getattr(request.user, "is_authenticated", False):
                return _error("Authentication required", 401)
            group_service.delete_group(request.user, slug)
            return Response(status=http_status.HTTP_204_NO_CONTENT)

        return self._execute(_impl)


class BanMemberInteractiveView(_HandledGroupAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BanInputSerializer

    def post(self, request, slug, user_id):
        def _impl():
            ser = self.get_serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = _validated_data(ser)
            member_service.ban_member(
                request.user,
                slug,
                int(user_id),
                reason=data.get("reason", ""),
            )
            return Response(status=http_status.HTTP_204_NO_CONTENT)

        return self._execute(_impl)


class MuteMemberInteractiveView(_HandledGroupAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MuteInputSerializer

    def post(self, request, slug, user_id):
        def _impl():
            ser = self.get_serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = _validated_data(ser)
            member_service.mute_member(
                request.user,
                slug,
                int(user_id),
                duration_seconds=data["durationSeconds"],
            )
            return Response(status=http_status.HTTP_204_NO_CONTENT)

        return self._execute(_impl)


class GroupInvitesInteractiveView(_HandledGroupAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InviteCreateInputSerializer

    def get(self, request, slug):
        def _impl():
            invites = invite_service.list_invites(request.user, slug)
            return Response({"items": InviteOutputSerializer(invites, many=True).data})

        return self._execute(_impl)

    def post(self, request, slug):
        def _impl():
            ser = self.get_serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = _validated_data(ser)
            invite = invite_service.create_invite(
                request.user,
                slug,
                name=data.get("name", ""),
                expires_in_seconds=data.get("expiresInSeconds"),
                max_uses=data.get("maxUses", 0),
            )
            return Response(
                InviteOutputSerializer(invite).data,
                status=http_status.HTTP_201_CREATED,
            )

        return self._execute(_impl)


class GroupPinsInteractiveView(_HandledGroupAPIView):
    permission_classes = [AllowAny]
    serializer_class = PinInputSerializer

    def get(self, request, slug):
        def _impl():
            user = getattr(request, "user", None)
            actor = user if user and getattr(user, "is_authenticated", False) else None
            items = pin_service.list_pinned(slug, actor)
            return Response({"items": PinOutputSerializer(items, many=True).data})

        return self._execute(_impl)

    def post(self, request, slug):
        def _impl():
            if not getattr(request.user, "is_authenticated", False):
                return _error("Authentication required", 401)
            ser = self.get_serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = _validated_data(ser)
            pin = pin_service.pin_message(request.user, slug, data["messageId"])
            return Response(
                {
                    "messageId": pin.message_id,
                    "pinnedAt": pin.pinned_at.isoformat(),
                },
                status=http_status.HTTP_201_CREATED,
            )

        return self._execute(_impl)


class TransferOwnershipInteractiveView(_HandledGroupAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TransferOwnershipInputSerializer

    def post(self, request, slug):
        def _impl():
            ser = self.get_serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = _validated_data(ser)
            ownership_service.transfer_ownership(
                request.user,
                slug,
                data["userId"],
            )
            return Response({"status": "transferred"})

        return self._execute(_impl)
