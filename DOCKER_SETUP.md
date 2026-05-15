# Docker & Ollama Setup Guide

## Overview
Project này được cấu hình hybrid:
- **Ollama** chạy trong Docker để tạo embeddings và phục vụ vector search
- **Qdrant** chạy trong Docker để lưu vector
- **Gemini** dùng để viết câu trả lời cuối cùng cho người dùng

## Prerequisites
- Docker & Docker Compose đã cài đặt
- Node.js 18+ (cho dev server)
- RAM: Tối thiểu 8GB (4GB cho Ollama + 2GB cho app + 1GB overhead)

## Quick Start

### 1. Clone và cấu hình .env
```bash
cp .env.example .env
```

Thay đổi các biến môi trường (nếu cần):
```env
# Trong .env
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
QDRANT_ENABLED=true
AI_PROVIDER=gemini
```

### 2. Khởi chạy Docker containers
```bash
docker-compose up -d
```

Container chạy:
- **ollama** - Local embeddings server + local LLM server (port 11434)
- **qdrant** - Vector database (port 6333)

### 3. Kiểm tra Ollama có sẵn model không
```bash
curl http://localhost:11434/api/tags
```

**Lần đầu tiên:** Download 2 model cần dùng (mất ~5-10 phút)
```bash
docker exec travel-ollama ollama pull qwen2.5:7b
docker exec travel-ollama ollama pull nomic-embed-text
```

### 4. Chạy dev server (trên máy, không trong Docker)
```bash
npm install
npm run dev
```

Server chạy tại:
- Frontend: http://localhost:5173 (Vite)
- Backend: http://localhost:3000

---

## Xem logs

```bash
# Xem logs Ollama
docker logs travel-ollama -f

# Xem logs Qdrant
docker logs travel-qdrant -f

# Xem logs app (trong terminal npm run dev)
```

---

## Troubleshooting

### Ollama không respond
```bash
# Kiểm tra container chạy không
docker ps | grep ollama

# Restart Ollama
docker restart travel-ollama

# Xem logs
docker logs travel-ollama
```

### Model không download được
```bash
# Pull model từ docker exec
docker exec travel-ollama ollama pull qwen2.5:7b

# Hoặc thay model khác
docker exec travel-ollama ollama pull mistral:7b
```

### Port đã được sử dụng
```bash
# Thay đổi port trong docker-compose.yml
# Ví dụ: "11434:11434" → "11435:11434"
```

### Dừng containers
```bash
docker-compose down

# Xóa volume (nếu muốn reset data)
docker-compose down -v
```

---

## Chuyển đổi AI Provider

### Hybrid mặc định
```env
AI_PROVIDER=gemini
OLLAMA_ENABLED=true
QDRANT_ENABLED=true
```

- Ollama xử lý embeddings và vector search
- Gemini viết câu trả lời cuối

### Dùng Gemini (API)
```env
AI_PROVIDER=gemini
OLLAMA_ENABLED=false
GEMINI_API_KEY=your_key_here
```

### Dùng OpenAI (API)
```env
AI_PROVIDER=openai
OLLAMA_ENABLED=false
OPENAI_API_KEY=your_key_here
```

---

## Development Notes

- **Ollama Service:** `server/src/services/ollama-service.ts`
- **Embedding Service:** `server/src/services/embedding-service.ts`
- **Vector Search:** `server/src/services/vector-search.ts`
- **AI Service Integration:** `server/src/services/ai-service.ts`
- **Config:** `server/src/config/env.ts`

---

## Production Deployment

### Tùy chọn 1: Để nguyên Docker
```bash
docker-compose -f docker-compose.yml up -d
```

### Tùy chọn 2: Chuyển sang API (khuyên dùng)
```env
# .env production
AI_PROVIDER=gemini
OLLAMA_ENABLED=false
QDRANT_ENABLED=false
```
- Không cần Docker cho Ollama
- Tiết kiệm tài nguyên server
- Dễ scale

---

**Cần giúp?** Hỏi tôi nếu gặp vấn đề!
