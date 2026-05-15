import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());
const sqlPath = path.resolve(projectRoot, "..", "import_all_go_vap_vi.sql");
const outputPath = path.resolve(projectRoot, "server", "src", "data", "mock-locations.json");

const categoryMap = {
    cho_go_vap_vi: { code: "cho", name: "Chợ" },
    chua_go_vap_vi: { code: "chua", name: "Chùa" },
    coffee_go_vap: { code: "coffee", name: "Cà phê" },
    coffee_go_vap_vi: { code: "coffee", name: "Cà phê" },
    congvien_go_vap_vi: { code: "cong-vien", name: "Công viên" },
    karaoke_go_vap_vi: { code: "karaoke", name: "Karaoke" },
    nhatho_go_vap_vi: { code: "nha-tho", name: "Nhà thờ" },
    quanan_go_vap_vi: { code: "quan-an", name: "Quán ăn" },
    thuexe_go_vap_vi: { code: "thue-xe", name: "Thuê xe" },
    hotels_go_vap: { code: "khach-san", name: "Khách sạn" },
    hotels_go_vap_vi: { code: "khach-san", name: "Khách sạn" }
};

const priceLabelByCategory = {
    cho: "Đa dạng",
    chua: null,
    coffee: "Phổ biến",
    "cong-vien": null,
    karaoke: "Tầm trung",
    "nha-tho": null,
    "quan-an": "Phổ biến",
    "thue-xe": "Tầm trung",
    "khach-san": "Tầm trung"
};

function splitTopLevel(input, separator) {
    const result = [];
    let current = "";
    let depthParen = 0;
    let inString = false;

    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        const next = input[i + 1];

        if (inString) {
            current += ch;
            if (ch === "'" && next === "'") {
                current += next;
                i += 1;
            } else if (ch === "'") {
                inString = false;
            }
            continue;
        }

        if (ch === "'") {
            inString = true;
            current += ch;
            continue;
        }

        if (ch === "(") depthParen += 1;
        if (ch === ")") depthParen -= 1;

        if (ch === separator && depthParen === 0) {
            result.push(current.trim());
            current = "";
            continue;
        }

        current += ch;
    }

    if (current.trim()) {
        result.push(current.trim());
    }

    return result;
}

function parseSqlLiteral(raw) {
    const v = raw.trim();
    if (!v || v.toUpperCase() === "NULL") {
        return null;
    }

    if (v.startsWith("N'") || v.startsWith("'")) {
        const firstQuote = v.indexOf("'");
        const body = v.slice(firstQuote + 1, -1);
        return body.replace(/''/g, "'");
    }

    const asNumber = Number(v);
    if (!Number.isNaN(asNumber)) {
        return asNumber;
    }

    return v;
}

function getRows(valuesBlock) {
    const rows = [];
    let current = "";
    let depth = 0;
    let inString = false;

    for (let i = 0; i < valuesBlock.length; i += 1) {
        const ch = valuesBlock[i];
        const next = valuesBlock[i + 1];

        if (inString) {
            current += ch;
            if (ch === "'" && next === "'") {
                current += next;
                i += 1;
            } else if (ch === "'") {
                inString = false;
            }
            continue;
        }

        if (ch === "'") {
            inString = true;
            current += ch;
            continue;
        }

        if (ch === "(") depth += 1;
        if (ch === ")") depth -= 1;

        current += ch;

        if (depth === 0 && ch === ")") {
            rows.push(current.trim());
            current = "";
            while (valuesBlock[i + 1] === "," || /\s/.test(valuesBlock[i + 1] || "")) {
                i += 1;
            }
        }
    }

    return rows;
}

function safeJsonParse(value) {
    if (!value || typeof value !== "string") {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function pickAvgPriceVnd(row) {
    const candidates = [row.average_price, row.average_price_vnd, row.extracted_price, row.price_vnd];

    for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
            return candidate;
        }
    }

    return null;
}

const sql = fs.readFileSync(sqlPath, "utf8");
const insertRegex = /INSERT INTO\s+dbo\.([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*VALUES\s*([\s\S]*?);/g;

const records = [];
let match;

while ((match = insertRegex.exec(sql)) !== null) {
    const tableRaw = match[1];
    const table = tableRaw.toLowerCase();
    const category = categoryMap[table];
    if (!category) {
        continue;
    }

    const columns = splitTopLevel(match[2], ",").map((col) => col.replace(/[\[\]]/g, "").trim());
    const rowTexts = getRows(match[3]);

    for (const rowText of rowTexts) {
        const trimmed = rowText.trim();
        const inner = trimmed.startsWith("(") && trimmed.endsWith(")") ?
            trimmed.slice(1, -1) :
            trimmed;

        const values = splitTopLevel(inner, ",").map(parseSqlLiteral);
        if (values.length !== columns.length) {
            continue;
        }

        const row = Object.fromEntries(columns.map((key, idx) => [key, values[idx]]));

        const rating = typeof row.rating === "number" ? row.rating : 0;
        const totalReviews = typeof row.reviews === "number" ? row.reviews : 0;
        const gps = safeJsonParse(row.gps_coordinates);
        const avgPriceVnd = pickAvgPriceVnd(row);

        const address = typeof row.address === "string" ? row.address : "";

        records.push({
            id: records.length + 1,
            name: typeof row.title === "string" ? row.title : "Địa điểm",
            categoryCode: category.code,
            categoryName: category.name,
            address,
            district: "Gò Vấp",
            description: typeof row.description === "string" ? row.description :
                (typeof row.type === "string" ? row.type :
                    (typeof row.hotel_type === "string" ? row.hotel_type : null)),
            imageUrl: typeof row.thumbnail === "string" ? row.thumbnail :
                (typeof row.img === "string" ? row.img : null),
            phone: typeof row.phone === "string" ? row.phone : null,
            website: typeof row.website === "string" ? row.website : null,
            rating,
            totalReviews,
            latitude: gps && typeof gps.latitude === "number" ? gps.latitude : null,
            longitude: gps && typeof gps.longitude === "number" ? gps.longitude : null,
            featured: rating >= 4.5 && totalReviews >= 100,
            priceLabel: priceLabelByCategory[category.code],
            avgPriceVnd,
            status: "approved"
        });
    }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(records, null, 2) + "\n", "utf8");

console.log(`Generated ${records.length} records -> ${outputPath}`);