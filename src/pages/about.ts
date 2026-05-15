import { navigate } from "../lib/router";

export function renderAboutPage(container: HTMLElement): void {
  container.innerHTML = `
    <section class="about-hero">
      <div class="shell">
        <span class="hero__eyebrow">ABOUT GOVAP SMART TRAVEL</span>
        <h1 class="about-title">Về chúng tôi</h1>
        <p class="about-subtitle">
          Chúng tôi xây dựng hệ thống đề xuất địa điểm du lịch theo ngữ cảnh vị trí để mỗi người dùng,
          đặc biệt tại khu vực Gò Vấp, có thể ra quyết định đi chơi và ăn uống nhanh hơn, chính xác hơn.
        </p>
      </div>
    </section>

    <section class="section">
      <div class="shell about-grid">
        <article class="about-card">
          <h2>Sứ mệnh</h2>
          <p>
            Kết hợp dữ liệu địa điểm, AI hội thoại và hành vi người dùng để cung cấp gợi ý cá nhân hóa,
            phù hợp theo thời gian, ngân sách và sở thích thực tế.
          </p>
        </article>
        <article class="about-card">
          <h2>Tầm nhìn</h2>
          <p>
            Trở thành nền tảng điều hướng trải nghiệm đô thị đáng tin cậy, nơi người dùng có thể khám phá
            địa điểm mới dựa trên ngữ cảnh sống hàng ngày.
          </p>
        </article>
        <article class="about-card">
          <h2>Nguyên tắc thiết kế</h2>
          <p>
            Ưu tiên tương phản màu rõ ràng, khoảng trắng nhất quán, biểu tượng trực quan map-system-navigation
            và luồng thao tác ngắn gọn trên mọi thiết bị.
          </p>
        </article>
      </div>
    </section>

    <section class="section section--alt">
      <div class="shell">
        <h2 class="section__title center">Giá trị cốt lõi của đội ngũ</h2>
        <div class="grid-3-system">
          <article class="feature feature--core">
            <span class="feature__icon">📍</span>
            <h3>Hiểu vị trí người dùng</h3>
            <p>Đề xuất theo bối cảnh địa lý để tăng độ liên quan và giảm thời gian tìm kiếm.</p>
          </article>
          <article class="feature feature--core">
            <span class="feature__icon">⚙️</span>
            <h3>Tư duy hệ thống</h3>
            <p>Thiết kế kiến trúc linh hoạt để dễ mở rộng dữ liệu và thuật toán đề xuất.</p>
          </article>
          <article class="feature feature--core">
            <span class="feature__icon">🧭</span>
            <h3>Điều hướng rõ ràng</h3>
            <p>Đặt trải nghiệm điều hướng làm trung tâm để người dùng luôn biết bước tiếp theo.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="shell about-cta">
        <h2>Sẵn sàng khám phá theo vị trí của bạn?</h2>
        <p>Trải nghiệm hệ thống gợi ý và lưu hành trình cá nhân hóa ngay trên trang chủ.</p>
        <button class="btn btn-primary" id="about-explore-home">Khám phá địa điểm</button>
      </div>
    </section>
  `;

  container.querySelector<HTMLButtonElement>("#about-explore-home")?.addEventListener("click", () => {
    navigate("/");
  });
}
