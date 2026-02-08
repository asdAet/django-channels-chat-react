import { apiService } from '../adapters/ApiService'
import type { RoomDetailsDto, RoomMessagesDto } from '../dto/chat'

class ChatController {
  public async getPublicRoom(): Promise<RoomDetailsDto> {
    return await apiService.getPublicRoom()
  }

  public async getRoomDetails(slug: string): Promise<RoomDetailsDto> {
    return await apiService.getRoomDetails(slug)
  }

  public async getRoomMessages(slug: string): Promise<RoomMessagesDto> {
    return await apiService.getRoomMessages(slug)
  }
}

export const chatController = new ChatController()

