import type { LocationRecord } from "../types/domain.js";
import { locationService } from "./location-service.js";
import mongoose from "mongoose";

const itinerarySchema = new mongoose.Schema(
  {
    itinerary_id: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    items: [
      {
        type: mongoose.Schema.Types.Mixed
      }
    ],
    totalDuration: { type: String },
    difficulty: { type: String },
    bestFor: { type: String },
    tenNguoiDung: { type: String },
    featured: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
  },
  { collection: "lichsuyeuthich" }
);

const Itinerary = mongoose.model("Itinerary", itinerarySchema);

class ItineraryService {
  private readonly memoryPlans = new Map<number, Array<{ locationId: number; startTime?: string; endTime?: string }>>();

  async listLocations(userId: number): Promise<LocationRecord[]> {
    return this.listFromMemory(userId);
  }

  async addLocation(userId: number, locationId: number, when?: { startTime?: string; endTime?: string }): Promise<LocationRecord[]> {
    return this.addToMemory(userId, locationId, when);
  }

  async removeLocation(userId: number, locationId: number): Promise<LocationRecord[]> {
    return this.removeFromMemory(userId, locationId);
  }

  async getPreferredHotel(userId: number): Promise<LocationRecord | null> {
    const items = await this.listLocations(userId);
    return items.find((item) => item.categoryCode === "khach-san") ?? null;
  }

  async getFeaturedItineraries(limit: number = 15): Promise<any[]> {
    try {
      const itineraries = await Itinerary.find({})
        .sort({ featured: -1, rating: -1, itinerary_id: 1 })
        .limit(limit)
        .lean();
      return itineraries || [];
    } catch (error) {
      console.error("Error fetching featured itineraries:", error);
      return [];
    }
  }

  async getItineraryById(id: string): Promise<any> {
    try {
      const numericId = Number(id);
      const itinerary = Number.isFinite(numericId)
        ? await Itinerary.findOne({ itinerary_id: numericId }).lean()
        : await Itinerary.findById(id).lean();
      return itinerary || null;
    } catch (error) {
      console.error("Error fetching itinerary by id:", error);
      return null;
    }
  }

  async listItinerariesByUsername(username: string, limit: number = 50): Promise<any[]> {
    try {
      const itineraries = await Itinerary.find({ tenNguoiDung: username })
        .sort({ createdAt: -1, itinerary_id: -1 })
        .limit(limit)
        .lean();
      return itineraries || [];
    } catch (error) {
      console.error("Error listing itineraries by username:", error);
      return [];
    }
  }

  async createPersonalItinerary(data: {
    title: string;
    description?: string;
    items: any[];
    totalDuration?: string;
    tenNguoiDung: string;
  }): Promise<any> {
    const nextId = await this.getNextItineraryId();
    const created = await Itinerary.create({
      itinerary_id: nextId,
      title: data.title,
      description: data.description ?? "Hành trình cá nhân do người dùng tự tạo.",
      items: data.items,
      totalDuration: data.totalDuration ?? "Tùy chỉnh",
      difficulty: "Tự tạo",
      bestFor: "Cá nhân",
      tenNguoiDung: data.tenNguoiDung,
      featured: false,
      rating: 0,
      createdAt: new Date()
    });
    return created.toObject();
  }

  async deletePersonalItineraryForUsername(id: string, username: string): Promise<boolean> {
    const numericId = Number(id);
    const filter = Number.isFinite(numericId)
      ? { itinerary_id: numericId, tenNguoiDung: username }
      : { _id: id, tenNguoiDung: username };
    const result = await Itinerary.deleteOne(filter as any);
    return result.deletedCount > 0;
  }

  private async getNextItineraryId(): Promise<number> {
    const last = await Itinerary.findOne({}).sort({ itinerary_id: -1 }).lean();
    return (last?.itinerary_id ?? 0) + 1;
  }

  private async addToMemory(userId: number, locationId: number, when?: { startTime?: string; endTime?: string }): Promise<LocationRecord[]> {
    const current = this.memoryPlans.get(userId) ?? [];
    const exists = current.find((c) => c.locationId === locationId);
    if (!exists) {
      current.push({ locationId, startTime: when?.startTime, endTime: when?.endTime });
      this.memoryPlans.set(userId, current);
    } else {
      // update times if provided
      if (when?.startTime) exists.startTime = when.startTime;
      if (when?.endTime) exists.endTime = when.endTime;
    }

    return this.listFromMemory(userId);
  }

  private async removeFromMemory(userId: number, locationId: number): Promise<LocationRecord[]> {
    const current = this.memoryPlans.get(userId) ?? [];
    this.memoryPlans.set(
      userId,
      current.filter((entry) => entry.locationId !== locationId)
    );

    return this.listFromMemory(userId);
  }

  private async listFromMemory(userId: number): Promise<LocationRecord[]> {
    const entries = this.memoryPlans.get(userId) ?? [];
    const records = await Promise.all(
      entries.map(async (entry) => {
        const loc = await locationService.getLocationById(entry.locationId);
        if (!loc) return null;
        // attach time metadata onto returned object
        return { ...loc, itineraryStart: entry.startTime ?? null, itineraryEnd: entry.endTime ?? null } as LocationRecord;
      })
    );
    return records.filter((item): item is LocationRecord => item !== null);
  }
}

export const itineraryService = new ItineraryService();
