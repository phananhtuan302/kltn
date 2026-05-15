import mongoose, { Document, Schema } from "mongoose";

import { connectMongoDB, getMongoose } from "../config/database.js";

export interface FavoriteLocationRow {
  userId: number;
  username: string;
  locationId: number;
  location: any;
  savedAt: Date;
  itineraryStart?: string | null;
  itineraryEnd?: string | null;
}

const favoriteSchema = new Schema<FavoriteLocationRow & Document>(
  {
    userId: { type: Number, required: true, index: true },
    username: { type: String, required: true, index: true },
    locationId: { type: Number, required: true, index: true },
    location: { type: Schema.Types.Mixed, required: true },
    savedAt: { type: Date, default: () => new Date(), required: true },
    itineraryStart: { type: String, required: false },
    itineraryEnd: { type: String, required: false }
  },
  { collection: "diadiemyeuthich" }
);

favoriteSchema.index({ userId: 1, locationId: 1 }, { unique: true });

let FavoriteModel: mongoose.Model<FavoriteLocationRow & Document> | null = null;

async function getFavoriteModel() {
  if (!FavoriteModel) {
    await connectMongoDB();
    const db = getMongoose();
    FavoriteModel = db.model<FavoriteLocationRow & Document>("FavoriteLocation", favoriteSchema, "diadiemyeuthich");
  }
  return FavoriteModel;
}

export class FavoriteService {
  async listFavorites(userId: number): Promise<FavoriteLocationRow[]> {
    const Favorite = await getFavoriteModel();
    return Favorite.find({ userId }).sort({ savedAt: -1 }).lean();
  }

  async saveFavorite(data: {
    userId: number;
    username: string;
    location: any;
    itineraryStart?: string | null;
    itineraryEnd?: string | null;
  }): Promise<FavoriteLocationRow> {
    const Favorite = await getFavoriteModel();
    const locationId = Number(data.location.id);

    if (!Number.isFinite(locationId)) {
      throw new Error("Địa điểm không hợp lệ.");
    }

    const existing = await Favorite.findOne({ userId: data.userId, locationId });
    if (existing) {
      // update itinerary times if provided
      if (data.itineraryStart) existing.itineraryStart = data.itineraryStart;
      if (data.itineraryEnd) existing.itineraryEnd = data.itineraryEnd;
      await existing.save();
      return existing.toObject() as FavoriteLocationRow;
    }

    const saved = await Favorite.create({
      userId: data.userId,
      username: data.username,
      locationId,
      location: data.location,
      savedAt: new Date(),
      itineraryStart: data.itineraryStart ?? undefined,
      itineraryEnd: data.itineraryEnd ?? undefined
    });

    return saved.toObject() as FavoriteLocationRow;
  }

  async removeFavorite(userId: number, locationId: number): Promise<boolean> {
    const Favorite = await getFavoriteModel();
    const result = await Favorite.deleteOne({ userId, locationId });
    return result.deletedCount > 0;
  }
}

export const favoriteService = new FavoriteService();