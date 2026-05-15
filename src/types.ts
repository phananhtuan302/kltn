export interface LocationItem {
  id: number;
  name: string;
  categoryCode: string;
  categoryName: string;
  address: string;
  district: string | null;
  description: string | null;
  imageUrl: string | null;
  phone: string | null;
  website: string | null;
  rating: number;
  totalReviews: number;
  latitude: number | null;
  longitude: number | null;
  featured: boolean;
  priceLabel: string | null;
  avgPriceVnd?: number | null;
  status: string;
  // optional itinerary metadata when returned from /api/itinerary
  itineraryStart?: string | null;
  itineraryEnd?: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  suggestions: LocationItem[];
}

export interface ItineraryResponse {
  items: LocationItem[];
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

export interface RegisterPreferences {
  favoriteCategories: string[];
  budgetPerTrip: number | null;
  foodPreferences: string;
  tripStyle: string;
}

export interface UserPreferences {
  favoriteCategories?: string[];
  budgetPerTrip?: number | null;
  foodPreferences?: string;
  tripStyle?: string;
}
