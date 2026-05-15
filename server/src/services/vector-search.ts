/**
 * Vector Search Service - Search in Qdrant
 * Tương tự vector_store.py từ RAG_LANGCHAIN
 */

import { env } from "../config/env.js";
import type { LocationRecord } from "../types/domain.js";
import { getEmbeddingService } from "./embedding-service.js";

export interface VectorSearchResult {
  id: string;
  score: number;
  location: LocationRecord;
}

export class VectorSearchService {
  private readonly qdrantUrl: string;
  private readonly collectionName: string;
  private readonly apiKey: string | null;

  constructor(qdrantUrl?: string, collectionName?: string, apiKey?: string | null) {
    this.qdrantUrl = qdrantUrl || env.qdrantUrl;
    this.collectionName = collectionName || env.qdrantCollection;
    this.apiKey = apiKey || (env.qdrantApiKey ? env.qdrantApiKey : null);
  }

  /**
   * Search similar vectors
   */
  async search(queryText: string, topK: number = 5): Promise<VectorSearchResult[]> {
    try {
      // 1. Embed query
      const embeddingService = getEmbeddingService();
      const queryVector = await embeddingService.embedText(queryText);

      // 2. Search in Qdrant
      const response = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}/points/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey && { "api-key": this.apiKey })
        },
        body: JSON.stringify({
          vector: queryVector,
          limit: topK,
          with_payload: true
        })
      });

      if (!response.ok) {
        throw new Error(`Qdrant search failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        result: Array<{
          id: string | number;
          score: number;
          payload: Record<string, unknown>;
        }>;
      };

      return data.result.map((result) => ({
        id: String(result.id),
        score: result.score,
        location: result.payload as unknown as LocationRecord
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[VectorSearch] Error:`, message);
      return [];
    }
  }

  /**
   * Check if collection exists
   */
  async collectionExists(): Promise<boolean> {
    try {
      const response = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}`, {
        method: "GET",
        headers: this.apiKey ? { "api-key": this.apiKey } : {}
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<{ points_count: number } | null> {
    try {
      const response = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}`, {
        method: "GET",
        headers: this.apiKey ? { "api-key": this.apiKey } : {}
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { result: { points_count: number } };
      return { points_count: data.result.points_count };
    } catch {
      return null;
    }
  }
}

/**
 * Initialize Vector Search Service (Singleton)
 */
let vectorSearchService: VectorSearchService | null = null;

export async function initializeVectorSearch(): Promise<VectorSearchService> {
  if (vectorSearchService) {
    return vectorSearchService;
  }

  vectorSearchService = new VectorSearchService();

  // Check if Qdrant is available
  const exists = await vectorSearchService.collectionExists();
  if (!exists) {
    console.warn(`[VectorSearch] Collection "${env.qdrantCollection}" does not exist. Run ingest script first.`);
  } else {
    const info = await vectorSearchService.getCollectionInfo();
    console.log(`[VectorSearch] Collection info:`, info);
  }

  return vectorSearchService;
}

export function getVectorSearchService(): VectorSearchService {
  if (!vectorSearchService) {
    throw new Error("Vector search service not initialized. Call initializeVectorSearch() first.");
  }
  return vectorSearchService;
}
