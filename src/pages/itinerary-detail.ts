import { apiFetchFeaturedItineraryById } from "../lib/api";
import { navigate } from "../lib/router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type ItineraryItem = Record<string, any>;

function getItemName(item: ItineraryItem): string {
  return item.tên || item.name || item.title || "Địa điểm";
}

function getItemAddress(item: ItineraryItem): string {
  return item.địa_chỉ || item.address || item.địa_chi || "";
}

function getItemImage(item: ItineraryItem): string {
  return item.serpapi_thumbnail
    || item.hình_thu_nhỏ
    || item.imageUrl
    || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80";
}

function getItemRating(item: ItineraryItem): string {
  const rating = Number(item.xếp_hạng ?? item.rating ?? 0);
  return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "Chưa có";
}

function getItemLatitude(item: ItineraryItem): number | null {
  const latitude = Number(item.latitude ?? item.lat ?? item.vĩ_độ ?? item.vi_do ?? item.latitudeValue);
  return Number.isFinite(latitude) ? latitude : null;
}

function getItemLongitude(item: ItineraryItem): number | null {
  const longitude = Number(item.longitude ?? item.lng ?? item.lon ?? item.kinh_độ ?? item.kinh_do ?? item.longitudeValue);
  return Number.isFinite(longitude) ? longitude : null;
}

function getItemCoordinates(item: ItineraryItem): { lat: number; lng: number } | null {
  const lat = getItemLatitude(item);
  const lng = getItemLongitude(item);
  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
}

function getMapPoints(items: ItineraryItem[]): Array<{ item: ItineraryItem; index: number; lat: number; lng: number }> {
  return items
    .map((item, index) => {
      const coords = getItemCoordinates(item);
      if (!coords) {
        return null;
      }

      return { item, index, ...coords };
    })
    .filter((point): point is { item: ItineraryItem; index: number; lat: number; lng: number } => point !== null);
}

function getMapSummary(points: Array<{ item: ItineraryItem; index: number; lat: number; lng: number }>): string {
  if (!points.length) {
    return "Chưa có tọa độ để hiển thị bản đồ.";
  }

  if (points.length === 1) {
    return "Chỉ có 1 điểm có tọa độ, bản đồ sẽ tập trung vào điểm đó.";
  }

  return `Đã xác định ${points.length} điểm có tọa độ.`;
}

function createNumberedMarker(index: number): L.DivIcon {
  return L.divIcon({
    className: "itinerary-map-marker",
    html: `<span>${index + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

function renderStopCard(item: ItineraryItem, index: number): string {
  const name = getItemName(item);
  const address = getItemAddress(item);
  const image = getItemImage(item);
  const rating = getItemRating(item);
  const phone = item.điện_thoại || item.phone;
  const website = item.trang_web || item.website;
  const opening = item.Gio_mo_cua_hang_ngay || item.openingHours || item.hours || "";
  const category = item.danh_muc || item.categoryName || item.categoryCode || "Điểm dừng";
  const notes = item.mô_tả || item.description || "";
  const time = item.time || item.estimatedTime || `Điểm ${index + 1}`;
  const coordinates = getItemCoordinates(item);

  return `
    <article class="itinerary-stop-card">
      <div class="itinerary-stop-card__media">
        <img src="${image}" alt="${name}" loading="lazy" />
        <span class="itinerary-stop-card__time">${time}</span>
      </div>
      <div class="itinerary-stop-card__body">
        <div class="itinerary-stop-card__top">
          <span class="itinerary-stop-card__index">${index + 1}</span>
          <span class="itinerary-stop-card__category">${category}</span>
        </div>
        <h3>${name}</h3>
        <p class="itinerary-stop-card__address">📍 ${address}</p>
        <div class="itinerary-stop-card__meta">
          <span>⭐ ${rating}</span>
          ${opening ? `<span>🕒 ${opening}</span>` : ""}
          ${coordinates ? `<span>🧭 ${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}</span>` : ""}
        </div>
        ${notes ? `<p class="itinerary-stop-card__desc">${notes}</p>` : ""}
        <div class="itinerary-stop-card__actions">
          ${phone ? `<a class="btn btn-outline btn-sm" href="tel:${phone}">📞 Gọi</a>` : ""}
          ${website ? `<a class="btn btn-primary btn-sm" href="${website}" target="_blank" rel="noreferrer">🌐 Website</a>` : ""}
        </div>
      </div>
    </article>
  `;
}

export async function renderItineraryDetailPage(container: HTMLElement): Promise<void> {
  const match = location.pathname.match(/^\/itinerary\/([^/?#]+)/);
  const itineraryId = match ? decodeURIComponent(match[1]) : "";

  if (!itineraryId) {
    navigate("/");
    return;
  }

  container.innerHTML = `
    <section class="section itinerary-detail-page">
      <div class="shell" id="itinerary-detail-root">
        <div class="itinerary-detail-skeleton">
          <p class="section-count">Đang tải lộ trình chi tiết…</p>
        </div>
      </div>
    </section>
  `;

  const root = container.querySelector<HTMLDivElement>("#itinerary-detail-root")!;

  try {
    const itinerary = await apiFetchFeaturedItineraryById(itineraryId);
    const items: ItineraryItem[] = Array.isArray(itinerary.items) ? itinerary.items : [];
    const mapPoints = getMapPoints(items);

    root.innerHTML = `
      <div class="itinerary-detail-hero">
        <button class="btn btn-outline itinerary-detail-back" id="itinerary-detail-back">← Quay lại</button>
        <div class="itinerary-detail-hero__content">
          <div class="itinerary-detail-hero__copy">
            <span class="itinerary-detail-kicker">Lộ trình đề xuất</span>
            <h1>${itinerary.title}</h1>
            <p>${itinerary.description || "Lộ trình 1 ngày được sắp xếp từ dữ liệu MongoDB."}</p>
            <div class="itinerary-detail-tags">
              ${itinerary.tenNguoiDung ? `<span class="badge badge-owner">👤 ${itinerary.tenNguoiDung}</span>` : ""}
              <span class="badge badge-difficulty">${itinerary.difficulty || "Trung bình"}</span>
              <span class="badge badge-for">${itinerary.bestFor || "Tất cả"}</span>
              <span class="badge badge-stops">📍 ${items.length} điểm dừng</span>
              ${itinerary.rating ? `<span class="badge badge-rating">⭐ ${itinerary.rating}/5</span>` : ""}
            </div>
          </div>
          <div class="itinerary-detail-hero__panel">
            <div class="hero-panel-stat">
              <span class="hero-panel-stat__num">${items.length}</span>
              <span class="hero-panel-stat__label">điểm trong lịch trình</span>
            </div>
            <div class="hero-panel-stat">
              <span class="hero-panel-stat__num">${itinerary.totalDuration || "1 ngày"}</span>
              <span class="hero-panel-stat__label">thời lượng dự kiến</span>
            </div>
          </div>
        </div>
      </div>

      <div class="itinerary-detail-grid">
        <div class="itinerary-detail-main">
          <div class="itinerary-detail-section-head">
            <h2>Các điểm dừng trong ngày</h2>
            <p>Sắp xếp theo buổi sáng, trưa, chiều và tối để đi thực tế dễ hơn.</p>
          </div>
          <div class="itinerary-stop-list">
            ${items.map((item, index) => renderStopCard(item, index)).join("")}
          </div>
        </div>

        <aside class="itinerary-detail-side">
          <div class="itinerary-map-card">
            <div class="itinerary-map-card__head">
              <span class="itinerary-note-card__label">Bản đồ lộ trình</span>
              <h3>Các điểm trên bản đồ</h3>
              <p>${getMapSummary(mapPoints)}</p>
            </div>
            <div class="itinerary-map-card__map" id="itinerary-map"></div>
            <div class="itinerary-map-card__meta">
              <div class="itinerary-map-card__stat">
                <strong>${mapPoints.length}</strong>
                <span>điểm có tọa độ</span>
              </div>
              <div class="itinerary-map-card__stat">
                <strong>${items.length}</strong>
                <span>tổng điểm trong lộ trình</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    `;

    const mapEl = root.querySelector<HTMLDivElement>("#itinerary-map");
    if (mapEl && mapPoints.length > 0) {
      try {
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
        });

        const map = L.map(mapEl, {
          scrollWheelZoom: false
        });

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        const bounds = L.latLngBounds([]);

        mapPoints.forEach((point) => {
          const name = getItemName(point.item);
          const address = getItemAddress(point.item);
          const marker = L.marker([point.lat, point.lng], { icon: createNumberedMarker(point.index) }).addTo(map);
          marker.bindPopup(`<strong>${point.index + 1}. ${name}</strong><br>${address || "Không có địa chỉ"}`);
          bounds.extend([point.lat, point.lng]);
        });

        if (mapPoints.length === 1) {
          map.setView([mapPoints[0].lat, mapPoints[0].lng], 15);
        } else {
          map.fitBounds(bounds.pad(0.18));
          const routeLine = mapPoints.map((point) => [point.lat, point.lng] as [number, number]);
          L.polyline(routeLine, {
            color: "#0194f3",
            weight: 4,
            opacity: 0.9
          }).addTo(map);
        }

        setTimeout(() => map.invalidateSize(), 0);
      } catch (error) {
        console.error("Failed to initialize itinerary map:", error);
        mapEl.innerHTML = '<div class="itinerary-map-empty">Không thể hiển thị bản đồ. Dữ liệu tọa độ có thể chưa đầy đủ.</div>';
      }
    } else if (mapEl) {
      mapEl.innerHTML = '<div class="itinerary-map-empty">Chưa có điểm nào có kinh độ/vĩ độ để hiển thị trên bản đồ.</div>';
    }

    root.querySelector<HTMLButtonElement>("#itinerary-detail-back")?.addEventListener("click", () => {
      navigate("/");
    });
  } catch {
    root.innerHTML = `
      <div class="empty empty--detail">
        <h2>Không tìm thấy lộ trình này</h2>
        <p>Dữ liệu có thể đã bị xóa hoặc id không hợp lệ.</p>
        <button class="btn btn-primary" id="itinerary-detail-home">Về trang chủ</button>
      </div>
    `;

    root.querySelector<HTMLButtonElement>("#itinerary-detail-home")?.addEventListener("click", () => {
      navigate("/");
    });
  }
}