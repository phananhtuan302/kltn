import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { favoriteService } from "../services/favorite-service.js";
import { itineraryService } from "../services/itinerary-service.js";
import { authService } from "../services/auth-service.js";
import { locationService } from "../services/location-service.js";

const itineraryRouter = Router();

const addItemSchema = z.object({
  locationId: z.number().int().positive(),
  startTime: z.string().optional(),
  endTime: z.string().optional()
});

const createPersonalItinerarySchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  items: z.array(
    z.object({
      locationId: z.number().int().positive(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/)
    })
  ).min(1)
});

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map((v) => Number(v));
  return h * 60 + m;
}

// Public endpoint for featured itineraries
itineraryRouter.get("/featured", async (request, response) => {
  try {
    const limit = Math.min(parseInt(request.query.limit as string) || 15, 50);
    const itineraries = await itineraryService.getFeaturedItineraries(limit);

    response.json({
      success: true,
      data: itineraries,
      count: itineraries.length
    });
  } catch (error: any) {
    console.error("Error fetching featured itineraries:", error);
    response.status(500).json({
      success: false,
      error: error?.message || "Failed to fetch itineraries"
    });
  }
});

itineraryRouter.get("/featured/:id", async (request, response) => {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const itinerary = await itineraryService.getItineraryById(id);

    if (!itinerary) {
      response.status(404).json({
        success: false,
        error: "Itinerary not found"
      });
      return;
    }

    response.json({
      success: true,
      data: itinerary
    });
  } catch (error: any) {
    console.error("Error fetching itinerary detail:", error);
    response.status(500).json({
      success: false,
      error: error?.message || "Failed to fetch itinerary"
    });
  }
});

// Protected endpoints below
itineraryRouter.use(requireAuth);

itineraryRouter.get("/", async (request, response) => {
  try {
    const userId = request.user!.id;
    const favs = await favoriteService.listFavorites(userId);
    // map favorite rows to LocationRecord-like response
    const items = favs.map((f) => ({ ...(f.location as any), itineraryStart: (f as any).itineraryStart ?? null, itineraryEnd: (f as any).itineraryEnd ?? null }));
    response.json({ items });
  } catch (error: any) {
    console.error("Error listing itinerary items:", error);
    response.status(500).json({ message: "Không thể tải hành trình." });
  }
});

itineraryRouter.post("/items", async (request, response) => {
  const parsed = addItemSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Du lieu luu hanh trinh khong hop le." });
    return;
  }

  try {
    const userId = request.user!.id;
    const { locationId, startTime, endTime } = parsed.data;
    // fetch full location object
    const loc = await locationService.getLocationById(locationId);
    if (!loc) {
      response.status(404).json({ message: "Không tìm thấy địa điểm." });
      return;
    }

    const user = await authService.getUserById(userId);
    if (!user) {
      response.status(404).json({ message: "Không tìm thấy người dùng." });
      return;
    }

    const saved = await favoriteService.saveFavorite({ userId, username: user.username, location: loc, itineraryStart: startTime ?? undefined, itineraryEnd: endTime ?? undefined });
    const items = (await favoriteService.listFavorites(userId)).map((f) => ({ ...(f.location as any), itineraryStart: (f as any).itineraryStart ?? null, itineraryEnd: (f as any).itineraryEnd ?? null }));
    response.status(201).json({ items });
  } catch (error: any) {
    console.error("Error adding itinerary item:", error);
    response.status(500).json({ message: error?.message || "Không thể thêm hành trình." });
  }
});

itineraryRouter.get("/mine", async (request, response) => {
  try {
    const user = await authService.getUserById(request.user!.id);
    if (!user) {
      response.status(404).json({ message: "Không tìm thấy người dùng." });
      return;
    }

    const items = await itineraryService.listItinerariesByUsername(user.username);
    response.json({ success: true, data: items, count: items.length });
  } catch (error: any) {
    console.error("Error loading my itineraries:", error);
    response.status(500).json({ message: "Không thể tải hành trình của bạn." });
  }
});

itineraryRouter.post("/personal", async (request, response) => {
  const parsed = createPersonalItinerarySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dữ liệu hành trình không hợp lệ." });
    return;
  }

  try {
    const user = await authService.getUserById(request.user!.id);
    if (!user) {
      response.status(404).json({ message: "Không tìm thấy người dùng." });
      return;
    }

    const favoriteRows = await favoriteService.listFavorites(request.user!.id);
    const favoriteMap = new Map<number, any>(
      favoriteRows.map((row) => [Number(row.locationId), row.location])
    );

    const sorted = [...parsed.data.items]
      .map((item) => ({
        ...item,
        startMinutes: toMinutes(item.startTime),
        endMinutes: toMinutes(item.endTime)
      }))
      .sort((a, b) => a.startMinutes - b.startMinutes);

    for (const item of sorted) {
      if (item.startMinutes >= item.endMinutes) {
        response.status(400).json({ message: "Khung giờ không hợp lệ." });
        return;
      }
      if (!favoriteMap.has(item.locationId)) {
        response.status(400).json({ message: "Chỉ được chọn địa điểm trong danh sách yêu thích." });
        return;
      }
    }

    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.startMinutes < prev.endMinutes) {
        response.status(400).json({ message: "Không thể thêm vì trùng giờ." });
        return;
      }
    }

    const itemPayload = sorted.map((item) => {
      const location = favoriteMap.get(item.locationId);
      return {
        ...(location as any),
        startTime: item.startTime,
        endTime: item.endTime,
        time: `${item.startTime} -> ${item.endTime}`
      };
    });

    const created = await itineraryService.createPersonalItinerary({
      title: parsed.data.title?.trim() || `Hành trình cá nhân của ${user.fullName}`,
      description: `Lộ trình tự tạo bởi ${user.fullName}.`,
      items: itemPayload,
      totalDuration: `${sorted[0].startTime} -> ${sorted[sorted.length - 1].endTime}`,
      tenNguoiDung: user.username
    });

    response.status(201).json({ success: true, data: created });
  } catch (error: any) {
    console.error("Error creating personal itinerary:", error);
    response.status(500).json({ message: error?.message || "Không thể lưu hành trình." });
  }
});

itineraryRouter.delete("/personal/:id", async (request, response) => {
  try {
    const user = await authService.getUserById(request.user!.id);
    if (!user) {
      response.status(404).json({ message: "Không tìm thấy người dùng." });
      return;
    }

    const id = String(request.params.id || "").trim();
    if (!id) {
      response.status(400).json({ message: "Thiếu id hành trình." });
      return;
    }

    const deleted = await itineraryService.deletePersonalItineraryForUsername(id, user.username);
    if (!deleted) {
      response.status(404).json({ message: "Không tìm thấy hành trình hoặc bạn không có quyền xóa." });
      return;
    }

    response.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting personal itinerary:", error);
    response.status(500).json({ message: error?.message || "Không thể xóa hành trình." });
  }
});

itineraryRouter.delete("/items/:locationId", async (request, response) => {
  const locationId = Number(request.params.locationId);
  if (!Number.isFinite(locationId) || locationId <= 0) {
    response.status(400).json({ message: "locationId khong hop le." });
    return;
  }

  try {
    const userId = request.user!.id;
    await favoriteService.removeFavorite(userId, locationId);
    const items = (await favoriteService.listFavorites(userId)).map((f) => ({ ...(f.location as any), itineraryStart: (f as any).itineraryStart ?? null, itineraryEnd: (f as any).itineraryEnd ?? null }));
    response.json({ items });
  } catch (error: any) {
    console.error("Error removing itinerary item:", error);
    response.status(500).json({ message: "Không thể xóa hành trình." });
  }
});

export { itineraryRouter };
