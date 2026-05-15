import type { ChatMessage, ChatResponse, ItineraryResponse, LocationItem } from "../types";
import { getState } from "./state";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(payload?.message ?? "Yêu cầu thất bại.");
  }
  return (await response.json()) as T;
}

function authHeader(): HeadersInit {
  const token = getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchLocations(params: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<LocationItem[]> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  return parseResponse<LocationItem[]>(
    await fetch(`/api/locations?${query.toString()}`)
  );
}

export async function fetchLocationById(id: number): Promise<LocationItem> {
  return parseResponse<LocationItem>(
    await fetch(`/api/locations/${id}`)
  );
}

export async function apiGetLocationRecommendations(preferences: Record<string, unknown>): Promise<LocationItem[]> {
  return parseResponse<LocationItem[]>(
    await fetch("/api/locations/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(preferences)
    })
  );
}

export async function sendChatMessage(
  messages: ChatMessage[]
): Promise<ChatResponse> {
  return parseResponse<ChatResponse>(
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ messages })
    })
  );
}

export async function apiGetItinerary(): Promise<LocationItem[]> {
  const result = await parseResponse<ItineraryResponse>(
    await fetch("/api/itinerary", { headers: authHeader() })
  );
  return result.items;
}

export async function apiFetchFeaturedItineraries(): Promise<any[]> {
  const result = await parseResponse<{ success: boolean; data: any[]; count: number }>(
    await fetch(`/api/itinerary/featured`)
  );
  return result.data;
}

export async function apiFetchFeaturedItineraryById(id: string | number): Promise<any> {
  const result = await parseResponse<{ success: boolean; data: any }>(
    await fetch(`/api/itinerary/featured/${id}`)
  );
  return result.data;
}

export interface FavoriteLocationRecord {
  userId: number;
  username: string;
  locationId: number;
  location: LocationItem;
  savedAt: string;
}

export interface PersonalItineraryRecord {
  _id: string;
  itinerary_id?: number;
  title: string;
  description?: string;
  items: any[];
  totalDuration?: string;
  tenNguoiDung?: string;
  createdAt?: string;
}

export async function apiGetFavoriteLocations(): Promise<FavoriteLocationRecord[]> {
  const result = await parseResponse<{ success: boolean; data: FavoriteLocationRecord[]; count: number }>(
    await fetch("/api/favorites", { headers: authHeader() })
  );
  return result.data;
}

export async function apiSaveFavoriteLocation(location: LocationItem): Promise<FavoriteLocationRecord> {
  const result = await parseResponse<{ success: boolean; data: FavoriteLocationRecord }>(
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ location })
    })
  );
  return result.data;
}

export async function apiRemoveFavoriteLocation(locationId: number): Promise<void> {
  await parseResponse<{ success: boolean }>(
    await fetch("/api/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ locationId })
    })
  );
}

export async function apiGetMyItineraries(): Promise<PersonalItineraryRecord[]> {
  const result = await parseResponse<{ success: boolean; data: PersonalItineraryRecord[]; count: number }>(
    await fetch("/api/itinerary/mine", { headers: authHeader() })
  );
  return result.data;
}

export async function apiCreatePersonalItinerary(data: {
  title?: string;
  items: Array<{ locationId: number; startTime: string; endTime: string }>;
}): Promise<PersonalItineraryRecord> {
  const result = await parseResponse<{ success: boolean; data: PersonalItineraryRecord }>(
    await fetch("/api/itinerary/personal", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(data)
    })
  );
  return result.data;
}

export async function apiDeletePersonalItinerary(id: string | number): Promise<void> {
  await parseResponse<{ success: boolean }>(
    await fetch(`/api/itinerary/personal/${id}`, {
      method: "DELETE",
      headers: authHeader()
    })
  );
}

export async function apiSaveUserPreferences(answers: Record<string, unknown>): Promise<{ success: boolean }> {
  return parseResponse<{ success: boolean }>(
    await fetch(`/api/user/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(answers)
    })
  );
}
export async function apiAddItineraryItem(locationId: number, opts?: { startTime?: string; endTime?: string }): Promise<LocationItem[]> {
  const payload: any = { locationId };
  if (opts?.startTime) payload.startTime = opts.startTime;
  if (opts?.endTime) payload.endTime = opts.endTime;
  const result = await parseResponse<ItineraryResponse>(
    await fetch("/api/itinerary/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(payload)
    })
  );
  return result.items;
}

export async function apiRemoveItineraryItem(locationId: number): Promise<LocationItem[]> {
  const result = await parseResponse<ItineraryResponse>(
    await fetch(`/api/itinerary/items/${locationId}`, {
      method: "DELETE",
      headers: authHeader()
    })
  );
  return result.items;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export async function apiRegister(data: {
  username: string;
  email: string;
  password: string;
  fullName: string;
  preferences?: {
    favoriteCategories?: string[];
    budgetPerTrip?: number | null;
    foodPreferences?: string;
    tripStyle?: string;
  };
}): Promise<AuthResult> {
  return parseResponse<AuthResult>(
    await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
  );
}

export async function apiLogin(data: {
  username: string;
  password: string;
}): Promise<AuthResult> {
  return parseResponse<AuthResult>(
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
  );
}

export async function apiGetMe(): Promise<AuthUser> {
  return parseResponse<AuthUser>(
    await fetch("/api/auth/me", { headers: authHeader() })
  );
}

export async function apiChangePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  return parseResponse<{ success: boolean; message: string }>(
    await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(data)
    })
  );
}

export async function apiGetUserPreferences(): Promise<Record<string, unknown>> {
  const result = await parseResponse<{ success: boolean; data: Record<string, unknown> }>(
    await fetch("/api/user/preferences", { headers: authHeader() })
  );
  return result.data;
}

export async function apiUpdateUserProfile(data: {
  fullName?: string;
  email?: string;
}): Promise<{ success: boolean; user: AuthUser }> {
  return parseResponse<{ success: boolean; user: AuthUser }>(
    await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(data)
    })
  );
}
