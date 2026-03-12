import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { usePasswordRules } from "../hooks/usePasswordRules";
import type { ApiError } from "../shared/api/types";
import { debugLog } from "../shared/lib/debug";
import { PresenceProvider } from "../shared/presence";
import { DirectInboxProvider } from "../shared/directInbox";
import { RuntimeConfigProvider } from "../shared/config/RuntimeConfigProvider";
import { AppShell } from "../widgets/layout/AppShell";
import { AppRoutes } from "./routes";
import shellStyles from "../styles/layout/AppShell.module.css";

type ProfileFieldErrors = Record<string, string[]>;
type ProfileSaveResult =
  | { ok: true }
  | { ok: false; errors?: ProfileFieldErrors; message?: string };

/**
 * Внутренний роутинг-слой приложения с глобальными провайдерами.
 */
function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, login, register, logout, updateProfile } = useAuth();
  const { rules: passwordRules } = usePasswordRules(
    location.pathname === "/register",
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const updateViewportVars = () => {
      root.style.setProperty("--app-height", `${window.innerHeight}px`);
      root.style.setProperty("--app-width", `${window.innerWidth}px`);
    };

    updateViewportVars();
    window.addEventListener("resize", updateViewportVars, { passive: true });
    window.addEventListener("orientationchange", updateViewportVars, {
      passive: true,
    });
    window.visualViewport?.addEventListener("resize", updateViewportVars);

    return () => {
      window.removeEventListener("resize", updateViewportVars);
      window.removeEventListener("orientationchange", updateViewportVars);
      window.visualViewport?.removeEventListener("resize", updateViewportVars);
    };
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timerId = window.setTimeout(() => setBanner(null), 4200);
    return () => window.clearTimeout(timerId);
  }, [banner]);

  const extractMessage = (err: unknown) => {
    if (
      err &&
      typeof err === "object" &&
      "message" in err &&
      typeof (err as ApiError).message === "string"
    ) {
      const apiErr = err as ApiError;
      const apiErrors =
        apiErr.data &&
        (apiErr.data.errors as Record<string, string[]> | undefined);
      if (apiErrors) {
        return Object.values(apiErrors).flat().join(" ");
      }
      if (
        apiErr.status === 400 &&
        apiErr.message?.includes("status code 400")
      ) {
        return "Проверьте введённые данные и попробуйте снова.";
      }
      return apiErr.message;
    }
    return "Не удалось выполнить запрос. Попробуйте еще раз.";
  };

  const extractAuthMessage = (err: unknown, fallback: string) => {
    const extractFromData = (data: unknown) => {
      if (!data || typeof data !== "object") return null;
      const record = data as Record<string, unknown>;
      const errors = record.errors as
        | Record<string, string[] | string>
        | undefined;
      if (errors) {
        const parts = Object.values(errors)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter((value) => typeof value === "string") as string[];
        if (parts.length) return parts.join(" ");
      }
      if (typeof record.error === "string") return record.error;
      if (typeof record.detail === "string") return record.detail;
      return null;
    };

    if (err && typeof err === "object") {
      const anyErr = err as ApiError & { response?: { data?: unknown } };
      const direct =
        extractFromData(anyErr.data) || extractFromData(anyErr.response?.data);
      if (direct) return direct;

      if ("message" in anyErr) {
        const rawMessage =
          typeof anyErr.message === "string" ? anyErr.message.trim() : "";
        if (rawMessage && !rawMessage.includes("status code 400")) {
          return rawMessage;
        }
        if (anyErr.status === 400) {
          return fallback;
        }
      }
    }
    return fallback;
  };

  const extractProfileErrors = (err: unknown): ProfileFieldErrors | null => {
    if (!err || typeof err !== "object") return null;
    const anyErr = err as ApiError & { response?: { data?: unknown } };
    const data = (anyErr.data ?? anyErr.response?.data) as
      | Record<string, unknown>
      | undefined;
    const rawErrors =
      data && (data.errors as Record<string, unknown> | undefined);
    if (!rawErrors || typeof rawErrors !== "object") return null;

    const normalized: ProfileFieldErrors = {};
    for (const [field, value] of Object.entries(rawErrors)) {
      if (Array.isArray(value)) {
        const messages = value.filter(
          (item) => typeof item === "string",
        ) as string[];
        if (messages.length) normalized[field] = messages;
      } else if (typeof value === "string") {
        normalized[field] = [value];
      }
    }
    return Object.keys(normalized).length ? normalized : null;
  };

  const onNavigate = useCallback(
    (path: string) => {
      navigate(path);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate],
  );

  const handleLogin = useCallback(
    async (username: string, password: string) => {
      setError(null);
      try {
        await login({ username, password });
        setBanner("Добро пожаловать обратно!");
        onNavigate("/");
      } catch (err) {
        debugLog("Login failed", err);
        setError(extractAuthMessage(err, "Неверный логин или пароль"));
      }
    },
    [login, onNavigate],
  );

  const handleRegister = useCallback(
    async (
      name: string,
      lastName: string,
      username: string,
      password1: string,
      password2: string,
    ) => {
      setError(null);
      try {
        await register({
          name,
          last_name: lastName,
          username,
          password1,
          password2,
        });
        setBanner("Аккаунт создан. Можно общаться!");
        onNavigate("/");
      } catch (err) {
        debugLog("Registration failed", err);
        setError(extractAuthMessage(err, "Проверьте данные регистрации"));
      }
    },
    [onNavigate, register],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    setBanner("Вы вышли из аккаунта");
    onNavigate("/login");
  }, [logout, onNavigate]);

  const handleProfileSave = useCallback(
    async (fields: {
      name?: string;
      last_name?: string;
      username: string;
      email: string;
      image?: File | null;
      bio?: string;
    }): Promise<ProfileSaveResult> => {
      if (!auth.user)
        return { ok: false, message: "Сначала войдите в аккаунт." };
      setError(null);
      try {
        await updateProfile(fields);
        setBanner("Профиль обновлен");
        const nextUsername = fields.username?.trim() || auth.user?.username;
        if (nextUsername) {
          onNavigate(`/users/${encodeURIComponent(nextUsername)}`);
        }
        return { ok: true };
      } catch (err) {
        debugLog("Profile update failed", err);
        const apiErr = err as ApiError;

        if (
          apiErr &&
          typeof apiErr.status === "number" &&
          apiErr.status === 401
        ) {
          setError("Сессия истекла. Войдите снова.");
          onNavigate("/login");
          return { ok: false, message: "Сессия истекла. Войдите снова." };
        }

        if (
          apiErr &&
          typeof apiErr.status === "number" &&
          apiErr.status === 413
        ) {
          return {
            ok: false,
            errors: { image: ["Файл слишком большой. Максимум 20 МБ."] },
            message: "Файл слишком большой. Максимум 20 МБ.",
          };
        }

        const fieldErrors = extractProfileErrors(err);
        if (fieldErrors) {
          return { ok: false, errors: fieldErrors };
        }

        return { ok: false, message: extractMessage(err) };
      }
    },
    [auth.user, onNavigate, updateProfile],
  );

  const isAuthRoute =
    location.pathname === "/login" || location.pathname === "/register";

  const routesElement = (
    <AppRoutes
      user={auth.user}
      error={error}
      passwordRules={passwordRules}
      onNavigate={onNavigate}
      onLogin={handleLogin}
      onRegister={handleRegister}
      onLogout={handleLogout}
      onProfileSave={handleProfileSave}
    />
  );

  return (
    <PresenceProvider user={auth.user} ready={!auth.loading}>
      <DirectInboxProvider user={auth.user} ready={!auth.loading}>
        {isAuthRoute ? (
          <div className={shellStyles.authPage}>{routesElement}</div>
        ) : (
          <AppShell
            user={auth.user}
            onNavigate={onNavigate}
            onLogout={handleLogout}
            banner={banner}
            error={error}
            isAuthRoute={isAuthRoute}
          >
            {routesElement}
          </AppShell>
        )}
      </DirectInboxProvider>
    </PresenceProvider>
  );
}

/**
 * Корневой компонент frontend-приложения.
 */
export function App() {
  return (
    <BrowserRouter>
      <RuntimeConfigProvider>
        <AppInner />
      </RuntimeConfigProvider>
    </BrowserRouter>
  );
}

export default App;
