import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AuthPage } from './AuthPage'

describe('AuthPage', () => {
  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('submits credentials and trims username', () => {
    const onSubmit = vi.fn()

    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

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

    /**
     * Выполняет метод `expect`.
     * @param onSubmit Входной параметр `onSubmit`.
     * @returns Результат выполнения `expect`.
     */

    expect(onSubmit).toHaveBeenCalledWith('demo', 'pass12345', '')
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('renders confirm password for registration mode', () => {
    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <AuthPage
        title="Регистрация"
        submitLabel="Создать аккаунт"
        onSubmit={vi.fn()}
        onNavigate={vi.fn()}
        requireConfirm
      />,
    )

    /**
     * Выполняет метод `expect`.
     * @returns Результат выполнения `expect`.
     */

    expect(screen.getByLabelText('Повторите пароль')).toBeInTheDocument()
  })

  /**
   * Выполняет метод `it`.
   * @returns Результат выполнения `it`.
   */

  it('navigates between login/register views', () => {
    const onNavigate = vi.fn()

    /**
     * Выполняет метод `render`.
     * @returns Результат выполнения `render`.
     */

    render(
      <AuthPage
        title="Вход"
        submitLabel="Войти"
        onSubmit={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))
    /**
     * Выполняет метод `expect`.
     * @param onNavigate Входной параметр `onNavigate`.
     * @returns Результат выполнения `expect`.
     */

    expect(onNavigate).toHaveBeenCalledWith('/register')
  })
})
