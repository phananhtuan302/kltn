import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { authService } from "../services/auth-service.js";
import { favoriteService } from "../services/favorite-service.js";

const saveFavoriteSchema = z.object({
  location: z.object({
    id: z.number(),
    name: z.string().min(1),
    categoryName: z.string().optional(),
    address: z.string().optional()
  }).passthrough()
});

const deleteFavoriteSchema = z.object({
  locationId: z.coerce.number().int().positive()
});

export const favoriteRouter = Router();

favoriteRouter.use(requireAuth);

favoriteRouter.get("/", async (req, res) => {
  try {
    const items = await favoriteService.listFavorites(req.user!.id);
    res.json({ success: true, data: items, count: items.length });
  } catch (error) {
    console.error("Error loading favorites:", error);
    res.status(500).json({ message: "Không thể tải danh sách địa điểm yêu thích." });
  }
});

favoriteRouter.post("/", async (req, res) => {
  const parsed = saveFavoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dữ liệu địa điểm không hợp lệ." });
    return;
  }

  try {
    const user = await authService.getUserById(req.user!.id);
    if (!user) {
      res.status(404).json({ message: "Không tìm thấy người dùng." });
      return;
    }

    const saved = await favoriteService.saveFavorite({
      userId: req.user!.id,
      username: user.username,
      location: parsed.data.location
    });

    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error("Error saving favorite:", error);
    res.status(500).json({ message: error instanceof Error ? error.message : "Không thể lưu địa điểm yêu thích." });
  }
});

favoriteRouter.delete("/", async (req, res) => {
  const parsed = deleteFavoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Thiếu locationId." });
    return;
  }

  try {
    const removed = await favoriteService.removeFavorite(req.user!.id, parsed.data.locationId);
    res.json({ success: removed });
  } catch (error) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ message: "Không thể xóa địa điểm yêu thích." });
  }
});