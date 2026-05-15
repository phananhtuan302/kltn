/**
 * Embedding Service - Convert text to vectors
 * Tương tự embeddings_factory.py từ RAG_LANGCHAIN
 * Sử dụng Ollama embeddings API qua Docker
 */

import { env } from "../config/env.js";

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

export class EmbeddingService {
  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor(baseUrl?: string, modelName?: string) {
    this.baseUrl = baseUrl || env.ollamaBaseUrl;
    this.modelName = modelName || env.ollamaEmbeddingModel;
  }

  /**
   * Embed single text
   */
  async embedText(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          model: this.modelName,
          prompt: text
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings API failed: ${response.status}`);
      }

      const result = (await response.json()) as { embedding?: number[] };
      if (!result.embedding || result.embedding.length === 0) {
        throw new Error("Ollama returned an empty embedding");
      }

      return result.embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Embedding] Error: ${message}`);
      throw new Error(`Failed to embed text: ${message}`);
    }
  }

  /**
   * Embed multiple texts - Returns just the vectors
   */
  async embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      try {
        const embedding = await this.embedText(text);
        results.push({ text, embedding });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Embedding] Failed to embed text: ${message}`);
        throw error;
      }
    }

    return results;
  }

  /**
   * Embed multiple texts - Returns just the vectors (for simpler usage)
   */
  async embedTextsVectors(texts: string[]): Promise<number[][]> {
    const results = await this.embedTexts(texts);
    return results.map((r) => r.embedding);
  }
}

/**
 * Initialize Embedding Service (Singleton)
 */
let embeddingService: EmbeddingService | null = null;

export async function initializeEmbedding(): Promise<EmbeddingService> {
  if (embeddingService) {
    return embeddingService;
  }

  embeddingService = new EmbeddingService();

  console.log(`[Embedding] Service initialized with Ollama model: ${env.ollamaEmbeddingModel}`);
  return embeddingService;
}

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    throw new Error("Embedding service not initialized. Call initializeEmbedding() first.");
  }
  return embeddingService;
}
