/**
 * Reflection Service - Rewrite follow-up queries into standalone queries
 * Similar to RAG_LANGCHAIN's reflection.py
 */

import { getOllamaService } from "./ollama-service.js";
import { env } from "../config/env.js";
import { GoogleGenAI } from "@google/genai";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class ReflectionService {
  private readonly maxHistoryItems: number = 4;
  private readonly geminiClient = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

  private extractText(result: unknown): string {
    if (typeof result === "string") return result.trim();

    const content = (result as any)?.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item?.text === "string") return item.text;
          return String(item);
        })
        .join(" ")
        .trim();
    }

    return String(result).trim();
  }

  async rewriteQuery(history: ChatMessage[], currentQuery: string): Promise<string> {
    // If history is empty or too short, return original query
    if (!history || history.length === 0) {
      return currentQuery;
    }

    const recentHistory = history.slice(-this.maxHistoryItems);
    const historyText = recentHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n");

    const reflectionPrompt = `Bạn là một trợ lý thông minh. Hãy viết lại câu hỏi của người dùng thành một câu hỏi độc lập, rõ ràng.
Chỉ xuất ra câu hỏi đã viết lại, không giải thích thêm.

Cuộc trò chuyện gần đây:
${historyText}

Câu hỏi hiện tại của người dùng:
${currentQuery}

Câu hỏi đã viết lại:`;

    try {
      // Try Gemini first if available
      if (this.geminiClient) {
        try {
          const response = await this.geminiClient.models.generateContent({
            model: "gemini-2.0-flash",
            contents: reflectionPrompt
          });
          const rewritten = response.text?.trim() || "";
          if (rewritten) return rewritten;
        } catch (error) {
          console.warn("[Reflection] Gemini failed, trying Ollama:", error instanceof Error ? error.message : error);
        }
      }

      // Fallback to Ollama
      const ollamaService = getOllamaService();
      const ollamaResponse = await ollamaService.generate(reflectionPrompt);
      const rewritten = this.extractText(ollamaResponse);
      return rewritten || currentQuery;
    } catch (error) {
      console.warn(
        "[Reflection] Query rewriting failed:",
        error instanceof Error ? error.message : error
      );
      return currentQuery;
    }
  }
}

let reflectionInstance: ReflectionService | null = null;

export function getReflectionService(): ReflectionService {
  if (!reflectionInstance) {
    reflectionInstance = new ReflectionService();
  }
  return reflectionInstance;
}
