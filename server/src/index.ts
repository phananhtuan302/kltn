import { createApp } from "./app.js";
import { connectMongoDB } from "./config/database.js";
import { env } from "./config/env.js";
import { initializeEmbedding } from "./services/embedding-service.js";
import { initializeVectorSearch } from "./services/vector-search.js";
import { initializeOllama } from "./services/ollama-service.js";
import { initializeRouter } from "./services/semantic-router.js";

async function start() {
  try {
    await connectMongoDB();
    console.log("✓ Database initialized");
  } catch (error) {
    console.error("✗ Failed to connect to database:", error);
    process.exit(1);
  }

  try {
    await initializeEmbedding();
    await initializeVectorSearch();
    await initializeOllama();
    await initializeRouter();
    console.log("✓ Hybrid AI services + Semantic Router initialized");
  } catch (error) {
    console.warn("⚠ Hybrid AI services not fully initialized:", error);
  }

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Travel AI server listening on http://localhost:${env.port}`);
  });
}

start();