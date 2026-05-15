import { apiLogin } from "../lib/api";
import { navigate } from "../lib/router";
import { setAuth } from "../lib/state";
import { renderNavbar } from "../components/navbar";

export function renderLoginPage(container: HTMLElement): void {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__header">
          <a class="auth-card__brand" href="/" data-link>🗺️ GoVap Travel AI</a>
          <h1>Đăng nhập</h1>
          <p>Chào mừng trở lại! Hãy đăng nhập để lưu lịch trình và yêu thích địa điểm.</p>
        </div>

        <form class="auth-form" id="login-form" novalidate>
          <div class="form-group">
            <label for="username">Tên đăng nhập hoặc Email</label>
            <input id="username" name="username" type="text" placeholder="admin" autocomplete="username" required />
          </div>
          <div class="form-group">
            <label for="password">Mật khẩu</label>
            <div class="input-eye">
              <input id="password" name="password" type="password" placeholder="••••••••" autocomplete="current-password" required />
              <button type="button" class="eye-toggle" id="toggle-pw" aria-label="Hiện mật khẩu">👁️</button>
            </div>
          </div>
          <p class="form-error" id="login-error" hidden></p>
          <button class="btn btn-primary btn-block" type="submit" id="login-btn">Đăng nhập</button>
        </form>

        <p class="auth-card__switch">
          Chưa có tài khoản?
          <a href="/register" data-link>Đăng ký ngay</a>
        </p>
      </div>
    </div>
  `;

  // SPA links
  container.querySelectorAll<HTMLAnchorElement>("a[data-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(a.getAttribute("href") ?? "/");
    });
  });

  // Toggle password visibility
  const pwInput = container.querySelector<HTMLInputElement>("#password")!;
  container.querySelector("#toggle-pw")?.addEventListener("click", () => {
    pwInput.type = pwInput.type === "password" ? "text" : "password";
  });

  // Form submit
  const form = container.querySelector<HTMLFormElement>("#login-form")!;
  const errorEl = container.querySelector<HTMLParagraphElement>("#login-error")!;
  const btn = container.querySelector<HTMLButtonElement>("#login-btn")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = "Đang xử lý…";

    const data = new FormData(form);
    try {
      const result = await apiLogin({
        username: (data.get("username") as string).trim(),
        password: data.get("password") as string
      });
      setAuth(result.user, result.token);
      renderNavbar();
      navigate("/");
    } catch (err) {
      errorEl.textContent =
        err instanceof Error ? err.message : "Đăng nhập thất bại.";
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Đăng nhập";
    }
  });
}
