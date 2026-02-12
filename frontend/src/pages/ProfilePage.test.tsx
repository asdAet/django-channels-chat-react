import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProfilePage } from './ProfilePage'

const user = {
  username: 'demo',
  email: 'demo@example.com',
  profileImage: null,
  bio: '',
  registeredAt: '2026-01-01T10:00:00.000Z',
}

describe('ProfilePage', () => {
  it('asks guest to login before editing profile', () => {
    const onNavigate = vi.fn()

    render(
      <ProfilePage
        user={null}
        onSave={vi.fn(async () => ({ ok: true }))}
        onNavigate={onNavigate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(onNavigate).toHaveBeenCalledWith('/login')
  })

  it('shows field-level validation errors from onSave', async () => {
    const onSave = vi.fn(async () => ({
      ok: false as const,
      errors: { username: ['Имя уже занято'] },
      message: 'Проверьте введённые данные и попробуйте снова.',
    }))

    render(
      <ProfilePage
        user={user}
        onSave={onSave}
        onNavigate={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => {
      expect(screen.getByText('Имя уже занято')).toBeInTheDocument()
      expect(
        screen.getByText('Проверьте введённые данные и попробуйте снова.'),
      ).toBeInTheDocument()
    })
  })

  it('shows max-bio warning over 1000 chars', () => {
    render(
      <ProfilePage
        user={user}
        onSave={vi.fn(async () => ({ ok: true }))}
        onNavigate={vi.fn()}
      />,
    )

    const textarea = screen.getByLabelText('О себе')
    fireEvent.change(textarea, { target: { value: 'a'.repeat(1001) } })

    expect(screen.getByText('Максимум 1000 символов.')).toBeInTheDocument()
  })
})
