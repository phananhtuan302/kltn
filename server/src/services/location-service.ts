import mongoose, { Schema, Document } from "mongoose";

import { connectMongoDB, getMongoose } from "../config/database.js";
import { env } from "../config/env.js";
import type { LocationRecord } from "../types/domain.js";
import { getVectorSearchService } from "./vector-search.js";

// Empty mock locations array - all data comes from MongoDB now
const mockLocations: LocationRecord[] = [];

// MongoDB Schema for Location
const locationSchema = new Schema<LocationRecord & Document>({
  id: { type: Number, required: true, index: true },
  name: { type: String, required: true, index: true },
  categoryCode: { type: String, required: true, index: true },
  categoryName: String,
  address: { type: String, required: true, index: true },
  district: String,
  description: String,
  imageUrl: String,
  phone: String,
  website: String,
  rating: { type: Number, default: 0, index: true },
  totalReviews: { type: Number, default: 0 },
  latitude: Number,
  longitude: Number,
  featured: { type: Boolean, default: false, index: true },
  priceLabel: String,
  avgPriceVnd: Number,
  status: String
}, { collection: "diadiem" });

let LocationModel: mongoose.Model<LocationRecord & Document> | null = null;

async function getLocationModel() {
  if (!LocationModel) {
    await connectMongoDB();
    const db = getMongoose();
    LocationModel = db.model<LocationRecord & Document>("Location", locationSchema, "diadiem");
  }
  return LocationModel;
}

interface AreaPreference {
  ward: string | null;
  district: string | null;
}

export class LocationService {
  async listLocations(filters: {
    limit?: number;
    category?: string;
    search?: string;
  }): Promise<LocationRecord[]> {
    if (env.useMockData) {
      return this.filterMock(filters);
    }

    try {
      return await this.queryLocations(filters);
    } catch {
      return this.filterMock(filters);
    }
  }

  async getLocationById(id: number): Promise<LocationRecord | null> {
    if (env.useMockData) {
      return mockLocations.find((item) => item.id === id) ?? null;
    }

    const items = await this.listLocations({ limit: 2000 });
    return items.find((item) => item.id === id) ?? null;
  }

  async findRelevantLocations(userPrompt: string, preferredArea?: AreaPreference | null): Promise<LocationRecord[]> {
    const lowered = userPrompt.toLowerCase();
    const all = await this.listLocations({ limit: 1000 });
    const prefersFood = /(quan\s*an|nha\s*hang|an\s*uong|mon\s*an)/i.test(lowered);
    const maxResults = 20;  // Return more for better context

    const scored = all
      .map((location) => {
        let score = location.featured ? 2 : 0;

        if (lowered.includes("an") || lowered.includes("nha hang") || lowered.includes("quan an")) {
          score += location.categoryCode === "quan-an" ? 4 : 0;
        }

        if (lowered.includes("coffee") || lowered.includes("ca phe")) {
          score += location.categoryCode === "coffee" ? 4 : 0;
        }

        if (lowered.includes("tam linh") || lowered.includes("chua") || lowered.includes("nha tho")) {
          score += location.categoryCode === "chua" || location.categoryCode === "nha-tho" ? 4 : 0;
        }

        if (lowered.includes("mua sam") || lowered.includes("cho") || lowered.includes("sieu thi")) {
          score += location.categoryCode === "cho" ? 4 : 0;
        }

        if (lowered.includes("gia dinh") && location.totalReviews > 100) {
          score += 2;
        }

        if (location.name.toLowerCase().includes(lowered)) {
          score += 3;
        }

        if (prefersFood && location.categoryCode === "quan-an" && preferredArea) {
          score += this.computeAreaScore(location.address, preferredArea);
        }

        return { location, score };
      })
      .sort((left, right) => right.score - left.score || right.location.rating - left.location.rating)
      .filter((entry) => entry.score > 0)
      .slice(0, maxResults)
      .map((entry) => entry.location);

    return scored.length > 0 ? scored : all.slice(0, maxResults);
  }

  async findLocationsByUserPreferences(preferences: {
    favoriteCategories?: string[];
    foodPreferences?: string;
    tripStyle?: string;
    budgetPerTrip?: number | null;
  }, limit = 5): Promise<LocationRecord[]> {
    try {
      const parts: string[] = [];

      if (preferences.favoriteCategories && preferences.favoriteCategories.length > 0) {
        parts.push(`Favorite location categories: ${preferences.favoriteCategories.join(", ")}`);
      }

      if (preferences.foodPreferences) {
        parts.push(`Food preference: ${preferences.foodPreferences}`);
      }

      if (preferences.tripStyle) {
        parts.push(`Trip style: ${preferences.tripStyle}`);
      }

      if (preferences.budgetPerTrip && preferences.budgetPerTrip > 0) {
        parts.push(`Budget: ${preferences.budgetPerTrip} VND`);
      }

      if (parts.length === 0) {
        return [];
      }

      const queryText = parts.join(". ");
      const vectorSearch = getVectorSearchService();
      const results = await vectorSearch.search(queryText, limit);

      return results
        .sort((a, b) => b.score - a.score)
        .map((r) => r.location);
    } catch (error) {
      console.error("[LocationService] Error finding locations by preferences:", error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  async findTopLocationsUnderBudget(
    categoryCode: string,
    maxPriceVnd: number,
    limit = 3,
    preferredArea?: AreaPreference | null
  ): Promise<LocationRecord[]> {
    if (env.useMockData) {
      return this.filterLocationsUnderBudgetMock(categoryCode, maxPriceVnd, limit, preferredArea);
    }

    try {
      return await this.queryLocationsUnderBudget(categoryCode, maxPriceVnd, limit, preferredArea);
    } catch {
      return this.filterLocationsUnderBudgetMock(categoryCode, maxPriceVnd, limit, preferredArea);
    }
  }

  private filterLocationsUnderBudgetMock(
    categoryCode: string,
    maxPriceVnd: number,
    limit: number,
    preferredArea?: AreaPreference | null
  ): LocationRecord[] {
    return mockLocations
      .filter((item) => item.categoryCode === categoryCode)
      .filter((item) => typeof item.avgPriceVnd === "number" && item.avgPriceVnd <= maxPriceVnd)
      .sort((a, b) => {
        const areaDiff = this.computeAreaScore(b.address, preferredArea) - this.computeAreaScore(a.address, preferredArea);
        if (areaDiff !== 0) {
          return areaDiff;
        }

        return b.rating - a.rating || b.totalReviews - a.totalReviews;
      })
      .slice(0, limit);
  }

  private filterMock(filters: {
    limit?: number;
    category?: string;
    search?: string;
  }): LocationRecord[] {
    const search = filters.search?.trim().toLowerCase();

    return mockLocations
      .filter((location) => !filters.category || location.categoryCode === filters.category)
      .filter((location) => {
        if (!search) {
          return true;
        }

        return [location.name, location.address, location.categoryName, location.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .slice(0, filters.limit ?? 1000);
  }

  private async queryLocations(filters: {
    limit?: number;
    category?: string;
    search?: string;
  }): Promise<LocationRecord[]> {
    try {
      const Location = await getLocationModel();
      
      const query: Record<string, unknown> = {};
      
      if (filters.category) {
        query.categoryCode = filters.category;
      }
      
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: "i" } },
          { address: { $regex: filters.search, $options: "i" } },
          { categoryName: { $regex: filters.search, $options: "i" } },
          { description: { $regex: filters.search, $options: "i" } }
        ];
      }
      
      const locations = await Location.find(query)
        .sort({ featured: -1, rating: -1, totalReviews: -1 })
        .limit(filters.limit || 1000)
        .lean();
      
      return locations as LocationRecord[];
    } catch (error) {
      console.error("MongoDB query failed:", error);
      return this.filterMock(filters);
    }
  }

  private async queryLocationsUnderBudget(
    categoryCode: string,
    maxPriceVnd: number,
    limit: number,
    preferredArea?: AreaPreference | null
  ): Promise<LocationRecord[]> {
    try {
      const Location = await getLocationModel();
      
      const locations = await Location.find({
        categoryCode,
        avgPriceVnd: { $exists: true, $ne: null, $lte: maxPriceVnd }
      })
        .sort({ rating: -1, totalReviews: -1 })
        .limit(Math.min(Math.max(limit * 20, 60), 500))
        .lean();
      
      return (locations as LocationRecord[])
        .sort((a, b) => {
          const areaDiff = 
            this.computeAreaScore(b.address, preferredArea) - 
            this.computeAreaScore(a.address, preferredArea);
          if (areaDiff !== 0) {
            return areaDiff;
          }
          return b.rating - a.rating || b.totalReviews - a.totalReviews;
        })
        .slice(0, limit);
    } catch (error) {
      console.error("MongoDB query failed:", error);
      return this.filterLocationsUnderBudgetMock(categoryCode, maxPriceVnd, limit, preferredArea);
    }
  }

  private computeAreaScore(address: string | null, preferredArea?: AreaPreference | null): number {
    if (!address || !preferredArea) {
      return 0;
    }

    const parsed = this.extractArea(address);
    let score = 0;

    if (preferredArea.ward && parsed.ward && preferredArea.ward === parsed.ward) {
      score += 6;
    }

    if (preferredArea.district && parsed.district && preferredArea.district === parsed.district) {
      score += 3;
    }

    return score;
  }

  extractArea(address: string | null): AreaPreference {
    if (!address) {
      return { ward: null, district: null };
    }

    const normalized = address.toLowerCase();
    const wardMatch = normalized.match(/(?:phường|p\.?)[\s]*([\p{L}\d]+)/u);
    const districtMatch = normalized.includes("gò vấp") || normalized.includes("go vap")
      ? "go vap"
      : (normalized.match(/quận\s*\d+/u)?.[0] ?? null);

    return {
      ward: wardMatch?.[1]?.replace(/[^\p{L}\d]/gu, "") ?? null,
      district: districtMatch
    };
  }
}

export const locationService = new LocationService();