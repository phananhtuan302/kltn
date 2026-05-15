import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://phananhtuan302_db_user:123z456z@dbtourist.vfkdtpu.mongodb.net/?appName=DBtourist";
const DB_NAME = "DBWebsite";

// Define itinerary templates with time slots
const itineraryTemplates = [{
        name: "Sáng nhàn nhã - Cà phê & Tham quan",
        description: "Bắt đầu ngày mới với cà phê sáng yên tĩnh, sau đó tham quan các địa điểm nổi tiếng",
        slots: [
            { time: "7:00 - 8:30", type: "coffee", description: "Uống cà phê sáng" },
            { time: "9:00 - 11:30", type: "location", description: "Tham quan địa điểm" },
            { time: "12:00 - 13:30", type: "restaurant", description: "Ăn trưa" },
            { time: "14:00 - 16:30", type: "park", description: "Thư giãn công viên" }
        ]
    },
    {
        name: "Chợ truyền thống & Ẩm thực Gò Vấp",
        description: "Khám phá những chợ truyền thống và thưởng thức ẩm thực đặc sắc địa phương",
        slots: [
            { time: "6:00 - 7:30", type: "market", description: "Ghé chợ sáng" },
            { time: "8:00 - 9:30", type: "coffee", description: "Ăn sáng & cà phê" },
            { time: "11:00 - 13:00", type: "restaurant", description: "Ăn cơm tấm" },
            { time: "14:00 - 16:00", type: "location", description: "Tham quan thêm" }
        ]
    },
    {
        name: "Ngày của gia đình - Công viên & Ăn chơi",
        description: "Dành ngày để thư giãn cùng gia đình tại công viên và các quán ăn vui nhộn",
        slots: [
            { time: "8:00 - 9:30", type: "coffee", description: "Ăn sáng nhẹ" },
            { time: "10:00 - 13:00", type: "park", description: "Chơi ở công viên" },
            { time: "13:00 - 14:30", type: "restaurant", description: "Ăn trưa gia đình" },
            { time: "15:00 - 18:00", type: "location", description: "Tham quan thêm" }
        ]
    },
    {
        name: "Mua sắm toàn ngày - Từ chợ đến siêu thị",
        description: "Hành trình mua sắm hoàn chỉnh từ chợ truyền thống đến siêu thị hiện đại",
        slots: [
            { time: "7:00 - 8:30", type: "coffee", description: "Cà phê sáng" },
            { time: "9:00 - 11:00", type: "market", description: "Mua sắm chợ" },
            { time: "12:00 - 13:30", type: "restaurant", description: "Ăn trưa" },
            { time: "14:00 - 17:00", type: "market", description: "Siêu thị & cửa hàng" }
        ]
    },
    {
        name: "Hành trình tâm linh - Chùa, nhà thờ & Ăn uống",
        description: "Tìm sự yên bình tại các điểm tâm linh và thưởng thức ẩm thực êm đềm",
        slots: [
            { time: "7:00 - 8:30", type: "coffee", description: "Cà phê kì tám" },
            { time: "9:00 - 12:00", type: "temple", description: "Thăm chùa/nhà thờ" },
            { time: "12:30 - 14:00", type: "restaurant", description: "Ăn cơm chay" },
            { time: "14:30 - 17:00", type: "temple", description: "Thủy tinh lâu" }
        ]
    },
    {
        name: "Cuối tuần lãng mạn - Cà phê yên tĩnh & Ăn tối",
        description: "Lãng mạn buổi chiều với cà phê, rồi ăn tối sang trọng",
        slots: [
            { time: "8:00 - 9:30", type: "coffee", description: "Ăn sáng nhẹ" },
            { time: "10:00 - 13:00", type: "location", description: "Tham quan" },
            { time: "14:00 - 16:30", type: "coffee", description: "Cà phê buổi chiều" },
            { time: "18:00 - 20:00", type: "restaurant", description: "Ăn tối lãng mạn" }
        ]
    },
    {
        name: "Ngày khám phá - Đi bộ & Ăn vặt",
        description: "Đi bộ khám phá, thưởng thức các mô on quán ăn vặt quen thuộc",
        slots: [
            { time: "7:00 - 8:30", type: "coffee", description: "Cà phê sáng" },
            { time: "9:00 - 12:00", type: "location", description: "Khám phá khu vực" },
            { time: "12:00 - 13:30", type: "restaurant", description: "Ăn cơm trưa" },
            { time: "14:00 - 18:00", type: "location", description: "Tiếp tục khám phá" }
        ]
    },
    {
        name: "Sáng sớm phiêu lưu - Chợ & Cơm tấm",
        description: "Sáng sớm thức dậy, ghé chợ, ăn cơm tấm này là cần thiết",
        slots: [
            { time: "5:30 - 7:00", type: "market", description: "Chợ sáng sớm" },
            { time: "7:00 - 8:30", type: "restaurant", description: "Cơm tấm sáng" },
            { time: "9:00 - 12:00", type: "location", description: "Tham quan" },
            { time: "13:00 - 17:00", type: "park", description: "Nghỉ ngơi công viên" }
        ]
    },
    {
        name: "Quán café & Bạn bè - Cuối tuần vui tươi",
        description: "Tụ tập bạn bè uống cà phê, ăn chơi thoải mái",
        slots: [
            { time: "10:00 - 12:30", type: "coffee", description: "Cà phê sáng muộn" },
            { time: "13:00 - 14:30", type: "restaurant", description: "Ăn trưa" },
            { time: "15:00 - 17:30", type: "location", description: "Tham quan vui nhộn" },
            { time: "18:30 - 20:00", type: "restaurant", description: "Ăn tối giải trí" }
        ]
    },
    {
        name: "Ngày giãn dân - Chối ngủ & Ăn từ tốn",
        description: "Thức dậy muộn, ăn từ từ, thư giãn từng giây phút",
        slots: [
            { time: "9:00 - 10:30", type: "coffee", description: "Ăn sáng muộn" },
            { time: "11:00 - 13:00", type: "park", description: "Công viên thơm phờ" },
            { time: "13:30 - 15:00", type: "restaurant", description: "Ăn cơm chiều" },
            { time: "15:30 - 18:00", type: "coffee", description: "Cà phê & tản bộ" }
        ]
    },
    {
        name: "Du khách mới - Khám phá toàn Gò Vấp",
        description: "Lộ trình dành cho du khách mới muốn khám phá tất cả những gì Gò Vấp có",
        slots: [
            { time: "7:00 - 8:30", type: "coffee", description: "Khởi động ngày mới" },
            { time: "9:00 - 11:30", type: "location", description: "Tham quan khu 1" },
            { time: "12:00 - 13:30", type: "restaurant", description: "Lunch đặc sắc" },
            { time: "14:00 - 17:30", type: "location", description: "Tham quan khu 2" }
        ]
    },
    {
        name: "Thể dục & Ăn lành mạnh",
        description: "Vận động buổi sáng tại công viên, ăn uống lành mạnh",
        slots: [
            { time: "6:00 - 8:00", type: "park", description: "Tập thể dục công viên" },
            { time: "8:30 - 10:00", type: "restaurant", description: "Ăn sáng lành mạnh" },
            { time: "11:00 - 13:30", type: "location", description: "Tham quan nhẹ nhàng" },
            { time: "14:00 - 17:00", type: "park", description: "Thư giãn thêm" }
        ]
    },
    {
        name: "Ăn đồ ăn vặt - Vòng vòng quanh khu",
        description: "Khám phá đủ loại đồ ăn vặt ngon nhất khu Gò Vấp",
        slots: [
            { time: "9:00 - 10:30", type: "coffee", description: "Cà phê & ăn vặt sáng" },
            { time: "11:00 - 13:00", type: "restaurant", description: "Ăn cơm trưa" },
            { time: "14:00 - 16:00", type: "market", description: "Mua ăn vặt" },
            { time: "17:00 - 19:00", type: "restaurant", description: "Ăn tối ăn vặt" }
        ]
    },
    {
        name: "Thủ công mỹ nghệ & Ăn uống",
        description: "Khám phá những cửa hàng bán thủ công mỹ nghệ độc đáo",
        slots: [
            { time: "8:00 - 9:30", type: "coffee", description: "Cà phê sáng" },
            { time: "10:00 - 12:30", type: "location", description: "Mua thủ công mỹ nghệ" },
            { time: "13:00 - 14:30", type: "restaurant", description: "Ăn trưa" },
            { time: "15:00 - 17:30", type: "location", description: "Tiếp tục khám phá" }
        ]
    }
];

const sampleUserNames = [
    "Nguyễn Văn A",
    "Trần Thị B",
    "Lê Minh C",
    "Phạm Gia D",
    "Hoàng Yến E"
];

async function seedItineraries() {
    try {
        console.log("🔗 Connecting to MongoDB...");
        const conn = await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            dbName: DB_NAME
        });

        const db = conn.connection.db;
        console.log(`✓ Connected to database: ${DB_NAME}`);

        // Get all locations
        console.log("📍 Loading diadiem collection...");
        const diaDiemCollection = db.collection("diadiem");
        const allLocations = await diaDiemCollection.find({}).toArray();
        console.log(`✓ Found ${allLocations.length} locations`);

        // Group locations by category
        const locationsByCategory = {};
        allLocations.forEach((loc) => {
            const cat = loc.categoryCode || "other";
            if (!locationsByCategory[cat]) {
                locationsByCategory[cat] = [];
            }
            locationsByCategory[cat].push(loc);
        });

        console.log(`✓ Categories found: ${Object.keys(locationsByCategory).join(", ")}`);

        // Map slot types to category codes
        const typeToCategory = {
            coffee: ["coffee", "cafe"],
            restaurant: ["quan-an", "restaurant"],
            market: ["cho", "market"],
            park: ["cong-vien", "park"],
            location: ["du-lich", "diem-du-lich"],
            temple: ["chua", "nha-tho"]
        };

        // Helper to get location from type
        const getLocationByType = (type) => {
            const categories = typeToCategory[type] || [];
            for (const cat of categories) {
                if (locationsByCategory[cat] && locationsByCategory[cat].length > 0) {
                    return locationsByCategory[cat][Math.floor(Math.random() * locationsByCategory[cat].length)];
                }
            }
            // Fallback: get random location
            const allCats = Object.keys(locationsByCategory);
            const randomCat = allCats[Math.floor(Math.random() * allCats.length)];
            return locationsByCategory[randomCat][Math.floor(Math.random() * locationsByCategory[randomCat].length)];
        };

        // Generate itineraries
        console.log("\n📋 Generating itineraries from templates...");
        const itineraries = [];

        itineraryTemplates.forEach((template, idx) => {
            const items = [];

            // Create items from slots
            template.slots.forEach((slot, slotIdx) => {
                const loc = getLocationByType(slot.type);
                if (loc) {
                    items.push({
                        ...loc,
                        order: slotIdx + 1,
                        time: slot.time,
                        timeSlotDescription: slot.description,
                        estimatedTime: slot.time
                    });
                }
            });

            if (items.length > 0) {
                itineraries.push({
                    itinerary_id: idx + 1,
                    title: template.name,
                    description: template.description,
                    tenNguoiDung: sampleUserNames[idx % sampleUserNames.length],
                    items: items,
                    totalDuration: `${items.length * 1.5} giờ`,
                    difficulty: ["Dễ", "Trung bình", "Khó"][Math.floor(Math.random() * 3)],
                    bestFor: ["Cặp đôi", "Gia đình", "Bạn bè", "Một mình"][Math.floor(Math.random() * 4)],
                    createdAt: new Date(),
                    featured: Math.random() > 0.5,
                    rating: (Math.random() * 2 + 3).toFixed(1)
                });
            }
        });

        // Drop existing collection
        const lichSuyCollection = db.collection("lichsuyeuthich");
        try {
            await lichSuyCollection.drop();
            console.log("✓ Dropped existing lichsuyeuthich collection");
        } catch (err) {
            if (err.code !== 26) {
                throw err;
            }
        }

        // Insert itineraries
        if (itineraries.length > 0) {
            const result = await lichSuyCollection.insertMany(itineraries);
            console.log(`✓ Inserted ${result.insertedCount} itineraries`);

            // Create indexes
            await lichSuyCollection.createIndex({ itinerary_id: 1 });
            await lichSuyCollection.createIndex({ featured: 1 });
            console.log("✓ Created indexes");

            // Show summary
            console.log(`\n📊 Generated Itineraries Summary:`);
            console.log("═".repeat(70));
            itineraries.forEach((it, idx) => {
                console.log(`${idx + 1}. ${it.title}`);
                console.log(`   📍 ${it.items.length} điểm dừng | ⭐ ${it.rating}/5 | Độ khó: ${it.difficulty}`);
                console.log(`   Phù hợp cho: ${it.bestFor}`);
                it.items.forEach((item, i) => {
                    console.log(`   ${i + 1}. [${item.time}] ${item.name} - ${item.description}`);
                });
                console.log();
            });
            console.log("═".repeat(70));
        }

        await mongoose.disconnect();
        console.log("\n✅ Seed completed successfully!");
    } catch (error) {
        console.error("❌ Seed failed:", error.message);
        process.exit(1);
    }
}

seedItineraries();