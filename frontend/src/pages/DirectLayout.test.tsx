import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./DirectChatsPage', () => ({
  DirectChatsList: () => <div>DIRECT_LIST</div>,
}))

vi.mock('./DirectChatByUsernamePage', () => ({
  DirectChatByUsernamePage: ({ username }: { username: string }) => <div>CHAT:{username}</div>,
}))

import { DirectLayout } from './DirectLayout'

const user = {
  username: 'demo',
  email: 'demo@example.com',
  profileImage: null,
  bio: '',
  lastSeen: null,
  registeredAt: null,
}

describe('DirectLayout', () => {
  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows list and placeholder when no active chat', () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(<DirectLayout user={user} onNavigate={vi.fn()} />)

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByText('DIRECT_LIST')).toBeInTheDocument()
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByText('Выберите диалог слева, чтобы открыть чат.')).toBeInTheDocument()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('shows list and chat when username is provided', () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(<DirectLayout user={user} username="alice" onNavigate={vi.fn()} />)

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByText('DIRECT_LIST')).toBeInTheDocument()
    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByText('CHAT:alice')).toBeInTheDocument()
  })
})
