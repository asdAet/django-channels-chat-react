import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DirectChatsResponseDto,
  DirectStartResponseDto,
  RoomDetailsDto,
  RoomMessagesDto,
} from '../dto/chat'

const apiMocks = vi.hoisted(() => ({
  getPublicRoom: vi.fn<() => Promise<RoomDetailsDto>>(),
  getRoomDetails: vi.fn<(slug: string) => Promise<RoomDetailsDto>>(),
  getRoomMessages: vi.fn<
    (slug: string, params?: { limit?: number; beforeId?: number }) => Promise<RoomMessagesDto>
  >(),
  startDirectChat: vi.fn<(username: string) => Promise<DirectStartResponseDto>>(),
  getDirectChats: vi.fn<() => Promise<DirectChatsResponseDto>>(),
}))

vi.mock('../adapters/ApiService', () => ({
  apiService: apiMocks,
}))

/**
 * Выполняет функцию `loadController`.
 * @returns Результат выполнения `loadController`.
 */

const loadController = async () => {
  vi.resetModules()
  const mod = await import('./ChatController')
  return mod.chatController
}

describe('ChatController', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    apiMocks.getPublicRoom.mockReset()
    apiMocks.getRoomDetails.mockReset()
    apiMocks.getRoomMessages.mockReset()
    apiMocks.startDirectChat.mockReset()
    apiMocks.getDirectChats.mockReset()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('does not cache public room between calls', async () => {
    const room: RoomDetailsDto = { slug: 'public', name: 'Public', kind: 'public', created: false, createdBy: null }
    apiMocks.getPublicRoom.mockResolvedValue(room)

    const chatController = await loadController()

    await chatController.getPublicRoom()
    await chatController.getPublicRoom()

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getPublicRoom).toHaveBeenCalledTimes(2)
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('deduplicates in-flight public room request', async () => {
    let settle: (value: RoomDetailsDto) => void = () => undefined
    const pending = new Promise<RoomDetailsDto>((res) => {
      settle = res
    })
    apiMocks.getPublicRoom.mockReturnValue(pending)

    const chatController = await loadController()

    const firstPromise = chatController.getPublicRoom()
    const secondPromise = chatController.getPublicRoom()

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getPublicRoom).toHaveBeenCalledTimes(1)

    /**
     * Выполняет метод `settle`.
     * @param props Входной параметр `props`.
     * @returns Результат выполнения `settle`.
     */

    settle({ slug: 'public', name: 'Public', kind: 'public', created: false, createdBy: null })
    const [first, second] = await Promise.all([firstPromise, secondPromise])

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(first.slug).toBe('public')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(second.slug).toBe('public')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('deduplicates in-flight room details by slug', async () => {
    let settle: (value: RoomDetailsDto) => void = () => undefined
    const pending = new Promise<RoomDetailsDto>((res) => {
      settle = res
    })
    apiMocks.getRoomDetails.mockReturnValue(pending)

    const chatController = await loadController()

    const firstPromise = chatController.getRoomDetails('abc')
    const secondPromise = chatController.getRoomDetails('abc')

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getRoomDetails).toHaveBeenCalledTimes(1)

    /**
     * Выполняет метод `settle`.
     * @param props Входной параметр `props`.
     * @returns Результат выполнения `settle`.
     */

    settle({
      slug: 'abc',
      name: 'Room',
      kind: 'private',
      created: false,
      createdBy: null,
    })

    const [first, second] = await Promise.all([firstPromise, secondPromise])
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(first.slug).toBe('abc')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(second.slug).toBe('abc')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('does not cache room details after request completes', async () => {
    apiMocks.getRoomDetails.mockResolvedValue({
      slug: 'abc',
      name: 'Room',
      kind: 'private',
      created: false,
      createdBy: null,
    })

    const chatController = await loadController()

    await chatController.getRoomDetails('abc')
    await chatController.getRoomDetails('abc')

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getRoomDetails).toHaveBeenCalledTimes(2)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getRoomDetails).toHaveBeenNthCalledWith(1, 'abc')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getRoomDetails).toHaveBeenNthCalledWith(2, 'abc')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('deduplicates in-flight room messages by params', async () => {
    let settle: (value: RoomMessagesDto) => void = () => undefined
    const pending = new Promise<RoomMessagesDto>((res) => {
      settle = res
    })
    apiMocks.getRoomMessages.mockReturnValue(pending)

    const chatController = await loadController()

    const firstPromise = chatController.getRoomMessages('public', { limit: 50 })
    const secondPromise = chatController.getRoomMessages('public', { limit: 50 })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getRoomMessages).toHaveBeenCalledTimes(1)

    /**
     * Выполняет метод `settle`.
     * @param props Входной параметр `props`.
     * @returns Результат выполнения `settle`.
     */

    settle({
      messages: [],
      pagination: { limit: 50, hasMore: false, nextBefore: null },
    })

    await Promise.all([firstPromise, secondPromise])
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('does not cache room messages after request completes', async () => {
    apiMocks.getRoomMessages.mockResolvedValue({
      messages: [],
      pagination: { limit: 50, hasMore: false, nextBefore: null },
    })

    const chatController = await loadController()

    await chatController.getRoomMessages('public', { limit: 50 })
    await chatController.getRoomMessages('public', { limit: 50 })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getRoomMessages).toHaveBeenCalledTimes(2)
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('deduplicates in-flight direct chats request', async () => {
    let settle: (value: DirectChatsResponseDto) => void = () => undefined
    const pending = new Promise<DirectChatsResponseDto>((res) => {
      settle = res
    })
    apiMocks.getDirectChats.mockReturnValue(pending)

    const chatController = await loadController()

    const firstPromise = chatController.getDirectChats()
    const secondPromise = chatController.getDirectChats()

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getDirectChats).toHaveBeenCalledTimes(1)

    /**
     * Выполняет метод `settle`.
     * @param props Входной параметр `props`.
     * @returns Результат выполнения `settle`.
     */

    settle({
      items: [
        {
          slug: 'dm_123',
          peer: { username: 'alice', profileImage: null },
          lastMessage: 'hello',
          lastMessageAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    await Promise.all([firstPromise, secondPromise])
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('does not cache direct chats after request completes', async () => {
    apiMocks.getDirectChats.mockResolvedValue({
      items: [
        {
          slug: 'dm_123',
          peer: { username: 'alice', profileImage: null },
          lastMessage: 'hello',
          lastMessageAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    const chatController = await loadController()

    await chatController.getDirectChats()
    await chatController.getDirectChats()
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(apiMocks.getDirectChats).toHaveBeenCalledTimes(2)
  })
})
