import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { Button, Card, Toast } from "../../shared/ui";
import styles from "./AuthForm.module.css";

type AuthMode = "login" | "register";

export type LoginSubmitPayload = {
  identifier: string;
  password: string;
};

export type RegisterSubmitPayload = {
  login: string;
  password: string;
  passwordConfirm: string;
  name: string;
  username?: string;
  email?: string;
};

type AuthFormProps = {
  mode: AuthMode;
  title: string;
  submitLabel: string;
  onSubmit: (payload: LoginSubmitPayload | RegisterSubmitPayload) => void;
  onGoogleAuth?: () => Promise<void> | void;
  googleAuthDisabledReason?: string | null;
  onNavigate: (path: string) => void;
  error?: string | null;
  passwordRules?: string[];
  className?: string;
};

export function AuthForm({
  mode,
  title,
  submitLabel,
  onSubmit,
  onGoogleAuth,
  googleAuthDisabledReason = null,
  onNavigate,
  error = null,
  passwordRules = [],
  className,
}: AuthFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  // const [username, setUsername] = useState("");
  // const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [googleAuthPending, setGoogleAuthPending] = useState(false);

  const isRegister = mode === "register";

  const canSubmit = useMemo(() => {
    if (isRegister) {
      return Boolean(login.trim() && name.trim() && password && confirm);
    }
    return Boolean(identifier.trim() && password);
  }, [confirm, identifier, isRegister, login, name, password]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (isRegister) {
      const payload: RegisterSubmitPayload = {
        login: login.trim(),
        password,
        passwordConfirm: confirm,
        name: name.trim(),
        // username: username.trim() || undefined,
        // email: email.trim() || undefined,
      };
      onSubmit(payload);
      return;
    }

    const payload: LoginSubmitPayload = {
      identifier: identifier.trim(),
      password,
    };
    onSubmit(payload);
  };

  const canUseGoogleAuth = Boolean(onGoogleAuth) && !googleAuthDisabledReason;

  const handleGoogleAuth = async () => {
    if (!onGoogleAuth || !canUseGoogleAuth || googleAuthPending) return;
    setGoogleAuthPending(true);
    try {
      await onGoogleAuth();
    } finally {
      setGoogleAuthPending(false);
    }
  };

  return (
    <div className={[styles.auth, className].filter(Boolean).join(" ")}>
      <Card wide className={styles.card}>
        <p className={styles.eyebrow}>{title}</p>
        <h2 className={styles.title}>{submitLabel}</h2>
        {error && (
          <Toast variant="danger" role="alert">
            {error}
          </Toast>
        )}
        <form className={styles.form} onSubmit={handleSubmit}>
          {isRegister ? (
            <>
              <label className={styles.field}>
                <span>Ваше имя</span>
                <input
                  type="text"
                  data-testid="auth-name-input"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span>Логин</span>
                <input
                  type="text"
                  data-testid="auth-login-input"
                  autoComplete="username"
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                />
              </label>

              {/* <label className={styles.field}>
                <span>Username (опционально)</span>
                <input
                  type="text"
                  data-testid="auth-username-input"
                  autoComplete="off"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label> */}

              {/* <label className={styles.field}>
                <span>Email (опционально)</span>
                <input
                  type="email"
                  data-testid="auth-email-input"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label> */}
            </>
          ) : (
            <label className={styles.field}>
              <span>Логин или email</span>
              <input
                type="text"
                data-testid="auth-identifier-input"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </label>
          )}

          <label className={styles.field}>
            <span>Пароль</span>
            <input
              type="password"
              data-testid="auth-password-input"
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {isRegister && (
            <label className={styles.field}>
              <span>Повторите пароль</span>
              <input
                type="password"
                data-testid="auth-confirm-input"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
          )}

          {isRegister && passwordRules.length > 0 && (
            <div className={styles.passwordRules}>
              <p className={styles.note}>
                Пароль должен соответствовать требованиям:
              </p>
              <ul className={styles.ticks}>
                {passwordRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          )}

          <Button
            variant="primary"
            type="submit"
            data-testid="auth-submit-button"
            disabled={!canSubmit}
          >
            {submitLabel}
          </Button>
        </form>

        <div className={styles.oauthSection}>
          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleAuth}
            disabled={!canUseGoogleAuth || googleAuthPending}
            data-testid="auth-google-button"
          >
            {googleAuthPending
              ? "Подключение к Google..."
              : "Продолжить с Google"}
          </Button>
          {googleAuthDisabledReason && (
            <p className={styles.oauthHint}>{googleAuthDisabledReason}</p>
          )}
        </div>

        <div className={styles.authSwitch}>
          {mode === "login" ? (
            <p>
              Нет аккаунта?{" "}
              <Button
                variant="link"
                onClick={() => onNavigate("/register")}
                className={styles.switchButton}
              >
                Зарегистрироваться
              </Button>
            </p>
          ) : (
            <p>
              Уже есть аккаунт?{" "}
              <Button
                variant="link"
                onClick={() => onNavigate("/login")}
                className={styles.switchButton}
              >
                Войти
              </Button>
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
