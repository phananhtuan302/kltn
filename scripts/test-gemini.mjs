import dotenv from "dotenv";

dotenv.config();

const key = process.env.GEMINI_API_KEY || "AIzaSyBeuPIfM3A8-0ISQogE7t-G_U4-cM2-fQQ";
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!key) {
    console.log("NO_KEY");
    process.exit(0);
}

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

try {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{
                role: "user",
                parts: [{ text: "Reply exactly: OK_GEMINI" }]
            }]
        })
    });

    const text = await response.text();
    console.log("STATUS", response.status);
    console.log(text.slice(0, 600));
} catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log("ERR", msg);
}