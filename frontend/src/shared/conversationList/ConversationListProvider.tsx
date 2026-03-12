/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { GlobalSearchResult } from "../../domain/interfaces/IApiService";
import type { ConversationItem } from "../../entities/conversation/types";
import type { GroupListItem } from "../../entities/group/types";
import type { UserProfile } from "../../entities/user/types";
import { chatController } from "../../controllers/ChatController";
import { groupController } from "../../controllers/GroupController";
import { useDirectInbox } from "../directInbox";
import { usePresence } from "../presence";
import { debugLog } from "../lib/debug";
import { useUnreadOverrides } from "../unreadOverrides/store";
import { CONVERSATION_LIST_REFRESH_EVENT } from "./events";

type FilterTab = "all" | "personal" | "groups";

type ConversationListState = {
  items: ConversationItem[];
  loading: boolean;
  error: string | null;
  filter: FilterTab;
  searchQuery: string;
  globalResults: GlobalSearchResult;
  globalLoading: boolean;
  isGlobalMode: boolean;
  setFilter: (tab: FilterTab) => void;
  setSearchQuery: (q: string) => void;
  refresh: () => void;
};

const EMPTY_GLOBAL_RESULTS: GlobalSearchResult = {
  users: [],
  groups: [],
  messages: [],
};

const fallback: ConversationListState = {
  items: [],
  loading: false,
  error: null,
  filter: "all",
  searchQuery: "",
  globalResults: EMPTY_GLOBAL_RESULTS,
  globalLoading: false,
  isGlobalMode: false,
  setFilter: () => {},
  setSearchQuery: () => {},
  refresh: () => {},
};

const ConversationListCtx = createContext<ConversationListState>(fallback);

type Props = {
  user: UserProfile | null;
  ready: boolean;
  children: ReactNode;
};

const canRunGlobalSearchQuery = (query: string) => {
  const normalized = query.trim();
  if (normalized.length < 2) return false;
  if (!normalized.startsWith("@")) return true;
  return normalized.slice(1).trim().length >= 2;
};

export function ConversationListProvider({ user, ready, children }: Props) {
  const { items: directItems, unreadCounts } = useDirectInbox();
  const unreadOverrides = useUnreadOverrides();
  const { online: presenceOnline, status: presenceStatus } = usePresence();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [roomUnreads, setRoomUnreads] = useState<Record<string, number>>({});
  const [groupItems, setGroupItems] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalResults, setGlobalResults] =
    useState<GlobalSearchResult>(EMPTY_GLOBAL_RESULTS);
  const [globalLoading, setGlobalLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onlineUsernames = useMemo(
    () =>
      new Set(
        presenceStatus === "online"
          ? presenceOnline.map((e) => e.username)
          : [],
      ),
    [presenceOnline, presenceStatus],
  );

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [counts, groups] = await Promise.all([
        chatController.getUnreadCounts(),
        groupController
          .getMyGroups()
          .catch(() => ({ items: [] as GroupListItem[], total: 0 })),
      ]);
      if (!mountedRef.current) return;
      const map: Record<string, number> = {};
      for (const item of counts) {
        map[item.roomSlug] = item.unreadCount;
      }
      setRoomUnreads(map);
      setGroupItems(groups.items);
      setError(null);
    } catch (err) {
      debugLog("Failed to fetch conversation data", err);
      if (mountedRef.current) setError("Не удалось загрузить данные");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (ready && user) {
      void fetchData();
    }
  }, [ready, user, fetchData]);

  useEffect(() => {
    if (!ready || !user) return;
    const onRefresh = () => {
      void fetchData();
    };
    window.addEventListener(CONVERSATION_LIST_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(CONVERSATION_LIST_REFRESH_EVENT, onRefresh);
    };
  }, [fetchData, ready, user]);

  const isGlobalMode = searchQuery.trim().length >= 2;
  const canRunGlobalSearch = canRunGlobalSearchQuery(searchQuery);

  useEffect(() => {
    if (!user || !isGlobalMode || !canRunGlobalSearch) {
      setGlobalLoading(false);
      setGlobalResults(EMPTY_GLOBAL_RESULTS);
      return;
    }

    let canceled = false;
    const timerId = window.setTimeout(() => {
      setGlobalLoading(true);
      chatController
        .globalSearch(searchQuery.trim())
        .then((result) => {
          if (!canceled) {
            setGlobalResults(result);
          }
        })
        .catch((err) => {
          debugLog("Global search failed", err);
          if (!canceled) {
            setGlobalResults(EMPTY_GLOBAL_RESULTS);
          }
        })
        .finally(() => {
          if (!canceled) {
            setGlobalLoading(false);
          }
        });
    }, 260);

    return () => {
      canceled = true;
      window.clearTimeout(timerId);
    };
  }, [canRunGlobalSearch, isGlobalMode, searchQuery, user]);

  const items = useMemo<ConversationItem[]>(() => {
    const resolveUnreadCount = (slug: string, wsUnreadCount?: number) => {
      const overrideUnread = unreadOverrides[slug];
      if (typeof overrideUnread === "number") return overrideUnread;
      if (typeof wsUnreadCount === "number") return wsUnreadCount;
      return roomUnreads[slug] ?? 0;
    };

    const conversations: ConversationItem[] = [];

    if (filter === "all") {
      conversations.push({
        type: "room",
        slug: "public",
        name: "Публичный чат",
        avatarUrl: null,
        avatarCrop: null,
        lastMessage: "Общий чат сообщества",
        lastMessageAt: null,
        unreadCount: resolveUnreadCount("public"),
        isOnline: false,
        isMuted: false,
        isPinned: true,
      });
    }

    if (filter !== "groups") {
      for (const dm of directItems) {
        const dmUnread = resolveUnreadCount(dm.slug, unreadCounts[dm.slug]);
        conversations.push({
          type: "direct",
          slug: dm.slug,
          name: dm.peer.username,
          avatarUrl: dm.peer.profileImage ?? null,
          avatarCrop: dm.peer.avatarCrop ?? null,
          lastMessage: dm.lastMessage,
          lastMessageAt: dm.lastMessageAt,
          unreadCount: dmUnread,
          isOnline: onlineUsernames.has(dm.peer.username),
          isMuted: false,
        });
      }
    }

    if (filter !== "personal") {
      for (const group of groupItems) {
        if (conversations.some((c) => c.slug === group.slug)) continue;
        conversations.push({
          type: "group",
          slug: group.slug,
          name: group.name,
          avatarUrl: group.avatarUrl ?? null,
          avatarCrop: group.avatarCrop ?? null,
          lastMessage: group.description || "",
          lastMessageAt: null,
          unreadCount: resolveUnreadCount(group.slug),
          isOnline: false,
          isMuted: false,
        });
      }
    }

    conversations.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (b.isPinned && !a.isPinned) return 1;
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return dateB - dateA;
    });

    if (!searchQuery.trim() || isGlobalMode) {
      return conversations;
    }

    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => c.name.toLowerCase().includes(q));
  }, [
    directItems,
    filter,
    groupItems,
    isGlobalMode,
    onlineUsernames,
    unreadOverrides,
    roomUnreads,
    searchQuery,
    unreadCounts,
  ]);

  const value: ConversationListState = {
    items,
    loading,
    error,
    filter,
    searchQuery,
    globalResults,
    globalLoading,
    isGlobalMode,
    setFilter,
    setSearchQuery,
    refresh: fetchData,
  };

  return (
    <ConversationListCtx.Provider value={value}>
      {children}
    </ConversationListCtx.Provider>
  );
}

export function useConversationList() {
  return useContext(ConversationListCtx);
}

export type { FilterTab };
