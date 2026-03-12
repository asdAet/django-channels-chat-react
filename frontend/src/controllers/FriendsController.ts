import { apiService } from "../adapters/ApiService";
import type {
  BlockedUser,
  Friend,
  FriendRequest,
} from "../entities/friend/types";
import type { SendFriendRequestResponse } from "../dto/http/friends";

class FriendsController {
  public async getFriends(): Promise<Friend[]> {
    return apiService.getFriends();
  }

  public async sendFriendRequest(
    username: string,
  ): Promise<SendFriendRequestResponse> {
    return apiService.sendFriendRequest(username);
  }

  public async getIncomingRequests(): Promise<FriendRequest[]> {
    return apiService.getIncomingRequests();
  }

  public async getOutgoingRequests(): Promise<FriendRequest[]> {
    return apiService.getOutgoingRequests();
  }

  public async acceptFriendRequest(friendshipId: number): Promise<void> {
    return apiService.acceptFriendRequest(friendshipId);
  }

  public async declineFriendRequest(friendshipId: number): Promise<void> {
    return apiService.declineFriendRequest(friendshipId);
  }

  public async cancelOutgoingFriendRequest(
    friendshipId: number,
  ): Promise<void> {
    return apiService.cancelOutgoingFriendRequest(friendshipId);
  }

  public async removeFriend(userId: number): Promise<void> {
    return apiService.removeFriend(userId);
  }

  public async blockUser(username: string): Promise<void> {
    return apiService.blockUser(username);
  }

  public async unblockUser(userId: number): Promise<void> {
    return apiService.unblockUser(userId);
  }

  public async getBlockedUsers(): Promise<BlockedUser[]> {
    return apiService.getBlockedUsers();
  }
}

export const friendsController = new FriendsController();
