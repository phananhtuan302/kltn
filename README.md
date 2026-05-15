# Travel AI Web

Khung website gợi ý địa điểm du lịch cho dữ liệu Gò Vấp, dùng:

- Frontend: HTML + CSS + TypeScript với Vite
- Backend: Node.js + Express + TypeScript
- Database: SQL Server
- AI chat: OpenAI API hoặc chế độ fallback nội bộ

## Cấu trúc thư mục

```text
travel-ai-web/
  server/                  API Express + SQL Server + AI service
  src/                     Frontend TypeScript + HTML + CSS
  .env.example             Mẫu biến môi trường
  package.json
```

## Tính năng khung đã có

- Trang chủ giới thiệu hệ thống gợi ý địa điểm
- Bộ lọc theo danh mục và từ khóa
- Danh sách địa điểm nổi bật lấy từ API
- Chat assistant để hỏi gợi ý địa điểm
- API kết nối SQL Server theo schema bạn đã có
- Chế độ mock data để chạy ngay cả khi chưa cấu hình DB/API key

## Cài đặt

```bash
npm install
copy .env.example .env
```

## Chạy môi trường phát triển

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Build production

```bash
npm run build
npm start
```

Khi có thư mục `dist`, backend sẽ tự phục vụ frontend build sẵn.

## Kết nối SQL Server

1. Chạy file `schema_travel_recommendation.sql`
2. Chạy file `seed_travel_data_from_sources.sql`
3. Cập nhật `.env` với thông tin SQL Server thực tế
4. Đổi `USE_MOCK_DATA=false`

## AI chat

- Nếu có `OPENAI_API_KEY`, API chat sẽ dùng model thật.
- Nếu chưa cấu hình API key, backend sẽ trả lời bằng cơ chế fallback dựa trên dữ liệu địa điểm.

## API hiện có

- `GET /api/health`
- `GET /api/locations?limit=12&category=coffee&search=lotte`
- `GET /api/locations/:id`
- `POST /api/chat`

## Hướng mở rộng tiếp theo

- Đăng nhập người dùng bằng bảng `NguoiDung`
- Lưu lịch sử chat vào `CuocTroChuyen` và `TinNhanTroChuyen`
- Tạo trang chi tiết địa điểm, yêu thích và lịch trình
- Gợi ý cá nhân hóa theo `SoThichNguoiDung`