const map = L.map('map', {
  worldCopyJump: true,
  preferCanvas: true,
});

const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 10,
  attribution: '&copy; OpenStreetMap contributors',
});
tileLayer.addTo(map);

map.setView([39.8283, -98.5795], 4);

const aircraftLayer = L.layerGroup().addTo(map);
const icao24ToMarker = new Map();

const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refreshBtn');
const autoRefreshEl = document.getElementById('autoRefresh');
const refreshIntervalEl = document.getElementById('refreshInterval');

function getVisibleBBox() {
  const b = map.getBounds();
  const south = b.getSouth();
  const north = b.getNorth();
  const west = b.getWest();
  const east = b.getEast();
  return [south, north, west, east];
}

function formatNumber(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(0) : '—';
}

async function fetchFlights() {
  const [south, north, west, east] = getVisibleBBox();
  const bbox = `${south.toFixed(4)},${north.toFixed(4)},${west.toFixed(4)},${east.toFixed(4)}`;
  const url = `/api/flights?bbox=${bbox}`;

  try {
    statusEl.textContent = 'Loading flights…';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    updateAircraft(data.states || []);
    const count = (data.states || []).length;
    statusEl.textContent = `Loaded ${count} aircraft`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load flights';
  }
}

function updateAircraft(states) {
  const seen = new Set();
  for (const s of states) {
    if (!s) continue;
    const icao24 = s[0];
    const callsignRaw = s[1];
    const originCountry = s[2];
    const longitude = s[5];
    const latitude = s[6];
    const velocity = s[9];
    const trueTrack = s[10];
    const geoAltitude = s[13];

    if (latitude == null || longitude == null || !icao24) continue;
    seen.add(icao24);

    const callsign = (callsignRaw || '').trim() || icao24.toUpperCase();
    const pos = [latitude, longitude];
    const html = `
      <div>
        <strong>${callsign}</strong><br/>
        Country: ${originCountry || '—'}<br/>
        Alt: ${formatNumber(geoAltitude)} m<br/>
        Spd: ${formatNumber(velocity)} m/s<br/>
        Hdg: ${formatNumber(trueTrack)}°
      </div>
    `;

    let marker = icao24ToMarker.get(icao24);
    if (!marker) {
      const icon = L.divIcon({
        className: 'aircraft-icon',
        html: '✈',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      marker = L.marker(pos, { icon, rotationAngle: trueTrack || 0, rotationOrigin: 'center' })
        .bindPopup(html);
      marker.addTo(aircraftLayer);
      icao24ToMarker.set(icao24, marker);
    } else {
      marker.setLatLng(pos);
      if (typeof trueTrack === 'number') {
        marker.setRotationAngle(trueTrack);
      }
      marker.setPopupContent(html);
    }
  }

  // Remove markers not seen in this update
  for (const [icao24, marker] of icao24ToMarker) {
    if (!seen.has(icao24)) {
      aircraftLayer.removeLayer(marker);
      icao24ToMarker.delete(icao24);
    }
  }
}

let autoTimer = null;
function setAutoRefresh(enabled) {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  if (enabled) {
    const seconds = parseInt(refreshIntervalEl.value, 10) || 10;
    autoTimer = setInterval(fetchFlights, seconds * 1000);
  }
}

refreshBtn.addEventListener('click', fetchFlights);
autoRefreshEl.addEventListener('change', (e) => setAutoRefresh(e.target.checked));
refreshIntervalEl.addEventListener('change', () => setAutoRefresh(autoRefreshEl.checked));

map.whenReady(() => {
  fetchFlights();
  setAutoRefresh(true);
});

map.on('moveend', () => {
  if (!autoRefreshEl.checked) fetchFlights();
});

