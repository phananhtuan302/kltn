import mongoose from "mongoose";
import sql from "mssql";

import { env } from "./env.js";

let mongoConnection: typeof mongoose | null = null;
let mssqlPool: sql.ConnectionPool | null = null;

export async function connectMongoDB(): Promise<typeof mongoose> {
  if (mongoConnection) {
    return mongoConnection;
  }

  try {
    mongoConnection = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      dbName: "DBWebsite"
    });

    console.log("✓ MongoDB connected successfully to database: DBWebsite");
    return mongoConnection;
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error);
    throw error;
  }
}

export function getMongoose(): typeof mongoose {
  if (!mongoConnection) {
    throw new Error("MongoDB not connected. Call connectMongoDB() first.");
  }
  return mongoConnection;
}

// For backward compatibility with auth-service and itinerary-service
// They will fall back to mock data when using MongoDB
export async function getDbPool(): Promise<sql.ConnectionPool> {
  if (env.useMockData) {
    // Create a dummy pool that will be ignored (queries use mock data)
    return new sql.ConnectionPool({
      server: "dummy",
      database: "dummy"
    });
  }
  
  // For now, return dummy pool - auth and itinerary services should use mock data
  return new sql.ConnectionPool({
    server: "dummy",
    database: "dummy"
  });
}