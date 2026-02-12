import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AuthPage } from './AuthPage'

describe('AuthPage', () => {
  it('submits credentials and trims username', () => {
    const onSubmit = vi.fn()

    render(
      <AuthPage
        title="Вход"
        submitLabel="Войти"
        onSubmit={onSubmit}
        onNavigate={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Имя пользователя'), {
      target: { value: '  demo  ' },
    })
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'pass12345' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(onSubmit).toHaveBeenCalledWith('demo', 'pass12345', '')
  })

  it('renders confirm password for registration mode', () => {
    render(
      <AuthPage
        title="Регистрация"
        submitLabel="Создать аккаунт"
        onSubmit={vi.fn()}
        onNavigate={vi.fn()}
        requireConfirm
      />,
    )

    expect(screen.getByLabelText('Повторите пароль')).toBeInTheDocument()
  })

  it('navigates between login/register views', () => {
    const onNavigate = vi.fn()

    render(
      <AuthPage
        title="Вход"
        submitLabel="Войти"
        onSubmit={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))
    expect(onNavigate).toHaveBeenCalledWith('/register')
  })
})
