import { getState, clearAuth } from "../lib/state";
import { navigate } from "../lib/router";

export function renderNavbar(): void {
  const existing = document.querySelector("nav.navbar");
  if (existing) existing.remove();

  const { user } = getState();

  const nav = document.createElement("nav");
  nav.className = "navbar";
  nav.innerHTML = `
    <div class="navbar__inner shell">
      <a class="navbar__brand" href="/" data-link>
        <span class="navbar__logo">✈️</span>
        <span>GoVap Travel</span>
      </a>
      <div class="navbar__links">
        <a href="/about" data-link>Về chúng tôi</a>
        ${user ? '<a href="/itinerary" data-link>Lịch trình của tôi</a>' : ""}
      </div>
      <div class="navbar__auth">
        ${
          user
            ? `<div class="navbar__user-menu">
                 <button class="navbar__user-btn" id="user-menu-btn">
                   Xin chào, <strong>${user.fullName}</strong>
                   <span class="navbar__user-arrow">▼</span>
                 </button>
                 <div class="navbar__dropdown" id="user-dropdown">
                   <a href="/change-password" class="navbar__dropdown-item" data-link>
                     <span>🔒</span> Đổi mật khẩu
                   </a>
                   <a href="/user-preferences" class="navbar__dropdown-item" data-link>
                     <span>⚙️</span> Sở thích
                   </a>
                   <div class="navbar__dropdown-divider"></div>
                   <button class="navbar__dropdown-item navbar__dropdown-logout" id="logout-btn">
                     <span>🚪</span> Đăng xuất
                   </button>
                 </div>
               </div>`
            : `<a class="btn btn-outline btn-sm" href="/login" data-link>Đăng nhập</a>
               <a class="btn btn-primary btn-sm" href="/register" data-link>Đăng ký</a>`
        }
      </div>
    </div>
  `;

  document.body.prepend(nav);

  // Handle user menu dropdown
  const userMenuBtn = nav.querySelector("#user-menu-btn");
  const userDropdown = nav.querySelector("#user-dropdown");

  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener("click", () => {
      userDropdown.classList.toggle("navbar__dropdown--active");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target as Node)) {
        userDropdown.classList.remove("navbar__dropdown--active");
      }
    });

    // Close dropdown when clicking on a link
    userDropdown.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        userDropdown.classList.remove("navbar__dropdown--active");
      });
    });
  }

  // Handle logout
  nav.querySelector("#logout-btn")?.addEventListener("click", () => {
    clearAuth();
    navigate("/");
    renderNavbar();
  });

  // Handle SPA links
  nav.querySelectorAll<HTMLAnchorElement>("a[data-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(a.getAttribute("href") ?? "/");
    });
  });
}
