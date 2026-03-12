import { useCallback, useState } from "react";

import type { UserProfile } from "../entities/user/types";
import { formatFullName } from "../shared/lib/format";
import { EmptyState } from "../shared/ui";
import styles from "../styles/pages/SettingsPage.module.css";

type Props = {
  user: UserProfile | null;
  onNavigate: (path: string) => void;
  onLogout: () => Promise<void>;
};

export function SettingsPage({ user, onNavigate, onLogout }: Props) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () =>
      typeof Notification !== "undefined" &&
      Notification.permission === "granted",
  );

  const handleToggleNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") return;

    if (Notification.permission === "granted") {
      setNotificationsEnabled(false);
      return;
    }

    const result = await Notification.requestPermission();
    setNotificationsEnabled(result === "granted");
  }, []);

  if (!user) {
    return (
      <EmptyState
        title="Авторизуйтесь"
        description="Для доступа к настройкам войдите в аккаунт."
      />
    );
  }

  const fullName = formatFullName(user.name, user.last_name) || "Без имени";

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Настройки</h1>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Аккаунт</div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>{fullName}</div>
            <div className={styles.rowDesc}>@{user.username}</div>
            <div className={styles.rowDesc}>{user.email}</div>
          </div>
          <button
            type="button"
            className={styles.themeBtn}
            onClick={() => onNavigate("/profile")}
            style={{ flex: "none", padding: "6px 16px" }}
          >
            Редактировать
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Уведомления</div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>Push-уведомления</div>
            <div className={styles.rowDesc}>
              Получать уведомления о новых сообщениях
            </div>
          </div>
          <button
            type="button"
            className={[
              styles.toggle,
              notificationsEnabled ? styles.toggleActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={handleToggleNotifications}
            aria-label="Переключить уведомления"
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Горячие клавиши</div>
        <div className={styles.shortcutsList}>
          <div className={styles.shortcutRow}>
            <span>Поиск</span>
            <span className={styles.shortcutKey}>Ctrl+K</span>
          </div>
          <div className={styles.shortcutRow}>
            <span>Закрыть панель</span>
            <span className={styles.shortcutKey}>Esc</span>
          </div>
          <div className={styles.shortcutRow}>
            <span>Отправить сообщение</span>
            <span className={styles.shortcutKey}>Enter</span>
          </div>
          <div className={styles.shortcutRow}>
            <span>Новая строка</span>
            <span className={styles.shortcutKey}>Shift+Enter</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Опасная зона</div>
        <button type="button" className={styles.dangerBtn} onClick={onLogout}>
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
