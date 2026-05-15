import { apiRegister } from "../lib/api";
import { navigate } from "../lib/router";
import { setAuth } from "../lib/state";
import { renderNavbar } from "../components/navbar";

export function renderRegisterPage(container: HTMLElement): void {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__header">
          <a class="auth-card__brand" href="/" data-link>🗺️ GoVap Travel AI</a>
          <h1>Tạo tài khoản</h1>
          <p>Tham gia cộng đồng khám phá địa điểm Gò Vấp cùng trợ lý AI.</p>
        </div>

        <form class="auth-form" id="register-form" novalidate>
          <div class="form-row-2">
            <div class="form-group">
              <label for="fullName">Họ và tên</label>
              <input id="fullName" name="fullName" type="text" placeholder="Nguyễn Văn A" required />
            </div>
            <div class="form-group">
              <label for="username">Tên đăng nhập</label>
              <input id="username" name="username" type="text" placeholder="nguyenvana" autocomplete="username" required minlength="3" />
            </div>
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required />
          </div>
          <div class="form-group">
            <label for="password">Mật khẩu</label>
            <div class="input-eye">
              <input id="password" name="password" type="password" placeholder="Tối thiểu 6 ký tự" autocomplete="new-password" required minlength="6" />
              <button type="button" class="eye-toggle" id="toggle-pw" aria-label="Hiện mật khẩu">👁️</button>
            </div>
            <small class="form-hint">Tối thiểu 6 ký tự</small>
          </div>
          <div class="form-group">
            <label for="confirm">Xác nhận mật khẩu</label>
            <input id="confirm" name="confirm" type="password" placeholder="Nhập lại mật khẩu" autocomplete="new-password" required />
          </div>

          <!-- Preference fields moved to post-registration questionnaire -->
          <p class="form-error" id="register-error" hidden></p>
          <button class="btn btn-primary btn-block" type="submit" id="register-btn">Đăng ký</button>
        </form>

        <p class="auth-card__switch">
          Đã có tài khoản?
          <a href="/login" data-link>Đăng nhập</a>
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

  // Toggle password
  const pwInput = container.querySelector<HTMLInputElement>("#password")!;
  container.querySelector("#toggle-pw")?.addEventListener("click", () => {
    pwInput.type = pwInput.type === "password" ? "text" : "password";
  });

  const form = container.querySelector<HTMLFormElement>("#register-form")!;
  const errorEl = container.querySelector<HTMLParagraphElement>("#register-error")!;
  const btn = container.querySelector<HTMLButtonElement>("#register-btn")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const data = new FormData(form);
    const password = data.get("password") as string;
    const confirm = data.get("confirm") as string;

    if (password !== confirm) {
      errorEl.textContent = "Mật khẩu xác nhận không khớp.";
      errorEl.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Đang xử lý…";

    try {
      const result = await apiRegister({
        username: (data.get("username") as string).trim(),
        email: (data.get("email") as string).trim(),
        password,
        fullName: (data.get("fullName") as string).trim(),
        preferences: {} // preferences will be collected after signup
      });
      setAuth(result.user, result.token);
      renderNavbar();
      // After successful signup, go to the questionnaire to collect preferences
      navigate("/user-questions");
    } catch (err) {
      errorEl.textContent =
        err instanceof Error ? err.message : "Đăng ký thất bại.";
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Đăng ký";
    }
  });
}
