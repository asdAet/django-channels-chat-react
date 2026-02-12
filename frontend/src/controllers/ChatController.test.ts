import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RoomDetailsDto, RoomMessagesDto } from '../dto/chat'

const apiMocks = vi.hoisted(() => ({
  getPublicRoom: vi.fn<() => Promise<RoomDetailsDto>>(),
  getRoomDetails: vi.fn<(slug: string) => Promise<RoomDetailsDto>>(),
  getRoomMessages: vi.fn<
    (slug: string, params?: { limit?: number; beforeId?: number }) => Promise<RoomMessagesDto>
  >(),
}))

vi.mock('../adapters/ApiService', () => ({
  apiService: apiMocks,
}))

const loadController = async () => {
  vi.resetModules()
  const mod = await import('./ChatController')
  return mod.chatController
}

describe('ChatController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    apiMocks.getPublicRoom.mockReset()
    apiMocks.getRoomDetails.mockReset()
    apiMocks.getRoomMessages.mockReset()
  })

  it('caches public room by ttl', async () => {
    const room = { slug: 'public', name: 'Public', created: false, createdBy: null }
    apiMocks.getPublicRoom.mockResolvedValue(room)

    const chatController = await loadController()

    const first = await chatController.getPublicRoom()
    const second = await chatController.getPublicRoom()

    expect(first).toEqual(room)
    expect(second).toEqual(room)
    expect(apiMocks.getPublicRoom).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-01-01T00:02:00.000Z'))
    await chatController.getPublicRoom()
    expect(apiMocks.getPublicRoom).toHaveBeenCalledTimes(2)
  })

  it('deduplicates in-flight public room request', async () => {
    let resolve: ((value: RoomDetailsDto) => void) | null = null
    const pending = new Promise<RoomDetailsDto>((res) => {
      resolve = res
    })
    apiMocks.getPublicRoom.mockReturnValue(pending)

    const chatController = await loadController()

    const firstPromise = chatController.getPublicRoom()
    const secondPromise = chatController.getPublicRoom()

    expect(apiMocks.getPublicRoom).toHaveBeenCalledTimes(1)

    resolve?.({ slug: 'public', name: 'Public', created: false, createdBy: null })
    const [first, second] = await Promise.all([firstPromise, secondPromise])

    expect(first.slug).toBe('public')
    expect(second.slug).toBe('public')
  })

  it('uses room details cache key by slug', async () => {
    apiMocks.getRoomDetails.mockResolvedValue({
      slug: 'abc',
      name: 'Room',
      created: false,
      createdBy: null,
    })

    const chatController = await loadController()

    await chatController.getRoomDetails('abc')
    await chatController.getRoomDetails('abc')
    await chatController.getRoomDetails('xyz')

    expect(apiMocks.getRoomDetails).toHaveBeenCalledTimes(2)
    expect(apiMocks.getRoomDetails).toHaveBeenNthCalledWith(1, 'abc')
    expect(apiMocks.getRoomDetails).toHaveBeenNthCalledWith(2, 'xyz')
  })

  it('caches room messages by limit and beforeId params', async () => {
    apiMocks.getRoomMessages.mockResolvedValue({
      messages: [],
      pagination: { limit: 50, hasMore: false, nextBefore: null },
    })

    const chatController = await loadController()

    await chatController.getRoomMessages('public', { limit: 50 })
    await chatController.getRoomMessages('public', { limit: 50 })
    await chatController.getRoomMessages('public', { limit: 50, beforeId: 200 })

    expect(apiMocks.getRoomMessages).toHaveBeenCalledTimes(2)
    expect(apiMocks.getRoomMessages).toHaveBeenNthCalledWith(1, 'public', { limit: 50 })
    expect(apiMocks.getRoomMessages).toHaveBeenNthCalledWith(2, 'public', {
      limit: 50,
      beforeId: 200,
    })
  })
})
