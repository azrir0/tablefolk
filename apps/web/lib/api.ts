import type {
  AvatarConfig,
  CafeInstanceSummaryDTO,
  GameCatalogueItemDTO,
  GameTutorialDTO,
  UserProfileDTO,
} from "@tablefolk/shared";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:2567"
)
  .trim()
  .replace(/\/+$/, "");

export const WS_BASE_URL = (
  process.env.NEXT_PUBLIC_WS_URL || API_BASE_URL.replace(/^http/, "ws")
)
  .trim()
  .replace(/\/+$/, "");

const TOKEN_KEY = "tablefolk_auth_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  requireAuth = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (requireAuth) {
    throw new Error("Please sign in first.");
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Cannot reach game server (${API_BASE_URL}). If hosted on Render free tier, wait 20–30s for it to wake up and try again.`
    );
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function loginAsGuest(
  displayName: string,
  avatarConfig?: AvatarConfig
): Promise<{ token: string; profile: UserProfileDTO }> {
  const res = await apiFetch<{ token: string; profile: UserProfileDTO }>(
    "/api/auth/guest",
    {
      method: "POST",
      body: JSON.stringify({ displayName, avatarConfig }),
    }
  );
  setStoredToken(res.token);
  return res;
}

export async function registerAccount(
  email: string,
  password: string,
  displayName: string,
  avatarConfig?: AvatarConfig
): Promise<{ token: string; profile: UserProfileDTO }> {
  const res = await apiFetch<{ token: string; profile: UserProfileDTO }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ email, password, displayName, avatarConfig }),
    }
  );
  setStoredToken(res.token);
  return res;
}

export async function loginAccount(
  email: string,
  password: string
): Promise<{ token: string; profile: UserProfileDTO }> {
  const res = await apiFetch<{ token: string; profile: UserProfileDTO }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
  setStoredToken(res.token);
  return res;
}

export async function upgradeGuestAccount(
  email: string,
  password: string
): Promise<{ token: string; profile: UserProfileDTO }> {
  const res = await apiFetch<{ token: string; profile: UserProfileDTO }>(
    "/api/auth/upgrade",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    true
  );
  setStoredToken(res.token);
  return res;
}

export async function fetchMyProfile(): Promise<UserProfileDTO> {
  const res = await apiFetch<{ profile: UserProfileDTO }>("/api/me", {}, true);
  return res.profile;
}

export async function saveMyAvatar(
  avatarConfig: AvatarConfig,
  displayName?: string
): Promise<UserProfileDTO> {
  const res = await apiFetch<{ profile: UserProfileDTO }>(
    "/api/me/avatar",
    {
      method: "PATCH",
      body: JSON.stringify({ avatarConfig, displayName }),
    },
    true
  );
  return res.profile;
}

export async function fetchGameCatalogue(): Promise<GameCatalogueItemDTO[]> {
  const res = await apiFetch<{ games: GameCatalogueItemDTO[] }>("/api/games");
  return res.games;
}

export async function fetchGameTutorial(slug: string): Promise<GameTutorialDTO> {
  const res = await apiFetch<{ tutorial: GameTutorialDTO }>(
    `/api/games/${encodeURIComponent(slug)}/tutorial`
  );
  return res.tutorial;
}

export async function fetchPublicCafes(): Promise<CafeInstanceSummaryDTO[]> {
  const res = await apiFetch<{ cafes: CafeInstanceSummaryDTO[] }>("/api/cafes");
  return res.cafes;
}

export async function createPrivateCafe(
  name: string,
  maxPlayers = 12
): Promise<{ roomId: string; name: string; accessCode: string }> {
  return apiFetch(
    "/api/cafes/private",
    {
      method: "POST",
      body: JSON.stringify({ name, maxPlayers }),
    },
    true
  );
}

export async function resolvePrivateCafeCode(
  accessCode: string
): Promise<{ roomId: string; accessCode: string }> {
  return apiFetch("/api/cafes/resolve-code", {
    method: "POST",
    body: JSON.stringify({ accessCode }),
  });
}

export async function submitPlayerReport(
  targetUserId: string,
  reason: string,
  context?: Record<string, unknown>
): Promise<void> {
  await apiFetch(
    "/api/reports",
    {
      method: "POST",
      body: JSON.stringify({ targetUserId, reason, context }),
    },
    true
  );
}

export interface ActiveGameRef {
  gameRoomId: string;
  cafeRoomId: string;
  tableId: string;
  gameSlug: string;
  startedAt: number;
}

export async function fetchMyActiveGame(): Promise<ActiveGameRef | null> {
  const res = await apiFetch<{ activeGame: ActiveGameRef | null }>(
    "/api/me/active-game",
    {},
    true
  );
  return res.activeGame ?? null;
}
