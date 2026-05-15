import { Router } from "express";
import { z } from "zod";

import { optionalAuth } from "../middleware/auth.js";
import { aiService } from "../services/ai-service.js";
import { itineraryService } from "../services/itinerary-service.js";

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1)
      })
    )
    .min(1)
});

const chatRouter = Router();

chatRouter.use(optionalAuth);

chatRouter.post("/", async (request, response) => {
  const parsed = chatSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: "Payload chat khong hop le." });
    return;
  }

  try {
    const preferredHotel = request.user
      ? await itineraryService.getPreferredHotel(request.user.id)
      : null;

    const result = await aiService.reply(parsed.data.messages, { preferredHotel });
    response.json(result);
  } catch (error) {
    console.error("[ChatRoute] AI provider error:", error instanceof Error ? error.stack || error.message : error);
    response.status(502).json({
      message: "AI tam thoi khong phan hoi duoc. Vui long thu lai sau it phut."
    });
  }
});

export { chatRouter };