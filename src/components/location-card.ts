import type { LocationItem } from "../types";

function formatRatingLabel(location: LocationItem): string {
  return `Rating: ${location.rating > 0 ? location.rating.toFixed(1) : "0.0"}`;
}

export function renderLocationCard(location: LocationItem): string {
  const ratingText = location.rating > 0 ? `${location.rating.toFixed(1)} / 5` : "Chua co danh gia";
  const reviewsText = location.totalReviews > 0 ? `${location.totalReviews} danh gia` : "Moi cap nhat";
  const image = location.imageUrl ?? "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80";

  return `
    <article class="location-card">
      <div class="location-card__media">
        <img src="${image}" alt="${location.name}" loading="lazy" />
        <span class="location-card__badge">${location.categoryName}</span>
      </div>
      <div class="location-card__content">
        <div class="location-card__meta">
          <strong>${ratingText}</strong>
          <span>${reviewsText}</span>
        </div>
        <h3>${location.name}</h3>
        <p>${location.description ?? location.address}</p>
        <div class="location-card__footer">
          <span>${location.district ?? "Go Vap"}</span>
          <span>${formatRatingLabel(location)}</span>
        </div>
      </div>
    </article>
  `;
}