/**
 * Geocoding via OpenStreetMap Nominatim (free, no API key).
 * Usage policy: max 1 request/second and a real User-Agent, so every call goes
 * through a serial queue and results are cached in memory.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const { isValidLatLng, haversineKm } = require('../utils/geo');

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT =
  process.env.GEOCODER_USER_AGENT || 'TripPilot-Geospatial-Travel-System/1.0 (student project)';
const MIN_INTERVAL_MS = 1100;
const CACHE_LIMIT = 500;

const cache = new Map();
let queue = Promise.resolve();
let lastCall = 0;

function cacheSet(key, value) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

/** Runs tasks strictly one at a time with a minimum gap between network calls. */
function enqueue(task) {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      return await task();
    } finally {
      lastCall = Date.now();
    }
  });
  queue = run.catch(() => {});
  return run;
}

async function nominatimRequest(path, params, timeoutMs = 8000) {
  const url = new URL(path, NOMINATIM_URL);
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && url.searchParams.set(k, v));
  url.searchParams.set('format', 'jsonv2');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalise(hit) {
  const lat = parseFloat(hit.lat);
  const lng = parseFloat(hit.lon);
  if (!isValidLatLng(lat, lng)) return null;
  let radiusKm = null;
  if (Array.isArray(hit.boundingbox) && hit.boundingbox.length === 4) {
    const [south, north, west, east] = hit.boundingbox.map(parseFloat);
    if ([south, north, west, east].every(Number.isFinite)) {
      radiusKm = haversineKm(south, west, north, east) / 2;
    }
  }
  return {
    lat,
    lng,
    displayName: hit.display_name,
    name: hit.name || (hit.display_name || '').split(',')[0],
    category: hit.category || hit.class,
    type: hit.type,
    radiusKm,
    importance: hit.importance
  };
}

/**
 * Forward geocode. `near` ({lat,lng}) biases results to that area (~±0.6°).
 * Returns up to `limit` normalised results (never throws; returns [] on failure).
 */
async function search(query, { near = null, limit = 5, bounded = false } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const key = `s|${q.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ''}|${limit}|${bounded}`;
  if (cache.has(key)) return cache.get(key);

  const params = { q, limit };
  if (near && isValidLatLng(near.lat, near.lng)) {
    const d = 0.6;
    params.viewbox = [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(',');
    if (bounded) params.bounded = 1;
  }

  try {
    const hits = await enqueue(() => nominatimRequest('/search', params));
    const results = (hits || []).map(normalise).filter(Boolean);
    cacheSet(key, results);
    return results;
  } catch (err) {
    console.warn(`[geocoder] search failed for "${q}": ${err.message}`);
    return [];
  }
}

/** Best single match or null. */
async function geocodeOne(query, opts = {}) {
  const [best] = await search(query, { ...opts, limit: opts.limit || 1 });
  return best || null;
}

async function reverse(lat, lng) {
  if (!isValidLatLng(lat, lng)) return null;
  const key = `r|${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const hit = await enqueue(() => nominatimRequest('/reverse', { lat, lon: lng, zoom: 16 }));
    if (!hit || hit.error) return null;
    const result = { displayName: hit.display_name, name: hit.name || (hit.display_name || '').split(',')[0] };
    cacheSet(key, result);
    return result;
  } catch (err) {
    console.warn(`[geocoder] reverse failed: ${err.message}`);
    return null;
  }
}

module.exports = { search, geocodeOne, reverse };
