import styles from "../../styles/chat/TypingIndicator.module.css";

type Props = {
  users: string[];
};

export function TypingIndicator({ users }: Props) {
  if (!users.length) return null;

  const text =
    users.length === 1
      ? `${users[0]} печатает`
      : users.length === 2
        ? `${users[0]} и ${users[1]} печатают`
        : `${users[0]} и еще ${users.length - 1} печатают`;

  return (
    <div className={styles.root} aria-live="polite">
      <span className={styles.dots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </span>
      <span>{text}...</span>
    </div>
  );
}
