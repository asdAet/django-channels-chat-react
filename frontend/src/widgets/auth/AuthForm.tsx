import type { FormEvent } from "react";
import { useState } from "react";

import { useUsernameMaxLength } from "../../shared/config/limits";
import { Button, Card, Toast } from "../../shared/ui";
import styles from "./AuthForm.module.css";

type AuthFormProps = {
  title: string;
  submitLabel: string;
  onSubmit: (
    name: string,
    lastName: string,
    username: string,
    password: string,
    confirm?: string,
  ) => void;
  onNavigate: (path: string) => void;
  requireConfirm?: boolean;
  error?: string | null;
  passwordRules?: string[];
  className?: string;
};

const USERNAME_ALLOWED_RE = /^[A-Za-z]+$/;

export function AuthForm({
  title,
  submitLabel,
  onSubmit,
  onNavigate,
  requireConfirm = false,
  error = null,
  passwordRules = [],
  className,
}: AuthFormProps) {
  const usernameMaxLength = useUsernameMaxLength();
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const normalizedName = name.trim();
  const normalizedLastName = lastName.trim();
  const normalizedUsername = username.trim();
  const usernameHasInvalidChars =
    normalizedUsername.length > 0 &&
    !USERNAME_ALLOWED_RE.test(normalizedUsername);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (requireConfirm && !normalizedName) return;
    if (!normalizedUsername || !password || usernameHasInvalidChars) return;

    onSubmit(
      normalizedName,
      normalizedLastName,
      normalizedUsername,
      password,
      confirm,
    );
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
          {requireConfirm && (
            <>
              <label className={styles.field}>
                <span>Имя</span>
                <input
                  type="text"
                  data-testid="auth-name-input"
                  autoComplete="given-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Фамилия (необязательно)</span>
                <input
                  type="text"
                  data-testid="auth-last-name-input"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
            </>
          )}
          <label className={styles.field}>
            <span>Имя пользователя</span>
            <input
              type="text"
              data-testid="auth-username-input"
              autoComplete="username"
              value={username}
              maxLength={usernameMaxLength}
              pattern="[A-Za-z]+"
              title="Используйте только латинские буквы (A-Z, a-z)."
              onChange={(e) => setUsername(e.target.value)}
            />
            {usernameHasInvalidChars && (
              <span className={[styles.note, styles.errorNote].join(" ")}>
                Допустимы только латинские буквы (A-Z, a-z).
              </span>
            )}
          </label>
          <label className={styles.field}>
            <span>Пароль</span>
            <input
              type="password"
              data-testid="auth-password-input"
              autoComplete={requireConfirm ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {requireConfirm && (
            <label className={styles.field}>
              <span>Повторите пароль</span>
              <input
                type="password"
                data-testid="auth-confirm-input"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}
          {requireConfirm && passwordRules.length > 0 && (
            <div className={styles.passwordRules}>
              <p className={styles.note}>Пароль должен соответствовать требованиям:</p>
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
            disabled={
              !normalizedUsername ||
              !password ||
              usernameHasInvalidChars ||
              (requireConfirm && !normalizedName)
            }
          >
            {submitLabel}
          </Button>
        </form>
        <div className={styles.authSwitch}>
          {title === "Вход" ? (
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
