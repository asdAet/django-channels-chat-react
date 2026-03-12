import { useCallback, useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding:
    "max(8px, var(--safe-top, 0px)) max(8px, var(--safe-right, 0px)) max(8px, var(--safe-bottom, 0px)) max(8px, var(--safe-left, 0px))",
  zIndex: 100,
};

const backdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  background: "#242424",
  borderRadius: 14,
  padding: 20,
  width: "min(460px, calc(100vw - 16px))",
  maxWidth: "100%",
  maxHeight:
    "calc(var(--app-height, 100vh) - var(--safe-top, 0px) - var(--safe-bottom, 0px) - 16px)",
  overflow: "auto",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#e2e8f5",
  marginBottom: 16,
};

export function Modal({ open, onClose, title, children }: Props) {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, handleEsc]);

  if (!open) return null;

  return (
    <div style={overlayStyle} role="dialog">
      <div style={backdropStyle} onClick={onClose} />
      <div style={cardStyle}>
        {title && <div style={titleStyle}>{title}</div>}
        {children}
      </div>
    </div>
  );
}
