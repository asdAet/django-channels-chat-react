import { z } from 'zod'

import type { Message } from '../../entities/message/types'
import type { DirectChatListItem, RoomDetails, RoomPeer } from '../../entities/room/types'
import { decodeOrThrow } from '../core/codec'

const roomKindSchema = z.enum(['public', 'private', 'direct'])

const roomPeerSchema = z
  .object({
    username: z.string().min(1),
    profileImage: z.string().nullable().optional(),
    lastSeen: z.string().nullable().optional(),
  })
  .passthrough()

const roomDetailsSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string(),
    kind: roomKindSchema,
    peer: roomPeerSchema.nullable().optional(),
    created: z.boolean().optional(),
    createdBy: z.string().nullable().optional(),
  })
  .passthrough()

const messageSchema = z
  .object({
    id: z.number(),
    username: z.string().min(1),
    content: z.string(),
    profilePic: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough()

const roomMessagesPaginationSchema = z
  .object({
    limit: z.number(),
    hasMore: z.boolean(),
    nextBefore: z.number().nullable(),
  })
  .passthrough()

const roomMessagesSchema = z
  .object({
    messages: z.array(messageSchema),
    pagination: roomMessagesPaginationSchema.optional(),
  })
  .passthrough()

const directStartSchema = z
  .object({
    slug: z.string().min(1),
    kind: roomKindSchema,
    peer: roomPeerSchema,
  })
  .passthrough()

const directChatsSchema = z
  .object({
    items: z.array(
      z
        .object({
          slug: z.string().min(1),
          peer: roomPeerSchema,
          lastMessage: z.string(),
          lastMessageAt: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough()

const mapPeer = (dto: z.infer<typeof roomPeerSchema>): RoomPeer => ({
  username: dto.username,
  profileImage: dto.profileImage ?? null,
  lastSeen: dto.lastSeen ?? null,
})

const mapRoomDetails = (dto: z.infer<typeof roomDetailsSchema>): RoomDetails => ({
  slug: dto.slug,
  name: dto.name,
  kind: dto.kind,
  peer: dto.peer ? mapPeer(dto.peer) : dto.peer ?? undefined,
  created: dto.created,
  createdBy: dto.createdBy ?? null,
})

const mapMessage = (dto: z.infer<typeof messageSchema>): Message => ({
  id: dto.id,
  username: dto.username,
  content: dto.content,
  profilePic: dto.profilePic ?? null,
  createdAt: dto.createdAt,
})

export type RoomMessagesDto = {
  messages: Message[]
  pagination?: {
    limit: number
    hasMore: boolean
    nextBefore: number | null
  }
}

export type RoomMessagesParams = {
  limit?: number
  beforeId?: number
}

export type DirectStartResponseDto = {
  slug: string
  kind: RoomDetails['kind']
  peer: RoomPeer
}

export type DirectChatsResponseDto = {
  items: DirectChatListItem[]
}

/**
 * Декодирует payload /api/chat/public-room/.
 */
export const decodePublicRoomResponse = (input: unknown): RoomDetails => {
  const parsed = decodeOrThrow(roomDetailsSchema, input, 'chat/public-room')
  return mapRoomDetails(parsed)
}

/**
 * Декодирует payload /api/chat/rooms/:slug/.
 */
export const decodeRoomDetailsResponse = (input: unknown): RoomDetails => {
  const parsed = decodeOrThrow(roomDetailsSchema, input, 'chat/room-details')
  return mapRoomDetails(parsed)
}

/**
 * Декодирует payload /api/chat/rooms/:slug/messages/.
 */
export const decodeRoomMessagesResponse = (input: unknown): RoomMessagesDto => {
  const parsed = decodeOrThrow(roomMessagesSchema, input, 'chat/room-messages')
  return {
    messages: parsed.messages.map(mapMessage),
    pagination: parsed.pagination,
  }
}

/**
 * Декодирует payload /api/chat/direct/start/.
 */
export const decodeDirectStartResponse = (input: unknown): DirectStartResponseDto => {
  const parsed = decodeOrThrow(directStartSchema, input, 'chat/direct-start')
  return {
    slug: parsed.slug,
    kind: parsed.kind,
    peer: mapPeer(parsed.peer),
  }
}

/**
 * Декодирует payload /api/chat/direct/chats/.
 */
export const decodeDirectChatsResponse = (input: unknown): DirectChatsResponseDto => {
  const parsed = decodeOrThrow(directChatsSchema, input, 'chat/direct-chats')
  return {
    items: parsed.items.map((item) => ({
      slug: item.slug,
      peer: mapPeer(item.peer),
      lastMessage: item.lastMessage,
      lastMessageAt: item.lastMessageAt,
    })),
  }
}
