/**
 * Road routing through OSRM (free public servers, no API key).
 * Falls back to straight-line geometry + estimated time if the service is down
 * so the UI always has something to draw.
 */
const { haversineKm, ROAD_FACTOR, estimateTravelMinutes, round } = require('../utils/geo');

const PROFILES = {
  driving: process.env.OSRM_DRIVING_URL || 'https://router.project-osrm.org/route/v1/driving',
  walking: process.env.OSRM_WALKING_URL || 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
};

const cache = new Map();
const CACHE_LIMIT = 200;

/** points: [{lat,lng}, ...] (2..25 points). Returns geometry as [[lat,lng],...]. */
async function getRoute(points, profile = 'driving') {
  const pts = points.filter(Boolean);
  if (pts.length < 2) {
    return { source: 'none', profile, geometry: pts.map((p) => [p.lat, p.lng]), distanceKm: 0, durationMin: 0, legs: [] };
  }
  const usable = pts.slice(0, 25);
  const base = PROFILES[profile] || PROFILES.driving;
  const coords = usable.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const key = `${profile}|${coords}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(`${base}/${coords}?overview=full&geometries=geojson&steps=false`, {
      headers: { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'TripPilot-Geospatial-Travel-System/1.0' },
      signal: controller.signal
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
    const data = await res.json();
    const route = data.routes && data.routes[0];
    if (data.code !== 'Ok' || !route) throw new Error(`OSRM code ${data.code}`);

    const result = {
      source: 'osrm',
      profile,
      geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: round(route.distance / 1000, 2),
      durationMin: Math.round(route.duration / 60),
      legs: (route.legs || []).map((l) => ({
        distanceKm: round(l.distance / 1000, 2),
        durationMin: Math.round(l.duration / 60)
      }))
    };
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
  } catch (err) {
    console.warn(`[routing] OSRM unavailable (${err.message}); using straight-line estimate`);
    return straightLineRoute(usable, profile);
  }
}

function straightLineRoute(pts, profile = 'driving') {
  const legs = [];
  for (let i = 1; i < pts.length; i++) {
    const km = haversineKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng) * ROAD_FACTOR;
    const min = profile === 'walking' ? Math.round((km / 4.8) * 60) : estimateTravelMinutes(km);
    legs.push({ distanceKm: round(km, 2), durationMin: min });
  }
  return {
    source: 'estimate',
    profile,
    geometry: pts.map((p) => [p.lat, p.lng]),
    distanceKm: round(legs.reduce((s, l) => s + l.distanceKm, 0), 2),
    durationMin: legs.reduce((s, l) => s + l.durationMin, 0),
    legs
  };
}

module.exports = { getRoute, straightLineRoute };
