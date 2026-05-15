import type { Request, Response } from "express";
import { itineraryService } from "../services/itinerary-service.js";

export async function getItineraries(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 15, 50);
    const itineraries = await itineraryService.getFeaturedItineraries(limit);

    res.json({
      success: true,
      data: itineraries,
      count: itineraries.length
    });
  } catch (error: any) {
    console.error("Error fetching itineraries:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to fetch itineraries"
    });
  }
}

export async function getItineraryById(req: Request, res: Response): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const itinerary = await itineraryService.getItineraryById(id);

    if (!itinerary) {
      res.status(404).json({
        success: false,
        error: "Itinerary not found"
      });
      return;
    }

    res.json({
      success: true,
      data: itinerary
    });
  } catch (error: any) {
    console.error("Error fetching itinerary:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to fetch itinerary"
    });
  }
}
