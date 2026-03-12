import { useCallback } from "react";
import { useLocation } from "react-router-dom";

import {
  useConversationList,
  type FilterTab,
} from "../../shared/conversationList/ConversationListProvider";
import { Spinner, EmptyState, Avatar } from "../../shared/ui";
import styles from "../../styles/sidebar/ConversationList.module.css";
import { ConversationListItem } from "./ConversationListItem";

type Props = {
  onNavigate: (path: string) => void;
};

const TAB_LABELS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "personal", label: "Личные" },
  { key: "groups", label: "Группы" },
];

export function ConversationList({ onNavigate }: Props) {
  const {
    items,
    loading,
    filter,
    setFilter,
    searchQuery,
    globalResults,
    globalLoading,
    isGlobalMode,
  } = useConversationList();
  const location = useLocation();

  const getItemPath = useCallback(
    (item: { type: string; slug: string; name: string }) => {
      if (item.type === "direct") {
        return `/@${encodeURIComponent(item.name)}`;
      }
      return `/rooms/${encodeURIComponent(item.slug)}`;
    },
    [],
  );

  const isItemActive = useCallback(
    (item: { type: string; slug: string; name: string }) => {
      const path = getItemPath(item);
      return (
        location.pathname === path || location.pathname.startsWith(path + "/")
      );
    },
    [location.pathname, getItemPath],
  );

  const hasGlobalResults =
    globalResults.users.length > 0 ||
    globalResults.groups.length > 0 ||
    globalResults.messages.length > 0;

  return (
    <>
      <div className={styles.tabs}>
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={[styles.tab, filter === key ? styles.active : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {isGlobalMode ? (
        <div className={styles.globalSearchWrap}>
          {globalLoading && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "24px",
              }}
            >
              <Spinner size="md" />
            </div>
          )}

          {!globalLoading && !hasGlobalResults && (
            <EmptyState
              title="Ничего не найдено"
              description="Измените запрос и попробуйте снова"
            />
          )}

          {!globalLoading && globalResults.users.length > 0 && (
            <section className={styles.globalSection}>
              <h4 className={styles.globalTitle}>Пользователи</h4>
              {globalResults.users.map((user) => (
                <button
                  key={`u-${user.username}`}
                  type="button"
                  className={styles.globalItem}
                  onClick={() =>
                    onNavigate(`/users/${encodeURIComponent(user.username)}`)
                  }
                >
                  <Avatar
                    username={user.username}
                    profileImage={user.profileImage}
                    avatarCrop={user.avatarCrop}
                    size="tiny"
                  />
                  <span className={styles.globalPrimary}>{user.username}</span>
                </button>
              ))}
            </section>
          )}

          {!globalLoading && globalResults.groups.length > 0 && (
            <section className={styles.globalSection}>
              <h4 className={styles.globalTitle}>Группы</h4>
              {globalResults.groups.map((group) => (
                <button
                  key={`g-${group.slug}`}
                  type="button"
                  className={styles.globalItem}
                  onClick={() =>
                    onNavigate(`/rooms/${encodeURIComponent(group.slug)}`)
                  }
                >
                  <Avatar username={group.name} size="tiny" />
                  <div className={styles.globalMeta}>
                    <span className={styles.globalPrimary}>{group.name}</span>
                    {group.username && (
                      <span className={styles.globalSecondary}>
                        @{group.username}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </section>
          )}

          {!globalLoading && globalResults.messages.length > 0 && (
            <section className={styles.globalSection}>
              <h4 className={styles.globalTitle}>Сообщения</h4>
              {globalResults.messages.map((message) => (
                <button
                  key={`m-${message.id}`}
                  type="button"
                  className={styles.globalItem}
                  onClick={() =>
                    onNavigate(
                      `/rooms/${encodeURIComponent(message.roomSlug)}?message=${message.id}`,
                    )
                  }
                >
                  <div className={styles.globalMeta}>
                    <span className={styles.globalPrimary}>
                      {message.username} •{" "}
                      {message.roomName || message.roomSlug}
                    </span>
                    <span className={styles.globalSecondary}>
                      {message.content}
                    </span>
                  </div>
                </button>
              ))}
            </section>
          )}
        </div>
      ) : loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", padding: "24px" }}
        >
          <Spinner size="md" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={searchQuery ? "Ничего не найдено" : "Нет бесед"}
          description={
            searchQuery ? "Попробуйте другой запрос" : "Начните новый диалог"
          }
        />
      ) : (
        <div className={styles.list}>
          {items.map((item) => (
            <ConversationListItem
              key={`${item.type}-${item.slug}`}
              item={item}
              isActive={isItemActive(item)}
              onClick={() => onNavigate(getItemPath(item))}
            />
          ))}
        </div>
      )}
    </>
  );
}
