import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { chatController } from "../../controllers/ChatController";
import { groupController } from "../../controllers/GroupController";
import { rolesController } from "../../controllers/RolesController";
import type { RoomAttachmentItem } from "../../domain/interfaces/IApiService";
import {
  combinePermissionFlags,
  flagsFromMask,
} from "../../entities/role/bitmask";
import type {
  BannedMember,
  Group,
  GroupInvite,
  GroupMember,
  JoinRequest,
} from "../../entities/group/types";
import {
  Perm,
  type PermissionOverride,
  type Role,
} from "../../entities/role/types";
import { useRoomPermissions } from "../../hooks/useRoomPermissions";
import type { AvatarCrop } from "../../shared/api/users";
import { Avatar, AvatarCropModal, Modal, Spinner } from "../../shared/ui";
import styles from "../../styles/groups/GroupInfoPanel.module.css";

type Props = { slug: string; currentUsername?: string | null };
type ViewState =
  | "info"
  | "media"
  | "members"
  | "links"
  | "settings"
  | "invites"
  | "users";
type SettingsTab = "general" | "permissions";
type GroupLinkItem = {
  url: string;
  messageId: number;
  username: string;
  createdAt: string;
  excerpt: string;
};

const DEFAULT_MEMBER_ROLES = new Set(["@everyone", "viewer", "member"]);
const PERMISSION_ITEMS: Array<{ bit: number; label: string }> = [
  { bit: Perm.READ_MESSAGES, label: "Чтение сообщений" },
  { bit: Perm.SEND_MESSAGES, label: "Отправка сообщений" },
  { bit: Perm.ATTACH_FILES, label: "Отправка файлов" },
  { bit: Perm.EMBED_LINKS, label: "Встраивание ссылок" },
  { bit: Perm.ADD_REACTIONS, label: "Реакции" },
  { bit: Perm.MANAGE_MESSAGES, label: "Управление сообщениями" },
  { bit: Perm.KICK_MEMBERS, label: "Исключение участников" },
  { bit: Perm.BAN_MEMBERS, label: "Блокировка участников" },
  { bit: Perm.MUTE_MEMBERS, label: "Mute" },
  { bit: Perm.PIN_MESSAGES, label: "Pin messages" },
  { bit: Perm.INVITE_USERS, label: "Приглашения" },
  { bit: Perm.CHANGE_GROUP_INFO, label: "Изменение информации группы" },
  { bit: Perm.MANAGE_INVITES, label: "Управление инвайтами" },
  { bit: Perm.MANAGE_ROLES, label: "Управление ролями" },
  { bit: Perm.MANAGE_ROOM, label: "Управление комнатой" },
];
const PERMISSION_BITS = PERMISSION_ITEMS.map((item) => item.bit);

const extractErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== "object") return fallback;
  const candidate = error as {
    message?: string;
    data?: { error?: string; detail?: string };
  };
  if (candidate.data?.error) return candidate.data.error;
  if (candidate.data?.detail) return candidate.data.detail;
  if (candidate.message && !candidate.message.includes("status code"))
    return candidate.message;
  return fallback;
};

const getElevatedRoles = (roles: string[]) =>
  roles.filter((role) => !DEFAULT_MEMBER_ROLES.has(role.trim().toLowerCase()));
const toggleBit = (current: number[], bit: number): number[] =>
  current.includes(bit)
    ? current.filter((item) => item !== bit)
    : [...current, bit];
const bitsFromMask = (mask: number): number[] =>
  flagsFromMask(mask, PERMISSION_BITS);
const isImageAttachment = (contentType: string) =>
  contentType.startsWith("image/");
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const sameAvatarCrop = (
  left: AvatarCrop | null | undefined,
  right: AvatarCrop | null | undefined,
) => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
};
const LINK_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const extractHttpLinks = (content: string): string[] => {
  const matches = content.match(LINK_PATTERN);
  if (!matches) return [];
  return matches.map((value) => value.replace(/[),.;!?]+$/, ""));
};
const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};
const revokeBlobUrl = (value: string | null) => {
  if (value && value.startsWith("blob:")) {
    URL.revokeObjectURL(value);
  }
};

export function GroupInfoPanel({ slug, currentUsername = null }: Props) {
  const [view, setView] = useState<ViewState>("info");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [bannedMembers, setBannedMembers] = useState<BannedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPublic, setEditPublic] = useState(false);
  const [editJoinApproval, setEditJoinApproval] = useState(false);
  const [editSlowMode, setEditSlowMode] = useState("0");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);

  const [inviteHours, setInviteHours] = useState("24");
  const [inviteMaxUses, setInviteMaxUses] = useState("0");

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#99AAB5");
  const [newRoleBits, setNewRoleBits] = useState<number[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | "">("");
  const [roleEditName, setRoleEditName] = useState("");
  const [roleEditColor, setRoleEditColor] = useState("#99AAB5");
  const [roleEditBits, setRoleEditBits] = useState<number[]>([]);

  const [selectedMemberRoleUserId, setSelectedMemberRoleUserId] = useState<
    number | ""
  >("");
  const [memberRoleIds, setMemberRoleIds] = useState<number[]>([]);

  const [overrideMode, setOverrideMode] = useState<"create" | "edit">("create");
  const [editingOverrideId, setEditingOverrideId] = useState<number | null>(
    null,
  );
  const [overrideTargetType, setOverrideTargetType] = useState<"role" | "user">(
    "role",
  );
  const [overrideTargetId, setOverrideTargetId] = useState<number | "">("");
  const [overrideAllowBits, setOverrideAllowBits] = useState<number[]>([]);
  const [overrideDenyBits, setOverrideDenyBits] = useState<number[]>([]);

  const [banTargetUserId, setBanTargetUserId] = useState<number | "">("");
  const [banReason, setBanReason] = useState("");
  const [mediaItems, setMediaItems] = useState<RoomAttachmentItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [links, setLinks] = useState<GroupLinkItem[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [editAvatarCrop, setEditAvatarCrop] = useState<AvatarCrop | null>(null);
  const [editAvatarPreviewUrl, setEditAvatarPreviewUrl] = useState<
    string | null
  >(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestAvatarPreviewUrlRef = useRef<string | null>(null);
  const latestPendingAvatarUrlRef = useRef<string | null>(null);
  const perms = useRoomPermissions(slug);

  const selectedRole = useMemo(
    () =>
      selectedRoleId === ""
        ? null
        : (roles.find((role) => role.id === selectedRoleId) ?? null),
    [roles, selectedRoleId],
  );
  const editableRoles = useMemo(
    () => roles.filter((role) => !role.isDefault),
    [roles],
  );
  const roleNameMap = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles],
  );
  const memberNameMap = useMemo(
    () => new Map(members.map((member) => [member.userId, member.username])),
    [members],
  );
  const isSelfMember = useCallback(
    (member: GroupMember) => {
      if (member.isSelf) return true;
      if (currentUsername && member.username === currentUsername) return true;
      return false;
    },
    [currentUsername],
  );

  useEffect(() => {
    latestAvatarPreviewUrlRef.current = editAvatarPreviewUrl;
  }, [editAvatarPreviewUrl]);

  useEffect(() => {
    latestPendingAvatarUrlRef.current = pendingAvatarUrl;
  }, [pendingAvatarUrl]);

  useEffect(() => {
    return () => {
      revokeBlobUrl(latestAvatarPreviewUrlRef.current);
      if (
        latestPendingAvatarUrlRef.current &&
        latestPendingAvatarUrlRef.current !== latestAvatarPreviewUrlRef.current
      ) {
        revokeBlobUrl(latestPendingAvatarUrlRef.current);
      }
    };
  }, []);

  const loadRolesData = useCallback(async () => {
    if (!perms.canManageRoles) {
      setRoles([]);
      setOverrides([]);
      return;
    }
    const [rolesResult, overridesResult] = await Promise.all([
      rolesController.getRoomRoles(slug).catch(() => []),
      rolesController.getRoomOverrides(slug).catch(() => []),
    ]);
    setRoles(rolesResult);
    setOverrides(overridesResult);
  }, [perms.canManageRoles, slug]);

  const clearPendingAvatar = useCallback((revoke = true) => {
    if (revoke) {
      revokeBlobUrl(latestPendingAvatarUrlRef.current);
    }
    setPendingAvatarFile(null);
    setPendingAvatarUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupResult, membersResult] = await Promise.all([
        groupController.getGroupDetails(slug),
        groupController
          .getGroupMembers(slug, { page: 1, pageSize: 200 })
          .catch(() => ({ items: [] as GroupMember[], total: 0 })),
      ]);
      setGroup(groupResult);
      setMembers(membersResult.items);
      setEditName(groupResult.name);
      setEditDescription(groupResult.description);
      setEditUsername(groupResult.username ?? "");
      setEditPublic(groupResult.isPublic);
      setEditJoinApproval(groupResult.joinApprovalRequired);
      setEditSlowMode(String(groupResult.slowModeSeconds));
      setEditAvatarFile(null);
      setEditAvatarCrop(groupResult.avatarCrop ?? null);
      setEditAvatarPreviewUrl((prev) => {
        revokeBlobUrl(prev);
        return null;
      });
      clearPendingAvatar(true);
      await loadRolesData();
    } catch (err) {
      setError(
        extractErrorMessage(err, "Не удалось загрузить информацию о группе"),
      );
    } finally {
      setLoading(false);
    }
  }, [clearPendingAvatar, loadRolesData, slug]);

  const loadInvites = useCallback(async () => {
    try {
      const result = await groupController.getInvites(slug);
      setInvites(result.filter((item) => !item.isRevoked));
    } catch {
      setInvites([]);
    }
  }, [slug]);

  const loadJoinRequests = useCallback(async () => {
    try {
      setJoinRequests(await groupController.getJoinRequests(slug));
    } catch {
      setJoinRequests([]);
    }
  }, [slug]);

  const loadBanned = useCallback(async () => {
    try {
      const result = await groupController.getBannedMembers(slug);
      setBannedMembers(result.items);
    } catch {
      setBannedMembers([]);
    }
  }, [slug]);

  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    try {
      const result = await chatController.getRoomAttachments(slug, {
        limit: 120,
      });
      setMediaItems(result.items);
    } catch {
      setMediaItems([]);
    } finally {
      setMediaLoading(false);
    }
  }, [slug]);

  const loadLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      const collected: GroupLinkItem[] = [];
      const seen = new Set<string>();
      let beforeId: number | undefined;

      for (let page = 0; page < 4 && collected.length < 120; page += 1) {
        const result = await chatController.getRoomMessages(slug, {
          limit: 100,
          beforeId,
        });
        for (const message of result.messages) {
          if (!message.content) continue;
          const linksFromMessage = extractHttpLinks(message.content);
          for (const link of linksFromMessage) {
            const dedupeKey = `${message.id}:${link}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            collected.push({
              url: link,
              messageId: message.id,
              username: message.username,
              createdAt: message.createdAt,
              excerpt: message.content.slice(0, 180),
            });
          }
        }

        if (!result.pagination?.hasMore || !result.pagination.nextBefore) {
          break;
        }
        beforeId = result.pagination.nextBefore;
      }

      collected.sort((a, b) => b.messageId - a.messageId);
      setLinks(collected);
    } catch {
      setLinks([]);
    } finally {
      setLinksLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (view === "invites") {
      void loadInvites();
      void loadJoinRequests();
    }
    if (view === "users") {
      void loadBanned();
    }
    if (view === "media") {
      void loadMedia();
    }
    if (view === "links") {
      void loadLinks();
    }
  }, [loadBanned, loadInvites, loadJoinRequests, loadLinks, loadMedia, view]);

  useEffect(() => {
    if (selectedRoleId === "") {
      setRoleEditName("");
      setRoleEditColor("#99AAB5");
      setRoleEditBits([]);
      return;
    }
    const role = roles.find((item) => item.id === selectedRoleId);
    if (!role) {
      setSelectedRoleId("");
      return;
    }
    setRoleEditName(role.name);
    setRoleEditColor(role.color);
    setRoleEditBits(bitsFromMask(role.permissions));
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (selectedMemberRoleUserId === "") {
      setMemberRoleIds([]);
      return;
    }
    rolesController
      .getMemberRoles(slug, Number(selectedMemberRoleUserId))
      .then((result) => setMemberRoleIds(result.roleIds))
      .catch(() => setMemberRoleIds([]));
  }, [selectedMemberRoleUserId, slug]);

  const hasGeneralChanges = useMemo(() => {
    if (!group) return false;
    if (editName.trim() !== group.name) return true;
    if (editDescription.trim() !== group.description) return true;
    if ((editUsername.trim() || "") !== (group.username ?? "")) return true;
    if (editPublic !== group.isPublic) return true;
    if (editJoinApproval !== group.joinApprovalRequired) return true;
    if ((Number(editSlowMode) || 0) !== group.slowModeSeconds) return true;
    if (editAvatarFile !== null) return true;
    if (!sameAvatarCrop(editAvatarCrop, group.avatarCrop ?? null)) return true;
    return false;
  }, [
    editAvatarCrop,
    editAvatarFile,
    editDescription,
    editJoinApproval,
    editName,
    editPublic,
    editSlowMode,
    editUsername,
    group,
  ]);

  const saveGroupSettings = useCallback(async () => {
    if (!group) return;
    setBusyAction("save-group");
    setError(null);
    try {
      const payload: {
        name: string;
        description: string;
        username: string | null;
        isPublic: boolean;
        joinApprovalRequired: boolean;
        slowModeSeconds: number;
        avatar?: File;
        avatarCrop?: AvatarCrop | null;
      } = {
        name: editName.trim(),
        description: editDescription.trim(),
        username: editUsername.trim() || null,
        isPublic: editPublic,
        joinApprovalRequired: editJoinApproval,
        slowModeSeconds: Math.max(0, Number(editSlowMode) || 0),
      };
      if (editAvatarFile) payload.avatar = editAvatarFile;
      if (editAvatarCrop) payload.avatarCrop = editAvatarCrop;
      const updated = await groupController.updateGroup(slug, payload);
      setGroup(updated);
      setView("info");
      await loadBase();
    } catch (err) {
      setError(
        extractErrorMessage(err, "Не удалось сохранить настройки группы"),
      );
    } finally {
      setBusyAction(null);
    }
  }, [
    editAvatarCrop,
    editAvatarFile,
    editDescription,
    editJoinApproval,
    editName,
    editPublic,
    editSlowMode,
    editUsername,
    group,
    loadBase,
    slug,
  ]);

  const removeAvatar = useCallback(async () => {
    setBusyAction("remove-avatar");
    setError(null);
    try {
      const updated = await groupController.updateGroup(slug, {
        avatarAction: "remove",
      });
      setEditAvatarFile(null);
      setEditAvatarCrop(null);
      setEditAvatarPreviewUrl((prev) => {
        revokeBlobUrl(prev);
        return null;
      });
      clearPendingAvatar(true);
      setGroup(updated);
      await loadBase();
    } catch (err) {
      setError(extractErrorMessage(err, "Не удалось удалить аватар"));
    } finally {
      setBusyAction(null);
    }
  }, [clearPendingAvatar, loadBase, slug]);

  const handleAvatarInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) return;
      setError(null);
      clearPendingAvatar(true);
      const nextUrl = URL.createObjectURL(file);
      setPendingAvatarFile(file);
      setPendingAvatarUrl(nextUrl);
      event.currentTarget.value = "";
    },
    [clearPendingAvatar],
  );

  const handleAvatarCropCancel = useCallback(() => {
    clearPendingAvatar(true);
  }, [clearPendingAvatar]);

  const handleAvatarCropApply = useCallback(
    (nextCrop: AvatarCrop) => {
      if (!pendingAvatarFile || !pendingAvatarUrl) {
        clearPendingAvatar(true);
        return;
      }

      setEditAvatarFile(pendingAvatarFile);
      setEditAvatarCrop(nextCrop);
      setEditAvatarPreviewUrl((previous) => {
        if (previous && previous !== pendingAvatarUrl) {
          revokeBlobUrl(previous);
        }
        return pendingAvatarUrl;
      });

      setPendingAvatarFile(null);
      setPendingAvatarUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [clearPendingAvatar, pendingAvatarFile, pendingAvatarUrl],
  );

  const handleLeaveGroup = useCallback(async () => {
    setBusyAction("leave");
    setError(null);
    try {
      await groupController.leaveGroup(slug);
      window.location.href = "/groups";
    } catch (err) {
      setError(extractErrorMessage(err, "Не удалось покинуть группу"));
    } finally {
      setBusyAction(null);
      setConfirmLeave(false);
    }
  }, [slug]);

  const handleDeleteGroup = useCallback(async () => {
    setBusyAction("delete");
    setError(null);
    try {
      await groupController.deleteGroup(slug);
      window.location.href = "/groups";
    } catch (err) {
      setError(extractErrorMessage(err, "Не удалось удалить группу"));
    } finally {
      setBusyAction(null);
      setConfirmDelete(false);
    }
  }, [slug]);

  const activeViewTitle = useMemo(() => {
    if (view === "info") return "Group Info";
    if (view === "media") return "Media";
    if (view === "members") return "Members";
    if (view === "links") return "Links";
    if (view === "settings") return "Настройка";
    if (view === "invites") return "Приглашения";
    return "Управление пользователями";
  }, [view]);

  const createInvite = useCallback(async () => {
    setBusyAction("create-invite");
    setError(null);
    try {
      await groupController.createInvite(slug, {
        expiresInHours:
          (Number(inviteHours) || 0) > 0 ? Number(inviteHours) : undefined,
        maxUses:
          (Number(inviteMaxUses) || 0) > 0 ? Number(inviteMaxUses) : undefined,
      });
      await loadInvites();
    } catch (err) {
      setError(extractErrorMessage(err, "Не удалось создать invite-ссылку"));
    } finally {
      setBusyAction(null);
    }
  }, [inviteHours, inviteMaxUses, loadInvites, slug]);

  const revokeInvite = useCallback(
    async (code: string) => {
      setBusyAction(`revoke-${code}`);
      setError(null);
      try {
        await groupController.revokeInvite(slug, code);
        await loadInvites();
      } catch (err) {
        setError(extractErrorMessage(err, "Не удалось отозвать ссылку"));
      } finally {
        setBusyAction(null);
      }
    },
    [loadInvites, slug],
  );

  const createRole = useCallback(async () => {
    if (!newRoleName.trim()) return;
    setBusyAction("create-role");
    setError(null);
    try {
      await rolesController.createRoomRole(slug, {
        name: newRoleName.trim(),
        color: newRoleColor,
        permissions: combinePermissionFlags(newRoleBits),
      });
      setNewRoleName("");
      setNewRoleColor("#99AAB5");
      setNewRoleBits([]);
      await loadRolesData();
    } catch (err) {
      setError(extractErrorMessage(err, "Не удалось создать роль"));
    } finally {
      setBusyAction(null);
    }
  }, [loadRolesData, newRoleBits, newRoleColor, newRoleName, slug]);

  const updateRole = useCallback(async () => {
    if (selectedRoleId === "") return;
    setBusyAction(`update-role-${selectedRoleId}`);
    setError(null);
    try {
      await rolesController.updateRoomRole(slug, Number(selectedRoleId), {
        name: roleEditName.trim(),
        color: roleEditColor,
        permissions: combinePermissionFlags(roleEditBits),
      });
      await loadRolesData();
      await loadBase();
    } catch (err) {
      setError(extractErrorMessage(err, "Не удалось обновить роль"));
    } finally {
      setBusyAction(null);
    }
  }, [
    loadBase,
    loadRolesData,
    roleEditBits,
    roleEditColor,
    roleEditName,
    selectedRoleId,
    slug,
  ]);

  const deleteRole = useCallback(
    async (roleId: number) => {
      setBusyAction(`delete-role-${roleId}`);
      setError(null);
      try {
        await rolesController.deleteRoomRole(slug, roleId);
        await loadRolesData();
        await loadBase();
      } catch (err) {
        setError(extractErrorMessage(err, "Не удалось удалить роль"));
      } finally {
        setBusyAction(null);
      }
    },
    [loadBase, loadRolesData, slug],
  );

  const saveMemberRoles = useCallback(async () => {
    if (selectedMemberRoleUserId === "") return;
    setBusyAction("save-member-roles");
    setError(null);
    try {
      await rolesController.setMemberRoles(
        slug,
        Number(selectedMemberRoleUserId),
        memberRoleIds,
      );
      await loadBase();
    } catch (err) {
      setError(extractErrorMessage(err, "Не удалось обновить роли участника"));
    } finally {
      setBusyAction(null);
    }
  }, [loadBase, memberRoleIds, selectedMemberRoleUserId, slug]);

  const resetOverrideForm = useCallback(() => {
    setOverrideMode("create");
    setEditingOverrideId(null);
    setOverrideTargetType("role");
    setOverrideTargetId("");
    setOverrideAllowBits([]);
    setOverrideDenyBits([]);
  }, []);

  const editOverride = useCallback((item: PermissionOverride) => {
    setOverrideMode("edit");
    setEditingOverrideId(item.id);
    if (item.targetRoleId !== null) {
      setOverrideTargetType("role");
      setOverrideTargetId(item.targetRoleId);
    } else {
      setOverrideTargetType("user");
      setOverrideTargetId(item.targetUserId ?? "");
    }
    setOverrideAllowBits(bitsFromMask(item.allow));
    setOverrideDenyBits(bitsFromMask(item.deny));
  }, []);

  const saveOverride = useCallback(async () => {
    setBusyAction("save-override");
    setError(null);
    try {
      const allow = combinePermissionFlags(overrideAllowBits);
      const deny = combinePermissionFlags(overrideDenyBits);
      if (overrideMode === "edit" && editingOverrideId !== null) {
        await rolesController.updateRoomOverride(slug, editingOverrideId, {
          allow,
          deny,
        });
      } else {
        if (overrideTargetId === "")
          throw new Error("Выберите цель для override");
        await rolesController.createRoomOverride(slug, {
          targetRoleId:
            overrideTargetType === "role"
              ? Number(overrideTargetId)
              : undefined,
          targetUserId:
            overrideTargetType === "user"
              ? Number(overrideTargetId)
              : undefined,
          allow,
          deny,
        });
      }
      await loadRolesData();
      resetOverrideForm();
    } catch (err) {
      setError(extractErrorMessage(err, "Не удалось сохранить override"));
    } finally {
      setBusyAction(null);
    }
  }, [
    editingOverrideId,
    loadRolesData,
    overrideAllowBits,
    overrideDenyBits,
    overrideMode,
    overrideTargetId,
    overrideTargetType,
    resetOverrideForm,
    slug,
  ]);

  const deleteOverride = useCallback(
    async (overrideId: number) => {
      setBusyAction(`delete-override-${overrideId}`);
      setError(null);
      try {
        await rolesController.deleteRoomOverride(slug, overrideId);
        await loadRolesData();
      } catch (err) {
        setError(extractErrorMessage(err, "Не удалось удалить override"));
      } finally {
        setBusyAction(null);
      }
    },
    [loadRolesData, slug],
  );

  const handleMemberAction = useCallback(
    async (action: "kick" | "ban" | "mute" | "unmute", userId: number) => {
      const target = members.find((member) => member.userId === userId);
      if (target && isSelfMember(target)) {
        setError("Нельзя применять действие к себе.");
        return;
      }
      setBusyAction(`${action}-${userId}`);
      setError(null);
      try {
        if (action === "kick") await groupController.kickMember(slug, userId);
        if (action === "ban") await groupController.banMember(slug, userId);
        if (action === "mute")
          await groupController.muteMember(slug, userId, 3600);
        if (action === "unmute")
          await groupController.unmuteMember(slug, userId);
        await loadBase();
        if (action === "ban" || action === "kick") await loadBanned();
      } catch (err) {
        setError(
          extractErrorMessage(
            err,
            "Не удалось выполнить действие с участником",
          ),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [isSelfMember, loadBanned, loadBase, members, slug],
  );

  const approveRequest = useCallback(
    async (requestId: number) => {
      setBusyAction(`approve-${requestId}`);
      setError(null);
      try {
        await groupController.approveJoinRequest(slug, requestId);
        await loadJoinRequests();
        await loadBase();
      } catch (err) {
        setError(extractErrorMessage(err, "Не удалось одобрить заявку"));
      } finally {
        setBusyAction(null);
      }
    },
    [loadBase, loadJoinRequests, slug],
  );

  const rejectRequest = useCallback(
    async (requestId: number) => {
      setBusyAction(`reject-${requestId}`);
      setError(null);
      try {
        await groupController.rejectJoinRequest(slug, requestId);
        await loadJoinRequests();
      } catch (err) {
        setError(extractErrorMessage(err, "Не удалось отклонить заявку"));
      } finally {
        setBusyAction(null);
      }
    },
    [loadJoinRequests, slug],
  );

  const availableBanTargets = useMemo(
    () =>
      members.filter(
        (member) =>
          !isSelfMember(member) &&
          !bannedMembers.some((banned) => banned.userId === member.userId),
      ),
    [bannedMembers, isSelfMember, members],
  );

  const banMemberFromForm = useCallback(async () => {
    if (!banTargetUserId) return;
    const selectedTarget = members.find(
      (member) => member.userId === Number(banTargetUserId),
    );
    if (selectedTarget && isSelfMember(selectedTarget)) {
      setError("Нельзя применять действие к себе.");
      return;
    }
    setBusyAction("ban-form");
    setError(null);
    try {
      await groupController.banMember(
        slug,
        Number(banTargetUserId),
        banReason.trim() || undefined,
      );
      setBanTargetUserId("");
      setBanReason("");
      await loadBanned();
      await loadBase();
    } catch (err) {
      setError(extractErrorMessage(err, "Не удалось заблокировать участника"));
    } finally {
      setBusyAction(null);
    }
  }, [
    banReason,
    banTargetUserId,
    isSelfMember,
    loadBanned,
    loadBase,
    members,
    slug,
  ]);

  const unbanMember = useCallback(
    async (userId: number) => {
      setBusyAction(`unban-${userId}`);
      setError(null);
      try {
        await groupController.unbanMember(slug, userId);
        await loadBanned();
        await loadBase();
      } catch (err) {
        setError(
          extractErrorMessage(err, "Не удалось разблокировать участника"),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [loadBanned, loadBase, slug],
  );

  const effectiveAvatarUrl = editAvatarPreviewUrl ?? group?.avatarUrl ?? null;
  const effectiveAvatarCrop = editAvatarCrop ?? group?.avatarCrop ?? null;

  if (loading)
    return (
      <div className={styles.centered}>
        <Spinner size="md" />
      </div>
    );
  if (!group) return <div className={styles.error}>Группа недоступна.</div>;

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        {view !== "info" && (
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setView("info")}
          >
            ←
          </button>
        )}
        <h4 className={styles.topTitle}>{activeViewTitle}</h4>
      </div>
      {error && <div className={styles.error}>{error}</div>}

      {view === "info" && (
        <div className={styles.infoView}>
          <section className={styles.profileCard}>
            <Avatar
              username={group.name}
              profileImage={group.avatarUrl}
              avatarCrop={group.avatarCrop ?? undefined}
              size="default"
            />
            <div className={styles.profileMeta}>
              <h5>{group.name}</h5>
              <p>{group.memberCount} участников</p>
              {group.username && <p>@{group.username}</p>}
            </div>
          </section>

          <section className={styles.quickActions}>
            <button
              type="button"
              className={styles.quickAction}
              data-testid="group-quick-settings"
              onClick={() => setView("settings")}
            >
              Настройка
            </button>
            <button
              type="button"
              className={styles.quickAction}
              data-testid="group-quick-invites"
              onClick={() => setView("invites")}
            >
              Приглашения
            </button>
            <button
              type="button"
              className={styles.quickAction}
              data-testid="group-quick-users"
              onClick={() => setView("users")}
            >
              Управление пользователями
            </button>
            <button
              type="button"
              className={[styles.quickAction, styles.quickActionDanger].join(
                " ",
              )}
              onClick={() => setConfirmLeave(true)}
            >
              Покинуть группу
            </button>
            {perms.isAdmin && (
              <button
                type="button"
                className={[styles.quickAction, styles.quickActionDanger].join(
                  " ",
                )}
                onClick={() => setConfirmDelete(true)}
              >
                Удалить группу
              </button>
            )}
          </section>

          <section className={styles.GroupData}>
            <button
              type="button"
              className={styles.quickAction}
              data-testid="group-quick-media"
              onClick={() => setView("media")}
            >
              Media
            </button>
            <button
              type="button"
              className={styles.quickAction}
              data-testid="group-quick-members"
              onClick={() => setView("members")}
            >
              Members
            </button>
            <button
              type="button"
              className={styles.quickAction}
              data-testid="group-quick-links"
              onClick={() => setView("links")}
            >
              Links
            </button>
          </section>

          <section className={styles.section}>
            <div className={styles.kvRow}>
              <span>Описание</span>
              <strong>{group.description || "—"}</strong>
            </div>
            <div className={styles.kvRow}>
              <span>Тип</span>
              <strong>{group.isPublic ? "Public" : "Private"}</strong>
            </div>
            <div className={styles.kvRow}>
              <span>Slow mode</span>
              <strong>
                {group.slowModeSeconds > 0
                  ? `${group.slowModeSeconds}s`
                  : "Off"}
              </strong>
            </div>
          </section>
        </div>
      )}

      {view === "media" && (
        <div className={styles.formView}>
          {mediaLoading && (
            <div className={styles.centered}>
              <Spinner size="sm" />
            </div>
          )}
          {!mediaLoading && mediaItems.length === 0 && (
            <p className={styles.empty}>Медиа и файлы пока не найдены.</p>
          )}
          {!mediaLoading && mediaItems.length > 0 && (
            <div className={styles.mediaGrid}>
              {mediaItems.map((item) => (
                <a
                  key={item.id}
                  href={item.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.mediaCard}
                >
                  {isImageAttachment(item.contentType) &&
                  (item.thumbnailUrl || item.url) ? (
                    <img
                      src={item.thumbnailUrl ?? (item.url as string)}
                      alt={item.originalFilename}
                      className={styles.mediaThumb}
                    />
                  ) : (
                    <div className={styles.fileThumb}>FILE</div>
                  )}
                  <div className={styles.mediaMeta}>
                    <span className={styles.mediaName}>
                      {item.originalFilename}
                    </span>
                    <span className={styles.mediaInfo}>
                      {formatFileSize(item.fileSize)} •{" "}
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "members" && (
        <div className={styles.formView}>
          <div className={styles.sectionTitle}>Участники</div>
          {members.map((member) => {
            const isSelf = isSelfMember(member);
            return (
              <div
                key={member.userId}
                className={styles.memberRow}
                data-testid={`group-member-${member.userId}`}
              >
                <div className={styles.memberMain}>
                  <Avatar
                    username={member.username}
                    profileImage={member.profileImage ?? null}
                    avatarCrop={member.avatarCrop ?? undefined}
                    size="tiny"
                  />
                  <div className={styles.memberMeta}>
                    <strong>
                      {member.username}
                      {isSelf ? " (Вы)" : ""}
                    </strong>
                    {getElevatedRoles(member.roles).length > 0 && (
                      <span>{getElevatedRoles(member.roles).join(", ")}</span>
                    )}
                  </div>
                </div>
                {!isSelf &&
                  (perms.canKick || perms.canBan || perms.canMute) && (
                    <div className={styles.memberActions}>
                      {perms.canMute && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleMemberAction(
                              member.isMuted ? "unmute" : "mute",
                              member.userId,
                            )
                          }
                          disabled={busyAction !== null}
                        >
                          {member.isMuted ? "Unmute" : "Mute"}
                        </button>
                      )}
                      {perms.canKick && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleMemberAction("kick", member.userId)
                          }
                          disabled={busyAction !== null}
                        >
                          Kick
                        </button>
                      )}
                      {perms.canBan && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleMemberAction("ban", member.userId)
                          }
                          disabled={busyAction !== null}
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
          {members.length === 0 && (
            <p className={styles.empty}>Нет участников.</p>
          )}
        </div>
      )}

      {view === "links" && (
        <div className={styles.formView}>
          {linksLoading && (
            <div className={styles.centered}>
              <Spinner size="sm" />
            </div>
          )}
          {!linksLoading && links.length === 0 && (
            <p className={styles.empty}>Ссылки в сообщениях не найдены.</p>
          )}
          {!linksLoading &&
            links.length > 0 &&
            links.map((item) => (
              <a
                key={`${item.messageId}-${item.url}`}
                className={styles.fileRow}
                href={`/rooms/${encodeURIComponent(slug)}?message=${item.messageId}`}
              >
                <div className={styles.mediaMeta}>
                  <span className={styles.mediaName}>{item.url}</span>
                  <span className={styles.mediaInfo}>
                    {item.username} • {formatDateTime(item.createdAt)}
                  </span>
                  <span className={styles.mediaInfo}>{item.excerpt}</span>
                </div>
                <span className={styles.fileInfo}>#{item.messageId}</span>
              </a>
            ))}
        </div>
      )}

      {view === "settings" && (
        <div className={styles.formView}>
          <section className={styles.tabs}>
            <button
              type="button"
              className={[
                styles.tab,
                settingsTab === "general" ? styles.tabActive : "",
              ].join(" ")}
              onClick={() => setSettingsTab("general")}
            >
              Общие
            </button>
            <button
              type="button"
              className={[
                styles.tab,
                settingsTab === "permissions" ? styles.tabActive : "",
              ].join(" ")}
              onClick={() => setSettingsTab("permissions")}
            >
              Permissions
            </button>
          </section>

          {settingsTab === "general" && (
            <>
              <div className={styles.avatarEditor}>
                <Avatar
                  username={group.name}
                  profileImage={effectiveAvatarUrl}
                  avatarCrop={effectiveAvatarCrop ?? undefined}
                  size="default"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.hiddenInput}
                  data-testid="group-avatar-input"
                  onChange={handleAvatarInputChange}
                  disabled={!perms.canManageRoom}
                />
                <div className={styles.avatarButtons}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!perms.canManageRoom}
                  >
                    Изменить аватар
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeAvatar()}
                    disabled={
                      !perms.canManageRoom || busyAction === "remove-avatar"
                    }
                  >
                    Удалить аватар
                  </button>
                </div>
              </div>

              <label className={styles.field}>
                <span>Название</span>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  maxLength={50}
                  disabled={!perms.canManageRoom}
                />
              </label>
              <label className={styles.field}>
                <span>Описание</span>
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  disabled={!perms.canManageRoom}
                />
              </label>
              <label className={styles.field}>
                <span>Username</span>
                <input
                  value={editUsername}
                  onChange={(event) => setEditUsername(event.target.value)}
                  maxLength={50}
                  disabled={!perms.canManageRoom}
                />
              </label>
              <label className={styles.field}>
                <span>Slow mode (seconds)</span>
                <input
                  type="number"
                  min={0}
                  max={86400}
                  value={editSlowMode}
                  onChange={(event) => setEditSlowMode(event.target.value)}
                  disabled={!perms.canManageRoom}
                />
              </label>
              <label className={styles.inlineToggle}>
                <input
                  type="checkbox"
                  checked={editPublic}
                  onChange={(event) => setEditPublic(event.target.checked)}
                  disabled={!perms.canManageRoom}
                />
                <span>Публичная группа</span>
              </label>
              <label className={styles.inlineToggle}>
                <input
                  type="checkbox"
                  checked={editJoinApproval}
                  onChange={(event) =>
                    setEditJoinApproval(event.target.checked)
                  }
                  disabled={!perms.canManageRoom}
                />
                <span>Требовать одобрение на вступление</span>
              </label>
              <button
                type="button"
                className={styles.primaryBtn}
                data-testid="group-save-settings"
                onClick={() => void saveGroupSettings()}
                disabled={
                  !perms.canManageRoom ||
                  !hasGeneralChanges ||
                  busyAction !== null
                }
              >
                {busyAction === "save-group"
                  ? "Сохранение..."
                  : "Сохранить настройки"}
              </button>
            </>
          )}

          {settingsTab === "permissions" && (
            <>
              <div className={styles.sectionTitle}>Создать роль</div>
              <label className={styles.field}>
                <span>Название роли</span>
                <input
                  value={newRoleName}
                  onChange={(event) => setNewRoleName(event.target.value)}
                  disabled={!perms.canManageRoles}
                />
              </label>
              <label className={styles.field}>
                <span>Цвет</span>
                <input
                  type="color"
                  value={newRoleColor}
                  onChange={(event) => setNewRoleColor(event.target.value)}
                  disabled={!perms.canManageRoles}
                />
              </label>
              <div className={styles.permissionsList}>
                {PERMISSION_ITEMS.map((item) => (
                  <label key={item.bit} className={styles.permissionItem}>
                    <input
                      type="checkbox"
                      checked={newRoleBits.includes(item.bit)}
                      disabled={!perms.canManageRoles}
                      onChange={() =>
                        setNewRoleBits((current) =>
                          toggleBit(current, item.bit),
                        )
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => void createRole()}
                disabled={
                  !perms.canManageRoles ||
                  !newRoleName.trim() ||
                  busyAction !== null
                }
              >
                Создать роль
              </button>

              {roles.map((role) => (
                <div key={role.id} className={styles.roleRow}>
                  <span
                    className={styles.roleDot}
                    style={{ backgroundColor: role.color }}
                  />
                  <strong>{role.name}</strong>
                  <div className={styles.requestActions}>
                    <button
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                    >
                      Выбрать
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRole(role.id)}
                      disabled={
                        !perms.canManageRoles ||
                        role.isDefault ||
                        busyAction !== null
                      }
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}

              {selectedRole && (
                <>
                  <label className={styles.field}>
                    <span>Название</span>
                    <input
                      value={roleEditName}
                      onChange={(event) => setRoleEditName(event.target.value)}
                      disabled={!perms.canManageRoles || selectedRole.isDefault}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Цвет</span>
                    <input
                      type="color"
                      value={roleEditColor}
                      onChange={(event) => setRoleEditColor(event.target.value)}
                      disabled={!perms.canManageRoles || selectedRole.isDefault}
                    />
                  </label>
                  <div className={styles.permissionsList}>
                    {PERMISSION_ITEMS.map((item) => (
                      <label key={item.bit} className={styles.permissionItem}>
                        <input
                          type="checkbox"
                          checked={roleEditBits.includes(item.bit)}
                          disabled={
                            !perms.canManageRoles || selectedRole.isDefault
                          }
                          onChange={() =>
                            setRoleEditBits((current) =>
                              toggleBit(current, item.bit),
                            )
                          }
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void updateRole()}
                    disabled={
                      !perms.canManageRoles ||
                      selectedRole.isDefault ||
                      busyAction !== null
                    }
                  >
                    Сохранить роль
                  </button>
                </>
              )}

              <div className={styles.sectionTitle}>Назначение ролей</div>
              <label className={styles.field}>
                <span>Участник</span>
                <select
                  value={
                    selectedMemberRoleUserId === ""
                      ? ""
                      : String(selectedMemberRoleUserId)
                  }
                  onChange={(event) =>
                    setSelectedMemberRoleUserId(
                      event.target.value ? Number(event.target.value) : "",
                    )
                  }
                  disabled={!perms.canManageRoles}
                >
                  <option value="">Выберите участника</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.username}
                    </option>
                  ))}
                </select>
              </label>
              {selectedMemberRoleUserId !== "" && (
                <>
                  <div className={styles.permissionsList}>
                    {editableRoles.map((role) => (
                      <label key={role.id} className={styles.permissionItem}>
                        <input
                          type="checkbox"
                          checked={memberRoleIds.includes(role.id)}
                          disabled={!perms.canManageRoles}
                          onChange={() =>
                            setMemberRoleIds((current) =>
                              current.includes(role.id)
                                ? current.filter((id) => id !== role.id)
                                : [...current, role.id],
                            )
                          }
                        />
                        <span>{role.name}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void saveMemberRoles()}
                    disabled={!perms.canManageRoles || busyAction !== null}
                  >
                    Сохранить роли участника
                  </button>
                </>
              )}

              <div className={styles.sectionTitle}>Permission Overrides</div>
              <label className={styles.field}>
                <span>Тип цели</span>
                <select
                  value={overrideTargetType}
                  onChange={(event) => {
                    setOverrideTargetType(
                      event.target.value as "role" | "user",
                    );
                    setOverrideTargetId("");
                  }}
                  disabled={!perms.canManageRoles || overrideMode === "edit"}
                >
                  <option value="role">Роль</option>
                  <option value="user">Пользователь</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Цель</span>
                <select
                  value={
                    overrideTargetId === "" ? "" : String(overrideTargetId)
                  }
                  onChange={(event) =>
                    setOverrideTargetId(
                      event.target.value ? Number(event.target.value) : "",
                    )
                  }
                  disabled={!perms.canManageRoles || overrideMode === "edit"}
                >
                  <option value="">Выберите цель</option>
                  {overrideTargetType === "role"
                    ? roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))
                    : members.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.username}
                        </option>
                      ))}
                </select>
              </label>
              <div className={styles.sectionTitle}>Allow</div>
              <div className={styles.permissionsList}>
                {PERMISSION_ITEMS.map((item) => (
                  <label key={item.bit} className={styles.permissionItem}>
                    <input
                      type="checkbox"
                      checked={overrideAllowBits.includes(item.bit)}
                      disabled={!perms.canManageRoles}
                      onChange={() =>
                        setOverrideAllowBits((current) =>
                          toggleBit(current, item.bit),
                        )
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <div className={styles.sectionTitle}>Deny</div>
              <div className={styles.permissionsList}>
                {PERMISSION_ITEMS.map((item) => (
                  <label key={item.bit} className={styles.permissionItem}>
                    <input
                      type="checkbox"
                      checked={overrideDenyBits.includes(item.bit)}
                      disabled={!perms.canManageRoles}
                      onChange={() =>
                        setOverrideDenyBits((current) =>
                          toggleBit(current, item.bit),
                        )
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <div className={styles.requestActions}>
                <button
                  type="button"
                  onClick={() => void saveOverride()}
                  disabled={!perms.canManageRoles || busyAction !== null}
                >
                  {overrideMode === "create"
                    ? "Создать override"
                    : "Сохранить override"}
                </button>
                <button
                  type="button"
                  onClick={resetOverrideForm}
                  disabled={busyAction !== null}
                >
                  Сбросить
                </button>
              </div>
              {overrides.map((item) => {
                const target =
                  item.targetRoleId !== null
                    ? `Role: ${roleNameMap.get(item.targetRoleId) ?? item.targetRoleId}`
                    : `User: ${memberNameMap.get(item.targetUserId ?? -1) ?? item.targetUserId}`;
                return (
                  <div key={item.id} className={styles.overrideRow}>
                    <strong>{target}</strong>
                    <div className={styles.requestActions}>
                      <button type="button" onClick={() => editOverride(item)}>
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteOverride(item.id)}
                        disabled={!perms.canManageRoles || busyAction !== null}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {view === "invites" && (
        <div className={styles.formView}>
          <div className={styles.sectionTitle}>Invite Links</div>
          <label className={styles.field}>
            <span>Срок действия (часы)</span>
            <input
              value={inviteHours}
              onChange={(event) => setInviteHours(event.target.value)}
              type="number"
              min={0}
              disabled={!perms.canInvite}
            />
          </label>
          <label className={styles.field}>
            <span>Лимит использований (0 = без лимита)</span>
            <input
              value={inviteMaxUses}
              onChange={(event) => setInviteMaxUses(event.target.value)}
              type="number"
              min={0}
              disabled={!perms.canInvite}
            />
          </label>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void createInvite()}
            disabled={!perms.canInvite || busyAction !== null}
          >
            {busyAction === "create-invite" ? "Создание..." : "Создать ссылку"}
          </button>
          {invites.map((invite) => (
            <div key={invite.code} className={styles.inviteRow}>
              <div className={styles.inviteMeta}>
                <strong>{invite.code}</strong>
                <span>
                  Uses: {invite.useCount}
                  {invite.maxUses > 0 ? ` / ${invite.maxUses}` : ""}
                </span>
              </div>
              <div className={styles.inviteActions}>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${window.location.origin}/invite/${invite.code}`,
                    )
                  }
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => void revokeInvite(invite.code)}
                  disabled={!perms.canInvite || busyAction !== null}
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}

          <div className={styles.sectionTitle}>Join Requests</div>
          {joinRequests.map((request) => (
            <div key={request.id} className={styles.requestRow}>
              <div className={styles.requestMeta}>
                <strong>{request.username}</strong>
                <span>{request.message || "Без комментария"}</span>
              </div>
              <div className={styles.requestActions}>
                <button
                  type="button"
                  onClick={() => void approveRequest(request.id)}
                  disabled={!perms.canKick || busyAction !== null}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void rejectRequest(request.id)}
                  disabled={!perms.canKick || busyAction !== null}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
          {joinRequests.length === 0 && (
            <p className={styles.empty}>Нет заявок на вступление.</p>
          )}
        </div>
      )}

      {view === "users" && (
        <div className={styles.formView}>
          <div className={styles.sectionTitle}>Участники</div>
          {members.map((member) => {
            const isSelf = isSelfMember(member);
            return (
              <div
                key={member.userId}
                className={styles.memberRow}
                data-testid={`group-member-${member.userId}`}
              >
                <div className={styles.memberMain}>
                  <Avatar
                    username={member.username}
                    profileImage={member.profileImage ?? null}
                    avatarCrop={member.avatarCrop ?? undefined}
                    size="tiny"
                  />
                  <div className={styles.memberMeta}>
                    <strong>
                      {member.username}
                      {isSelf ? " (Вы)" : ""}
                    </strong>
                    {getElevatedRoles(member.roles).length > 0 && (
                      <span>{getElevatedRoles(member.roles).join(", ")}</span>
                    )}
                  </div>
                </div>
                {!isSelf &&
                  (perms.canKick || perms.canBan || perms.canMute) && (
                    <div className={styles.memberActions}>
                      {perms.canMute && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleMemberAction(
                              member.isMuted ? "unmute" : "mute",
                              member.userId,
                            )
                          }
                          disabled={busyAction !== null}
                        >
                          {member.isMuted ? "Unmute" : "Mute"}
                        </button>
                      )}
                      {perms.canKick && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleMemberAction("kick", member.userId)
                          }
                          disabled={busyAction !== null}
                        >
                          Kick
                        </button>
                      )}
                      {perms.canBan && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleMemberAction("ban", member.userId)
                          }
                          disabled={busyAction !== null}
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
          {members.length === 0 && (
            <p className={styles.empty}>Нет участников.</p>
          )}

          <div className={styles.sectionTitle}>Блокировка участника</div>
          <label className={styles.field}>
            <span>Участник</span>
            <select
              data-testid="ban-member-select"
              value={banTargetUserId === "" ? "" : String(banTargetUserId)}
              onChange={(event) =>
                setBanTargetUserId(
                  event.target.value ? Number(event.target.value) : "",
                )
              }
              disabled={!perms.canBan}
            >
              <option value="">Выберите участника</option>
              {availableBanTargets.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.username}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Причина (необязательно)</span>
            <input
              value={banReason}
              onChange={(event) => setBanReason(event.target.value)}
              maxLength={500}
              placeholder="Причина бана"
              disabled={!perms.canBan}
            />
          </label>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void banMemberFromForm()}
            disabled={
              !perms.canBan || !banTargetUserId || busyAction === "ban-form"
            }
          >
            {busyAction === "ban-form" ? "Блокировка..." : "Заблокировать"}
          </button>

          <div className={styles.sectionTitle}>Banned Members</div>
          {bannedMembers.map((member) => (
            <div key={member.userId} className={styles.requestRow}>
              <div className={styles.requestMeta}>
                <strong>{member.username}</strong>
                <span>{member.reason || "Без причины"}</span>
                <span>Заблокировал: {member.bannedBy || "—"}</span>
              </div>
              <div className={styles.requestActions}>
                <button
                  type="button"
                  onClick={() => void unbanMember(member.userId)}
                  disabled={!perms.canBan || busyAction !== null}
                >
                  Unban
                </button>
              </div>
            </div>
          ))}
          {bannedMembers.length === 0 && (
            <p className={styles.empty}>Список блокировок пуст.</p>
          )}
        </div>
      )}

      <Modal
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Покинуть группу"
      >
        <p style={{ color: "#aaa", marginBottom: 16 }}>
          {perms.isAdmin
            ? `Вы владелец группы «${group.name}». При выходе группа будет удалена для всех участников.`
            : `Вы уверены, что хотите покинуть группу «${group.name}»?`}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className={styles.quickAction}
            onClick={() => setConfirmLeave(false)}
          >
            Отмена
          </button>
          <button
            type="button"
            className={[styles.quickAction, styles.quickActionDanger].join(" ")}
            onClick={() => void handleLeaveGroup()}
            disabled={busyAction === "leave"}
          >
            {busyAction === "leave"
              ? perms.isAdmin
                ? "Удаление..."
                : "Выход..."
              : perms.isAdmin
                ? "Удалить и выйти"
                : "Покинуть"}
          </button>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удалить группу"
      >
        <p style={{ color: "#aaa", marginBottom: 16 }}>
          Вы уверены, что хотите удалить группу «{group.name}»? Это действие
          необратимо.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className={styles.quickAction}
            onClick={() => setConfirmDelete(false)}
          >
            Отмена
          </button>
          <button
            type="button"
            className={[styles.quickAction, styles.quickActionDanger].join(" ")}
            onClick={() => void handleDeleteGroup()}
            disabled={busyAction === "delete"}
          >
            {busyAction === "delete" ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </Modal>

      <AvatarCropModal
        open={Boolean(pendingAvatarUrl)}
        image={pendingAvatarUrl}
        onCancel={handleAvatarCropCancel}
        onApply={handleAvatarCropApply}
      />
    </div>
  );
}
