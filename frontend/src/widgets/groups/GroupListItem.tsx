import type { GroupListItem as GroupListItemType } from "../../entities/group/types";
import { Avatar } from "../../shared/ui";
import styles from "../../styles/groups/GroupsPage.module.css";

type Props = {
  group: GroupListItemType;
  onClick: (slug: string) => void;
};

export function GroupListItem({ group, onClick }: Props) {
  return (
    <div
      className={styles.item}
      onClick={() => onClick(group.slug)}
      role="button"
      tabIndex={0}
    >
      <div className={styles.itemIcon}>
        <Avatar
          username={group.name}
          profileImage={group.avatarUrl ?? null}
          avatarCrop={group.avatarCrop ?? undefined}
          size="small"
        />
      </div>
      <div className={styles.itemInfo}>
        <div className={styles.itemName}>{group.name}</div>
        {group.description && (
          <div className={styles.itemDesc}>{group.description}</div>
        )}
      </div>
      <div className={styles.itemMeta}>{group.memberCount} уч.</div>
    </div>
  );
}
