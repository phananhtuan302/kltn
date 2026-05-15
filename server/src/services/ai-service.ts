import { env } from "../config/env.js";
import type { ChatMessageInput, LocationRecord } from "../types/domain.js";
import { getVectorSearchService } from "./vector-search.js";
import { locationService } from "./location-service.js";
import { getOllamaService } from "./ollama-service.js";
import { getSemanticRouter } from "./semantic-router.js";
import { getReflectionService } from "./reflection-service.js";
import { GREETING_RESPONSES, RAG_PROMPT_TEMPLATE, REFLECTION_PROMPT_TEMPLATE, getSystemPrompt } from "./system-prompts.js";

import { GoogleGenAI } from "@google/genai";
import fs from "fs";

export class AiService {
  private readonly geminiClient = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;
  private sessionHistories: Map<string, ChatMessageInput[]> = new Map();
  private readonly maxHistoryLength = 20;

  async reply(
    messages: ChatMessageInput[],
    context?: { preferredHotel?: LocationRecord | null }
  ): Promise<{ reply: string; suggestions: LocationRecord[] }> {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
    const preferredArea = context?.preferredHotel ? locationService.extractArea(context.preferredHotel.address) : null;

    let rewrittenQuery = lastUserMessage;

    // 1. Try semantic router to classify intent
    try {
      const router = getSemanticRouter();
      const routeDecision = await router.classify(lastUserMessage);
      
      console.log(`[AI] Query classified as: ${routeDecision.intent} (confidence: ${routeDecision.confidence.toFixed(2)}, reason: ${routeDecision.reason})`);

      // 2. Handle greeting intents without any RAG
      if (routeDecision.intent === "chitchat" && routeDecision.confidence > 0.8) {
        const greeting = GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)];
        return { reply: greeting, suggestions: [] };
      }

      // 3. Apply reflection service to rewrite query from history
      const reflectionService = getReflectionService();
      rewrittenQuery = await reflectionService.rewriteQuery(
        messages.filter((m) => m.role === "user" || m.role === "assistant"),
        lastUserMessage
      );
      
      if (rewrittenQuery !== lastUserMessage) {
        console.log(`[AI] Query rewritten: "${lastUserMessage}" -> "${rewrittenQuery}"`);
      }

      // 4. Handle budget queries with special logic
      const budgetIntent = this.parseBudgetCategoryIntent(rewrittenQuery);
      if (budgetIntent) {
        return await this.handleBudgetQuery(budgetIntent, preferredArea);
      }
    } catch (error) {
      console.warn("[AI] Semantic routing failed, proceeding with fallback:", error instanceof Error ? error.message : error);
    }

    // 5. Get suggestions using vector search + fallback
    const suggestions = await this.findHybridSuggestions(rewrittenQuery, preferredArea);

    // 6. Generate response using LLM with RAG context
    try {
      if (this.geminiClient) {
        return await this.replyWithGemini(messages, suggestions, rewrittenQuery);
      }

      return {
        reply: this.buildFallbackReply(rewrittenQuery, suggestions),
        suggestions: suggestions.slice(0, 5)  // Return top 5 for UI
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI provider error";
      console.error(`[AI] Provider ${env.aiProvider} failed: ${message}`);
      try {
        fs.appendFileSync("ai-error.log", `${new Date().toISOString()} - ${message}\n${error instanceof Error ? (error.stack || "") : String(error)}\n\n`);
      } catch (e) {
        console.warn("[AI] Failed to write ai-error.log", e);
      }

      return {
        reply: this.buildFallbackReply(rewrittenQuery, suggestions),
        suggestions: suggestions.slice(0, 5)  // Return top 5 for UI
      };
    }
  }

  private async handleBudgetQuery(
    budgetIntent: { categoryCode: string; categoryLabel: string; maxPriceVnd: number },
    preferredArea?: { ward: string | null; district: string | null } | null
  ): Promise<{ reply: string; suggestions: LocationRecord[] }> {
    const picks = await locationService.findTopLocationsUnderBudget(
      budgetIntent.categoryCode,
      budgetIntent.maxPriceVnd,
      10,  // Request 10 for context, but display only 5
      preferredArea
    );

    if (picks.length > 0) {
      const displayLimit = 5;
      const reply = this.buildBudgetCategoryReply(budgetIntent.categoryLabel, budgetIntent.maxPriceVnd, picks);
      return {
        reply,
        suggestions: picks.slice(0, displayLimit)  // Return only top 5 for UI
      };
    }

    return {
      reply: `Hiện tôi không tìm thấy ${budgetIntent.categoryLabel.toLowerCase()} nào có giá trung bình dưới ${budgetIntent.maxPriceVnd.toLocaleString("vi-VN")} VND trong dữ liệu của tôi. Bạn có thể tăng ngân sách hoặc thử tìm kiếm địa điểm khác không?`,
      suggestions: []
    };
  }

  private parseBudgetCategoryIntent(prompt: string): { categoryCode: string; categoryLabel: string; maxPriceVnd: number } | null {
    const lowered = prompt.toLowerCase();
    const wantsRestaurant = /(quan\s*an|nha\s*hang|an\s*uong)/i.test(lowered);
    const wantsHotel = /(khach\s*san|hotel|nha\s*nghi)/i.test(lowered);
    const wantsUnder = /(duoi|<|toi\s*da|khong\s*qua)/i.test(lowered);

    if ((!wantsRestaurant && !wantsHotel) || !wantsUnder) {
      return null;
    }

    const amountMatch = lowered.match(/(\d+(?:[\.,]\d+)?)\s*(k|nghin|ngan|nghin|tr|trieu)?/i);
    if (!amountMatch) {
      return null;
    }

    const rawAmount = Number(amountMatch[1].replace(/,/g, "."));
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return null;
    }

    const unit = (amountMatch[2] ?? "").toLowerCase();
    let maxPriceVnd = rawAmount;

    if (unit === "k" || unit === "nghin" || unit === "ngan") {
      maxPriceVnd = rawAmount * 1000;
    } else if (unit === "tr" || unit === "trieu") {
      maxPriceVnd = rawAmount * 1_000_000;
    } else if (maxPriceVnd < 1000) {
      maxPriceVnd = rawAmount * 1000;
    }

    if (wantsHotel) {
      return {
        categoryCode: "khach-san",
        categoryLabel: "khách sạn",
        maxPriceVnd: Math.round(maxPriceVnd)
      };
    }

    return {
      categoryCode: "quan-an",
      categoryLabel: "quán ăn",
      maxPriceVnd: Math.round(maxPriceVnd)
    };
  }

  private buildBudgetCategoryReply(categoryLabel: string, maxPriceVnd: number, picks: LocationRecord[]): string {
    const top = picks
      .map((item, index) => {
        const avgPrice = typeof item.avgPriceVnd === "number" ? `${item.avgPriceVnd.toLocaleString("vi-VN")} VND` : "Chưa rõ";
        return `${index + 1}. ${item.name} - ${item.address}\n   Giá TB: ${avgPrice} | Rating: ${item.rating.toFixed(1)} (${item.totalReviews} đánh giá)`;
      })
      .join("\n");

    return `Top ${picks.length} ${categoryLabel} dưới ${maxPriceVnd.toLocaleString("vi-VN")} VND:\n${top}`;
  }

  private async replyWithGemini(
    messages: ChatMessageInput[],
    suggestions: LocationRecord[],
    lastUserMessage: string
  ): Promise<{ reply: string; suggestions: LocationRecord[] }> {
    const maxAttempts = 3;
    let attempt = 0;
    const displayLimit = 5;  // Only show top 5 to user

    // Build RAG context from ALL suggestions (for LLM context)
    const contextStr = suggestions
      .map(
        (s) =>
          `- ${s.name} (${s.categoryName}): ${s.address}, Rating: ${s.rating}/5, Giá: ${s.priceLabel}`
      )
      .join("\n");

    const fullPrompt = RAG_PROMPT_TEMPLATE(contextStr, lastUserMessage);
    const systemPrompt = this.buildSystemPrompt();
    const conversationTranscript = this.buildConversationTranscript(messages);

    const combinedPrompt = `${systemPrompt}\n\n${conversationTranscript}\n\n${fullPrompt}`;

    while (attempt < maxAttempts) {
      try {
        const response = await this.geminiClient!.models.generateContent({
          model: env.geminiModel,
          contents: combinedPrompt
        });
        const reply = response.text?.trim() || this.buildFallbackReply(lastUserMessage, suggestions);
        return { 
          reply, 
          suggestions: suggestions.slice(0, displayLimit)  // Return only top 5 for UI
        };
      } catch (err: unknown) {
        attempt += 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[AI] Gemini attempt ${attempt} failed: ${errMsg}`);

        let waitMs = Math.pow(2, attempt) * 500;
        try {
          const maybe = err as any;
          if (maybe?.error?.details) {
            const retryInfo = maybe.error.details.find((d: any) => d["@type"]?.includes("RetryInfo"));
            if (retryInfo && retryInfo.retryDelay) {
              const m = /(?:(\d+)s)/.exec(retryInfo.retryDelay) || [];
              const sec = m[1] ? Number(m[1]) : null;
              if (sec) waitMs = sec * 1000;
            }
          }
        } catch (_) {}

        if (attempt >= maxAttempts) break;
        await new Promise((res) => setTimeout(res, waitMs + Math.floor(Math.random() * 200)));
      }
    }

    console.error("[AI] Gemini unavailable after retries, trying Ollama fallback...");
    try {
      return await this.replyWithOllama(messages, suggestions, lastUserMessage);
    } catch (ollamaErr) {
      const ollamaMsg = ollamaErr instanceof Error ? ollamaErr.message : String(ollamaErr);
      console.error(`[AI] Ollama fallback also failed: ${ollamaMsg}. Using template fallback.`);
      return {
        reply: this.buildFallbackReply(lastUserMessage, suggestions),
        suggestions: suggestions.slice(0, displayLimit)
      };
    }
  }

  private async replyWithOllama(
    messages: ChatMessageInput[],
    suggestions: LocationRecord[],
    lastUserMessage: string
  ): Promise<{ reply: string; suggestions: LocationRecord[] }> {
    try {
      const ollamaService = getOllamaService();
      const displayLimit = 5;  // Only show top 5 to user

      // Build RAG context from ALL suggestions (for LLM context)
      const contextStr = suggestions
        .map(
          (s) =>
            `- ${s.name} (${s.categoryName}): ${s.address}, Rating: ${s.rating}/5, Giá: ${s.priceLabel}`
        )
        .join("\n");

      const fullPrompt = RAG_PROMPT_TEMPLATE(contextStr, lastUserMessage);
      const systemPrompt = this.buildSystemPrompt();
      const conversationTranscript = this.buildConversationTranscript(messages);

      const combinedPrompt = `${systemPrompt}\n\n${conversationTranscript}\n\n${fullPrompt}`;

      const reply = await ollamaService.generate(combinedPrompt, { temperature: 0.7 });
      return {
        reply: reply.trim() || this.buildFallbackReply(lastUserMessage, suggestions),
        suggestions: suggestions.slice(0, displayLimit)  // Return only top 5 for UI
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Ollama error";
      console.error(`[AI] Ollama fallback generation failed: ${message}`);
      throw new Error(`Ollama generation failed: ${message}`);
    }
  }

  private async findHybridSuggestions(
    userPrompt: string,
    preferredArea?: { ward: string | null; district: string | null } | null
  ): Promise<LocationRecord[]> {
    const topK = 20;  // Retrieve more results for better context
    
    try {
      const vectorSearch = getVectorSearchService();
      const rankedResults = await vectorSearch.search(userPrompt, topK);
      // Combine vector score with simple heuristics (rating, category match) to avoid
      // returning only keyword-like matches. This improves result quality for users.
      const scored = rankedResults
        .map((r) => {
          const loc = r.location;
          const ratingBoost = (typeof loc.rating === "number" ? loc.rating / 5 : 0) * 0.2; // up to +0.2
          const combined = (typeof r.score === "number" ? r.score : 0) + ratingBoost;
          return { ...r, combined };
        })
        .sort((a, b) => b.combined - a.combined)
        .map((r) => r.location)
        .filter((location) => {
          if (!preferredArea) return true;
          const address = location.address.toLowerCase();
          const wardMatch = preferredArea.ward ? address.includes(preferredArea.ward.toLowerCase()) : true;
          const districtMatch = preferredArea.district ? address.includes(preferredArea.district.toLowerCase()) : true;
          return wardMatch || districtMatch;
        })
        .slice(0, topK);

      if (scored.length > 0) {
        console.log(`[AI] Vector search returned ${scored.length} results for context`);
        return scored;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[AI] Vector search unavailable, falling back to keyword search: ${message}`);
    }

    const fallbackSuggestions = await locationService.findRelevantLocations(userPrompt, preferredArea);
    console.log(`[AI] Keyword search returned ${fallbackSuggestions.length} results for context`);
    return fallbackSuggestions.slice(0, topK);
  }

  private buildSystemPrompt(intent?: string): string {
    // Use structured prompts based on intent classification
    const systemPrompt = intent ? getSystemPrompt(intent) : getSystemPrompt("chitchat");
    
    const rules = env.aiTrainRules
      .split("||")
      .map((item) => item.trim())
      .filter(Boolean);

    if (rules.length === 0) {
      return systemPrompt;
    }

    return `${systemPrompt}\n\nQuy tắc phản hồi ưu tiên:\n${rules
      .map((rule, index) => `${index + 1}. ${rule}`)
      .join("\n")}`;
  }

  private buildSuggestionPrompt(suggestions: LocationRecord[]): string {
    const suggestionsData = suggestions.map((item) => ({
      name: item.name,
      categoryName: item.categoryName,
      address: item.address,
      rating: item.rating,
      totalReviews: item.totalReviews,
      priceLabel: item.priceLabel
    }));

    return `DANH SACH DIA DIEM CO TRONG HE THONG (CHI GOI Y CAC DIA DIEM NAY):\n${JSON.stringify(suggestionsData, null, 2)}\n\nYEU CAU TRONG VAL: \n- CHI GOI Y va goi ten cac dia diem co trong danh sach tren\n- Neu khach hoi ve quán an, mon chay, com, bun, pho, do an, do uong thi CHI u tien cac dia diem an uong, khong tu y doi sang chua, nha tho, hay dia diem tam linh\n- Neu khach hoi ve dia diem khong co trong he thong, hay thong bao "Dia diem nay hien chua co trong co so du lieu cua toi"\n- Tat ca cac goi y phai LAY TU danh sach duoc cung cap`;
    return `DANH SACH DIA DIEM CO TRONG HE THONG (CHI GOI Y CAC DIA DIEM NAY):\n${JSON.stringify(suggestionsData, null, 2)}\n\nYEU CAU TRONG VAL: \n- CHI GOI Y va goi ten cac dia diem co trong danh sach tren\n- Neu khach hoi ve quán an, mon chay, com, bun, pho, do an, do uong thi CHI u tien cac dia diem an uong, khong tu y doi sang chua, nha tho, hay dia diem tam linh\n- Neu khach hoi ve dia diem khong co trong he thong, hay thong bao "Dia diem nay hien chua co trong co so du lieu cua toi"\n- Tat ca cac goi y phai LAY TU danh sach duoc cung cap\n\nPHONG CACH: Dung tieng Viet tu nhien, lich su, ngan gon. Khong trich dan JSON, khong them thong tin khong can thiet.`;
  }

  private buildConversationTranscript(messages: ChatMessageInput[]): string {
    return `Lịch sử hỏi đáp:\n${messages
      .map((message) => `${message.role === "user" ? "Người dùng" : "Trợ lý"}: ${message.content}`)
      .join("\n")}`;
  }

  private buildFallbackReply(prompt: string, suggestions: LocationRecord[]): string {
    const intro = prompt
      ? `Tôi đã phân tích yêu cầu của bạn: "${prompt}".`
      : "Tôi đã chuẩn bị một vài gợi ý bạn có thể tham khảo.";

    // Show top suggestions from the full context
    const displayLimit = Math.min(5, suggestions.length);
    const picks = suggestions
      .slice(0, displayLimit)
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} (${item.categoryName}) - ${item.address}. Điểm ${item.rating.toFixed(1)} với ${item.totalReviews} đánh giá.`
      )
      .join("\n");

    const hasMore = suggestions.length > displayLimit ? `\n\n(Còn ${suggestions.length - displayLimit} gợi ý khác có sẵn)` : "";

    return `${intro}\n\nGợi ý phù hợp hiện tại:\n${picks}${hasMore}\n\nNếu bạn muốn, tôi có thể tiếp tục lọc theo ngân sách, địa điểm có chỗ để xe, không gian gia đình, hay mục đích đi chơi cuối tuần.`;
  }
}

export const aiService = new AiService();
