import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Props = {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  marginTop: 4,
  background: "#2a2a2a",
  borderRadius: 8,
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
  minWidth: 160,
  zIndex: 50,
  padding: "4px 0",
};

export function Dropdown({ trigger, children, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          style={{ ...menuStyle, [align === "right" ? "right" : "left"]: 0 }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
