import { apiService } from "../adapters/ApiService";
import type {
  Group,
  GroupListItem,
  GroupMember,
  GroupInvite,
  InvitePreview,
  JoinRequest,
  PinnedMessage,
  BannedMember,
} from "../entities/group/types";
import type { UpdateGroupInput } from "../domain/interfaces/IApiService";
import { emitConversationListRefresh } from "../shared/conversationList/events";

class GroupController {
  public async createGroup(data: {
    name: string;
    description?: string;
    isPublic?: boolean;
    username?: string | null;
  }): Promise<Group> {
    const group = await apiService.createGroup(data);
    emitConversationListRefresh();
    return group;
  }

  public async getPublicGroups(params?: {
    search?: string;
    limit?: number;
    before?: number;
  }): Promise<{ items: GroupListItem[]; total: number }> {
    return apiService.getPublicGroups(params);
  }

  public async getMyGroups(params?: {
    search?: string;
    limit?: number;
    before?: number;
  }): Promise<{ items: GroupListItem[]; total: number }> {
    return apiService.getMyGroups(params);
  }

  public async getGroupDetails(slug: string): Promise<Group> {
    return apiService.getGroupDetails(slug);
  }

  public async updateGroup(
    slug: string,
    data: UpdateGroupInput,
  ): Promise<Group> {
    const group = await apiService.updateGroup(slug, data);
    emitConversationListRefresh();
    return group;
  }

  public async deleteGroup(slug: string): Promise<void> {
    await apiService.deleteGroup(slug);
    emitConversationListRefresh();
  }

  public async joinGroup(slug: string): Promise<void> {
    await apiService.joinGroup(slug);
    emitConversationListRefresh();
  }

  public async leaveGroup(slug: string): Promise<void> {
    await apiService.leaveGroup(slug);
    emitConversationListRefresh();
  }

  public async getGroupMembers(
    slug: string,
    params?: { limit?: number; before?: number },
  ): Promise<{ items: GroupMember[]; total: number }> {
    return apiService.getGroupMembers(slug, params);
  }

  public async kickMember(slug: string, userId: number): Promise<void> {
    return apiService.kickMember(slug, userId);
  }

  public async banMember(
    slug: string,
    userId: number,
    reason?: string,
  ): Promise<void> {
    return apiService.banMember(slug, userId, reason);
  }

  public async unbanMember(slug: string, userId: number): Promise<void> {
    return apiService.unbanMember(slug, userId);
  }

  public async muteMember(
    slug: string,
    userId: number,
    durationSeconds = 3600,
  ): Promise<void> {
    return apiService.muteMember(slug, userId, durationSeconds);
  }

  public async unmuteMember(slug: string, userId: number): Promise<void> {
    return apiService.unmuteMember(slug, userId);
  }

  public async getBannedMembers(
    slug: string,
    params?: { limit?: number; before?: number },
  ): Promise<{ items: BannedMember[]; total: number }> {
    return apiService.getBannedMembers(slug, params);
  }

  public async createInvite(
    slug: string,
    data?: { maxUses?: number; expiresInHours?: number },
  ): Promise<GroupInvite> {
    return apiService.createInvite(slug, data);
  }

  public async getInvites(slug: string): Promise<GroupInvite[]> {
    return apiService.getInvites(slug);
  }

  public async revokeInvite(slug: string, code: string): Promise<void> {
    return apiService.revokeInvite(slug, code);
  }

  public async getInvitePreview(code: string): Promise<InvitePreview> {
    return apiService.getInvitePreview(code);
  }

  public async joinViaInvite(code: string): Promise<{ roomId: number }> {
    const result = await apiService.joinViaInvite(code);
    emitConversationListRefresh();
    return result;
  }

  public async getJoinRequests(slug: string): Promise<JoinRequest[]> {
    return apiService.getJoinRequests(slug);
  }

  public async approveJoinRequest(
    slug: string,
    requestId: number,
  ): Promise<void> {
    return apiService.approveJoinRequest(slug, requestId);
  }

  public async rejectJoinRequest(
    slug: string,
    requestId: number,
  ): Promise<void> {
    return apiService.rejectJoinRequest(slug, requestId);
  }

  public async getPinnedMessages(slug: string): Promise<PinnedMessage[]> {
    return apiService.getPinnedMessages(slug);
  }

  public async pinMessage(slug: string, messageId: number): Promise<void> {
    return apiService.pinMessage(slug, messageId);
  }

  public async unpinMessage(slug: string, messageId: number): Promise<void> {
    return apiService.unpinMessage(slug, messageId);
  }

  public async transferOwnership(slug: string, userId: number): Promise<void> {
    return apiService.transferOwnership(slug, userId);
  }
}

export const groupController = new GroupController();
