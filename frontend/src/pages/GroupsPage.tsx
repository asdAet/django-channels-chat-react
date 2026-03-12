import { useCallback, useState } from "react";

import type { UserProfile } from "../entities/user/types";
import { useGroupList } from "../hooks/useGroupList";
import { Spinner, EmptyState } from "../shared/ui";
import { CreateGroupDialog } from "../widgets/groups/CreateGroupDialog";
import { GroupListItem } from "../widgets/groups/GroupListItem";
import styles from "../styles/groups/GroupsPage.module.css";

type Props = {
  user: UserProfile | null;
  onNavigate: (path: string) => void;
};

const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export function GroupsPage({ user, onNavigate }: Props) {
  const { groups, loading, error, search, setSearch, reload } = useGroupList();
  const [showCreate, setShowCreate] = useState(false);

  const handleGroupClick = useCallback(
    (slug: string) => onNavigate(`/rooms/${slug}`),
    [onNavigate],
  );

  const handleCreated = useCallback(
    (slug: string) => {
      setShowCreate(false);
      reload();
      onNavigate(`/rooms/${slug}`);
    },
    [reload, onNavigate],
  );

  if (!user) {
    return (
      <div className={styles.root}>
        <EmptyState
          title="Авторизуйтесь"
          description="Для просмотра групп войдите в аккаунт."
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Группы</span>
        <div className={styles.headerSpacer} />
        <button
          type="button"
          className={styles.createBtn}
          onClick={() => setShowCreate(true)}
        >
          <IconPlus /> Создать
        </button>
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск групп..."
        />
      </div>

      <div className={styles.body}>
        {loading && (
          <div className={styles.centered}>
            <Spinner size="md" />
          </div>
        )}

        {error && <div className={styles.centered}>{error}</div>}

        {!loading && !error && groups.length === 0 && (
          <EmptyState
            title="Нет групп"
            description={
              search ? "Ничего не найдено." : "Создайте первую группу."
            }
          />
        )}

        {!loading &&
          !error &&
          groups.map((g) => (
            <GroupListItem key={g.slug} group={g} onClick={handleGroupClick} />
          ))}
      </div>

      {showCreate && (
        <CreateGroupDialog
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
