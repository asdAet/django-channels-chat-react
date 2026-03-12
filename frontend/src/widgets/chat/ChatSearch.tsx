import { useCallback, useEffect, useRef, useState } from "react";

import { chatController } from "../../controllers/ChatController";
import type { SearchResultItem } from "../../domain/interfaces/IApiService";
import { formatTimestamp } from "../../shared/lib/format";
import { Spinner } from "../../shared/ui";
import styles from "../../styles/chat/ChatSearch.module.css";

type Props = {
  slug: string;
  onResultClick?: (messageId: number) => void;
};

function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
}

export function ChatSearch({ slug, onResultClick }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      setSearched(true);
      try {
        const result = await chatController.searchMessages(slug, q);
        setResults(result.results);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  return (
    <div className={styles.root}>
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск сообщений..."
          autoFocus
        />
      </div>

      <div className={styles.results}>
        {loading && (
          <div className={styles.centered}>
            <Spinner size="sm" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className={styles.centered}>Ничего не найдено</div>
        )}

        {!loading &&
          results.map((r) => (
            <div
              key={r.id}
              className={styles.resultItem}
              onClick={() => onResultClick?.(r.id)}
              role="button"
              tabIndex={0}
            >
              <span className={styles.resultUser}>{r.username}</span>
              <span className={styles.resultTime}>
                {formatTimestamp(r.createdAt)}
              </span>
              <div
                className={styles.resultContent}
                dangerouslySetInnerHTML={{
                  __html: r.highlight || highlightText(r.content, query),
                }}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
