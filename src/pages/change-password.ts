import { apiChangePassword } from "../lib/api";
import { navigate } from "../lib/router";
import { renderNavbar } from "../components/navbar";

export function renderChangePasswordPage(container: HTMLElement): void {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__header">
          <h1>🔒 Đổi mật khẩu</h1>
          <p>Nhập mật khẩu hiện tại và mật khẩu mới để cập nhật bảo mật tài khoản của bạn.</p>
        </div>

        <form class="auth-form" id="change-pw-form" novalidate>
          <div class="form-group">
            <label for="current-password">Mật khẩu hiện tại</label>
            <div class="input-eye">
              <input id="current-password" name="currentPassword" type="password" placeholder="••••••••" required />
              <button type="button" class="eye-toggle" data-toggle="current-password" aria-label="Hiện mật khẩu">👁️</button>
            </div>
          </div>

          <div class="form-group">
            <label for="new-password">Mật khẩu mới</label>
            <div class="input-eye">
              <input id="new-password" name="newPassword" type="password" placeholder="••••••••" required minlength="6" />
              <button type="button" class="eye-toggle" data-toggle="new-password" aria-label="Hiện mật khẩu">👁️</button>
            </div>
            <p class="form-hint">Mật khẩu phải có ít nhất 6 ký tự</p>
          </div>

          <div class="form-group">
            <label for="confirm-password">Xác nhận mật khẩu mới</label>
            <div class="input-eye">
              <input id="confirm-password" name="confirmPassword" type="password" placeholder="••••••••" required />
              <button type="button" class="eye-toggle" data-toggle="confirm-password" aria-label="Hiện mật khẩu">👁️</button>
            </div>
          </div>

          <p class="form-error" id="change-pw-error" hidden></p>
          <p class="form-success" id="change-pw-success" hidden>✓ Mật khẩu đã được cập nhật thành công!</p>

          <button class="btn btn-primary btn-block" type="submit" id="change-pw-btn">Đổi mật khẩu</button>
        </form>

        <p class="auth-card__switch">
          <a href="/" data-link>← Quay về trang chủ</a>
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
  container.querySelectorAll<HTMLButtonElement>(".eye-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const fieldId = btn.getAttribute("data-toggle");
      const input = container.querySelector<HTMLInputElement>(`#${fieldId}`);
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
      }
    });
  });

  // Form submit
  const form = container.querySelector<HTMLFormElement>("#change-pw-form")!;
  const errorEl = container.querySelector<HTMLParagraphElement>("#change-pw-error")!;
  const successEl = container.querySelector<HTMLParagraphElement>("#change-pw-success")!;
  const btn = container.querySelector<HTMLButtonElement>("#change-pw-btn")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;
    btn.disabled = true;
    btn.textContent = "Đang xử lý…";

    const data = new FormData(form);
    const currentPw = (data.get("currentPassword") as string).trim();
    const newPw = (data.get("newPassword") as string).trim();
    const confirmPw = (data.get("confirmPassword") as string).trim();

    // Validate
    if (newPw.length < 6) {
      errorEl.textContent = "Mật khẩu mới phải có ít nhất 6 ký tự.";
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Đổi mật khẩu";
      return;
    }

    if (newPw !== confirmPw) {
      errorEl.textContent = "Mật khẩu xác nhận không khớp.";
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = "Đổi mật khẩu";
      return;
    }

    try {
      await apiChangePassword({
        currentPassword: currentPw,
        newPassword: newPw
      });
      successEl.hidden = false;
      form.reset();
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      errorEl.textContent =
        err instanceof Error ? err.message : "Đổi mật khẩu thất bại.";
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Đổi mật khẩu";
    }
  });
}
