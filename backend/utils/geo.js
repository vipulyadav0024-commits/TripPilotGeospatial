/**
 * Pure geospatial helpers (no I/O). Everything here is unit-testable.
 * Convention: GeoJSON order [lng, lat] is used for storage; helpers that take
 * separate arguments use (lat, lng) to match everyday usage.
 */

const EARTH_RADIUS_KM = 6371.0088;
const ROAD_FACTOR = 1.3; // straight-line -> typical road distance multiplier

const toRad = (deg) => (deg * Math.PI) / 180;

function isValidLatLng(lat, lng) {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0) // "null island" is almost always a failed lookup
  );
}

/** Great-circle distance in km (Haversine formula). */
function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial compass bearing (0-360) from point 1 to point 2. */
function bearingDeg(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function compassDirection(deg) {
  return COMPASS[Math.round(deg / 45) % 8];
}

/** GeoJSON Point from lat/lng. */
function toPoint(lat, lng) {
  return { type: 'Point', coordinates: [round(lng, 6), round(lat, 6)] };
}

/** Read a GeoJSON Point (plain object or mongoose subdoc) -> {lat, lng} | null. */
function fromPoint(point) {
  if (!point) return null;
  const c = point.coordinates;
  if (!c || c.length !== 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  return isValidLatLng(lat, lng) ? { lat, lng } : null;
}

function round(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Rough travel-time estimate in minutes for a road distance in km.
 * Short hops are walkable, longer ones assume urban traffic speeds.
 */
function estimateTravelMinutes(roadKm) {
  if (roadKm <= 0) return 0;
  const speedKmh = roadKm <= 1.5 ? 4.8 : roadKm <= 8 ? 22 : 35;
  return Math.max(1, Math.round((roadKm / speedKmh) * 60));
}

/** Length of an ordered list of {lat,lng} points (straight-line, km). */
function pathLengthKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return total;
}

/** Bounding box [minLng, minLat, maxLng, maxLat] of points, or null. */
function boundingBox(points) {
  const pts = points.filter(Boolean);
  if (!pts.length) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const p of pts) {
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }
  return [round(minLng, 6), round(minLat, 6), round(maxLng, 6), round(maxLat, 6)];
}

function centroid(points) {
  const pts = points.filter(Boolean);
  if (!pts.length) return null;
  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length
  };
}

/** Point at a given distance (km) and bearing from a start point. */
function destinationPoint(lat, lng, distanceKm, bearing) {
  const d = distanceKm / EARTH_RADIUS_KM;
  const b = toRad(bearing);
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 =
    lng1 +
    Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: ((lng2 * 180) / Math.PI + 540) % 360 - 180 };
}

/**
 * Best visiting order for a set of stops.
 *  - `start` (optional) is a fixed starting point (e.g. the hotel) that is NOT reordered.
 *  - n <= 8  : exact optimum via branch-and-bound over permutations.
 *  - n  > 8  : nearest-neighbour construction + 2-opt local improvement.
 * Returns { order: number[] (indices into `stops`), distanceKm }.
 * Path is open (does not return to the start).
 */
function optimizeOrder(stops, start = null) {
  const n = stops.length;
  if (n === 0) return { order: [], distanceKm: 0 };

  const d = (a, b) => haversineKm(a.lat, a.lng, b.lat, b.lng);
  const dist = stops.map((a) => stops.map((b) => d(a, b)));
  const fromStart = start ? stops.map((s) => d(start, s)) : stops.map(() => 0);

  const lengthOf = (order) => {
    let total = fromStart[order[0]];
    for (let i = 1; i < order.length; i++) total += dist[order[i - 1]][order[i]];
    return total;
  };

  if (n <= 8) {
    let best = Infinity;
    let bestOrder = [...Array(n).keys()];
    const used = new Array(n).fill(false);
    const current = [];
    const search = (len) => {
      if (len >= best) return; // prune
      if (current.length === n) {
        best = len;
        bestOrder = [...current];
        return;
      }
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        const step = current.length === 0 ? fromStart[i] : dist[current[current.length - 1]][i];
        used[i] = true;
        current.push(i);
        search(len + step);
        current.pop();
        used[i] = false;
      }
    };
    search(0);
    return { order: bestOrder, distanceKm: round(best, 3) };
  }

  // Nearest neighbour
  const visited = new Array(n).fill(false);
  let cur = start
    ? fromStart.indexOf(Math.min(...fromStart))
    : 0;
  const order = [cur];
  visited[cur] = true;
  while (order.length < n) {
    let next = -1;
    let nd = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[cur][i] < nd) { nd = dist[cur][i]; next = i; }
    }
    visited[next] = true;
    order.push(next);
    cur = next;
  }

  // 2-opt improvement (open path)
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (lengthOf(candidate) + 1e-9 < lengthOf(order)) {
          order.splice(0, n, ...candidate);
          improved = true;
        }
      }
    }
  }
  return { order, distanceKm: round(lengthOf(order), 3) };
}

module.exports = {
  EARTH_RADIUS_KM, ROAD_FACTOR,
  isValidLatLng, haversineKm, bearingDeg, compassDirection,
  toPoint, fromPoint, round, estimateTravelMinutes,
  pathLengthKm, boundingBox, centroid, destinationPoint, optimizeOrder
};
