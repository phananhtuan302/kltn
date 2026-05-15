/**
 * Ollama Service - Local LLM Integration
 * Tương tự llm_factory.py từ RAG_LANGCHAIN
 * Chạy qua HTTP API
 */

import { env } from "../config/env.js";

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface OllamaListResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
  }>;
}

export class OllamaService {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = "http://localhost:11434", model: string = "qwen2.5:7b") {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * Generate text using Ollama
   */
  async generate(prompt: string, options?: { temperature?: number; topK?: number; topP?: number }): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          temperature: options?.temperature ?? 0.2,
          top_k: options?.topK ?? 40,
          top_p: options?.topP ?? 0.9
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = (await response.json()) as OllamaResponse;
      return data.response.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Ollama] Generate failed: ${message}`);
      throw new Error(`Ollama generation failed: ${message}`);
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = (await response.json()) as OllamaListResponse;
      return data.models.map((m) => m.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Ollama] List models failed: ${message}`);
      return [];
    }
  }

  /**
   * Check if Ollama server is healthy
   */
  async healthCheck(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Pull a model from registry
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName, stream: false })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Ollama] Pull model failed: ${message}`);
      throw error;
    }
  }
}

/**
 * Initialize Ollama Service (Singleton)
 */
let ollamaService: OllamaService | null = null;

export async function initializeOllama(baseUrl?: string, model?: string): Promise<OllamaService> {
  if (ollamaService) {
    return ollamaService;
  }

  const url = baseUrl ?? env.ollamaBaseUrl ?? "http://localhost:11434";
  const modelName = model ?? env.ollamaModel ?? "qwen2.5:7b";

  ollamaService = new OllamaService(url, modelName);

  // Check if Ollama is running
  const isHealthy = await ollamaService.healthCheck();
  if (!isHealthy) {
    console.warn(`[Ollama] Server not responding at ${url}. Make sure Ollama is running.`);
  }

  console.log(`[Ollama] Initialized with model: ${modelName}`);
  return ollamaService;
}

export function getOllamaService(): OllamaService {
  if (!ollamaService) {
    throw new Error("Ollama service not initialized. Call initializeOllama() first.");
  }
  return ollamaService;
}
