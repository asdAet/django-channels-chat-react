import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import type { UserProfile } from "../../entities/user/types";
import { ConversationListProvider } from "../../shared/conversationList/ConversationListProvider";
import {
  InfoPanelProvider,
  useInfoPanel,
} from "../../shared/layout/useInfoPanel";
import { Toast } from "../../shared/ui";
import styles from "../../styles/layout/AppShell.module.css";
import { InfoPanel } from "./InfoPanel";
import { Sidebar } from "./Sidebar";

type Props = {
  user: UserProfile | null;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  banner: string | null;
  error: string | null;
  isAuthRoute: boolean;
  children: ReactNode;
};

function ShellLayout({
  user,
  onNavigate,
  onLogout,
  banner,
  error,
  isAuthRoute,
  children,
}: Props) {
  const { isOpen } = useInfoPanel();
  const location = useLocation();
  const isMainActive = location.pathname !== "/";

  return (
    <div
      className={[
        styles.shell,
        isOpen ? styles.withInfoPanel : "",
        isMainActive ? styles.chatActive : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.sidebarPane}>
        <Sidebar user={user} onNavigate={onNavigate} onLogout={onLogout} />
      </div>
      <div className={styles.main}>
        {(banner || (error && !isAuthRoute)) && (
          <div className={styles.banners}>
            {banner && (
              <Toast variant="success" role="status">
                {banner}
              </Toast>
            )}
            {error && !isAuthRoute && (
              <Toast variant="danger" role="alert">
                {error}
              </Toast>
            )}
          </div>
        )}
        <div className={styles.mainInner}>{children}</div>
      </div>
      <InfoPanel currentUsername={user?.username ?? null} />
    </div>
  );
}

export function AppShell(props: Props) {
  return (
    <ConversationListProvider user={props.user} ready={true}>
      <InfoPanelProvider>
        <ShellLayout {...props} />
      </InfoPanelProvider>
    </ConversationListProvider>
  );
}
