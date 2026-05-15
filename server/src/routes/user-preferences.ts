import { Router } from "express";
import mongoose, { Schema, Document } from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { authService } from "../services/auth-service.js";
import { connectMongoDB, getMongoose } from "../config/database.js";

interface PreferenceRow {
  nguoi_dung_id: number;
  ten_dang_nhap: string;
  answers: Record<string, unknown>;
  createdAt: Date;
}

const prefSchema = new Schema<PreferenceRow & Document>(
  {
    nguoi_dung_id: { type: Number, required: true, index: true },
    ten_dang_nhap: { type: String, required: true, index: true },
    answers: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: () => new Date(), required: true }
  },
  { collection: "sothichnguoidung" }
);

let PrefModel: mongoose.Model<PreferenceRow & Document> | null = null;

async function getPrefModel() {
  if (!PrefModel) {
    await connectMongoDB();
    const db = getMongoose();
    PrefModel = db.model<PreferenceRow & Document>("SoThichNguoiDung", prefSchema, "sothichnguoidung");
  }
  return PrefModel;
}

export const userPrefRouter = Router();

// Save preferences for authenticated user
userPrefRouter.post("/preferences", requireAuth, async (req, res) => {
  try {
    const user = req.user!; // set by requireAuth middleware
    const answers = req.body;
    if (!answers || typeof answers !== "object") {
      res.status(400).json({ message: "Dữ liệu không hợp lệ." });
      return;
    }

    const Pref = await getPrefModel();
    // fetch full user to get username
    const fullUser = await authService.getUserById(user.id);
    const username = fullUser?.username ?? "";
    const doc = new Pref({
      nguoi_dung_id: user.id,
      ten_dang_nhap: username,
      answers,
      createdAt: new Date()
    });

    await doc.save();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Failed to save user preferences:", err);
    res.status(500).json({ message: "Lưu sở thích thất bại." });
  }
});

// Get preferences for authenticated user
userPrefRouter.get("/preferences", requireAuth, async (req, res) => {
  try {
    const user = req.user!; // set by requireAuth middleware
    const Pref = await getPrefModel();
    
    const prefs = await Pref.findOne({ nguoi_dung_id: user.id }).sort({ createdAt: -1 });
    
    if (!prefs) {
      res.json({
        success: true,
        data: {
          favoriteCategories: [],
          budgetPerTrip: null,
          foodPreferences: "",
          tripStyle: ""
        }
      });
      return;
    }

    // Map answers from questionnaire to preferences format
    const answers = prefs.answers as Record<string, unknown>;
    const favoriteCategories: string[] = [];

    // Extract place preferences (multi-select, corresponds to favoriteCategories)
    if (Array.isArray(answers.place)) {
      for (const cat of answers.place as string[]) {
        favoriteCategories.push(cat);
      }
    }

    // Extract food preference (single, corresponds to foodPreferences)
    const foodPreferences = typeof answers.food === "string" ? answers.food : "";

    // Extract budget (text number)
    let budgetPerTrip: number | null = null;
    if (typeof answers.budget === "string") {
      const parsed = parseInt(answers.budget, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        budgetPerTrip = parsed;
      }
    }

    // Trip style - infer from place selections and food preference
    let tripStyle = "";
    const hasCoffee = favoriteCategories.includes("coffee");
    const hasAdventure = favoriteCategories.includes("karaoke") || favoriteCategories.includes("cong-vien");
    const hasCulture = favoriteCategories.includes("chua") || favoriteCategories.includes("nha-tho");
    const hasFood = foodPreferences === "com" || foodPreferences === "pho" || foodPreferences === "bun";

    if (hasCulture) {
      tripStyle = "culture";
    } else if (hasAdventure) {
      tripStyle = "adventure";
    } else if (hasCoffee && hasFood) {
      tripStyle = "foodie";
    } else if (hasCoffee) {
      tripStyle = "relaxation";
    }

    res.json({
      success: true,
      data: {
        favoriteCategories,
        budgetPerTrip,
        foodPreferences,
        tripStyle
      }
    });
  } catch (err) {
    console.error("Failed to get user preferences:", err);
    res.status(500).json({ message: "Lấy sở thích thất bại." });
  }
});
