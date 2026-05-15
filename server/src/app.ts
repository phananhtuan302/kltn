import cors from "cors";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";

import { locationsRouter } from "./routes/locations.js";
import { chatRouter } from "./routes/chat.js";
import { authRouter } from "./routes/auth.js";
import { itineraryRouter } from "./routes/itinerary.js";
import { userPrefRouter } from "./routes/user-preferences.js";
import { favoriteRouter } from "./routes/favorites.js";

export function createApp() {
  const app = express();
  const clientDistPath = path.resolve(process.cwd(), "dist");

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/itinerary", itineraryRouter);
  app.use("/api/favorites", favoriteRouter);
  app.use("/api/locations", locationsRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/user", userPrefRouter);

  if (existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));

    app.get("*", (_request, response) => {
      response.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  return app;
}