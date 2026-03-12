import { AuthForm } from "../widgets/auth/AuthForm";
import styles from "../styles/pages/RegisterPage.module.css";

type Props = {
  onSubmit: (
    name: string,
    lastName: string,
    username: string,
    password1: string,
    password2: string,
  ) => void;
  onNavigate: (path: string) => void;
  error?: string | null;
  passwordRules?: string[];
};

/**
 * Страница регистрации пользователя.
 * @param props Обработчики формы регистрации и навигации.
 * @returns JSX-разметка страницы регистрации.
 */
export function RegisterPage({
  onSubmit,
  onNavigate,
  error = null,
  passwordRules = [],
}: Props) {
  return (
    <AuthForm
      title="Регистрация"
      submitLabel="Создать аккаунт"
      onSubmit={(name, lastName, username, password, confirm) =>
        onSubmit(name, lastName, username, password, confirm ?? "")
      }
      onNavigate={onNavigate}
      error={error}
      requireConfirm
      passwordRules={passwordRules}
      className={styles.page}
    />
  );
}
