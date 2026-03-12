import { useEffect, useRef, useState, type ChangeEvent } from "react";

import type { UserProfile } from "../entities/user/types";
import type { AvatarCrop } from "../shared/api/users";
import { useUsernameMaxLength } from "../shared/config/limits";
import {
  avatarFallback,
  formatLastSeen,
  formatRegistrationDate,
} from "../shared/lib/format";
import { usePresence } from "../shared/presence";
import {
  AvatarCropModal,
  AvatarMedia,
  Button,
  Card,
  Panel,
  Toast,
} from "../shared/ui";
import styles from "../styles/pages/ProfilePage.module.css";

type SaveResult =
  | { ok: true }
  | { ok: false; errors?: Record<string, string[]>; message?: string };

type Props = {
  user: UserProfile | null;
  onSave: (fields: {
    name?: string;
    last_name?: string;
    username: string;
    email: string;
    image?: File | null;
    avatarCrop?: AvatarCrop | null;
    bio?: string;
  }) => Promise<SaveResult>;
  onNavigate: (path: string) => void;
};

const USERNAME_ALLOWED_RE = /^[A-Za-z]+$/;

export function ProfilePage({ user, onSave, onNavigate }: Props) {
  const usernameMaxLength = useUsernameMaxLength();
  const { online: presenceOnline, status: presenceStatus } = usePresence();

  const [form, setForm] = useState({
    name: user?.name || "",
    last_name: user?.last_name || "",
    username: user?.username || "",
    email: user?.email || "",
    bio: user?.bio || "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [draftAvatarCrop, setDraftAvatarCrop] = useState<AvatarCrop | null>(
    null,
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const previewUrl = localPreviewUrl ?? user?.profileImage ?? null;
  const avatarCrop = draftAvatarCrop ?? user?.avatarCrop ?? null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestPreviewUrlRef = useRef<string | null>(localPreviewUrl);
  const latestPendingUrlRef = useRef<string | null>(pendingUrl);

  const trimmedUsername = form.username.trim();
  const isUsernameTooLong = trimmedUsername.length > usernameMaxLength;
  const hasInvalidUsernameChars =
    trimmedUsername.length > 0 && !USERNAME_ALLOWED_RE.test(trimmedUsername);
  const isUsernameValid =
    trimmedUsername.length > 0 &&
    trimmedUsername.length <= usernameMaxLength &&
    !hasInvalidUsernameChars;
  const isBioValid = form.bio.length <= 1000;

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const revokeBlobUrl = (value: string | null) => {
    if (value && value.startsWith("blob:")) {
      URL.revokeObjectURL(value);
    }
  };

  const clearPendingState = (revoke = true) => {
    if (revoke) {
      revokeBlobUrl(pendingUrl);
    }
    setPendingFile(null);
    setPendingUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    latestPreviewUrlRef.current = localPreviewUrl;
  }, [localPreviewUrl]);

  useEffect(() => {
    latestPendingUrlRef.current = pendingUrl;
  }, [pendingUrl]);

  useEffect(() => {
    return () => {
      revokeBlobUrl(latestPreviewUrlRef.current);
      if (
        latestPendingUrlRef.current &&
        latestPendingUrlRef.current !== latestPreviewUrlRef.current
      ) {
        revokeBlobUrl(latestPendingUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!formError) return undefined;
    if (!formError.includes("Проверьте введенные данные")) return undefined;
    const timeoutId = window.setTimeout(() => setFormError(null), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [formError]);

  if (!user) {
    return (
      <Panel>
        <p>Нужно войти, чтобы редактировать профиль.</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => onNavigate("/login")}>
            Войти
          </Button>
          <Button variant="ghost" onClick={() => onNavigate("/register")}>
            Регистрация
          </Button>
        </div>
      </Panel>
    );
  }

  const usernameError = fieldErrors.username?.[0];
  const nameError = fieldErrors.name?.[0];
  const lastNameError = fieldErrors.last_name?.[0];
  const emailError = fieldErrors.email?.[0];
  const bioError = fieldErrors.bio?.[0];
  const imageError = fieldErrors.image?.[0];
  const genericError =
    formError || fieldErrors.non_field_errors?.[0] || fieldErrors.__all__?.[0];
  const isUserOnline =
    presenceStatus === "online" &&
    presenceOnline.some((entry) => entry.username === user.username);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    setFormError(null);
    clearFieldError("image");
    revokeBlobUrl(pendingUrl);

    const nextUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingUrl(nextUrl);

    event.currentTarget.value = "";
  };

  const handleCropCancel = () => {
    clearPendingState(true);
  };

  const handleCropApply = (nextCrop: AvatarCrop) => {
    if (!pendingFile || !pendingUrl) {
      clearPendingState(true);
      return;
    }

    setImage(pendingFile);
    setDraftAvatarCrop(nextCrop);
    setLocalPreviewUrl((prev) => {
      if (prev && prev !== pendingUrl) {
        revokeBlobUrl(prev);
      }
      return pendingUrl;
    });

    setPendingFile(null);
    setPendingUrl(null);
  };

  return (
    <>
      <Card wide className={styles.profileCard}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Редактировать профиль</h1>
            <p className={styles.subtitle}>
              Измените имя, юзернейм, био и фото профиля.
            </p>
          </div>
          <div className={styles.profileMeta}>
            {isUserOnline ? (
              <span>В сети</span>
            ) : (
              <span>
                Последний раз в сети: {formatLastSeen(user.lastSeen) || "—"}
              </span>
            )}
            <span>
              Регистрация: {formatRegistrationDate(user.registeredAt) || "—"}
            </span>
          </div>
        </header>

        {genericError && (
          <Toast variant="danger" role="alert">
            {genericError}
          </Toast>
        )}

        <section className={styles.avatarSection}>
          <div
            className={[
              styles.profileAvatarWrapper,
              isUserOnline ? styles.online : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-online={isUserOnline ? "true" : "false"}
          >
            <div
              className={styles.profileAvatar}
              role="button"
              tabIndex={0}
              aria-label="Загрузить фото профиля"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              {previewUrl ? (
                <AvatarMedia
                  src={previewUrl}
                  alt={user.username}
                  avatarCrop={avatarCrop}
                  loading="eager"
                />
              ) : (
                <span>{avatarFallback(user.username)}</span>
              )}
              <div className={styles.avatarOverlay}>Изменить</div>
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className={styles.hiddenInput}
              onChange={handleFileChange}
            />
          </div>
          <p className={styles.caption}>
            Нажмите на аватар, чтобы выбрать новое фото.
          </p>
          {imageError && (
            <p className={[styles.note, styles.errorNote].join(" ")}>
              {imageError}
            </p>
          )}
        </section>

        <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            setFormError(null);
            const result = await onSave({
              ...form,
              image,
              avatarCrop: avatarCrop ?? null,
              bio: form.bio,
            });
            if (result.ok) {
              setFieldErrors({});
              return;
            }
            if (result.errors) {
              setFieldErrors(result.errors);
            } else {
              setFieldErrors({});
            }
            if (result.message) {
              setFormError(result.message);
            }
          }}
        >
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Основные данные</h2>
            <div className={styles.fieldGrid}>
              <label
                className={[styles.field, nameError ? styles.fieldError : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span>Имя</span>
                <input
                  type="text"
                  data-testid="profile-name-input"
                  value={form.name}
                  onChange={(event) => {
                    setForm({ ...form, name: event.target.value });
                    setFormError(null);
                    clearFieldError("name");
                  }}
                />
                {nameError && (
                  <span className={[styles.note, styles.errorNote].join(" ")}>
                    {nameError}
                  </span>
                )}
              </label>

              <label
                className={[
                  styles.field,
                  lastNameError ? styles.fieldError : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span>Фамилия (необязательно)</span>
                <input
                  type="text"
                  data-testid="profile-last-name-input"
                  value={form.last_name}
                  onChange={(event) => {
                    setForm({ ...form, last_name: event.target.value });
                    setFormError(null);
                    clearFieldError("last_name");
                  }}
                />
                {lastNameError && (
                  <span className={[styles.note, styles.errorNote].join(" ")}>
                    {lastNameError}
                  </span>
                )}
              </label>

              <label
                className={[styles.field, emailError ? styles.fieldError : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => {
                    setForm({ ...form, email: event.target.value });
                    setFormError(null);
                    clearFieldError("email");
                  }}
                />
                {emailError && (
                  <span className={[styles.note, styles.errorNote].join(" ")}>
                    {emailError}
                  </span>
                )}
              </label>

              <label
                className={[
                  styles.field,
                  styles.fullField,
                  bioError ? styles.fieldError : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span>Биография (необязательно)</span>
                <textarea
                  data-testid="profile-bio-input"
                  value={form.bio}
                  onChange={(event) => {
                    setForm({ ...form, bio: event.target.value });
                    setFormError(null);
                    clearFieldError("bio");
                  }}
                  placeholder="Например: 23 года, дизайнер из Екатеринбурга"
                />
                {!isBioValid && (
                  <span className={[styles.note, styles.warningNote].join(" ")}>
                    Максимум 1000 символов.
                  </span>
                )}
                {bioError && (
                  <span className={[styles.note, styles.errorNote].join(" ")}>
                    {bioError}
                  </span>
                )}
              </label>
            </div>
            <p className={styles.caption}>
              Укажите любые данные о себе: возраст, род занятий, город или
              интересы.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Имя пользователя</h2>
            <label
              className={[styles.field, usernameError ? styles.fieldError : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <span>Юзернейм (@username)</span>
              <input
                type="text"
                data-testid="profile-username-input"
                value={form.username}
                maxLength={usernameMaxLength}
                pattern="[A-Za-z]+"
                title="Используйте только латинские буквы (A-Z, a-z)."
                onChange={(event) => {
                  setForm({ ...form, username: event.target.value });
                  setFormError(null);
                  clearFieldError("username");
                }}
              />
              {isUsernameTooLong && (
                <span className={[styles.note, styles.warningNote].join(" ")}>
                  Максимум {usernameMaxLength} символов.
                </span>
              )}
              {hasInvalidUsernameChars && (
                <span className={[styles.note, styles.errorNote].join(" ")}>
                  Допустимы только латинские буквы (A-Z, a-z).
                </span>
              )}
              {usernameError && (
                <span className={[styles.note, styles.errorNote].join(" ")}>
                  {usernameError}
                </span>
              )}
            </label>
            <p className={styles.caption}>
              По юзернейму вас смогут найти через поиск. Допустимы только
              латинские буквы.
            </p>
          </section>

          <div className={styles.actions}>
            <Button
              variant="primary"
              type="submit"
              data-testid="profile-save-button"
              disabled={!isUsernameValid || !isBioValid}
            >
              Сохранить
            </Button>
            <Button variant="ghost" onClick={() => onNavigate("/")}>
              На главную
            </Button>
          </div>
        </form>
      </Card>

      {pendingFile && pendingUrl ? (
        <AvatarCropModal
          key={pendingUrl}
          open
          image={pendingUrl}
          onCancel={handleCropCancel}
          onApply={handleCropApply}
        />
      ) : null}
    </>
  );
}
