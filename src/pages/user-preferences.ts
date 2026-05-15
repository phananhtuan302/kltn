import { apiUpdateUserProfile, apiSaveUserPreferences, apiGetUserPreferences } from "../lib/api";
import { navigate } from "../lib/router";
import { getState, setAuth } from "../lib/state";
import { renderNavbar } from "../components/navbar";

export function renderUserPreferencesPage(container: HTMLElement): void {
  const { user, token } = getState();

  if (!user || !token) {
    navigate("/login");
    return;
  }

  container.innerHTML = `
    <div class="section">
      <div class="shell">
        <div class="preferences-container">
          <h1>⚙️ Sở thích và thông tin cá nhân</h1>
          
          <div class="preferences-tabs">
            <button class="tab-btn tab-btn--active" data-tab="profile">Thông tin cá nhân</button>
            <button class="tab-btn" data-tab="preferences">Sở thích du lịch</button>
          </div>

          <!-- Profile Tab -->
          <div class="tab-content tab-content--active" data-tab="profile">
            <form class="preferences-form" id="profile-form">
              <div class="form-group">
                <label for="fullName">Họ và tên</label>
                <input id="fullName" name="fullName" type="text" value="${user.fullName}" required />
              </div>

              <div class="form-group">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" value="${user.email}" required />
              </div>

              <p class="form-error" id="profile-error" hidden></p>
              <p class="form-success" id="profile-success" hidden>✓ Cập nhật thành công!</p>

              <button class="btn btn-primary" type="submit" id="save-profile-btn">Lưu thay đổi</button>
            </form>
          </div>

          <!-- Preferences Tab -->
          <div class="tab-content" data-tab="preferences">
            <form class="preferences-form" id="preferences-form">
              <div class="form-group">
                <label for="budget">Ngân sách mỗi chuyến (VND)</label>
                <input id="budget" name="budgetPerTrip" type="number" placeholder="Ví dụ: 1500000" />
              </div>

              <div class="form-group">
                <label for="foodPref">Sở thích ẩm thực</label>
                <select id="foodPref" name="foodPreferences">
                  <option value="">-- Chọn --</option>
                  <option value="com">Cơm</option>
                  <option value="bun">Bún</option>
                  <option value="pho">Phở</option>
                  <option value="hai-san">Hải sản</option>
                  <option value="lau-nuong">Lẩu & nướng</option>
                  <option value="do-chay">Đồ chay</option>
                </select>
              </div>

              <div class="form-group">
                <label for="tripStyle">Phong cách du lịch</label>
                <select id="tripStyle" name="tripStyle">
                  <option value="">-- Chọn --</option>
                  <option value="adventure">Phiêu lưu mạo hiểm</option>
                  <option value="relaxation">Thư giãn & nghỉ dưỡng</option>
                  <option value="culture">Văn hóa & lịch sử</option>
                  <option value="shopping">Mua sắm</option>
                  <option value="foodie">Ẩm thực địa phương</option>
                </select>
              </div>

              <div class="form-group">
                <label for="categories">Loại địa điểm ưa thích (chọn nhiều)</label>
                <div class="checkbox-group">
                  <label><input type="checkbox" name="favoriteCategories" value="cong-vien" /> Công viên</label>
                  <label><input type="checkbox" name="favoriteCategories" value="cho" /> Chợ</label>
                  <label><input type="checkbox" name="favoriteCategories" value="chua" /> Chùa</label>
                  <label><input type="checkbox" name="favoriteCategories" value="coffee" /> Cà phê</label>
                  <label><input type="checkbox" name="favoriteCategories" value="karaoke" /> Karaoke</label>
                  <label><input type="checkbox" name="favoriteCategories" value="nha-tho" /> Nhà thờ</label>
                </div>
              </div>

              <p class="form-error" id="pref-error" hidden></p>
              <p class="form-success" id="pref-success" hidden>✓ Cập nhật thành công!</p>

              <button class="btn btn-primary" type="submit" id="save-pref-btn">Lưu sở thích</button>
            </form>
          </div>

          <div class="preferences-footer">
            <a href="/" class="btn btn-outline" data-link>← Quay về trang chủ</a>
          </div>
        </div>
      </div>
    </div>
  `;

  // Tab switching
  const tabBtns = container.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const tabContents = container.querySelectorAll<HTMLDivElement>(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.getAttribute("data-tab");
      
      tabBtns.forEach((b) => b.classList.remove("tab-btn--active"));
      tabContents.forEach((c) => c.classList.remove("tab-content--active"));
      
      btn.classList.add("tab-btn--active");
      container.querySelector(`[data-tab="${tabName}"]`)?.classList.add("tab-content--active");
    });
  });

  // SPA links
  container.querySelectorAll<HTMLAnchorElement>("a[data-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(a.getAttribute("href") ?? "/");
    });
  });

  // Load existing preferences
  const loadPreferences = async () => {
    try {
      const prefs = await apiGetUserPreferences();
      if (prefs.budgetPerTrip) {
        container.querySelector<HTMLInputElement>("#budget")!.value = String(prefs.budgetPerTrip);
      }
      if (prefs.foodPreferences) {
        container.querySelector<HTMLSelectElement>("#foodPref")!.value = String(prefs.foodPreferences);
      }
      if (prefs.tripStyle) {
        container.querySelector<HTMLSelectElement>("#tripStyle")!.value = String(prefs.tripStyle);
      }
      if (prefs.favoriteCategories && Array.isArray(prefs.favoriteCategories)) {
        const cats = prefs.favoriteCategories as string[];
        container.querySelectorAll<HTMLInputElement>('input[name="favoriteCategories"]').forEach((inp) => {
          inp.checked = cats.includes(inp.value);
        });
      }
    } catch (err) {
      console.warn("Failed to load preferences", err);
    }
  };

  void loadPreferences();

  // Profile form submit
  const profileForm = container.querySelector<HTMLFormElement>("#profile-form")!;
  const profileErrorEl = container.querySelector<HTMLParagraphElement>("#profile-error")!;
  const profileSuccessEl = container.querySelector<HTMLParagraphElement>("#profile-success")!;
  const saveProfileBtn = container.querySelector<HTMLButtonElement>("#save-profile-btn")!;

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    profileErrorEl.hidden = true;
    profileSuccessEl.hidden = true;
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Đang lưu…";

    const data = new FormData(profileForm);
    try {
      const result = await apiUpdateUserProfile({
        fullName: (data.get("fullName") as string).trim(),
        email: (data.get("email") as string).trim()
      });
      setAuth(result.user, token!);
      renderNavbar();
      profileSuccessEl.hidden = false;
    } catch (err) {
      profileErrorEl.textContent =
        err instanceof Error ? err.message : "Cập nhật thất bại.";
      profileErrorEl.hidden = false;
    } finally {
      saveProfileBtn.disabled = false;
      saveProfileBtn.textContent = "Lưu thay đổi";
    }
  });

  // Preferences form submit
  const preferencesForm = container.querySelector<HTMLFormElement>("#preferences-form")!;
  const prefErrorEl = container.querySelector<HTMLParagraphElement>("#pref-error")!;
  const prefSuccessEl = container.querySelector<HTMLParagraphElement>("#pref-success")!;
  const savePrefBtn = container.querySelector<HTMLButtonElement>("#save-pref-btn")!;

  preferencesForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    prefErrorEl.hidden = true;
    prefSuccessEl.hidden = true;
    savePrefBtn.disabled = true;
    savePrefBtn.textContent = "Đang lưu…";

    const data = new FormData(preferencesForm);
    const budget = (data.get("budgetPerTrip") as string).trim();
    const categories = data.getAll("favoriteCategories") as string[];

    try {
      await apiSaveUserPreferences({
        budgetPerTrip: budget ? Number(budget) : null,
        foodPreferences: data.get("foodPreferences"),
        tripStyle: data.get("tripStyle"),
        favoriteCategories: categories
      });
      prefSuccessEl.hidden = false;
    } catch (err) {
      prefErrorEl.textContent =
        err instanceof Error ? err.message : "Cập nhật thất bại.";
      prefErrorEl.hidden = false;
    } finally {
      savePrefBtn.disabled = false;
      savePrefBtn.textContent = "Lưu sở thích";
    }
  });
}
