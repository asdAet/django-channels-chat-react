import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { decodeRoomSlugParam, decodeUsernameParam } from "../dto";
import type { UserProfile } from "../entities/user/types";
import { ChatRoomPage } from "../pages/ChatRoomPage";
import { DirectLayout } from "../pages/DirectLayout";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { ProfilePage } from "../pages/ProfilePage";
import { RegisterPage } from "../pages/RegisterPage";
import { FriendsPage } from "../pages/FriendsPage";
import { GroupsPage } from "../pages/GroupsPage";
import { InvitePreviewPage } from "../pages/InvitePreviewPage";
import { SettingsPage } from "../pages/SettingsPage";
import { UserProfilePage } from "../pages/UserProfilePage";

type ProfileFieldErrors = Record<string, string[]>;
type ProfileSaveResult =
  | { ok: true }
  | { ok: false; errors?: ProfileFieldErrors; message?: string };

type AppRoutesProps = {
  user: UserProfile | null;
  error: string | null;
  passwordRules: string[];
  onNavigate: (path: string) => void;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (
    name: string,
    lastName: string,
    username: string,
    password1: string,
    password2: string,
  ) => Promise<void>;
  onLogout: () => Promise<void>;
  onProfileSave: (fields: {
    name?: string;
    last_name?: string;
    username: string;
    email: string;
    image?: File | null;
    bio?: string;
  }) => Promise<ProfileSaveResult>;
};

/**
 * Обертка для пользовательского профиля с получением username из URL.
 */
function UserProfileRoute({
  user,
  onNavigate,
  onLogout,
}: Pick<AppRoutesProps, "user" | "onNavigate" | "onLogout">) {
  const params = useParams<{ username: string }>();
  const username = decodeUsernameParam(params.username);
  if (!username) {
    return <Navigate to="/" replace />;
  }

  return (
    <UserProfilePage
      key={username}
      user={user}
      username={username}
      currentUser={user}
      onNavigate={onNavigate}
      onLogout={onLogout}
    />
  );
}

/**
 * Обертка для direct-чата по username из URL.
 */
function DirectByUsernameRoute({
  user,
  onNavigate,
}: Pick<AppRoutesProps, "user" | "onNavigate">) {
  const params = useParams<{ username: string }>();
  const rawUsername = params.username || "";
  if (!rawUsername.startsWith("@")) {
    return <Navigate to="/" replace />;
  }
  const username = decodeUsernameParam(rawUsername);
  if (!username) {
    return <Navigate to="/direct" replace />;
  }

  return (
    <DirectLayout user={user} username={username} onNavigate={onNavigate} />
  );
}

/**
 * Обертка для комнаты с валидацией slug.
 */
function RoomRoute({
  user,
  onNavigate,
}: Pick<AppRoutesProps, "user" | "onNavigate">) {
  const params = useParams<{ slug: string }>();
  const slug = decodeRoomSlugParam(params.slug);
  if (!slug) {
    return <Navigate to="/" replace />;
  }

  return (
    <ChatRoomPage key={slug} slug={slug} user={user} onNavigate={onNavigate} />
  );
}

/**
 * Обертка для инвайт-превью с получением code из URL.
 */
function InviteRoute({ onNavigate }: Pick<AppRoutesProps, "onNavigate">) {
  const params = useParams<{ code: string }>();
  const code = params.code || "";
  if (!code) {
    return <Navigate to="/" replace />;
  }
  return <InvitePreviewPage code={code} onNavigate={onNavigate} />;
}

/**
 * Декларация всех frontend-маршрутов приложения.
 */
export function AppRoutes({
  user,
  error,
  passwordRules,
  onNavigate,
  onLogin,
  onRegister,
  onLogout,
  onProfileSave,
}: AppRoutesProps) {
  return (
    <Routes>
      <Route
        path="/"
        element={<HomePage user={user} onNavigate={onNavigate} />}
      />
      <Route
        path="/login"
        element={
          <LoginPage onSubmit={onLogin} onNavigate={onNavigate} error={error} />
        }
      />
      <Route
        path="/register"
        element={
          <RegisterPage
            onSubmit={onRegister}
            onNavigate={onNavigate}
            error={error}
            passwordRules={passwordRules}
          />
        }
      />
      <Route
        path="/profile"
        element={
          <ProfilePage
            key={user?.username || "guest"}
            user={user}
            onSave={onProfileSave}
            onNavigate={onNavigate}
          />
        }
      />
      <Route
        path="/settings"
        element={
          <SettingsPage
            user={user}
            onNavigate={onNavigate}
            onLogout={onLogout}
          />
        }
      />
      <Route
        path="/friends"
        element={<FriendsPage user={user} onNavigate={onNavigate} />}
      />
      <Route
        path="/groups"
        element={<GroupsPage user={user} onNavigate={onNavigate} />}
      />
      <Route
        path="/invite/:code"
        element={<InviteRoute onNavigate={onNavigate} />}
      />
      <Route
        path="/direct"
        element={<DirectLayout user={user} onNavigate={onNavigate} />}
      />
      <Route
        path="/:username"
        element={<DirectByUsernameRoute user={user} onNavigate={onNavigate} />}
      />
      <Route
        path="/users/:username"
        element={
          <UserProfileRoute
            user={user}
            onNavigate={onNavigate}
            onLogout={onLogout}
          />
        }
      />
      <Route
        path="/rooms/:slug"
        element={<RoomRoute user={user} onNavigate={onNavigate} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
