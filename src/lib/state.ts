import type { AuthUser } from "../types";

export interface AppState {
  user: AuthUser | null;
  token: string | null;
}

const FLASH_KEY = "flash_message";
const FAVORITE_KEY = "favorite_location_ids";
const AUTH_COOKIE_KEY = "travel_ai_auth";
const AUTH_STORAGE_KEY = "travel_ai_auth";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const state: AppState = {
  user: null,
  token: null
};

function writeAuthCookie(value: string): void {
  document.cookie = `${AUTH_COOKIE_KEY}=${value}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; samesite=lax`;
}

function readAuthCookie(): string | null {
  const prefix = `${AUTH_COOKIE_KEY}=`;
  const parts = document.cookie.split("; ");
  const match = parts.find((part) => part.startsWith(prefix));
  if (!match) {
    return null;
  }

  return match.slice(prefix.length);
}

function clearAuthCookie(): void {
  document.cookie = `${AUTH_COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
}

function persistAuth(): void {
  if (!state.user || !state.token) {
    return;
  }

  const payload = JSON.stringify({ user: state.user, token: state.token });
  const encoded = encodeURIComponent(payload);
  localStorage.setItem(AUTH_STORAGE_KEY, encoded);
  writeAuthCookie(encoded);
}

export function getState(): Readonly<AppState> {
  return state;
}

export function setAuth(user: AuthUser, token: string): void {
  state.user = user;
  state.token = token;
  persistAuth();
}

export function clearAuth(): void {
  state.user = null;
  state.token = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  clearAuthCookie();
}

export function loadStoredUser(): void {
  const raw = readAuthCookie() ?? localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    state.user = null;
    state.token = null;
    return;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AppState;
    if (parsed.user && parsed.token) {
      state.user = parsed.user;
      state.token = parsed.token;
      persistAuth();
      return;
    }
  } catch {
    // ignore corrupted auth payload
  }

  state.user = null;
  state.token = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  clearAuthCookie();
}

export function setFlashMessage(message: string): void {
  sessionStorage.setItem(FLASH_KEY, message);
}

export function consumeFlashMessage(): string | null {
  const value = sessionStorage.getItem(FLASH_KEY);
  if (value) {
    sessionStorage.removeItem(FLASH_KEY);
  }
  return value;
}

export function getFavoriteLocationIds(): number[] {
  const raw = localStorage.getItem(FAVORITE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const list = JSON.parse(raw) as number[];
    return Array.isArray(list) ? list.filter((id) => Number.isFinite(id)) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteLocationId(locationId: number): number[] {
  const current = getFavoriteLocationIds();
  const next = current.includes(locationId)
    ? current.filter((id) => id !== locationId)
    : [...current, locationId];

  localStorage.setItem(FAVORITE_KEY, JSON.stringify(next));
  return next;
}
