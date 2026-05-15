/**
 * Semantic Router - Classify query intent using embeddings + keywords
 * Similar to RAG_LANGCHAIN's semantic_router.py
 */

import type { LocationRecord } from "../types/domain.js";
import { getEmbeddingService } from "./embedding-service.js";
import { getVectorSearchService } from "./vector-search.js";

export type QueryIntent = "restaurant" | "hotel" | "attraction" | "budget_query" | "chitchat" | "travel_planning";

export interface RouteDecision {
  intent: QueryIntent;
  confidence: number;
  reason: "keyword_match" | "embedding_similarity" | "default";
}

export class SemanticRouter {
  private readonly keywordMap: Record<QueryIntent, string[]> = {
    restaurant: [
      "quán ăn", "quan an", "ăn gì", "an gi", "cơm", "com", "bún", "bun",
      "phở", "pho", "món chay", "mon chay", "ăn chay", "an chay", "chay",
      "đồ ăn", "do an", "ăn uống", "an uong", "nhà hàng", "nha hang", "cafe", "quán cà phê"
    ],
    hotel: [
      "khách sạn", "khach san", "hotel", "nhà nghỉ", "nha nghi", "resort",
      "homestay", "phòng", "phong", "ở lại", "o lai", "chỗ ở", "cho o", "ngủ"
    ],
    attraction: [
      "địa điểm", "dia diem", "du lịch", "du lich", "tham quan", "tour",
      "công viên", "cong vien", "bảo tàng", "bao tang", "nhà thờ", "nha tho",
      "biển", "bien", "núi", "nui", "thác", "thac", "chợ", "cho", "chứng tích"
    ],
    budget_query: [
      "dưới", "duoi", "hơn", "hon", "trên", "tren", "<", ">", "≤", "≥",
      "khoảng", "khoang", "tối đa", "toi da", "tối thiểu", "toi thieu"
    ],
    travel_planning: [
      "lịch trình", "lich trinh", "kế hoạch", "ke hoach", "itinerary",
      "ngày 1", "ngay 1", "ngày 2", "ngay 2", "suốt", "suot", "theo tuần", "theo tuan"
    ],
    chitchat: [
      "chào", "chao", "hi", "hello", "hey", "xin chào", "xin chao",
      "cảm ơn", "cam on", "vâng", "vang", "được", "duoc", "không", "khong"
    ]
  };

  private intentPrototypes: Record<QueryIntent, string[]> = {
    restaurant: [
      "quán ăn ngon ở Hà Nội",
      "nơi nào ăn phở ngon nhất",
      "tôi đang đói, gợi ý chỗ ăn"
    ],
    hotel: [
      "khách sạn 4 sao gần trung tâm",
      "nơi nào để ở qua đêm",
      "tìm resort ở Nha Trang"
    ],
    attraction: [
      "địa điểm du lịch nổi tiếng",
      "nhà thờ lớn Sài Gòn ở đâu",
      "công viên lớn nhất thành phố"
    ],
    budget_query: [
      "quán ăn dưới 50k",
      "khách sạn tối đa 1 triệu",
      "hôm nay có chỗ giá rẻ không"
    ],
    travel_planning: [
      "lên lịch trình 3 ngày ở Đà Nẵng",
      "chuỗi hoạt động suốt ngày để thú vị",
      "kế hoạch du lịch cuối tuần"
    ],
    chitchat: [
      "xin chào, bạn khỏe không",
      "cảm ơn bạn rất nhiều",
      "tôi rất vui khi gặp bạn"
    ]
  };

  private intentVectors: Record<QueryIntent, number[][]> = {} as Record<QueryIntent, number[][]>;

  async initialize(): Promise<void> {
    const embeddingService = getEmbeddingService();

    for (const [intent, prototypes] of Object.entries(this.intentPrototypes)) {
      try {
        const vectors = await embeddingService.embedTextsVectors(prototypes);
        this.intentVectors[intent as QueryIntent] = vectors;
      } catch (error) {
        console.error(`[SemanticRouter] Failed to initialize vectors for intent ${intent}:`, error);
        throw error;
      }
    }

    console.log("[SemanticRouter] Successfully initialized with", Object.keys(this.intentVectors).length, "intents");
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const numerator = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return normA === 0 || normB === 0 ? 0 : numerator / (normA * normB);
  }

  private getMaxSimilarity(queryVector: number[], intentVectors: number[][]): number {
    return Math.max(...intentVectors.map((vec) => this.cosineSimilarity(queryVector, vec)));
  }

  async classify(query: string): Promise<RouteDecision> {
    const lowerQuery = query.toLowerCase().trim();

    // 1. Try keyword matching first
    for (const [intent, keywords] of Object.entries(this.keywordMap)) {
      if (keywords.some((kw) => lowerQuery.includes(kw))) {
        return {
          intent: intent as QueryIntent,
          confidence: 0.95,
          reason: "keyword_match"
        };
      }
    }

    // 2. Try embedding similarity
    try {
      const embeddingService = getEmbeddingService();
      const queryVector = await embeddingService.embedText(query);

      let bestIntent: QueryIntent = "chitchat";
      let bestScore = 0;

      for (const [intent, vectors] of Object.entries(this.intentVectors)) {
        const score = this.getMaxSimilarity(queryVector, vectors);
        if (score > bestScore) {
          bestScore = score;
          bestIntent = intent as QueryIntent;
        }
      }

      return {
        intent: bestIntent,
        confidence: Math.max(bestScore, 0.5),
        reason: "embedding_similarity"
      };
    } catch (error) {
      console.warn("[SemanticRouter] Embedding failed, falling back to default:", error);
      return {
        intent: "chitchat",
        confidence: 0.3,
        reason: "default"
      };
    }
  }
}

let routerInstance: SemanticRouter | null = null;

export async function initializeRouter(): Promise<SemanticRouter> {
  if (routerInstance) return routerInstance;

  routerInstance = new SemanticRouter();
  await routerInstance.initialize();
  return routerInstance;
}

export function getSemanticRouter(): SemanticRouter {
  if (!routerInstance) {
    throw new Error("Semantic router not initialized. Call initializeRouter() first.");
  }
  return routerInstance;
}
