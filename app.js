const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const installBtn = document.getElementById("installBtn");
const statusText = document.getElementById("statusText");
const startTimeText = document.getElementById("startTime");
const elapsedTimeText = document.getElementById("elapsedTime");
const distanceText = document.getElementById("distanceText");
const speedText = document.getElementById("speedText");
const pointsText = document.getElementById("pointsText");
const mapStatus = document.getElementById("mapStatus");
const fuelEfficiencyInput = document.getElementById("fuelEfficiency");
const fuelPriceInput = document.getElementById("fuelPrice");
const fuelUsedText = document.getElementById("fuelUsedText");
const fuelCostText = document.getElementById("fuelCostText");
const historyCount = document.getElementById("historyCount");
const historyList = document.getElementById("historyList");
const reportDialog = document.getElementById("reportDialog");
const reportDate = document.getElementById("reportDate");
const reportStart = document.getElementById("reportStart");
const reportEnd = document.getElementById("reportEnd");
const reportDuration = document.getElementById("reportDuration");
const reportDistance = document.getElementById("reportDistance");
const reportPoints = document.getElementById("reportPoints");
const reportAvgSpeed = document.getElementById("reportAvgSpeed");
const reportMaxSpeed = document.getElementById("reportMaxSpeed");
const closeReport = document.getElementById("closeReport");

let tracking = false;
let watchId = null;
let startTime = null;
let lastPosition = null;
let totalDistance = 0;
let currentSpeed = 0;
let maxSpeed = 0;
let trackPoints = [];
let history = [];
let settings = {
  fuelEfficiency: 20,
  fuelPrice: 6.0,
};

let map = null;
let routeLayer = null;
let currentMarker = null;

function initializeMap() {
  if (!window.L) {
    throw new Error("Leaflet não foi carregado. Verifique a conexão com a CDN ou o caminho do script.");
  }

  map = L.map("map", { zoomControl: false }).setView([-23.5505, -46.6333], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  routeLayer = L.polyline([], { color: "#4f6cff", weight: 6, opacity: 0.9 }).addTo(map);
  currentMarker = L.circleMarker([0, 0], {
    radius: 9,
    color: "#ffffff",
    weight: 2,
    fillColor: "#29d6ff",
    fillOpacity: 0.95,
  }).addTo(map);
  currentMarker.setStyle({ opacity: 0 });
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatDate(date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toFixed(value, digits = 2) {
  return Number(value).toFixed(digits).replace(".", ",");
}

function metersToKilometers(meters) {
  return meters / 1000;
}

function calculateDistance(a, b) {
  const R = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aVar = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(aVar), Math.sqrt(1 - aVar));
  return R * c;
}

function updateMapRoute() {
  const latlngs = trackPoints.map(point => [point.lat, point.lng]);
  routeLayer.setLatLngs(latlngs);
  if (latlngs.length) {
    const last = latlngs[latlngs.length - 1];
    currentMarker.setLatLng(last).setStyle({ opacity: 1 });
    if (latlngs.length === 1) {
      map.setView(last, 15);
    } else {
      map.fitBounds(routeLayer.getBounds().pad(0.24), { maxZoom: 16 });
    }
  }
}

function updateStats() {
  distanceText.textContent = `${toFixed(metersToKilometers(totalDistance))} km`;
  speedText.textContent = `${Math.round(currentSpeed)} km/h`;
  pointsText.textContent = String(trackPoints.length);

  const fuelUsed = settings.fuelEfficiency > 0 ? metersToKilometers(totalDistance) / settings.fuelEfficiency : 0;
  const fuelCost = fuelUsed * settings.fuelPrice;

  fuelUsedText.textContent = `${toFixed(fuelUsed)} L`;
  fuelCostText.textContent = `R$ ${toFixed(fuelCost)}`;
}

function updateTimer() {
  if (!tracking || !startTime) return;
  const now = Date.now();
  elapsedTimeText.textContent = formatDuration(now - startTime);
}

function saveSettings() {
  localStorage.setItem("trackerSettings", JSON.stringify(settings));
}

function loadSettings() {
  const saved = localStorage.getItem("trackerSettings");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed.fuelEfficiency === "number") settings.fuelEfficiency = parsed.fuelEfficiency;
      if (typeof parsed.fuelPrice === "number") settings.fuelPrice = parsed.fuelPrice;
    } catch (error) {
      console.warn("Erro ao carregar configurações", error);
    }
  }
  fuelEfficiencyInput.value = settings.fuelEfficiency;
  fuelPriceInput.value = settings.fuelPrice;
}

function saveHistory() {
  localStorage.setItem("trackerHistory", JSON.stringify(history));
}

function loadHistory() {
  const saved = localStorage.getItem("trackerHistory");
  if (saved) {
    try {
      history = JSON.parse(saved);
    } catch (error) {
      console.warn("Erro ao carregar histórico", error);
      history = [];
    }
  }
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  if (!history.length) {
    historyCount.textContent = "Nenhum expediente salvo";
    return;
  }

  historyCount.textContent = `${history.length} expedientes registrados`;
  history.slice().reverse().forEach(record => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "history-item";
    item.innerHTML = `
      <strong>${record.date} • ${record.start} - ${record.end}</strong>
      <span>${record.duration} • ${record.distance} km • ${record.points} pontos</span>
    `;
    item.addEventListener("click", () => showHistoryRecord(record));
    historyList.appendChild(item);
  });
}

function showHistoryRecord(record) {
  reportDate.textContent = record.date;
  reportStart.textContent = record.start;
  reportEnd.textContent = record.end;
  reportDuration.textContent = record.duration;
  reportDistance.textContent = `${record.distance} km`;
  reportPoints.textContent = String(record.points);
  reportAvgSpeed.textContent = `${record.avgSpeed} km/h`;
  reportMaxSpeed.textContent = `${record.maxSpeed} km/h`;

  trackPoints = record.route.map(point => ({ lat: point.lat, lng: point.lng, timestamp: point.timestamp }));
  totalDistance = Number(record.distance.replace(",", ".")) * 1000;
  currentSpeed = 0;
  updateMapRoute();
  updateStats();
  reportDialog.showModal();
}

function showReport(record) {
  reportDate.textContent = record.date;
  reportStart.textContent = record.start;
  reportEnd.textContent = record.end;
  reportDuration.textContent = record.duration;
  reportDistance.textContent = `${record.distance} km`;
  reportPoints.textContent = String(record.points);
  reportAvgSpeed.textContent = `${record.avgSpeed} km/h`;
  reportMaxSpeed.textContent = `${record.maxSpeed} km/h`;
  reportDialog.showModal();
}

function resetSession() {
  totalDistance = 0;
  currentSpeed = 0;
  maxSpeed = 0;
  trackPoints = [];
  lastPosition = null;
  routeLayer.setLatLngs([]);
  currentMarker.setStyle({ opacity: 0 });
  distanceText.textContent = "0,00 km";
  speedText.textContent = "0 km/h";
  pointsText.textContent = "0";
  elapsedTimeText.textContent = "00:00:00";
  mapStatus.textContent = "Aguardando início";
}

function startTracking() {
  if (!("geolocation" in navigator)) {
    alert("Geolocalização não disponível neste navegador.");
    return;
  }

  if (tracking) return;
  tracking = true;
  startTime = Date.now();
  startTimeText.textContent = formatTime(new Date(startTime));
  statusText.textContent = "Rastreando";
  startBtn.disabled = true;
  stopBtn.disabled = false;
  mapStatus.textContent = "Rastreamento ativo";
  resetSession();

  watchId = navigator.geolocation.watchPosition(
    position => {
      const point = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: position.timestamp,
        speed: position.coords.speed !== null ? position.coords.speed * 3.6 : 0,
        accuracy: position.coords.accuracy || 0,
      };

      const isFirstPoint = trackPoints.length === 0;
      if (isFirstPoint) {
        if (point.accuracy > 60) {
          mapStatus.textContent = "Aguardando GPS estável";
          return;
        }

        trackPoints.push(point);
        lastPosition = point;
        updateMapRoute();
        updateStats();
        mapStatus.textContent = "Rastreamento ativo";
        return;
      }

      const previous = trackPoints[trackPoints.length - 1];
      const distanceDelta = calculateDistance(previous, point);
      const deltaSeconds = (point.timestamp - previous.timestamp) / 1000;
      const estimatedSpeed = deltaSeconds ? (distanceDelta / deltaSeconds) * 3.6 : 0;
      if (!point.speed) {
        point.speed = estimatedSpeed;
      }

      const isJitter = distanceDelta < 8 && point.speed < 2;
      const isLowAccuracy = point.accuracy > 80 && point.speed < 2;
      const isUnrealisticJump = distanceDelta > 70 && point.accuracy > 50 && point.speed < 8;

      if (isJitter || isLowAccuracy || isUnrealisticJump) {
        mapStatus.textContent = "Aguardando GPS estável";
        return;
      }

      totalDistance += distanceDelta;
      currentSpeed = point.speed || 0;
      maxSpeed = Math.max(maxSpeed, currentSpeed);
      trackPoints.push(point);
      lastPosition = point;
      updateMapRoute();
      updateStats();
      mapStatus.textContent = "Rastreamento ativo";
    },
    error => {
      console.warn(error);
      statusText.textContent = "Permissão negada ou erro de GPS";
      mapStatus.textContent = "Erro de localização";
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20000,
    }
  );
}

function stopTracking() {
  if (!tracking) return;
  tracking = false;
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  const endTime = Date.now();
  const durationMS = endTime - startTime;
  const durationText = formatDuration(durationMS);
  const routeKm = metersToKilometers(totalDistance);
  const avgSpeed = durationMS ? (routeKm / (durationMS / 3600000)) : 0;
  const record = {
    id: Date.now(),
    date: formatDate(new Date(startTime)),
    start: formatTime(new Date(startTime)),
    end: formatTime(new Date(endTime)),
    duration: durationText,
    distance: toFixed(routeKm),
    points: trackPoints.length,
    avgSpeed: toFixed(avgSpeed, 1),
    maxSpeed: toFixed(maxSpeed, 1),
    route: trackPoints.map(point => ({ lat: point.lat, lng: point.lng, timestamp: point.timestamp })),
  };

  history.push(record);
  saveHistory();
  renderHistory();
  showReport(record);

  statusText.textContent = "Inativo";
  mapStatus.textContent = "Expediente finalizado";
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

function init() {
  loadSettings();
  loadHistory();
  updateStats();
  setInterval(updateTimer, 1000);

  try {
    initializeMap();
  } catch (error) {
    console.error(error);
    statusText.textContent = "Erro ao iniciar o mapa";
    mapStatus.textContent = "Leaflet não carregado";
  }

  fuelEfficiencyInput.addEventListener("change", event => {
    const value = parseFloat(event.target.value.replace(",", "."));
    if (!Number.isNaN(value) && value > 0) {
      settings.fuelEfficiency = value;
      saveSettings();
      updateStats();
    }
  });

  fuelPriceInput.addEventListener("change", event => {
    const value = parseFloat(event.target.value.replace(",", "."));
    if (!Number.isNaN(value) && value >= 0) {
      settings.fuelPrice = value;
      saveSettings();
      updateStats();
    }
  });

  startBtn.addEventListener("click", () => {
    try {
      startTracking();
    } catch (error) {
      console.error(error);
      statusText.textContent = "Erro ao iniciar rastreamento";
      mapStatus.textContent = "Verifique o console";
    }
  });
  stopBtn.addEventListener("click", stopTracking);
  closeReport.addEventListener("click", () => reportDialog.close());
  reportDialog.addEventListener("cancel", event => event.preventDefault());

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(error => {
      console.warn("Falha ao registrar service worker", error);
    });
  }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.style.display = "inline-flex";
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      installBtn.style.display = "none";
    }
    deferredPrompt = null;
  });
}

init();
