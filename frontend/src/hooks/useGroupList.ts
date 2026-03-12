import { useCallback, useEffect, useState } from "react";

import { groupController } from "../controllers/GroupController";
import type { GroupListItem } from "../entities/group/types";

type UseGroupListResult = {
  groups: GroupListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (q: string) => void;
  reload: () => void;
};

export function useGroupList(): UseGroupListResult {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await groupController.getMyGroups({
        search: search || undefined,
      });
      setGroups(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Ошибка загрузки";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { groups, total, loading, error, search, setSearch, reload };
}
