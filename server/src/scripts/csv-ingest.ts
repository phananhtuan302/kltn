/**
 * CSV Ingest Script - Load CSV data into Qdrant
 * Run: npm run ingest
 * Tương tự ingestion.py từ RAG_LANGCHAIN
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from "url";

import { initializeEmbedding, getEmbeddingService } from "../services/embedding-service.js";
import type { LocationRecord } from "../types/domain.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CSVRow {
  danh_muc: string;
  tên: string;
  địa_chỉ: string;
  xếp_hạng?: string;
  số_bình_luận?: string;
  giá?: string;
  mô_tả?: string;
  tọa_độ_vĩ_độ?: string;
  tọa_độ_kinh_độ?: string;
}

interface LocationVector {
  id: number;
  vector: number[];
  payload: LocationRecord;
}

function mapCategory(danhMuc: string): { categoryCode: string; categoryName: string } {
  const normalized = danhMuc.trim().toLowerCase();

  if (normalized.includes("chợ")) return { categoryCode: "cho", categoryName: "Chợ" };
  if (normalized.includes("quán ăn") || normalized.includes("ăn uống")) return { categoryCode: "quan-an", categoryName: "Quán ăn" };
  if (normalized.includes("khách sạn")) return { categoryCode: "khach-san", categoryName: "Khách sạn" };
  if (normalized.includes("cà phê") || normalized.includes("coffee")) return { categoryCode: "coffee", categoryName: "Cà phê" };

  return {
    categoryCode: normalized.replace(/\s+/g, "-") || "dia-diem-khac",
    categoryName: danhMuc || "Địa điểm khác"
  };
}

function toNumber(value: string | undefined, fallback = 0): number {
  const parsed = Number(String(value ?? "").replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadCSV(filePath: string): Promise<CSVRow[]> {
  const csvPath = path.resolve(__dirname, "../../..", filePath);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  return records as CSVRow[];
}

async function createVectors(csvRows: CSVRow[]): Promise<LocationVector[]> {
  const embeddingService = getEmbeddingService();
  const vectors: LocationVector[] = [];

  console.log(`📊 Processing ${csvRows.length} locations...`);

  for (let i = 0; i < csvRows.length; i++) {
    const row = csvRows[i];

    if (!row.tên || !row.địa_chỉ) {
      console.warn(`⚠️  Skipping row ${i}: missing name or address`);
      continue;
    }

    // Create text content for embedding
    const textContent = `
      Name: ${row.tên}
      Category: ${row.danh_muc}
      Address: ${row.địa_chỉ}
      Description: ${row.mô_tả || ""}
      Rating: ${row.xếp_hạng || "N/A"}
    `.trim();

    try {
      const vector = await embeddingService.embedText(textContent);
      const mappedCategory = mapCategory(row.danh_muc);
      const locationId = i + 1;

      vectors.push({
        id: locationId,
        vector,
        payload: {
          id: locationId,
          name: row.tên,
          categoryCode: mappedCategory.categoryCode,
          categoryName: mappedCategory.categoryName,
          address: row.địa_chỉ,
          district: null,
          description: row.mô_tả || null,
          imageUrl: null,
          phone: null,
          website: null,
          rating: toNumber(row.xếp_hạng, 0),
          totalReviews: toNumber(row.số_bình_luận, 0),
          latitude: toNumber(row.tọa_độ_vĩ_độ, 0),
          longitude: toNumber(row.tọa_độ_kinh_độ, 0),
          featured: false,
          priceLabel: row.giá || null,
          avgPriceVnd: null,
          status: "active"
        }
      });

      if ((i + 1) % 50 === 0) {
        console.log(`✅ Processed ${i + 1}/${csvRows.length}`);
      }
    } catch (error) {
      console.error(`❌ Error embedding row ${i}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`✅ Created ${vectors.length} vectors`);
  return vectors;
}

async function uploadToQdrant(vectors: LocationVector[]): Promise<void> {
  const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
  const collectionName = process.env.QDRANT_COLLECTION || "travel_locations";
  const apiKey = process.env.QDRANT_API_KEY || undefined;

  if (vectors.length === 0) {
    throw new Error("No vectors were created from CSV data");
  }

  console.log(`\n🚀 Uploading to Qdrant (${qdrantUrl})...`);

  // Remove old collection first so stale point IDs do not remain in the index.
  const deleteResponse = await fetch(`${qdrantUrl}/collections/${collectionName}`, {
    method: "DELETE",
    headers: apiKey ? { "api-key": apiKey } : {}
  });

  if (deleteResponse.ok) {
    console.log(`🗑️  Existing collection "${collectionName}" removed`);
  }

  // 1. Create collection
  console.log(`📦 Creating collection "${collectionName}"...`);

  const collectionResponse = await fetch(`${qdrantUrl}/collections/${collectionName}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey && { "api-key": apiKey })
    },
    body: JSON.stringify({
      vectors: {
        size: vectors[0].vector.length,
        distance: "Cosine"
      }
    })
  });

  if (!collectionResponse.ok) {
    throw new Error(`Failed to create collection: ${collectionResponse.status}`);
  }

  console.log(`✅ Collection ready`);

  // 2. Upload points
  console.log(`📤 Uploading ${vectors.length} points...`);

  const uploadResponse = await fetch(`${qdrantUrl}/collections/${collectionName}/points`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey && { "api-key": apiKey })
    },
    body: JSON.stringify({
      points: vectors.map((v) => ({
        id: v.id,
        vector: v.vector,
        payload: v.payload
      }))
    })
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload points: ${uploadResponse.status}`);
  }

  console.log(`✅ Successfully uploaded ${vectors.length} locations to Qdrant`);
}

async function ingestData(csvPath: string = "cleaned_data_updated_2.csv"): Promise<void> {
  try {
    console.log("🔍 Loading CSV...");
    const csvRows = await loadCSV(csvPath);

    console.log("🧠 Initializing embedding service...");
    await initializeEmbedding();

    console.log("📈 Creating vectors...");
    const vectors = await createVectors(csvRows);

    console.log("☁️  Uploading to Qdrant...");
    await uploadToQdrant(vectors);

    console.log("\n✨ Ingestion complete!");
  } catch (error) {
    console.error("❌ Ingest failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
ingestData().catch(console.error);
