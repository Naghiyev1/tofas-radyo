const API_BASE = "https://de1.api.radio-browser.info/json";

const stationsGrid = document.getElementById("stationsGrid");
const statusText = document.getElementById("statusText");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const audioPlayer = document.getElementById("audioPlayer");
const currentStation = document.getElementById("currentStation");
const currentMeta = document.getElementById("currentMeta");
const stationCount = document.getElementById("stationCount");
const favoriteCount = document.getElementById("favoriteCount");
const playerFavoriteButton = document.getElementById("playerFavoriteButton");
const powerButton = document.getElementById("powerButton");
const themeToggle = document.getElementById("themeToggle");
const needle = document.getElementById("needle");
const presets = Array.from(document.querySelectorAll(".preset"));

let stations = [];
let activeFilter = "";
let currentPlayingStation = null;
let favoriteStations = JSON.parse(localStorage.getItem("tofasRadyoFavorites") || "[]");
let recentlyPlayedStations = JSON.parse(localStorage.getItem("tofasRadyoRecent") || "[]");
let favorites = favoriteStations.map(station => station.stationuuid);
let lightsMode = localStorage.getItem("tofasRadyoLights") || "off";

function updateFavoriteCount() {
  favoriteCount.textContent = favorites.length;
}

async function fetchStations() {
  if (activeFilter === "__favorites") {
    renderFavoriteStations();
    return;
  }

  if (activeFilter === "__recent") {
    renderRecentlyPlayedStations();
    return;
  }

  statusText.textContent = "Türkiye radyoları yükleniyor...";
  stationsGrid.innerHTML = "";
  stationCount.textContent = "0";

  const searchTerm = searchInput.value.trim();

  const params = new URLSearchParams({
    countrycode: "TR",
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
    limit: "90"
  });

  if (searchTerm) {
    params.set("name", searchTerm);
  }

  if (activeFilter) {
    params.set("tag", activeFilter);
  }

  const url = `${API_BASE}/stations/search?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Radio API request failed.");
    }

    const data = await response.json();

    stations = data
      .filter(station => station.lastcheckok === 1)
      .filter(station => station.url_resolved || station.url)
      .filter(removeDuplicatesByUrl)
      .slice(0, 70);

    renderStations(stations);

    stationCount.textContent = stations.length;
    statusText.textContent = stations.length
      ? `${stations.length} radyo bulundu`
      : "Radyo bulunamadı. Başka bir arama dene.";
  } catch (error) {
    console.error(error);
    statusText.textContent = "Radyolar yüklenemedi. Biraz sonra tekrar dene.";
    stationsGrid.innerHTML = `<div class="empty-state">Radyolar yüklenirken bir sorun oluştu.</div>`;
  }
}

function removeDuplicatesByUrl(station, index, array) {
  const currentUrl = station.url_resolved || station.url;
  return array.findIndex(item => (item.url_resolved || item.url) === currentUrl) === index;
}

function renderStations(stationsToRender) {
  stationsGrid.innerHTML = "";

  if (!stationsToRender.length) {
    stationsGrid.innerHTML = `<div class="empty-state">Gösterilecek radyo yok.</div>`;
    return;
  }

  stationsToRender.forEach(station => {
    const card = document.createElement("article");
    card.className = "station-card";

    const streamUrl = station.url_resolved || station.url;
    const isFavorite = favorites.includes(station.stationuuid);
    const initials = getInitials(station.name);
    const tags = station.tags ? shortenTags(station.tags) : "Etiket yok";

    card.innerHTML = `
      <div class="station-top">
        <div class="station-logo-wrap">
          ${station.favicon ? `<img class="station-logo" src="${escapeHTML(station.favicon)}" alt="" loading="lazy" />` : initials}
        </div>
        <div>
          <div class="station-name">${escapeHTML(station.name)}</div>
          <div class="station-country">${escapeHTML(station.country || "Türkiye")}</div>
        </div>
      </div>

      <div class="station-tags">${escapeHTML(tags)}</div>

      <div class="station-actions">
        <button type="button" class="play-button">DİNLE</button>
        <button type="button" class="favorite-button ${isFavorite ? "active" : ""}" aria-label="Favorilere ekle">★</button>
      </div>
    `;

    const logo = card.querySelector(".station-logo");

    if (logo) {
      logo.addEventListener("error", () => {
        logo.parentElement.textContent = initials;
      });
    }

    card.querySelector(".play-button").addEventListener("click", () => {
      playStation(station, streamUrl);
    });

    card.querySelector(".favorite-button").addEventListener("click", event => {
      toggleFavorite(station.stationuuid);
      event.currentTarget.classList.toggle("active");
    });

    stationsGrid.appendChild(card);
  });
}

function playStation(station, streamUrl) {
  statusText.textContent = `${station.name} ayarlanıyor...`;
  audioPlayer.src = streamUrl;

  audioPlayer.play()
    .then(() => {
      currentPlayingStation = station;
      updateRadioDisplay(station);
      saveRecentlyPlayed(station);
      statusText.textContent = `Çalıyor: ${station.name}`;

      if (activeFilter === "__recent") {
        renderRecentlyPlayedStations();
      }
    })
    .catch(error => {
      console.error(error);
      statusText.textContent = "Bu radyo tarayıcıda çalmadı. Başka bir radyo dene.";
    });
}

function updateRadioDisplay(station) {
  currentStation.textContent = station.name;
  currentMeta.textContent = `${station.country || "Türkiye"}${station.codec ? " · " + station.codec.toUpperCase() : ""}${station.bitrate ? " · " + station.bitrate + " kbps" : ""}`;

  playerFavoriteButton.disabled = false;
  playerFavoriteButton.classList.toggle("active", favorites.includes(station.stationuuid));

  const needlePosition = 7 + Math.floor(Math.random() * 84);
  needle.style.left = `${needlePosition}%`;
}

function stopRadio() {
  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  audioPlayer.load();

  currentPlayingStation = null;
  currentStation.textContent = "KANAL SEÇ";
  currentMeta.textContent = "Türkiye · Hazır";
  playerFavoriteButton.disabled = true;
  playerFavoriteButton.classList.remove("active");
  needle.style.left = "7%";
  statusText.textContent = "Radyo kapatıldı.";
}

function saveRecentlyPlayed(station) {
  recentlyPlayedStations = recentlyPlayedStations.filter(item => item.stationuuid !== station.stationuuid);
  recentlyPlayedStations.unshift(station);
  recentlyPlayedStations = recentlyPlayedStations.slice(0, 20);
  localStorage.setItem("tofasRadyoRecent", JSON.stringify(recentlyPlayedStations));
}

function toggleFavorite(stationId) {
  const station = stations.find(item => item.stationuuid === stationId)
    || favoriteStations.find(item => item.stationuuid === stationId)
    || recentlyPlayedStations.find(item => item.stationuuid === stationId);

  if (favorites.includes(stationId)) {
    favorites = favorites.filter(id => id !== stationId);
    favoriteStations = favoriteStations.filter(item => item.stationuuid !== stationId);
  } else if (station) {
    favorites.push(stationId);
    favoriteStations.push(station);
  }

  localStorage.setItem("tofasRadyoFavorites", JSON.stringify(favoriteStations));
  updateFavoriteCount();

  if (currentPlayingStation && currentPlayingStation.stationuuid === stationId) {
    playerFavoriteButton.classList.toggle("active", favorites.includes(stationId));
  }

  if (activeFilter === "__favorites") {
    renderFavoriteStations();
  }
}

function renderFavoriteStations() {
  statusText.textContent = favoriteStations.length
    ? `${favoriteStations.length} favori radyo`
    : "Henüz favori yok. Yıldız tuşuyla ekleyebilirsin.";

  stationCount.textContent = favoriteStations.length;
  renderStations(favoriteStations);
}

function renderRecentlyPlayedStations() {
  statusText.textContent = recentlyPlayedStations.length
    ? `${recentlyPlayedStations.length} son dinlenen radyo`
    : "Henüz son dinlenen yok. Bir radyo çalınca burada görünür.";

  stationCount.textContent = recentlyPlayedStations.length;
  renderStations(recentlyPlayedStations);
}

function shortenTags(tags) {
  return tags
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");
}

function getInitials(name) {
  return String(name || "TR")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyLightsMode(mode) {
  const safeMode = mode === "on" ? "on" : "off";
  document.body.classList.toggle("lights", safeMode === "on");
  themeToggle.textContent = safeMode === "on" ? "Farları Kapat" : "Farları Aç";
  localStorage.setItem("tofasRadyoLights", safeMode);
  lightsMode = safeMode;
}

function toggleLightsMode() {
  applyLightsMode(lightsMode === "on" ? "off" : "on");
}

searchButton.addEventListener("click", fetchStations);

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    fetchStations();
  }
});

presets.forEach(preset => {
  preset.addEventListener("click", () => {
    presets.forEach(item => item.classList.remove("active"));
    preset.classList.add("active");
    activeFilter = preset.dataset.filter || "";
    fetchStations();
  });
});

playerFavoriteButton.addEventListener("click", () => {
  if (currentPlayingStation) {
    toggleFavorite(currentPlayingStation.stationuuid);
  }
});

powerButton.addEventListener("click", stopRadio);
themeToggle.addEventListener("click", toggleLightsMode);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

applyLightsMode(lightsMode);
updateFavoriteCount();
fetchStations();
