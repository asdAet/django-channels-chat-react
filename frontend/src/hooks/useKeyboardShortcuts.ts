import { useEffect } from "react";

import { useInfoPanel } from "../shared/layout/useInfoPanel";

type Options = {
  slug?: string | null;
};

export function useKeyboardShortcuts({ slug }: Options = {}) {
  const { toggle, close, isOpen } = useInfoPanel();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K → toggle search panel
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (slug) {
          toggle("search", slug);
        }
      }

      // Escape → close info panel
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [slug, toggle, close, isOpen]);
}
