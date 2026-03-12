import { apiService } from "../adapters/ApiService";
import type {
  Role,
  MemberRoles,
  PermissionOverride,
  MyPermissions,
} from "../entities/role/types";

class RolesController {
  public async getRoomRoles(slug: string): Promise<Role[]> {
    return apiService.getRoomRoles(slug);
  }

  public async createRoomRole(
    slug: string,
    data: { name: string; color?: string; permissions?: number },
  ): Promise<Role> {
    return apiService.createRoomRole(slug, data);
  }

  public async updateRoomRole(
    slug: string,
    roleId: number,
    data: Partial<{
      name: string;
      color: string;
      permissions: number;
      position: number;
    }>,
  ): Promise<Role> {
    return apiService.updateRoomRole(slug, roleId, data);
  }

  public async deleteRoomRole(slug: string, roleId: number): Promise<void> {
    return apiService.deleteRoomRole(slug, roleId);
  }

  public async getMemberRoles(
    slug: string,
    userId: number,
  ): Promise<MemberRoles> {
    return apiService.getMemberRoles(slug, userId);
  }

  public async setMemberRoles(
    slug: string,
    userId: number,
    roleIds: number[],
  ): Promise<MemberRoles> {
    return apiService.setMemberRoles(slug, userId, roleIds);
  }

  public async getRoomOverrides(slug: string): Promise<PermissionOverride[]> {
    return apiService.getRoomOverrides(slug);
  }

  public async createRoomOverride(
    slug: string,
    data: {
      targetRoleId?: number;
      targetUserId?: number;
      allow?: number;
      deny?: number;
    },
  ): Promise<PermissionOverride> {
    return apiService.createRoomOverride(slug, data);
  }

  public async updateRoomOverride(
    slug: string,
    overrideId: number,
    data: Partial<{ allow: number; deny: number }>,
  ): Promise<PermissionOverride> {
    return apiService.updateRoomOverride(slug, overrideId, data);
  }

  public async deleteRoomOverride(
    slug: string,
    overrideId: number,
  ): Promise<void> {
    return apiService.deleteRoomOverride(slug, overrideId);
  }

  public async getMyPermissions(slug: string): Promise<MyPermissions> {
    return apiService.getMyPermissions(slug);
  }
}

export const rolesController = new RolesController();
