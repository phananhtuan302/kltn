import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

import { env } from "../config/env.js";
import type { ChatMessageInput, LocationRecord } from "../types/domain.js";
import { locationService } from "./location-service.js";

export class AiService {
  private readonly openAiClient = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;
  private readonly geminiClient = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

  async reply(
    messages: ChatMessageInput[],
    context?: { preferredHotel?: LocationRecord | null }
  ): Promise<{ reply: string; suggestions: LocationRecord[] }> {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
    const budgetIntent = this.parseBudgetCategoryIntent(lastUserMessage);
    const preferredArea = context?.preferredHotel ? locationService.extractArea(context.preferredHotel.address) : null;

    if (budgetIntent) {
      const picks = await locationService.findTopLocationsUnderBudget(
        budgetIntent.categoryCode,
        budgetIntent.maxPriceVnd,
        3,
        preferredArea
      );

      if (picks.length > 0) {
        return {
          reply: this.buildBudgetCategoryReply(budgetIntent.categoryLabel, budgetIntent.maxPriceVnd, picks),
          suggestions: picks
        };
      }

      return {
        reply: `Khong tim thay ${budgetIntent.categoryLabel.toLowerCase()} nao co gia trung binh duoi ${budgetIntent.maxPriceVnd.toLocaleString("vi-VN")} VND trong du lieu noi bo hien tai.`,
        suggestions: []
      };
    }

    const suggestions = await locationService.findRelevantLocations(lastUserMessage, preferredArea);

    try {
      if (env.aiProvider === "gemini" && env.geminiApiKey) {
        return await this.replyWithGemini(messages, suggestions, lastUserMessage);
      }

      if (this.openAiClient) {
        return await this.replyWithOpenAi(messages, suggestions, lastUserMessage);
      }

      return {
        reply: this.buildFallbackReply(lastUserMessage, suggestions),
        suggestions
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI provider error";
      console.error(`[AI] Provider ${env.aiProvider} failed: ${message}`);

      throw new Error("Khong the lay phan hoi tu AI luc nay. Vui long thu lai sau.");
    }
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
        const avgPrice = typeof item.avgPriceVnd === "number" ? `${item.avgPriceVnd.toLocaleString("vi-VN")} VND` : "Chua ro";
        return `${index + 1}. ${item.name} - ${item.address}\n   Gia TB: ${avgPrice} | Rating: ${item.rating.toFixed(1)} (${item.totalReviews} danh gia)`;
      })
      .join("\n");

    return `Top ${picks.length} ${categoryLabel} duoi ${maxPriceVnd.toLocaleString("vi-VN")} VND (xu ly tu du lieu noi bo cua web):\n${top}`;
  }

  private async replyWithOpenAi(
    messages: ChatMessageInput[],
    suggestions: LocationRecord[],
    lastUserMessage: string
  ): Promise<{ reply: string; suggestions: LocationRecord[] }> {
    const completion = await this.openAiClient!.responses.create({
      model: env.openAiModel,
      input: [
        {
          role: "system",
          content: this.buildSystemPrompt()
        },
        {
          role: "system",
          content: this.buildSuggestionPrompt(suggestions)
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      ]
    });

    const reply = completion.output_text?.trim() || this.buildFallbackReply(lastUserMessage, suggestions);

    return {
      reply,
      suggestions
    };
  }

  private async replyWithGemini(
    messages: ChatMessageInput[],
    suggestions: LocationRecord[],
    lastUserMessage: string
  ): Promise<{ reply: string; suggestions: LocationRecord[] }> {
    const response = await this.geminiClient!.models.generateContent({
      model: env.geminiModel,
      contents: `${this.buildSystemPrompt()}\n\n${this.buildSuggestionPrompt(suggestions)}\n\n${this.buildConversationTranscript(messages)}`
    });

    const reply = response.text?.trim() || this.buildFallbackReply(lastUserMessage, suggestions);

    return {
      reply,
      suggestions
    };
  }

  private buildSystemPrompt(): string {
    const rules = env.aiTrainRules
      .split("||")
      .map((item) => item.trim())
      .filter(Boolean);

    if (rules.length === 0) {
      return env.aiSystemPrompt;
    }

    return `${env.aiSystemPrompt}\n\nQuy tac phan hoi uu tien:\n${rules
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

    return `DANH SACH DIA DIEM CO TRONG HE THONG (CHI GOI Y CAC DIA DIEM NAY):\n${JSON.stringify(suggestionsData, null, 2)}\n\nYEU CAU TRONG VAL: \n- CHI GOI Y va goi ten cac dia diem co trong danh sach tren\n- Neu khach hoi ve dia diem khong co trong he thong, hay thong bao "Dia diem nay hien chua co trong co so du lieu cua toi"\n- Tat ca cac goi y phai LAY TU danh sach duoc cung cap`;
  }

  private buildConversationTranscript(messages: ChatMessageInput[]): string {
    return `Lich su hoi dap:\n${messages
      .map((message) => `${message.role === "user" ? "Nguoi dung" : "Tro ly"}: ${message.content}`)
      .join("\n")}`;
  }

  private buildFallbackReply(prompt: string, suggestions: LocationRecord[]): string {
    const intro = prompt
      ? `Toi da phan tich yeu cau cua ban: "${prompt}".`
      : "Toi da chuan bi mot vai goi y ban co the bat dau tham khao.";

    const picks = suggestions
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} (${item.categoryName}) - ${item.address}. Diem ${item.rating.toFixed(1)} voi ${item.totalReviews} danh gia.`
      )
      .join("\n");

    return `${intro}\n\nGoi y phu hop hien tai:\n${picks}\n\nNeu ban muon, toi co the tiep tuc loc theo ngan sach, dia diem co cho de xe, khong gian gia dinh, hay muc dich di choi cuoi tuan.`;
  }
}

export const aiService = new AiService();
