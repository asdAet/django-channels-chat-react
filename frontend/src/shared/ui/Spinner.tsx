import styles from "../../styles/ui/Spinner.module.css";

type SpinnerSize = "sm" | "md" | "lg";

type Props = {
  size?: SpinnerSize;
  className?: string;
};

const sizeClass: Record<SpinnerSize, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

export function Spinner({ size = "md", className }: Props) {
  return (
    <span
      className={[styles.spinner, sizeClass[size], className]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label="Загрузка"
    />
  );
}
