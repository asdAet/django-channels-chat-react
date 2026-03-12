import type { UserProfile } from "../entities/user/types";
import { Panel } from "../shared/ui";
import styles from "../styles/pages/DirectLayout.module.css";
import { DirectChatByUsernamePage } from "./DirectChatByUsernamePage";

type Props = {
  user: UserProfile | null;
  username?: string;
  onNavigate: (path: string) => void;
};

/**
 * Direct chat layout: conversation list is shown in the global sidebar,
 * this page only renders the active DM thread.
 */
export function DirectLayout({ user, username, onNavigate }: Props) {
  const hasActive = Boolean(username);

  return (
    <div
      className={[styles.directLayout, hasActive ? styles.chatMode : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <section className={styles.main}>
        {hasActive && username ? (
          <DirectChatByUsernamePage
            key={username}
            user={user}
            username={username}
            onNavigate={onNavigate}
          />
        ) : (
          <Panel muted>
            �������� ������ � ������� ������, ����� ������� ���.
          </Panel>
        )}
      </section>
    </div>
  );
}
