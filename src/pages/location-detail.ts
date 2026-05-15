import { apiAddItineraryItem, apiRemoveItineraryItem, fetchLocationById } from "../lib/api";
import { navigate } from "../lib/router";
import { getFavoriteLocationIds, getState, toggleFavoriteLocationId } from "../lib/state";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function starsHtml(rating: number): string {
  const full = Math.round(rating);
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="${i < full ? "star star--on" : "star"}">★</span>`
  ).join("");
}

export async function renderLocationDetailPage(container: HTMLElement): Promise<void> {
  const match = location.pathname.match(/^\/location\/(\d+)/);
  const locationId = match ? Number(match[1]) : NaN;

  if (!Number.isFinite(locationId)) {
    navigate("/");
    return;
  }

  container.innerHTML = `
    <section class="section">
      <div class="shell" id="location-detail-root">
        <p class="section-count">Đang tải chi tiết địa điểm…</p>
      </div>
    </section>
  `;

  const root = container.querySelector<HTMLDivElement>("#location-detail-root")!;

  try {
    const item = await fetchLocationById(locationId);
    const isFavorite = getFavoriteLocationIds().includes(item.id);
    const lat = Number(item.latitude);
    const lon = Number(item.longitude);
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);
    const directionsUrl = hasCoordinates
      ? `https://www.google.com/maps/dir//${lat},${lon}`
      : null;

    root.innerHTML = `
      <div class="detail-head">
        <button class="btn btn-outline" id="detail-back">← Quay lại</button>
      </div>
      <article class="detail-card">
        <div class="detail-media">
          <img src="${item.imageUrl ?? "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80"}" alt="${item.name}" />
        </div>
        <div class="detail-body">
          <span class="detail-cat">${item.categoryName}</span>
          <h1>${item.name}</h1>
          <p class="detail-address">📍 ${item.address}</p>
          <div id="map" style="height: 320px; margin: 12px 0; border-radius:8px; overflow:hidden"></div>
          <div class="detail-rating">${starsHtml(item.rating)} <small>${item.rating.toFixed(1)} (${item.totalReviews} đánh giá)</small></div>
          <p class="detail-desc">${item.description ?? "Chưa có mô tả chi tiết."}</p>
          <div class="detail-actions">
            <button class="btn btn-outline" id="detail-favorite">${isFavorite ? "♥ Bỏ yêu thích" : "♡ Yêu thích"}</button>
            <button class="btn btn-primary" id="detail-itinerary">+ Thêm vào hành trình</button>
            ${directionsUrl ? `<a class="btn btn-primary" href="${directionsUrl}" target="_blank" rel="noreferrer">🧭 Chỉ đường</a>` : ""}
            ${item.phone ? `<a class="btn btn-outline" href="tel:${item.phone}">📞 Gọi</a>` : ""}
            ${item.website ? `<a class="btn btn-outline" href="${item.website}" target="_blank" rel="noreferrer">🌐 Website</a>` : ""}
          </div>
        </div>
      </article>
    `;

    root.querySelector("#detail-back")?.addEventListener("click", () => navigate("/"));

    const favoriteBtn = root.querySelector<HTMLButtonElement>("#detail-favorite");
    favoriteBtn?.addEventListener("click", () => {
      const ids = toggleFavoriteLocationId(item.id);
      favoriteBtn.textContent = ids.includes(item.id) ? "♥ Bỏ yêu thích" : "♡ Yêu thích";
    });

    // Initialize Leaflet map if coordinates are available
    try {
      if (hasCoordinates) {
        // Fix default marker icon paths (use CDN images)
        L.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
        });

        const map = L.map(root.querySelector('#map') as HTMLElement).setView([lat, lon], 15);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        L.marker([lat, lon]).addTo(map)
          .bindPopup(`${item.name}<br>${item.address}`);
      } else {
        // hide map container if no coords
        const mapEl = root.querySelector('#map') as HTMLElement | null;
        if (mapEl) mapEl.style.display = 'none';
      }
    } catch (e) {
      // ignore map errors
      const mapEl = root.querySelector('#map') as HTMLElement | null;
      if (mapEl) mapEl.style.display = 'none';
    }

    root.querySelector("#detail-itinerary")?.addEventListener("click", () => {
      if (!getState().token) {
        alert("Vui lòng đăng nhập để thêm vào hành trình.");
        return;
      }

      void (async () => {
        const itinerary = await apiAddItineraryItem(item.id);
        const exists = itinerary.some((it) => it.id === item.id);
        if (exists) {
          alert("Đã thêm vào hành trình.");
          return;
        }

        await apiRemoveItineraryItem(item.id);
        alert("Đã xóa khỏi hành trình.");
      })();
    });
  } catch {
    root.innerHTML = `
      <p class="empty">Không tìm thấy địa điểm này.</p>
      <button class="btn btn-outline" id="detail-back-home">Về trang chủ</button>
    `;
    root.querySelector("#detail-back-home")?.addEventListener("click", () => navigate("/"));
  }
}
