import { apiFetchFeaturedItineraries, apiGetFavoriteLocations, apiGetLocationRecommendations, apiGetUserPreferences, apiRemoveFavoriteLocation, apiSaveFavoriteLocation, fetchLocations, sendChatMessage } from "../lib/api";
import { navigate } from "../lib/router";
import { consumeFlashMessage, getFavoriteLocationIds, getState, toggleFavoriteLocationId } from "../lib/state";
import type { ChatMessage, LocationItem, UserPreferences } from "../types";

const CATEGORIES = [
  { code: "", label: "Tất cả", icon: "🧭" },
  { code: "cho", label: "Chợ", icon: "🛍️" },
  { code: "quan-an", label: "Quán ăn", icon: "🍽️" },
  { code: "coffee", label: "Cà phê", icon: "☕" },
  { code: "cong-vien", label: "Công viên", icon: "🌳" },
  { code: "chua", label: "Chùa", icon: "🛕" },
  { code: "nha-tho", label: "Nhà thờ", icon: "⛪" },
  { code: "karaoke", label: "Karaoke", icon: "🎤" },
  { code: "thue-xe", label: "Thuê xe", icon: "🧭" },
  { code: "khach-san", label: "Khách sạn", icon: "🏨" }
];

const PAGE_SIZE = 12;

const STYLE_CATEGORY_BOOSTS: Record<string, string[]> = {
  adventure: ["cong-vien", "karaoke", "thue-xe"],
  relaxation: ["coffee", "cong-vien", "khach-san"],
  culture: ["chua", "nha-tho", "cho"],
  shopping: ["cho"],
  foodie: ["quan-an", "coffee", "cho"]
};

const FOOD_PREFERENCE_BOOSTS: Record<string, string[]> = {
  com: ["quan-an"],
  bun: ["quan-an"],
  pho: ["quan-an"],
  "hai-san": ["quan-an"],
  "lau-nuong": ["quan-an"],
  "do-chay": ["quan-an"]
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function estimateLocationPrice(location: LocationItem): number | null {
  if (typeof location.avgPriceVnd === "number" && Number.isFinite(location.avgPriceVnd) && location.avgPriceVnd > 0) {
    return location.avgPriceVnd;
  }

  const priceLabel = normalizeText(location.priceLabel);
  if (!priceLabel) {
    return null;
  }

  const match = priceLabel.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) {
    return null;
  }

  const rawAmount = Number(match[1].replace(/,/g, "."));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return null;
  }

  if (/[kđ]|ngh?n|ngan/.test(priceLabel)) {
    return Math.round(rawAmount * 1000);
  }

  if (/tr|triệu/.test(priceLabel)) {
    return Math.round(rawAmount * 1_000_000);
  }

  if (rawAmount < 1000) {
    return Math.round(rawAmount * 1000);
  }

  return Math.round(rawAmount);
}

function formatRatingLabel(location: LocationItem): string {
  return `Rating: ${location.rating > 0 ? location.rating.toFixed(1) : "0.0"}`;
}

function scoreBudgetMatch(location: LocationItem, budget: number | null | undefined): number {
  if (!budget || budget <= 0) {
    return 0;
  }

  const estimatedPrice = estimateLocationPrice(location);
  if (!estimatedPrice) {
    return 0;
  }

  const ratio = estimatedPrice / budget;
  if (ratio <= 0.7) return 1.8;
  if (ratio <= 1.0) return 2.4;
  if (ratio <= 1.2) return 1.2;
  if (ratio <= 1.5) return -0.4;
  return -1.8;
}

function getPreferenceScore(location: LocationItem, preferences: UserPreferences | null): number {
  if (!preferences) {
    return 0;
  }

  let score = 0;
  const categoryCode = normalizeText(location.categoryCode);

  if (preferences.favoriteCategories?.some((item) => normalizeText(item) === categoryCode)) {
    score += 4;
  }

  const foodPreference = normalizeText(preferences.foodPreferences);
  if (foodPreference && FOOD_PREFERENCE_BOOSTS[foodPreference]?.includes(categoryCode)) {
    score += 2.5;
  }

  const tripStyle = normalizeText(preferences.tripStyle);
  if (tripStyle && STYLE_CATEGORY_BOOSTS[tripStyle]?.includes(categoryCode)) {
    score += 2.25;
  }

  score += scoreBudgetMatch(location, preferences.budgetPerTrip);

  if (location.featured) {
    score += 0.4;
  }

  score += Math.min(location.rating / 5, 1) * 2;
  score += Math.log10((location.totalReviews ?? 0) + 1) * 0.25;

  return score;
}

function rankLocationsByPreferences(locations: LocationItem[], preferences: UserPreferences | null): LocationItem[] {
  return [...locations].sort((a, b) => {
    const scoreDiff = getPreferenceScore(b, preferences) - getPreferenceScore(a, preferences);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    if (b.rating !== a.rating) {
      return b.rating - a.rating;
    }

    if (b.totalReviews !== a.totalReviews) {
      return b.totalReviews - a.totalReviews;
    }

    return a.name.localeCompare(b.name, "vi");
  });
}

function starsHtml(rating: number): string {
  const full = Math.round(rating);
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="${i < full ? "star star--on" : "star"}">★</span>`
  ).join("");
}

function cardHtml(loc: LocationItem, selected: boolean, favorite: boolean): string {
  const img =
    loc.imageUrl ??
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80";
  return `
    <article class="loc-card" data-id="${loc.id}">
      <div class="loc-card__img">
        <img src="${img}" alt="${loc.name}" loading="lazy" />
        <span class="loc-card__cat">${loc.categoryName}</span>
        ${loc.featured ? '<span class="loc-card__featured">⭐ Nổi bật</span>' : ""}
      </div>
      <div class="loc-card__body">
        <div class="loc-card__stars">${starsHtml(loc.rating)}
          <small>${loc.rating > 0 ? loc.rating.toFixed(1) : "Chưa có"} (${loc.totalReviews})</small>
        </div>
        <h3>${loc.name}</h3>
        <p class="loc-card__addr">📍 ${loc.address}</p>
        <div class="loc-card__foot">
          <button class="badge badge-favorite ${favorite ? "badge-favorite--selected" : ""}" data-action="toggle-favorite" data-id="${loc.id}">
            ${favorite ? "♥ Yêu thích" : "♡ Yêu thích"}
          </button>
          <button class="badge badge-itinerary ${selected ? "badge-itinerary--selected" : ""}" data-action="toggle-itinerary" data-id="${loc.id}">
            ${selected ? "✓ Đã lưu hành trình" : "+ Lưu vào hành trình"}
          </button>
          <span class="badge badge-price">${formatRatingLabel(loc)}</span>
          ${loc.phone ? `<a class="badge badge-phone" href="tel:${loc.phone}">📞 ${loc.phone}</a>` : ""}
        </div>
      </div>
    </article>`;
}

export async function renderHomePage(
  container: HTMLElement,
  options?: { scrollToSection?: "chat" | "locations" }
): Promise<void> {
  const chatMessages: ChatMessage[] = [
    {
      role: "assistant",
      content:
        "Xin chào! Tôi là trợ lý du lịch AI. Bạn muốn tìm quán ăn, cà phê, điểm tham quan hay lên lịch trình cụ thể?"
    }
  ];
  let activeCategory = "";
  let currentPage = 1;
  let totalPages = 1;
  let allLocations: LocationItem[] = [];
  let allRecommendations: LocationItem[] = [];
  let userPreferences: UserPreferences | null = null;
  let savedFavorites: any[] = [];
  let favoriteIds = getFavoriteLocationIds();
  
  // Itinerary pagination state
  let allItineraries: any[] = [];
  let currentItineraryPage = 1;
  let totalItineraryPages = 1;
  const ITINERARY_PAGE_SIZE = 6;
  
  const flashMessage = consumeFlashMessage();

  container.innerHTML = `
    <div class="home-page">
    ${flashMessage ? `<div class="shell"><div class="flash-note">${flashMessage}</div></div>` : ""}
    <section class="hero hero--travel-banner">
      <div class="shell">
        <div class="hero__content">
          <div class="hero__text">
            <span class="hero__eyebrow">GO VAP SMART RECOMMENDATION</span>
            <h1 class="hero__title">Khám phá chuyến đi trong mơ ngay hôm nay, bắt đầu từ chính nơi bạn đang đứng</h1>
            <p class="hero__sub">
              Ấn tượng đầu tiên quyết định tất cả. Hệ thống sẽ gợi ý điểm đi chơi, ăn uống, cafe và trải nghiệm phù hợp theo vị trí hiện tại, giúp bạn chốt lịch trình chỉ trong vài phút.
            </p>
            <div class="hero__signals">
              <span class="hero__signal">🔥 Xu hướng cuối tuần</span>
              <span class="hero__signal">⭐ Đánh giá cao từ cộng đồng</span>
              <span class="hero__signal">⚡ Gợi ý tức thì theo vị trí</span>
            </div>
          </div>
          <div class="hero__stats">
            <div class="hero__stat">
              <span class="stat-num">1200+</span>
              <span class="stat-label">Địa điểm đề xuất</span>
            </div>
            <div class="hero__stat">
              <span class="stat-num">24/7</span>
              <span class="stat-label">Trợ lý AI hỗ trợ</span>
            </div>
            <div class="hero__stat">
              <span class="stat-num">3 bước</span>
              <span class="stat-label">Map, System, Navigation</span>
            </div>
          </div>
        </div>

        <div class="hero-search-wrap">
         
          <div class="hero__cta">
            <button class="btn btn-outline-light btn-lg" id="hero-explore">Xem điểm hot ngay</button>
            <button class="btn btn-white btn-lg" id="hero-chat">Nhận tư vấn AI miễn phí</button>
          </div>
        </div>

        <div class="hero-services" aria-label="Dịch vụ nhanh">
          <div class="hero-service-card">
            <span class="service-icon">🗺️</span>
            <p>Bản đồ điểm đến</p>
          </div>
          <div class="hero-service-card">
            <span class="service-icon">⚙️</span>
            <p>System gợi ý AI</p>
          </div>
          <div class="hero-service-card">
            <span class="service-icon">🧭</span>
            <p>Điều hướng thông minh</p>
          </div>
          <div class="hero-service-card">
            <span class="service-icon">🍜</span>
            <p>Ăn uống gần bạn</p>
          </div>
          <div class="hero-service-card">
            <span class="service-icon">🌆</span>
            <p>Vui chơi cuối tuần</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="favorite-routes-section">
      <div class="shell">
        <section class="tour-spotlight" id="tour-spotlight" aria-label="Tour được hành khách ưa thích">
          <div class="tour-spotlight__intro">
            <span class="tour-spotlight__eyebrow">Tour ưa thích</span>
            <h3>Các tour được hành khách chọn nhiều nhất</h3>
            <p>Những lộ trình được xây dựng kỹ lưỡng cho từng loại du lịch</p>
          </div>
          <div class="tour-spotlight__grid" id="tour-spotlight-grid">
            <p class="tour-spotlight__loading">Đang tải lộ trình...</p>
          </div>
          <nav class="pager" id="itinerary-pager" aria-label="Phân trang lộ trình"></nav>
        </section>
      </div>
    </section>

    <section class="section section--tight" id="categories">
      <div class="shell">
        <div class="section-head section-head--compact">
          <h2 class="section__title">Danh mục tìm kiếm</h2>
        </div>
        <div class="cat-strip" id="cat-strip">
          ${CATEGORIES.map(
            (c) =>
              `<button class="cat-pill${c.code === activeCategory ? " cat-pill--active" : ""}" data-cat="${c.code}">
                <span class="cat-pill__icon">${c.icon}</span>
                <span>${c.label}</span>
               </button>`
          ).join("")}
        </div>
      </div>
    </section>

    <!-- ====== RECOMMENDATIONS ====== -->
    <section class="section" id="recommendations-section" hidden>
      <div class="shell">
        <div class="section-head">
          <h2 class="section__title">✨ Gợi ý cho bạn</h2>
          <p class="section-sub">Dựa trên sở thích của bạn</p>
        </div>
        <div class="locs-grid" id="recommendations-grid"></div>
      </div>
    </section>

    <!-- ====== MAIN GRID ====== -->
    <section class="section" id="locations-section">
      <div class="shell">
       <form class="search-bar" id="search-bar">
            <div class="search-bar__prefix">Khám phá</div>
            <input id="search-q" type="text" placeholder="Bạn muốn đi đâu hoặc tìm gì ở Gò Vấp?" class="search-bar__input" />
            <button class="btn btn-primary" type="submit">Bắt đầu khám phá</button>
          </form>
          </br>
        <div class="section-head">
          <h2 class="section__title" id="locs-title">Địa điểm nổi bật</h2>
          <span class="section-count" id="locs-count">Đang tải…</span>
        </div>
        <div class="locs-grid" id="locs-grid"></div>
        <nav class="pager" id="locs-pager" aria-label="Phân trang địa điểm"></nav>
        <p class="empty" id="locs-empty" hidden>Không tìm thấy địa điểm phù hợp.</p>
      </div>
    </section>

    <!-- ====== FEATURES ====== -->
    <section class="section section--alt" id="core-values">
      <div class="shell">
        <h2 class="section__title center">Core Value</h2>
        <div class="grid-3-system features-core">
          <article class="feature feature--core">
            <span class="feature__icon">📍</span>
            <h3>Context by Location</h3>
            <p>Đề xuất theo vị trí hiện tại như Gò Vấp và khu vực lân cận để giảm thời gian tìm kiếm.</p>
          </article>
          <article class="feature feature--core">
            <span class="feature__icon">⚙️</span>
            <h3>System Intelligence</h3>
            <p>Hệ thống học từ lịch sử tương tác, ưu tiên nhu cầu thực tế về ăn uống, vui chơi, nghỉ ngơi.</p>
          </article>
          <article class="feature feature--core">
            <span class="feature__icon">🧭</span>
            <h3>Navigation Ready</h3>
            <p>Điều hướng nhanh đến địa điểm với thông tin khoảng cách, giờ mở cửa, mức giá và độ phù hợp.</p>
          </article>
          <article class="feature feature--core">
            <span class="feature__icon">🛡️</span>
            <h3>Reliable Data</h3>
            <p>Dữ liệu được chuẩn hóa từ nhiều nguồn và có lớp kiểm duyệt nội dung để tăng độ chính xác.</p>
          </article>
          <article class="feature feature--core">
            <span class="feature__icon">🤝</span>
            <h3>Human Friendly</h3>
            <p>Giao diện ưu tiên khả năng đọc, khoảng trắng hợp lý, độ tương phản rõ trên cả mobile và desktop.</p>
          </article>
          <article class="feature feature--core">
            <span class="feature__icon">📈</span>
            <h3>Continuous Improvement</h3>
            <p>Phản hồi người dùng được ghi nhận để liên tục tối ưu mô hình đề xuất theo hành vi thực tế.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section" id="feedback">
      <div class="shell">
        <h2 class="section__title center">Feedback Từ Người Dùng</h2>
        <div class="grid-3-system feedback-grid">
          <article class="feedback-card">
            <p>"Tôi đang ở Gò Vấp và tìm được quán ăn gia đình trong vài giây, gợi ý rất sát nhu cầu."</p>
            <strong>Ngoc Anh, 26 tuổi</strong>
          </article>
          <article class="feedback-card">
            <p>"Điểm cộng lớn là phần điều hướng, lọc nhanh theo khoảng cách và mức giá khá chuẩn."</p>
            <strong>Minh Quan, nhân viên văn phòng</strong>
          </article>
          <article class="feedback-card">
            <p>"Tôi thích giao diện sáng, sạch và dễ đọc. Khoảng trắng thoáng nên dùng lâu không bị mỏi mắt."</p>
            <strong>Thanh Thao, freelancer</strong>
          </article>
        </div>
      </div>
    </section>

    <!-- ====== AI CHAT ====== -->
    <section class="section" id="chat-section">
      <div class="shell">
        <div class="chat-layout">
          <div class="chat-info">
            <span class="eyebrow">✨ Trợ lý AI</span>
            <h2>Hỏi gì cũng được</h2>
            <p>Từ quán ăn gia đình, cà phê yên tĩnh đến điểm tâm linh hay thuê xe — AI sẽ gợi ý đúng nhu cầu.</p>
            <ul class="chat-hints">
              <li>💡 "Tôi muốn tìm quán ăn gia đình có chỗ để xe"</li>
              <li>💡 "Cà phê yên tĩnh để làm việc xung quanh Go Vap"</li>
              <li>💡 "Lịch trình 1 ngày tham quan và ăn uống"</li>
            </ul>
          </div>
          <div class="chat-box">
            <div class="chat-feed" id="chat-feed"></div>
            <form class="chat-input-row" id="chat-form">
              <textarea id="chat-q" placeholder="Nhập câu hỏi…" rows="3"></textarea>
              <button class="btn btn-primary" type="submit" id="chat-send">Gửi</button>
            </form>
            <div id="chat-suggestions"></div>
          </div>
        </div>
      </div>
    </section>
    </div>
  `;

  /* ---- refs ---- */
  const locsGrid = container.querySelector<HTMLDivElement>("#locs-grid")!;
  const locsPager = container.querySelector<HTMLElement>("#locs-pager")!;
  const locsEmpty = container.querySelector<HTMLParagraphElement>("#locs-empty")!;
  const locsCount = container.querySelector<HTMLSpanElement>("#locs-count")!;
  const locsTitle = container.querySelector<HTMLHeadingElement>("#locs-title")!;
  const recsGrid = container.querySelector<HTMLDivElement>("#recommendations-grid")!;
  const chatFeed = container.querySelector<HTMLDivElement>("#chat-feed")!;
  const chatSuggestions = container.querySelector<HTMLDivElement>("#chat-suggestions")!;
  const chatQ = container.querySelector<HTMLTextAreaElement>("#chat-q")!;
  const searchQ = container.querySelector<HTMLInputElement>("#search-q")!;
  const tourSpotlightGrid = container.querySelector<HTMLDivElement>("#tour-spotlight-grid")!;
  const itineraryPager = container.querySelector<HTMLElement>("#itinerary-pager")!;

  /* ---- render helpers ---- */
  function renderFeed(): void {
    chatFeed.innerHTML = chatMessages
      .map(
        (m) =>
          `<div class="bubble bubble--${m.role}">
            <span class="bubble__who">${m.role === "user" ? "Bạn" : "AI"}</span>
            <p>${m.content}</p>
           </div>`
      )
      .join("");
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function getPaginationModel(page: number, pages: number): Array<number | "dots"> {
    if (pages <= 7) {
      return Array.from({ length: pages }, (_, i) => i + 1);
    }

    const model: Array<number | "dots"> = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(pages - 1, page + 1);

    if (start > 2) {
      model.push("dots");
    }

    for (let p = start; p <= end; p += 1) {
      model.push(p);
    }

    if (end < pages - 1) {
      model.push("dots");
    }

    model.push(pages);
    return model;
  }

  function renderPager(): void {
    if (allLocations.length === 0) {
      locsPager.innerHTML = "";
      return;
    }

    const model = getPaginationModel(currentPage, totalPages);
    locsPager.innerHTML =
      `<button class="pager__btn" data-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? "disabled" : ""}>‹</button>` +
      model
        .map((item) => {
          if (item === "dots") {
            return `<span class="pager__dots">…</span>`;
          }

          return `<button class="pager__btn${item === currentPage ? " pager__btn--active" : ""}" data-page="${item}">${item}</button>`;
        })
        .join("") +
      `<button class="pager__btn" data-page="${Math.min(totalPages, currentPage + 1)}" ${currentPage === totalPages ? "disabled" : ""}>›</button>`;
  }

  function renderPage(page: number): void {
    if (allLocations.length === 0) {
      locsGrid.innerHTML = "";
      locsEmpty.hidden = false;
      locsCount.textContent = "0 địa điểm";
      locsPager.innerHTML = "";
      return;
    }

    currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = allLocations.slice(start, start + PAGE_SIZE);

    const selectedIds = new Set(savedFavorites.map((item) => item.locationId ?? item.location?.id));
    const favoriteSet = new Set(favoriteIds);
    locsGrid.innerHTML = pageItems
      .map((item) => cardHtml(item, selectedIds.has(item.id), favoriteSet.has(item.id)))
      .join("");
    locsEmpty.hidden = true;
    locsCount.textContent = `${allLocations.length} địa điểm • Trang ${currentPage}/${totalPages}`;
    renderPager();
  }

  function itineraryCardHtml(itinerary: any): string {
    const items = itinerary.items || [];
    const itemsPreview = items.slice(0, 3).map((item: any) => {
      const itemName = item.tên || item.name || "Không xác định";
      const time = item.time || "";
      return `<div class="itinerary-item-preview">
        <span class="time">${time}</span>
        <span class="name">${itemName}</span>
      </div>`;
    }).join("");
    
    const rating = itinerary.rating || 0;
    const difficulty = itinerary.difficulty || "Trung bình";
    const bestFor = itinerary.bestFor || "Tất cả";

    return `
      <article class="tour-card" data-id="${itinerary.itinerary_id ?? itinerary._id}">
        <div class="tour-card__head">
          <h4>${itinerary.title}</h4>
          <span class="tour-card__rating">⭐ ${rating}/5</span>
        </div>
        <p class="tour-card__desc">${itinerary.description}</p>
        <div class="tour-card__meta">
          <span class="badge badge-difficulty">${difficulty}</span>
          <span class="badge badge-for">${bestFor}</span>
          <span class="badge badge-stops">📍 ${items.length} điểm</span>
        </div>
        <div class="tour-card__items">
          ${itemsPreview}
          ${items.length > 3 ? `<div class="itinerary-item-preview more">+${items.length - 3} điểm khác</div>` : ""}
        </div>
        <button class="btn btn-outline btn-sm" data-action="view-itinerary" data-id="${itinerary.itinerary_id ?? itinerary._id}">Xem chi tiết</button>
      </article>
    `;
  }

  async function loadFeaturedItineraries(): Promise<void> {
    try {
      tourSpotlightGrid.innerHTML = '<p class="tour-spotlight__loading">Đang tải lộ trình...</p>';
      allItineraries = await apiFetchFeaturedItineraries();
      
      if (!allItineraries || allItineraries.length === 0) {
        tourSpotlightGrid.innerHTML = '<p class="tour-spotlight__empty">Chưa có lộ trình nào</p>';
        itineraryPager.innerHTML = '';
        return;
      }

      totalItineraryPages = Math.max(1, Math.ceil(allItineraries.length / ITINERARY_PAGE_SIZE));
      renderItineraryPage(1);
    } catch (error) {
      console.error("Error loading featured itineraries:", error);
      tourSpotlightGrid.innerHTML = '<p class="tour-spotlight__error">Lỗi tải lộ trình</p>';
    }
  }

  function renderItineraryPage(page: number): void {
    if (allItineraries.length === 0) {
      tourSpotlightGrid.innerHTML = '<p class="tour-spotlight__empty">Chưa có lộ trình nào</p>';
      itineraryPager.innerHTML = '';
      return;
    }

    currentItineraryPage = Math.min(Math.max(page, 1), totalItineraryPages);
    const start = (currentItineraryPage - 1) * ITINERARY_PAGE_SIZE;
    const pageItems = allItineraries.slice(start, start + ITINERARY_PAGE_SIZE);

    tourSpotlightGrid.innerHTML = pageItems.map(itineraryCardHtml).join("");
    
    // Add click handlers
    tourSpotlightGrid.querySelectorAll<HTMLButtonElement>("button[data-action='view-itinerary']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.dataset.id;
        navigate(`/itinerary/${id}`);
      });
    });

    renderItineraryPager();
  }

  function renderItineraryPager(): void {
    if (allItineraries.length === 0) {
      itineraryPager.innerHTML = "";
      return;
    }

    const model = getPaginationModel(currentItineraryPage, totalItineraryPages);
    itineraryPager.innerHTML =
      `<button class="pager__btn" data-page="${Math.max(1, currentItineraryPage - 1)}" ${currentItineraryPage === 1 ? "disabled" : ""}>‹</button>` +
      model
        .map((item) => {
          if (item === "dots") {
            return `<span class="pager__dots">…</span>`;
          }

          return `<button class="pager__btn${item === currentItineraryPage ? " pager__btn--active" : ""}" data-page="${item}">${item}</button>`;
        })
        .join("") +
      `<button class="pager__btn" data-page="${Math.min(totalItineraryPages, currentItineraryPage + 1)}" ${currentItineraryPage === totalItineraryPages ? "disabled" : ""}>›</button>`;
  }

  async function loadItinerary(): Promise<void> {
    if (!getState().token) {
      savedFavorites = [];
      return;
    }

    try {
      savedFavorites = await apiGetFavoriteLocations();
      renderPage(currentPage);
    } catch {
      savedFavorites = [];
    }
  }

  async function loadUserPreferences(): Promise<void> {
    try {
      const prefs = await apiGetUserPreferences();
      userPreferences = {
        favoriteCategories: Array.isArray(prefs.favoriteCategories) ? (prefs.favoriteCategories as string[]) : [],
        budgetPerTrip: typeof prefs.budgetPerTrip === "number" ? prefs.budgetPerTrip : null,
        foodPreferences: typeof prefs.foodPreferences === "string" ? prefs.foodPreferences : "",
        tripStyle: typeof prefs.tripStyle === "string" ? prefs.tripStyle : ""
      };
    } catch (e) {
      userPreferences = null;
    }
  }

  async function loadRecommendations(): Promise<void> {
    if (!getState().token || !userPreferences) {
      allRecommendations = [];
      document.querySelector("#recommendations-section")?.setAttribute("hidden", "");
      return;
    }

    try {
      const recommendations = await apiGetLocationRecommendations(userPreferences);
      if (recommendations.length > 0) {
        allRecommendations = recommendations.slice(0, 6);
        const recGrid = document.querySelector<HTMLDivElement>("#recommendations-grid");
        if (recGrid) {
          const selectedIds = new Set(savedFavorites.map((item) => item.locationId ?? item.location?.id));
          const favoriteSet = new Set(favoriteIds);
          recGrid.innerHTML = allRecommendations
            .map((item) => cardHtml(item, selectedIds.has(item.id), favoriteSet.has(item.id)))
            .join("");
        }
        document.querySelector("#recommendations-section")?.removeAttribute("hidden");
      } else {
        document.querySelector("#recommendations-section")?.setAttribute("hidden", "");
      }
    } catch (error) {
      console.error("[Home] Failed to load recommendations:", error);
      document.querySelector("#recommendations-section")?.setAttribute("hidden", "");
    }
  }

  async function loadLocations(search = "", category = ""): Promise<void> {
    locsCount.textContent = "Đang tải…";
    try {
      const locs = await fetchLocations({ limit: 1000, search, category });
      allLocations = rankLocationsByPreferences(locs, userPreferences);
      totalPages = Math.max(1, Math.ceil(allLocations.length / PAGE_SIZE));
      renderPage(1);
      locsTitle.textContent =
        category
          ? (CATEGORIES.find((c) => c.code === category)?.label ?? "Địa điểm") + " nổi bật"
          : search
          ? `Kết quả tìm kiếm "${search}"`
          : "Địa điểm nổi bật";
    } catch {
      locsCount.textContent = "Lỗi tải dữ liệu";
      locsGrid.innerHTML = "";
      locsPager.innerHTML = "";
      locsEmpty.hidden = false;
    }
  }

  /* ---- initial load ---- */
  renderFeed();
  await loadUserPreferences();
  await loadRecommendations();
  await loadLocations();
  await loadItinerary();
  await loadFeaturedItineraries();

  /* ---- categories ---- */
  container.querySelector("#cat-strip")?.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".cat-pill");
    if (!btn) return;
    activeCategory = btn.dataset.cat ?? "";
    container.querySelectorAll(".cat-pill").forEach((b) => b.classList.remove("cat-pill--active"));
    btn.classList.add("cat-pill--active");
    await loadLocations(searchQ.value.trim(), activeCategory);
  });

  /* ---- search ---- */
  container.querySelector("#search-bar")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await loadLocations(searchQ.value.trim(), activeCategory);
  });

  /* ---- hero buttons ---- */
  container.querySelector("#hero-explore")?.addEventListener("click", () => {
    document.querySelector("#locations-section")?.scrollIntoView({ behavior: "smooth" });
  });
  container.querySelector("#hero-chat")?.addEventListener("click", () => {
    document.querySelector("#chat-section")?.scrollIntoView({ behavior: "smooth" });
  });

  if (options?.scrollToSection === "chat") {
    requestAnimationFrame(() => {
      document.querySelector("#chat-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } else if (options?.scrollToSection === "locations") {
    requestAnimationFrame(() => {
      document.querySelector("#locations-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ---- location card click ---- */
  locsGrid.addEventListener("click", (e) => {
    const favoriteButton = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action='toggle-favorite']");
    if (favoriteButton) {
      e.stopPropagation();
      const id = Number(favoriteButton.dataset.id);
      if (!Number.isFinite(id)) {
        return;
      }

      favoriteIds = toggleFavoriteLocationId(id);
      renderPage(currentPage);
      return;
    }

    const actionButton = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action='toggle-itinerary']");
    if (actionButton) {
      e.stopPropagation();
      const id = Number(actionButton.dataset.id);
      if (!Number.isFinite(id)) {
        return;
      }

      if (!getState().token) {
        chatMessages.push({ role: "assistant", content: "Vui lòng đăng nhập để lưu địa điểm vào hành trình." });
        renderFeed();
        return;
      }

      const exists = savedFavorites.some((item) => Number(item.locationId ?? item.location?.id) === id);
      const run = async () => {
        if (exists) {
          await apiRemoveFavoriteLocation(id);
        } else {
          const location = allLocations.find((item) => item.id === id);
          if (!location) {
            return;
          }
          await apiSaveFavoriteLocation(location);
        }
        savedFavorites = await apiGetFavoriteLocations();
        renderPage(currentPage);
      };

      void run();
      return;
    }

    const card = (e.target as HTMLElement).closest<HTMLElement>(".loc-card");
    if (card) navigate(`/location/${card.dataset.id}`);
  });

  recsGrid.addEventListener("click", (e) => {
    const favoriteButton = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action='toggle-favorite']");
    if (favoriteButton) {
      e.stopPropagation();
      const id = Number(favoriteButton.dataset.id);
      if (!Number.isFinite(id)) {
        return;
      }

      favoriteIds = toggleFavoriteLocationId(id);
      void loadRecommendations();
      return;
    }

    const actionButton = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action='toggle-itinerary']");
    if (actionButton) {
      e.stopPropagation();
      const id = Number(actionButton.dataset.id);
      if (!Number.isFinite(id)) {
        return;
      }

      if (!getState().token) {
        chatMessages.push({ role: "assistant", content: "Vui lòng đăng nhập để lưu địa điểm vào hành trình." });
        renderFeed();
        return;
      }

      const exists = savedFavorites.some((item) => Number(item.locationId ?? item.location?.id) === id);
      const run = async () => {
        if (exists) {
          await apiRemoveFavoriteLocation(id);
        } else {
          const location = allRecommendations.find((item) => item.id === id);
          if (!location) {
            return;
          }
          await apiSaveFavoriteLocation(location);
        }
        savedFavorites = await apiGetFavoriteLocations();
        await loadRecommendations();
      };

      void run();
      return;
    }

    const card = (e.target as HTMLElement).closest<HTMLElement>(".loc-card");
    if (card) navigate(`/location/${card.dataset.id}`);
  });

  locsPager.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-page]");
    if (!btn || btn.disabled) {
      return;
    }

    const page = Number(btn.dataset.page);
    if (!Number.isFinite(page)) {
      return;
    }

    renderPage(page);
    document.querySelector("#locations-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  itineraryPager.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-page]");
    if (!btn || btn.disabled) {
      return;
    }

    const page = Number(btn.dataset.page);
    if (!Number.isFinite(page)) {
      return;
    }

    renderItineraryPage(page);
    document.querySelector("#tour-spotlight")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---- chat ---- */
  container.querySelector("#chat-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatQ.value.trim();
    if (!text) return;
    chatMessages.push({ role: "user", content: text });
    chatQ.value = "";
    renderFeed();

    const btn = container.querySelector<HTMLButtonElement>("#chat-send");
    if (btn) { btn.disabled = true; btn.textContent = "Đang xử lý…"; }

    try {
      const res = await sendChatMessage(chatMessages);
      chatMessages.push({ role: "assistant", content: res.reply });
      renderFeed();
      if (res.suggestions.length > 0) {
        chatSuggestions.innerHTML =
          `<p class="suggestions-label">📌 Gợi ý liên quan:</p>` +
          res.suggestions
            .map(
              (s) =>
                `<div class="suggestion-chip" data-id="${s.id}">
                  <strong>${s.name}</strong>
                  <span>${s.categoryName} · ${s.address}</span>
                 </div>`
            )
            .join("");
        chatSuggestions.querySelectorAll<HTMLElement>(".suggestion-chip").forEach((chip) => {
          chip.addEventListener("click", () => navigate(`/location/${chip.dataset.id}`));
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định.";
      chatMessages.push({ role: "assistant", content: `Xin lỗi, có lỗi xảy ra: ${msg}` });
      renderFeed();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Gửi"; }
    }
  });

  /* ---- Enter to submit ---- */
  chatQ.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (container.querySelector<HTMLFormElement>("#chat-form"))?.requestSubmit();
    }
  });
}
