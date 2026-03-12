import type { ReactNode } from "react";

import styles from "../../styles/ui/EmptyState.module.css";

type Props = {
  icon?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
}: Props) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      {icon && <div className={styles.icon}>{icon}</div>}
      {title && <p className={styles.title}>{title}</p>}
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </div>
  );
}
