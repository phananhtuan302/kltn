export interface LocationRecord {
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
}

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}