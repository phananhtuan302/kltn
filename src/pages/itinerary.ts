import {
  apiCreatePersonalItinerary,
  apiDeletePersonalItinerary,
  apiGetFavoriteLocations,
  apiGetItinerary,
  apiGetMyItineraries,
  apiRemoveItineraryItem
} from "../lib/api";
import { navigate } from "../lib/router";
import { getState, setFlashMessage } from "../lib/state";
import type { LocationItem } from "../types";

type DraftPlanItem = {
  locationId: number;
  locationName: string;
  startTime: string;
  endTime: string;
};

function shortenLabel(text: string, maxLength: number = 58): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function itineraryCard(item: LocationItem): string {
  const img =
    item.imageUrl ??
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80";

  return `
    <article class="loc-card" data-id="${item.id}">
      <div class="loc-card__img">
        <img src="${img}" alt="${item.name}" loading="lazy" />
        <span class="loc-card__cat">${item.categoryName}</span>
      </div>
      <div class="loc-card__body">
        <h3>${item.name}</h3>
        <p class="loc-card__addr">📍 ${item.address}</p>
        <div class="loc-card__foot">
          <button class="badge badge-itinerary badge-itinerary--selected" data-remove-id="${item.id}">Xóa khỏi hành trình</button>
          ${item.priceLabel ? `<span class="badge badge-price">${item.priceLabel}</span>` : ""}
        </div>
      </div>
    </article>
  `;
}

export async function renderItineraryPage(container: HTMLElement): Promise<void> {
  if (!getState().token) {
    setFlashMessage("Vui lòng đăng nhập để xem Hành trình cá nhân.");
    navigate("/");
    return;
  }

  container.innerHTML = `
    <section class="section">
      <div class="shell">
        <button class="btn btn-outline" id="itinerary-create-toggle">Tạo hành trình</button>

        <div id="itinerary-modal" class="modal-overlay" aria-hidden="true">
          <div class="modal modal--wide">
            <div class="modal__header">
              <h3>Tạo hành trình</h3>
              <button class="modal__close" id="it-modal-close">✕</button>
            </div>
            <div class="modal__body it-plan-grid">
              <div class="it-plan-form">
                <label>Tên hành trình
                  <input type="text" id="it-title" placeholder="Ví dụ: Ngày cuối tuần thư giãn" />
                </label>
                <label>Thời gian bắt đầu <input type="time" id="it-start" /></label>
                <label>Thời gian kết thúc <input type="time" id="it-end" /></label>
                <label>Chọn địa điểm yêu thích
                  <select id="it-location-select"><option value="">Đang tải…</option></select>
                </label>
                <div class="it-plan-form__actions">
                  <button class="btn btn-primary" id="it-add-btn">Thêm vào sắp xếp</button>
                </div>
                <p class="it-plan-error" id="it-plan-error" hidden></p>
              </div>

              <div class="it-plan-preview">
                <div class="it-plan-preview__head">
                  <h4>Sắp xếp hành trình</h4>
                  <small id="it-plan-count">0 mục</small>
                </div>
                <div id="it-plan-list" class="it-plan-list"></div>
                <p class="it-plan-empty" id="it-plan-empty">Chưa có khung giờ nào.</p>
              </div>
            </div>
            <div class="modal__footer">
              <button class="btn btn-primary" id="it-save-btn">Lưu hành trình cá nhân</button>
              <button class="btn" id="it-cancel-btn">Hủy</button>
            </div>
          </div>
        </div>
        <div class="section-head">
          <h1 class="section__title">Địa điểm yêu thích của bạn</h1>
          <span class="section-count" id="itinerary-count">Đang tải…</span>
        </div>
        <div class="locs-grid" id="itinerary-grid"></div>
        <p class="empty" id="itinerary-empty" hidden>Bạn chưa lưu địa điểm nào.</p>

        <div class="section-head itinerary-mine-head">
          <h2 class="section__title">Hành trình của bạn</h2>
          <span class="section-count" id="my-itinerary-count">Đang tải…</span>
        </div>
        <div class="locs-grid" id="my-itinerary-grid"></div>
        <p class="empty" id="my-itinerary-empty" hidden>Bạn chưa lưu hành trình cá nhân nào.</p>
      </div>
    </section>
  `;

  const grid = container.querySelector<HTMLDivElement>("#itinerary-grid")!;
  const empty = container.querySelector<HTMLParagraphElement>("#itinerary-empty")!;
  const count = container.querySelector<HTMLSpanElement>("#itinerary-count")!;
  const myGrid = container.querySelector<HTMLDivElement>("#my-itinerary-grid")!;
  const myEmpty = container.querySelector<HTMLParagraphElement>("#my-itinerary-empty")!;
  const myCount = container.querySelector<HTMLSpanElement>("#my-itinerary-count")!;
  let favoriteRows: Array<{ locationId: number; location: LocationItem }> = [];
  let draftItems: DraftPlanItem[] = [];

  const planError = container.querySelector<HTMLParagraphElement>("#it-plan-error")!;

  function showPlanError(message: string): void {
    planError.textContent = message;
    planError.hidden = false;
  }

  function clearPlanError(): void {
    planError.textContent = "";
    planError.hidden = true;
  }

  function toMinutes(time: string): number {
    const [h, m] = time.split(":").map((v) => Number(v));
    return h * 60 + m;
  }

  function hasOverlap(item: DraftPlanItem): boolean {
    const start = toMinutes(item.startTime);
    const end = toMinutes(item.endTime);
    return draftItems.some((existing) => {
      const eStart = toMinutes(existing.startTime);
      const eEnd = toMinutes(existing.endTime);
      return start < eEnd && end > eStart;
    });
  }

  function renderDraftPlan(): void {
    const list = container.querySelector<HTMLDivElement>("#it-plan-list")!;
    const emptyPlan = container.querySelector<HTMLParagraphElement>("#it-plan-empty")!;
    const planCount = container.querySelector<HTMLElement>("#it-plan-count")!;

    draftItems.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    planCount.textContent = `${draftItems.length} mục`;
    emptyPlan.hidden = draftItems.length > 0;

    list.innerHTML = draftItems
      .map(
        (item, idx) => `
        <div class="it-plan-row">
          <span class="it-plan-row__time">${item.startTime} -> ${item.endTime}</span>
          <span class="it-plan-row__name">${item.locationName}</span>
          <button class="btn btn-sm" data-remove-plan="${idx}">Xóa</button>
        </div>
      `
      )
      .join("");
  }

  function myItineraryCard(it: any): string {
    const currentUsername = getState().user?.username ?? "";
    const canDelete = !!currentUsername && it.tenNguoiDung === currentUsername;
    const owner = it.tenNguoiDung ? `👤 ${it.tenNguoiDung}` : "👤 Không rõ";
    const stops = Array.isArray(it.items) ? it.items.slice(0, 3) : [];
    return `
      <article class="tour-card" data-itinerary-id="${it.itinerary_id ?? it._id}" data-owner="${it.tenNguoiDung ?? ""}">
        <div class="tour-card__head">
          <h4>${it.title ?? "Hành trình cá nhân"}</h4>
          <span class="tour-card__rating">${owner}</span>
        </div>
        <p class="tour-card__desc">${it.description ?? "Lộ trình do bạn tự tạo."}</p>
        <div class="tour-card__items">
          ${stops
            .map((s: any) => `<div class="itinerary-item-preview"><span class="time">${s.startTime ?? "--:--"} - ${s.endTime ?? "--:--"}</span><span class="name">${s.name ?? "Địa điểm"}</span></div>`)
            .join("")}
        </div>
        <div class="tour-card__actions">
          <button class="btn btn-outline btn-sm" data-open-itinerary="${it.itinerary_id ?? it._id}">Xem chi tiết</button>
          ${canDelete ? `<button class="btn btn-danger btn-sm" data-delete-itinerary="${it.itinerary_id ?? it._id}">Xóa</button>` : ""}
        </div>
      </article>
    `;
  }

  async function load(): Promise<void> {
    const items = await apiGetItinerary();
    grid.innerHTML = items.map(itineraryCard).join("");
    empty.hidden = items.length > 0;
    count.textContent = `${items.length} địa điểm`;
  }

  async function loadMyItineraries(): Promise<void> {
    const data = await apiGetMyItineraries();
    myGrid.innerHTML = data.map(myItineraryCard).join("");
    myEmpty.hidden = data.length > 0;
    myCount.textContent = `${data.length} hành trình`;
  }

  async function loadFavoriteOptions(): Promise<void> {
    const select = container.querySelector<HTMLSelectElement>("#it-location-select")!;
    try {
      const favs = await apiGetFavoriteLocations();
      favoriteRows = favs.map((f) => ({ locationId: f.locationId, location: f.location }));
      if (favs.length === 0) {
        select.innerHTML = '<option value="">(Không có địa điểm yêu thích)</option>';
      } else {
        select.innerHTML = favs
          .map((f) => {
            const rawLabel = f.location.address
              ? `${f.location.name} — ${f.location.address}`
              : f.location.name;
            const shortLabel = shortenLabel(rawLabel);
            return `<option value="${f.locationId}" title="${rawLabel}">${shortLabel}</option>`;
          })
          .join("");
      }
    } catch {
      favoriteRows = [];
      select.innerHTML = '<option value="">(Không tải được địa điểm yêu thích)</option>';
    }
  }

  try {
    await load();
  } catch {
    count.textContent = "Không thể tải hành trình";
  }

  try {
    await loadMyItineraries();
  } catch {
    myCount.textContent = "Không thể tải hành trình của bạn";
  }

  await loadFavoriteOptions();

  grid.addEventListener("click", (e) => {
    const removeBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-remove-id]");
    if (removeBtn) {
      e.stopPropagation();
      const id = Number(removeBtn.dataset.removeId);
      if (!Number.isFinite(id)) {
        return;
      }

      void (async () => {
        await apiRemoveItineraryItem(id);
        await load();
      })();
      return;
    }

    const card = (e.target as HTMLElement).closest<HTMLElement>(".loc-card");
    if (card) {
      navigate(`/location/${card.dataset.id}`);
    }
  });

  // Modal handlers
  const toggle = container.querySelector<HTMLButtonElement>("#itinerary-create-toggle")!;
  const modal = container.querySelector<HTMLDivElement>("#itinerary-modal")! as HTMLDivElement;
  const addBtn = container.querySelector<HTMLButtonElement>("#it-add-btn")!;
  const cancelBtn = container.querySelector<HTMLButtonElement>("#it-cancel-btn")!;
  const modalClose = container.querySelector<HTMLButtonElement>("#it-modal-close")!;

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    clearPlanError();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  toggle.addEventListener("click", () => openModal());
  toggle.addEventListener("click", () => {
    void loadFavoriteOptions();
  });

  cancelBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    closeModal();
  });

  modalClose.addEventListener("click", () => closeModal());

  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) {
      closeModal();
    }
  });

  container.querySelector<HTMLDivElement>("#it-plan-list")?.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-remove-plan]");
    if (!btn) return;
    const idx = Number(btn.dataset.removePlan);
    if (!Number.isFinite(idx)) return;
    draftItems.splice(idx, 1);
    renderDraftPlan();
  });

  addBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    clearPlanError();
    const select = container.querySelector<HTMLSelectElement>("#it-location-select")!;
    const start = (container.querySelector<HTMLInputElement>("#it-start")!).value;
    const end = (container.querySelector<HTMLInputElement>("#it-end")!).value;
    const locId = Number(select.value);
    if (!Number.isFinite(locId) || locId <= 0) {
      showPlanError("Vui lòng chọn một địa điểm hợp lệ.");
      setFlashMessage("Vui lòng chọn một địa điểm hợp lệ.");
      return;
    }
    if (!start || !end) {
      showPlanError("Vui lòng chọn đầy đủ giờ bắt đầu và kết thúc.");
      setFlashMessage("Vui lòng chọn đầy đủ giờ bắt đầu và kết thúc.");
      return;
    }
    if (toMinutes(start) >= toMinutes(end)) {
      showPlanError("Khung giờ không hợp lệ: giờ kết thúc phải muộn hơn giờ bắt đầu.");
      setFlashMessage("Khung giờ không hợp lệ.");
      return;
    }

    const selected = favoriteRows.find((f) => Number(f.locationId) === locId);
    if (!selected) {
      showPlanError("Địa điểm không nằm trong danh sách yêu thích.");
      setFlashMessage("Địa điểm không nằm trong danh sách yêu thích.");
      return;
    }

    const nextItem: DraftPlanItem = {
      locationId: locId,
      locationName: selected.location.name,
      startTime: start,
      endTime: end
    };

    if (hasOverlap(nextItem)) {
      showPlanError(`Trùng giờ: ${start} -> ${end} đang chồng với khung giờ đã có trong danh sách.`);
      setFlashMessage("Không thể thêm vì trùng giờ.");
      return;
    }

    draftItems.push(nextItem);
    renderDraftPlan();
    clearPlanError();
    (container.querySelector<HTMLInputElement>("#it-start")!).value = "";
    (container.querySelector<HTMLInputElement>("#it-end")!).value = "";
  });

  const saveBtn = container.querySelector<HTMLButtonElement>("#it-save-btn")!;
  saveBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    clearPlanError();
    if (draftItems.length === 0) {
      showPlanError("Bạn chưa thêm khung giờ nào để lưu hành trình.");
      setFlashMessage("Bạn chưa thêm khung giờ nào.");
      return;
    }

    try {
      const title = (container.querySelector<HTMLInputElement>("#it-title")!).value.trim();
      await apiCreatePersonalItinerary({
        title: title || undefined,
        items: draftItems.map((item) => ({
          locationId: item.locationId,
          startTime: item.startTime,
          endTime: item.endTime
        }))
      });

      await loadMyItineraries();
      draftItems = [];
      renderDraftPlan();
      (container.querySelector<HTMLInputElement>("#it-title")!).value = "";
      clearPlanError();
      closeModal();
      setFlashMessage("Đã lưu hành trình cá nhân.");
    } catch (err) {
      showPlanError((err as Error).message || "Lưu hành trình không thành công.");
      setFlashMessage((err as Error).message || "Lưu hành trình không thành công.");
    }
  });

  myGrid.addEventListener("click", (e) => {
    const openBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-open-itinerary]");
    if (!openBtn) return;
    const id = openBtn.dataset.openItinerary;
    if (!id) return;
    navigate(`/itinerary/${id}`);
  });

  myGrid.addEventListener("click", (e) => {
    const deleteBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-delete-itinerary]");
    if (!deleteBtn) return;
    const id = deleteBtn.dataset.deleteItinerary;
    if (!id) return;

    const currentUsername = getState().user?.username ?? "";
    const itineraryOwner = deleteBtn.closest<HTMLElement>(".tour-card")?.dataset.owner ?? "";
    if (!currentUsername || itineraryOwner !== currentUsername) {
      setFlashMessage("Bạn chỉ có thể xóa lộ trình do chính mình tạo.");
      return;
    }

    void (async () => {
      await apiDeletePersonalItinerary(id);
      await loadMyItineraries();
      setFlashMessage("Đã xóa hành trình cá nhân.");
    })();
  });
}
