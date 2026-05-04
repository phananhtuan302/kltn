import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(
    import.meta.url));
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://phananhtuan302_db_user:123z456z@dbtourist.vfkdtpu.mongodb.net/?appName=DBtourist";
const DB_NAME = "DBWebsite";
const COLLECTION_NAME = "diadiem";

function parseLocationFromCsv(row, index) {
    const categoryName = row.danh_muc || '';
    const categoryCode = categoryName.toLowerCase().replace(/\s+/g, '-') || 'unknown';

    return {
        id: index + 1,
        name: row.tên || '',
        categoryCode: categoryCode,
        categoryName: categoryName,
        address: row.địa_chỉ || '',
        district: extractDistrict(row.địa_chỉ),
        description: row.mô_tả || '',
        imageUrl: row.photos_link || row.serpapi_thumbnail || '',
        phone: row.điện_thoại || '',
        website: row.trang_web || '',
        rating: parseFloat(row.xếp_hạng) || 0,
        totalReviews: parseInt(row.số_bình_luận) || 0,
        latitude: parseFloat(row.tọa_độ_vĩ_độ),
        longitude: parseFloat(row.tọa_độ_kinh_độ),
        featured: row.unclaimed_listing === 'True' ? false : true,
        priceLabel: row.giá_trích_xuất || '',
        avgPriceVnd: parseFloat(row.giá) || 0,
        status: 'active'
    };
}

function extractDistrict(address) {
    if (!address) return '';
    const matches = address.match(/Quận\s+(\d+|[Á-ỹ]+)|Huyện\s+([Á-ỹ\s]+)|Thị xã\s+([Á-ỹ\s]+)/i);
    if (matches) {
        return matches[1] || matches[2] || matches[3] || '';
    }
    return '';
}

async function importLocations() {
    try {
        console.log("🔗 Connecting to MongoDB...");
        const conn = await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            dbName: DB_NAME
        });

        const db = conn.connection.db;
        console.log(`✓ Connected to database: ${DB_NAME}`);

        // Read CSV data
        console.log("📖 Reading cleaned_data_updated_2.csv...");
        const dataPath = path.join(__dirname, "../cleaned_data_updated_2.csv");
        const csvData = await fs.readFile(dataPath, "utf-8");
        const records = parse(csvData, {
            columns: true,
            skip_empty_lines: true
        });

        const locations = records.map((row, index) => parseLocationFromCsv(row, index));
        console.log(`✓ Found ${locations.length} locations to import from CSV`);

        // Drop existing collection
        const collection = db.collection(COLLECTION_NAME);
        try {
            await collection.drop();
            console.log(`✓ Dropped existing collection: ${COLLECTION_NAME}`);
        } catch (err) {
            if (err.code !== 26) {
                // 26 = namespace does not exist
                throw err;
            }
            console.log(`✓ Collection ${COLLECTION_NAME} does not exist, creating new one`);
        }

        // Insert locations
        const result = await collection.insertMany(locations);
        console.log(`✓ Successfully imported ${result.insertedCount} locations!`);

        // Create indexes
        await collection.createIndex({ id: 1 });
        await collection.createIndex({ categoryCode: 1 });
        await collection.createIndex({ featured: 1 });
        await collection.createIndex({ rating: -1 });
        await collection.createIndex({ name: "text", address: "text" });
        console.log(`✓ Created database indexes`);

        // Show summary
        const count = await collection.countDocuments();
        console.log(`\n📊 Summary:`);
        console.log(`   Database: ${DB_NAME}`);
        console.log(`   Collection: ${COLLECTION_NAME}`);
        console.log(`   Total documents: ${count}`);

        await mongoose.disconnect();
        console.log("\n✅ Import completed successfully!");
    } catch (error) {
        console.error("❌ Import failed:", error.message);
        process.exit(1);
    }
}

importLocations();