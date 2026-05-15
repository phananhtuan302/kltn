import { navigate } from "../lib/router";

export async function renderNotFoundPage(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="not-found shell">
      <div class="not-found__inner">
        <span class="not-found__icon">🗺️</span>
        <h1>404</h1>
        <p>Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.</p>
        <button class="btn btn-primary" id="go-home">Về trang chủ</button>
      </div>
    </div>
  `;
  container.querySelector("#go-home")?.addEventListener("click", () => navigate("/"));
}
