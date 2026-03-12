import { useCallback, useEffect, useMemo, useState } from "react";

import { chatController } from "../../controllers/ChatController";
import type { RoomAttachmentItem } from "../../domain/interfaces/IApiService";
import type { RoomDetails } from "../../entities/room/types";
import { formatLastSeen, formatTimestamp } from "../../shared/lib/format";
import { AudioAttachmentPlayer, Avatar, Spinner } from "../../shared/ui";
import styles from "../../styles/chat/DirectInfoPanel.module.css";

type Props = {
  slug: string;
};

type Tab = "profile" | "attachments";

const isImage = (contentType: string) => contentType.startsWith("image/");
const isVideo = (contentType: string) => contentType.startsWith("video/");
const isAudio = (contentType: string) => contentType.startsWith("audio/");

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function AttachmentCard({ item }: { item: RoomAttachmentItem }) {
  const preview = (
    <>
      {isImage(item.contentType) && item.url && (
        <img
          src={item.thumbnailUrl ?? item.url}
          alt={item.originalFilename}
          className={styles.media}
        />
      )}

      {isVideo(item.contentType) && item.url && (
        <video
          className={styles.media}
          src={item.url}
          preload="metadata"
          controls
        />
      )}

      {isAudio(item.contentType) && item.url && (
        <div className={styles.fileCard}>
          <AudioAttachmentPlayer
            src={item.url}
            title={item.originalFilename}
            subtitle={formatFileSize(item.fileSize)}
            downloadName={item.originalFilename}
            className={styles.audioPlayer}
          />
        </div>
      )}

      {!isImage(item.contentType) &&
        !isVideo(item.contentType) &&
        !isAudio(item.contentType) && (
          <div className={styles.fileCard}>
            <span className={styles.fileIcon}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <span className={styles.fileName}>{item.originalFilename}</span>
            <span className={styles.fileMeta}>
              {formatFileSize(item.fileSize)}
            </span>
          </div>
        )}

      <div className={styles.cardMeta}>
        <span>{item.username}</span>
        <span>{formatTimestamp(item.createdAt)}</span>
      </div>
    </>
  );

  const canOpenAsLink = Boolean(item.url && !isAudio(item.contentType));
  const cardClassName = [
    styles.card,
    isAudio(item.contentType) ? styles.cardAudio : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (canOpenAsLink) {
    return (
      <a
        href={item.url as string}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClassName}
      >
        {preview}
      </a>
    );
  }

  return <div className={cardClassName}>{preview}</div>;
}

export function DirectInfoPanel({ slug }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [attachments, setAttachments] = useState<RoomAttachmentItem[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [room, files] = await Promise.all([
        chatController.getRoomDetails(slug),
        chatController.getRoomAttachments(slug, { limit: 60 }),
      ]);
      setDetails(room);
      setAttachments(files.items);
      setHasMore(files.pagination.hasMore);
      setNextBefore(files.pagination.nextBefore);
    } catch {
      setDetails(null);
      setAttachments([]);
      setHasMore(false);
      setNextBefore(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const files = await chatController.getRoomAttachments(slug, {
        limit: 60,
        before: nextBefore,
      });
      setAttachments((prev) => [...prev, ...files.items]);
      setHasMore(files.pagination.hasMore);
      setNextBefore(files.pagination.nextBefore);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextBefore, slug]);

  const peer = details?.peer ?? null;
  const attachmentItems = useMemo(() => attachments, [attachments]);

  if (loading) {
    return (
      <div className={styles.centered}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={[styles.tab, tab === "profile" ? styles.tabActive : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("profile")}
        >
          Профиль
        </button>
        <button
          type="button"
          className={[styles.tab, tab === "attachments" ? styles.tabActive : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("attachments")}
        >
          Вложения
        </button>
      </div>

      {tab === "profile" && peer && (
        <div className={styles.profile}>
          <Avatar
            username={peer.username}
            profileImage={peer.profileImage}
            avatarCrop={peer.avatarCrop}
            size="default"
          />
          <h4 className={styles.peerName}>{peer.username}</h4>
          <p className={styles.meta}>
            Был(а) в сети: {formatLastSeen(peer.lastSeen ?? null) || "—"}
          </p>
          {peer.bio?.trim() ? (
            <div className={styles.bioSection}>
              <span className={styles.bioLabel}>О себе</span>
              <p className={styles.bioText}>{peer.bio}</p>
            </div>
          ) : null}
        </div>
      )}

      {tab === "attachments" && (
        <div className={styles.attachments}>
          {attachmentItems.length === 0 && (
            <p className={styles.empty}>В этом чате пока нет вложений.</p>
          )}

          {attachmentItems.length > 0 && (
            <div className={styles.grid}>
              {attachmentItems.map((item) => (
                <AttachmentCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {hasMore && (
            <button
              type="button"
              className={styles.loadMoreBtn}
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "Загрузка..." : "Показать еще"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
