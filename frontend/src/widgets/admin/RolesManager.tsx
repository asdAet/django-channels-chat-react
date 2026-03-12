import { useCallback, useEffect, useState } from "react";

import { rolesController } from "../../controllers/RolesController";
import type { Role } from "../../entities/role/types";
import { Spinner } from "../../shared/ui";
import styles from "../../styles/admin/RolesManager.module.css";

type Props = {
  slug: string;
};

export function RolesManager({ slug }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#8ae6ff");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await rolesController.getRoomRoles(slug);
      setRoles(result);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await rolesController.createRoomRole(slug, {
        name: trimmed,
        color: newColor,
      });
      setNewName("");
      setShowCreate(false);
      void reload();
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  }, [slug, newName, newColor, reload]);

  const handleDelete = useCallback(
    async (roleId: number) => {
      try {
        await rolesController.deleteRoomRole(slug, roleId);
        void reload();
      } catch {
        // silent
      }
    },
    [slug, reload],
  );

  if (loading) {
    return (
      <div className={styles.centered}>
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>Роли</span>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowCreate(!showCreate)}
        >
          + Роль
        </button>
      </div>

      {roles.map((role) => (
        <div key={role.id} className={styles.roleItem}>
          <span
            className={styles.roleColor}
            style={{ background: role.color }}
          />
          <span className={styles.roleName}>{role.name}</span>
          {role.isDefault && (
            <span className={styles.roleDefault}>default</span>
          )}
          <div className={styles.roleActions}>
            <button
              type="button"
              className={[
                styles.roleActionBtn,
                styles.roleActionBtnDanger,
              ].join(" ")}
              onClick={() => handleDelete(role.id)}
              disabled={role.isDefault}
              aria-label={`Удалить роль ${role.name}`}
            >
              ×
            </button>
          </div>
        </div>
      ))}

      {roles.length === 0 && <div className={styles.centered}>Нет ролей</div>}

      {showCreate && (
        <div className={styles.createForm}>
          <input
            className={styles.createInput}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название роли"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <input
            type="color"
            className={styles.createColorInput}
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
          />
          <button
            type="button"
            className={styles.createSubmitBtn}
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
          >
            Создать
          </button>
        </div>
      )}
    </div>
  );
}
