import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RoomDetailsDto, RoomMessagesDto } from '../dto/chat'

const controllerMocks = vi.hoisted(() => ({
  getRoomDetails: vi.fn<(slug: string) => Promise<RoomDetailsDto>>(),
  getRoomMessages: vi.fn<
    (slug: string, params?: { limit?: number; beforeId?: number }) => Promise<RoomMessagesDto>
  >(),
}))

vi.mock('../controllers/ChatController', () => ({
  chatController: controllerMocks,
}))

import { useChatRoom } from './useChatRoom'

const authUser = {
  username: 'tester',
  email: 'tester@example.com',
  profileImage: null,
  bio: '',
  lastSeen: null,
  registeredAt: null,
}

describe('useChatRoom', () => {
  /**
   * Выполняет метод `beforeEach`.
   * @returns Результат выполнения `beforeEach`.
   */

  beforeEach(() => {
    controllerMocks.getRoomDetails.mockReset()
    controllerMocks.getRoomMessages.mockReset()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('loads initial room details and deduplicates messages', async () => {
    controllerMocks.getRoomDetails.mockResolvedValue({
      slug: 'public',
      name: 'Public',
      kind: 'public',
      created: false,
      createdBy: null,
    })
    controllerMocks.getRoomMessages.mockResolvedValue({
      messages: [
        {
          id: 1,
          username: 'alice',
          content: 'Hello',
          profilePic: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 1,
          username: 'alice',
          content: 'Hello',
          profilePic: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      pagination: { limit: 50, hasMore: false, nextBefore: null },
    })

    const { result } = renderHook(() => useChatRoom('public', authUser))

    await waitFor(() => expect(result.current.loading).toBe(false))

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.details?.slug).toBe('public')
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.messages).toHaveLength(1)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.hasMore).toBe(false)
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('loads older messages by nextBefore cursor', async () => {
    controllerMocks.getRoomDetails.mockResolvedValue({
      slug: 'public',
      name: 'Public',
      kind: 'public',
      created: false,
      createdBy: null,
    })
    controllerMocks.getRoomMessages
      .mockResolvedValueOnce({
        messages: [
          {
            id: 2,
            username: 'alice',
            content: 'Second',
            profilePic: null,
            createdAt: '2026-01-01T00:02:00.000Z',
          },
        ],
        pagination: { limit: 50, hasMore: true, nextBefore: 2 },
      })
      .mockResolvedValueOnce({
        messages: [
          {
            id: 1,
            username: 'alice',
            content: 'First',
            profilePic: null,
            createdAt: '2026-01-01T00:01:00.000Z',
          },
        ],
        pagination: { limit: 50, hasMore: false, nextBefore: null },
      })

    const { result } = renderHook(() => useChatRoom('public', authUser))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.loadMore()
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(controllerMocks.getRoomMessages).toHaveBeenNthCalledWith(2, 'public', {
      limit: 50,
      beforeId: 2,
    })
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.messages.map((item) => item.id)).toEqual([1, 2])
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.hasMore).toBe(false)
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('sets load_failed when initial request fails', async () => {
    controllerMocks.getRoomDetails.mockRejectedValue(new Error('boom'))
    controllerMocks.getRoomMessages.mockResolvedValue({
      messages: [],
      pagination: { limit: 50, hasMore: false, nextBefore: null },
    })

    const { result } = renderHook(() => useChatRoom('public', authUser))

    await waitFor(() => expect(result.current.loading).toBe(false))
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.error).toBe('load_failed')
  })


  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('derives pagination when backend omits pagination payload', async () => {
    controllerMocks.getRoomDetails.mockResolvedValue({
      slug: 'public',
      name: 'Public',
      kind: 'public',
      created: false,
      createdBy: null,
    })
    const messages = Array.from({ length: 50 }, (_, idx) => ({
      id: idx + 1,
      username: 'alice',
      content: `m-${idx + 1}`,
      profilePic: null,
      createdAt: `2026-01-01T00:${String(idx).padStart(2, '0')}:00.000Z`,
    }))
    controllerMocks.getRoomMessages.mockResolvedValue({ messages })

    const { result } = renderHook(() => useChatRoom('public', authUser))

    await waitFor(() => expect(result.current.loading).toBe(false))

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.hasMore).toBe(true)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.messages).toHaveLength(50)

    await act(async () => {
      await result.current.loadMore()
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(controllerMocks.getRoomMessages).toHaveBeenNthCalledWith(2, 'public', {
      limit: 50,
      beforeId: 1,
    })
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('stops pagination when nextBefore cursor is missing', async () => {
    controllerMocks.getRoomDetails.mockResolvedValue({
      slug: 'public',
      name: 'Public',
      kind: 'public',
      created: false,
      createdBy: null,
    })
    controllerMocks.getRoomMessages.mockResolvedValue({
      messages: [],
      pagination: { limit: 50, hasMore: true, nextBefore: null },
    })

    const { result } = renderHook(() => useChatRoom('public', authUser))

    await waitFor(() => expect(result.current.loading).toBe(false))
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      await result.current.loadMore()
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.hasMore).toBe(false)
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(controllerMocks.getRoomMessages).toHaveBeenCalledTimes(1)
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('does not load private room for guests', async () => {
    /**
     * Выполняет метод `renderHook`.
     * @returns Результат выполнения `renderHook`.
     */

    renderHook(() => useChatRoom('private123', null))

    await act(async () => {
      await Promise.resolve()
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(controllerMocks.getRoomDetails).not.toHaveBeenCalled()
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(controllerMocks.getRoomMessages).not.toHaveBeenCalled()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('keeps messages when loadMore request fails', async () => {
    controllerMocks.getRoomDetails.mockResolvedValue({
      slug: 'public',
      name: 'Public',
      kind: 'public',
      created: false,
      createdBy: null,
    })
    controllerMocks.getRoomMessages
      .mockResolvedValueOnce({
        messages: [
          {
            id: 10,
            username: 'alice',
            content: 'latest',
            profilePic: null,
            createdAt: '2026-01-01T00:10:00.000Z',
          },
        ],
        pagination: { limit: 50, hasMore: true, nextBefore: 10 },
      })
      .mockRejectedValueOnce(new Error('failed to load more'))

    const { result } = renderHook(() => useChatRoom('public', authUser))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.loadMore()
    })

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.messages.map((m) => m.id)).toEqual([10])
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(result.current.loadingMore).toBe(false)
  })

})