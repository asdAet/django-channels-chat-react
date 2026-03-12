/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type InfoPanelContent = "profile" | "group" | "search" | "direct" | null;

type InfoPanelState = {
  isOpen: boolean;
  content: InfoPanelContent;
  targetId: string | null;
  open: (
    content: NonNullable<InfoPanelContent>,
    targetId?: string | null,
  ) => void;
  close: () => void;
  clearClosed: () => void;
  toggle: (
    content: NonNullable<InfoPanelContent>,
    targetId?: string | null,
  ) => void;
};

const InfoPanelCtx = createContext<InfoPanelState>({
  isOpen: false,
  content: null,
  targetId: null,
  open: () => {},
  close: () => {},
  clearClosed: () => {},
  toggle: () => {},
});

export function InfoPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean;
    content: InfoPanelContent;
    targetId: string | null;
  }>({
    isOpen: false,
    content: null,
    targetId: null,
  });

  const open = useCallback(
    (content: NonNullable<InfoPanelContent>, targetId?: string | null) => {
      setState({ isOpen: true, content, targetId: targetId ?? null });
    },
    [],
  );

  const close = useCallback(() => {
    setState((prev) => {
      if (prev.content === null || !prev.isOpen) {
        return prev;
      }
      return { ...prev, isOpen: false };
    });
  }, []);

  const clearClosed = useCallback(() => {
    setState((prev) => {
      if (prev.isOpen || prev.content === null) {
        return prev;
      }
      return { isOpen: false, content: null, targetId: null };
    });
  }, []);

  const toggle = useCallback(
    (content: NonNullable<InfoPanelContent>, targetId?: string | null) => {
      setState((prev) => {
        const nextTargetId = targetId ?? null;
        if (prev.content === content && prev.targetId === nextTargetId) {
          return { ...prev, isOpen: !prev.isOpen };
        }
        return { isOpen: true, content, targetId: nextTargetId };
      });
    },
    [],
  );

  const value: InfoPanelState = {
    isOpen: state.isOpen,
    content: state.content,
    targetId: state.targetId,
    open,
    close,
    clearClosed,
    toggle,
  };

  return (
    <InfoPanelCtx.Provider value={value}>{children}</InfoPanelCtx.Provider>
  );
}

export function useInfoPanel() {
  return useContext(InfoPanelCtx);
}
