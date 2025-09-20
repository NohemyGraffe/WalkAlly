const drawerHome = document.getElementById("drawerHome");
const drawerRoute = document.getElementById("drawerRoute");
const btnShareSmall = document.getElementById("btnShareSmall");
const btnStartTrip = document.getElementById("btnStartTrip");
const btnReport2 = document.getElementById("btnReport2");

const toggleRisk = document.getElementById("toggleRisk");
const btnShare = document.getElementById("btnShare");
const toast = document.getElementById("toast");

// --- Colors ---
const COLORS = {
  blue: "#16A2C5",
  green: "#1FAE6B",
  red: "#FF4D4D",
  orange: "#FFA500",
};

// --- Initialize Map ---
const map = L.map("map", { zoomControl: false }).setView([25.774, -80.193], 15);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

// Current user location (blue dot)
L.circleMarker([25.774, -80.193], {
  radius: 8,
  color: COLORS.blue,
  fillColor: COLORS.blue,
  fillOpacity: 1,
}).addTo(map);

// --- Hazards ---
const hazards = [
  { id: "h1", type: "Crime", lat: 25.776, lng: -80.194, color: COLORS.red },
  {
    id: "h2",
    type: "Accident",
    lat: 25.772,
    lng: -80.191,
    color: COLORS.orange,
  },
];
const hazardLayer = L.layerGroup().addTo(map);

function renderHazards() {
  hazardLayer.clearLayers();
  hazards.forEach((h) => {
    L.circle([h.lat, h.lng], {
      radius: 120,
      color: h.color,
      fillColor: h.color,
      fillOpacity: 0.25,
    }).addTo(hazardLayer);
    L.marker([h.lat, h.lng]).bindTooltip(`⚠️ ${h.type}`).addTo(hazardLayer);
  });
}
renderHazards();

// --- Risk toggle ---
let riskOn = true;
document.getElementById("toggleRisk").addEventListener("click", () => {
  riskOn = !riskOn;
  if (riskOn) {
    hazardLayer.addTo(map);
    toggleRisk.textContent = "Risk: ON";
  } else {
    map.removeLayer(hazardLayer);
    toggleRisk.textContent = "Risk: OFF";
  }
});

// --- Fake Routes ---
let fastLine, safeLine;

const fastestRoute = [
  [25.774, -80.196],
  [25.776, -80.194], // passes near hazard
  [25.777, -80.19],
];
const safestRoute = [
  [25.774, -80.196],
  [25.775, -80.195],
  [25.778, -80.191], // avoids hazard
];

// Compute a fake safety score
function computeScore(route, hazards) {
  const path = route.map((c) => L.latLng(c[0], c[1]));
  let near = 0;
  hazards.forEach((h) => {
    const hazard = L.latLng(h.lat, h.lng);
    const close = path.some((pt) => pt.distanceTo(hazard) < 150);
    if (close) near++;
  });
  return (10 - near).toFixed(1);
}

// --- Plan Route flow ---
const destInput = document.getElementById("destInput");
const btnFind = document.getElementById("btnFind");
const planPanel = document.getElementById("planPanel");
const routeCard = document.getElementById("routeCard");
const etaTxt = document.getElementById("etaTxt");
const distTxt = document.getElementById("distTxt");
const scoreTxt = document.getElementById("scoreTxt");

destInput.addEventListener("input", () => {
  btnFind.disabled = destInput.value.trim().length < 2;
});

btnFind.addEventListener("click", () => {
  // Close panel
  planPanel.classList.remove("open");

  // Remove old lines
  if (fastLine) map.removeLayer(fastLine);
  if (safeLine) map.removeLayer(safeLine);

  // Draw routes
  fastLine = L.polyline(fastestRoute, {
    color: "#999",
    weight: 6,
    dashArray: "8 8",
  }).addTo(map);
  safeLine = L.polyline(safestRoute, { color: COLORS.green, weight: 8 }).addTo(
    map
  );

  // Fake values
  etaTxt.textContent = "18 min";
  distTxt.textContent = "1.4 mi";
  scoreTxt.textContent = computeScore(safestRoute, hazards);

  routeCard.classList.remove("hidden");

  // Fit bounds to show both
  const group = L.featureGroup([fastLine, safeLine]);
  map.fitBounds(group.getBounds(), { padding: [30, 30] });
});

// --- Navigation mode ---
const btnStart = document.getElementById("btnStart");
let navIndex = 0;
let navMarker, navInterval;

// Hazard alert banner (create once)
const banner = document.createElement("div");
banner.id = "hazardBanner";
banner.style.cssText = `
  position:absolute; top:60px; left:0; right:0;
  background:#FFA500; color:white; text-align:center;
  padding:10px; font-weight:bold; display:none; z-index:2000;
`;

btnStart.addEventListener("click", () => {
  if (!safeLine) return;

  // Reset
  if (navMarker) {
    map.removeLayer(navMarker);
    clearInterval(navInterval);
  }

  const path = safeLine.getLatLngs();
  navIndex = 0;

  // Blue dot marker
  navMarker = L.circleMarker(path[0], {
    radius: 10,
    color: COLORS.blue,
    fillColor: COLORS.blue,
    fillOpacity: 1,
  }).addTo(map);

  // Simulate walking
  navInterval = setInterval(() => {
    navIndex++;
    if (navIndex >= path.length) {
      clearInterval(navInterval);
      banner.style.display = "none";
      alert("✅ You have arrived!");

      // Reset UI back to home
      if (fastLine) map.removeLayer(fastLine);
      if (safeLine) map.removeLayer(safeLine);
      if (navMarker) map.removeLayer(navMarker);
      routeCard.classList.add("hidden"); // hide the info card

      return;
    }

    navMarker.setLatLng(path[navIndex]);

    // Check hazard proximity
    const here = navMarker.getLatLng();
    const nearHazard = hazards.some((h) => {
      const hazard = L.latLng(h.lat, h.lng);
      return here.distanceTo(hazard) < 150;
    });

    banner.style.display = nearHazard ? "block" : "none";
  }, 2000); // move every 2 seconds
});

// --- Share button logic (moved globally) ---
btnShare.addEventListener("click", async () => {
  const text = `WalkAlly safe route — ETA 18 min, Safety Score ${scoreTxt.textContent}/10`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: "WalkAlly",
        text,
        url: window.location.href,
      });
    } catch {}
  } else {
    await navigator.clipboard.writeText(text);
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 1500);
  }
});

// --- Panel open/close logic ---
const btnPlan = document.getElementById("btnPlan");
const btnReport = document.getElementById("btnReport");
const planPanelEl = document.getElementById("planPanel");
const reportStep1El = document.getElementById("reportStep1");
const reportStep2El = document.getElementById("reportStep2");
const reportDoneEl = document.getElementById("reportDone");

// Helper to close all panels
function closePanels() {
  [planPanelEl, reportStep1El, reportStep2El, reportDoneEl].forEach((p) =>
    p.classList.remove("open")
  );
}

// Open Plan panel
btnPlan.addEventListener("click", () => {
  closePanels();
  planPanelEl.classList.add("open");
});

// Open Report Step 1 panel
btnReport.addEventListener("click", () => {
  closePanels();
  reportStep1El.classList.add("open");
});

// Hazard report flow
document.getElementById("btnShort").addEventListener("click", () => {
  // Short term hazards
  document.getElementById("step2Title").textContent =
    "Select a short-term hazard";
  document.getElementById("grid").innerHTML = `
    <button class="grid-item">🐕 Unleashed Dog</button>
    <button class="grid-item">🐊 Gator</button>
    <button class="grid-item">🚔 Crime</button>
    <button class="grid-item">🚗 Car Accident</button>
  `;
  reportStep1El.classList.remove("open");
  reportStep2El.classList.add("open");
});

document.getElementById("btnLong").addEventListener("click", () => {
  // Long term hazards
  document.getElementById("step2Title").textContent =
    "Select a long-term hazard";
  document.getElementById("grid").innerHTML = `
    <button class="grid-item">🌊 Flooding</button>
    <button class="grid-item">💡 Broken Light</button>
    <button class="grid-item">🚧 Construction</button>
    <button class="grid-item">🌴 Blocked Path</button>
  `;
  reportStep1El.classList.remove("open");
  reportStep2El.classList.add("open");
});

// Submit hazard
document.getElementById("btnSubmitHazard").addEventListener("click", () => {
  reportStep2El.classList.remove("open");
  reportDoneEl.classList.add("open");
});

// Return to map
document.getElementById("btnBackToMap").addEventListener("click", () => {
  reportDoneEl.classList.remove("open");
});

// Helper to close all panels
function closePanels() {
  [planPanelEl, reportStep1El, reportStep2El, reportDoneEl].forEach((p) =>
    p.classList.remove("open")
  );
  toggleRisk.classList.remove("hidden"); // show Risk button again
}

// Open Plan panel
btnPlan.addEventListener("click", () => {
  closePanels();
  planPanelEl.classList.add("open");
  toggleRisk.classList.add("hidden"); // hide Risk button
});

// Open Report Step 1 panel
btnReport.addEventListener("click", () => {
  closePanels();
  reportStep1El.classList.add("open");
  toggleRisk.classList.add("hidden"); // hide Risk button
});

// Submit hazard
document.getElementById("btnSubmitHazard").addEventListener("click", () => {
  reportStep2El.classList.remove("open");
  reportDoneEl.classList.add("open");
  toggleRisk.classList.add("hidden"); // still hidden
});

// Return to map
document.getElementById("btnBackToMap").addEventListener("click", () => {
  reportDoneEl.classList.remove("open");
  toggleRisk.classList.remove("hidden"); // show Risk button again
});

// Fake Share Popup elements
const sharePopup = document.getElementById("sharePopup");
const btnCopyLink = document.getElementById("btnCopyLink");
const btnClosePopup = document.getElementById("btnClosePopup");
const shareLink = document.getElementById("shareLink");

// Override Share button behavior
btnShare.addEventListener("click", async () => {
  const text = `WalkAlly safe route — ETA ${etaTxt.textContent}, Safety Score ${scoreTxt.textContent}/10`;
  
  if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
    // Mobile devices → use native share
    try {
      await navigator.share({
        title: "WalkAlly",
        text,
        url: window.location.href,
      });
    } catch {}
  } else {
    // Desktop → show fake popup
    sharePopup.classList.remove("hidden");
  }
});

// Fake popup buttons
btnCopyLink.addEventListener("click", async () => {
  await navigator.clipboard.writeText(shareLink.value);
  alert("✅ Link copied!");
  sharePopup.classList.add("hidden");
});

btnClosePopup.addEventListener("click", () => {
  sharePopup.classList.add("hidden");
});
