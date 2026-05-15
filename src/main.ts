import "./styles.css";

import { renderNavbar } from "./components/navbar";
import { route, startRouter } from "./lib/router";
import { loadStoredUser } from "./lib/state";
import { renderHomePage } from "./pages/home";
import { renderLoginPage } from "./pages/login";
import { renderRegisterPage } from "./pages/register";
import { renderNotFoundPage } from "./pages/not-found";
import { renderItineraryPage } from "./pages/itinerary";
import { renderItineraryDetailPage } from "./pages/itinerary-detail";
import { renderLocationDetailPage } from "./pages/location-detail";
import { renderAboutPage } from "./pages/about";
import { renderUserQuestionsPage } from "./pages/user-questions";
import { renderChangePasswordPage } from "./pages/change-password";
import { renderUserPreferencesPage } from "./pages/user-preferences";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("No #app element found.");

// Initialize auth state (in-memory only)
loadStoredUser();

// Render persistent navbar
renderNavbar();

// Register SPA routes
route("/", () => {
  void renderHomePage(app);
});

route("/login", () => {
  renderLoginPage(app);
});

route("/register", () => {
  renderRegisterPage(app);
});

route("/explore", () => {
  void renderHomePage(app);
});

route("/chat", () => {
  void renderHomePage(app, { scrollToSection: "chat" });
});

route("/itinerary", () => {
  void renderItineraryPage(app);
});

route("/itinerary/", () => {
  void renderItineraryDetailPage(app);
});

route("/about", () => {
  renderAboutPage(app);
});

route("/user-questions", () => {
  renderUserQuestionsPage(app);
});

route("/change-password", () => {
  renderChangePasswordPage(app);
});

route("/user-preferences", () => {
  renderUserPreferencesPage(app);
});

route("/location/", () => {
  void renderLocationDetailPage(app);
});

route("/404", () => {
  void renderNotFoundPage(app);
});

// Start the router (reads location.pathname and dispatches)
startRouter();
