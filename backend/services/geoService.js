/**
 * Geospatial business logic:
 *  - attach coordinates to every stop of a trip (AI-provided -> validated -> geocoded -> approximate)
 *  - build the map/statistics view of a trip
 *  - nearby search and per-day route optimisation
 */
const geocoder = require('./geocoder');
const {
  isValidLatLng, haversineKm, toPoint, fromPoint, round, ROAD_FACTOR,
  estimateTravelMinutes, boundingBox, destinationPoint, optimizeOrder,
  bearingDeg, compassDirection, centroid
} = require('../utils/geo');

const SLOT_ORDER = { Morning: 0, Afternoon: 1, Evening: 2, Night: 3 };

/* ------------------------------------------------------------------ */
/* Coordinate cleaning                                                 */
/* ------------------------------------------------------------------ */

/** Returns a valid GeoJSON Point or undefined. Accepts GeoJSON or {lat,lng}. */
function cleanGeo(geo) {
  if (!geo) return undefined;
  if (Array.isArray(geo.coordinates)) {
    const [lng, lat] = geo.coordinates.map(Number);
    return isValidLatLng(lat, lng) ? toPoint(lat, lng) : undefined;
  }
  const lat = Number(geo.lat ?? geo.latitude);
  const lng = Number(geo.lng ?? geo.lon ?? geo.longitude);
  return isValidLatLng(lat, lng) ? toPoint(lat, lng) : undefined;
}

function aiLatLng(item) {
  const lat = Number(item.latitude);
  const lng = Number(item.longitude);
  return isValidLatLng(lat, lng) ? { lat, lng } : null;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic scatter around the centre so unresolved stops are still visible (flagged 'approximate'). */
function approximatePosition(center, seed, maxKm) {
  const h = hash(seed);
  const distance = Math.min(maxKm * 0.25, 0.5 + (h % 300) / 100); // 0.5 - 3.5 km
  return destinationPoint(center.lat, center.lng, distance, h % 360);
}

function stopName(item) {
  return item.title || item.restaurantName || item.name || item.location || 'Place';
}

/* ------------------------------------------------------------------ */
/* Enrichment                                                          */
/* ------------------------------------------------------------------ */

/**
 * Resolve destination/origin into place references.
 * Runs sequentially because Nominatim allows one request per second.
 */
async function resolveEndpoints(destination, from) {
  const dest = destination ? await geocoder.geocodeOne(destination) : null;
  const orig = from ? await geocoder.geocodeOne(from) : null;

  const toRef = (query, hit) =>
    hit ? { name: hit.name || query, geo: toPoint(hit.lat, hit.lng), radiusKm: hit.radiusKm ? round(hit.radiusKm, 1) : undefined } : undefined;

  const destinationGeo = toRef(destination, dest);
  const originGeo = toRef(from, orig);
  const routeDistanceKm =
    dest && orig ? round(haversineKm(orig.lat, orig.lng, dest.lat, dest.lng), 1) : undefined;

  return { destinationGeo, originGeo, routeDistanceKm };
}

/**
 * Attach `geo` + `geoSource` to one stop (mutates `item`).
 * ctx = { center, maxKm, destination, budget: { left }, allowLookups }
 */
async function locateItem(item, ctx, { kind, widen = 1, force = false } = {}) {
  const existing = cleanGeo(item.geo);
  const keep = existing && !(force && item.geoSource === 'approximate');
  if (keep) {
    item.geo = existing;
    if (!item.geoSource) item.geoSource = 'manual';
    delete item.latitude; delete item.longitude;
    return;
  }

  const maxKm = ctx.maxKm * widen;
  const ai = aiLatLng(item);
  delete item.latitude; delete item.longitude;

  // 1) Coordinates supplied by the AI - accept only if plausibly inside the destination area
  if (ai && (!ctx.center || haversineKm(ctx.center.lat, ctx.center.lng, ai.lat, ai.lng) <= maxKm)) {
    item.geo = toPoint(ai.lat, ai.lng);
    item.geoSource = 'ai';
    return;
  }

  // 2) Look the name up with the geocoder (rate-limited, so budgeted)
  const name = stopName(item);
  if (ctx.allowLookups && ctx.budget.left > 0 && name) {
    ctx.budget.left -= 1;
    const query = [name, item.area, ctx.destination].filter(Boolean).join(', ');
    const hit = await geocoder.geocodeOne(query, { near: ctx.center });
    if (hit && (!ctx.center || haversineKm(ctx.center.lat, ctx.center.lng, hit.lat, hit.lng) <= maxKm * 1.5)) {
      item.geo = toPoint(hit.lat, hit.lng);
      item.geoSource = 'geocoded';
      return;
    }
  }

  // 3) Last resort - visible but flagged as approximate
  if (ctx.center) {
    const p = approximatePosition(ctx.center, `${kind}:${name}`, maxKm);
    item.geo = toPoint(p.lat, p.lng);
    item.geoSource = 'approximate';
  }
}

function buildContext({ destination, destinationGeo, plain, allowLookups = true, lookups = 10 }) {
  let center = fromPoint(destinationGeo && destinationGeo.geo);
  let radiusKm = destinationGeo && destinationGeo.radiusKm;

  // If the destination could not be geocoded, fall back to the centroid of AI-supplied coordinates
  if (!center && plain) {
    const pts = [];
    (plain.itinerary || []).forEach((d) => (d.activities || []).forEach((a) => { const p = aiLatLng(a); if (p) pts.push(p); }));
    (plain.accommodation || []).forEach((h) => { const p = aiLatLng(h); if (p) pts.push(p); });
    center = centroid(pts);
  }
  const maxKm = Math.min(1500, Math.max(40, (radiusKm || 20) * 1.6));
  return { center, maxKm, destination, allowLookups, budget: { left: lookups } };
}

/**
 * Enrich a plain trip payload {itinerary, accommodation, nearbyAttractions} in place.
 * `options.force` re-tries stops that only have an approximate position.
 */
async function enrichPlain(plain, ctx, options = {}) {
  const { force = false, onlyDay = null } = options;

  for (const h of plain.accommodation || []) {
    await locateItem(h, ctx, { kind: 'hotel', force });
  }
  for (const day of plain.itinerary || []) {
    if (onlyDay && day.dayNumber !== onlyDay) continue;
    for (const a of day.activities || []) await locateItem(a, ctx, { kind: 'activity', force });
    for (const m of day.meals || []) await locateItem(m, ctx, { kind: 'meal', force });
  }
  for (const n of plain.nearbyAttractions || []) {
    if (!n || typeof n !== 'object') continue;
    await locateItem(n, ctx, { kind: 'attraction', widen: 3, force });
  }
  return plain;
}

/**
 * Used at trip creation. `tripData` is the AI (or mock) payload.
 * Returns the geo fields to merge into the Trip document.
 */
async function enrichNewTrip(tripData, { from, destination, mock = false }) {
  const endpoints = await resolveEndpoints(destination, from);
  const ctx = buildContext({
    destination,
    destinationGeo: endpoints.destinationGeo,
    plain: tripData,
    allowLookups: !mock,
    lookups: 8
  });
  await enrichPlain(tripData, ctx);
  return endpoints;
}

/** Fill in / repair coordinates on an existing Mongoose trip document (mutates + returns it, unsaved). */
async function ensureTripGeo(trip, { lookups = 12, force = false, onlyDay = null } = {}) {
  if (!trip.destinationGeo || !trip.destinationGeo.geo) {
    const endpoints = await resolveEndpoints(trip.destination, trip.from);
    if (endpoints.destinationGeo) trip.destinationGeo = endpoints.destinationGeo;
    if (endpoints.originGeo) trip.originGeo = endpoints.originGeo;
    if (endpoints.routeDistanceKm !== undefined) trip.routeDistanceKm = endpoints.routeDistanceKm;
  }

  const plain = trip.toObject();
  const ctx = buildContext({
    destination: trip.destination,
    destinationGeo: plain.destinationGeo,
    plain,
    allowLookups: true,
    lookups
  });
  await enrichPlain(plain, ctx, { force, onlyDay });

  trip.itinerary = plain.itinerary;
  trip.accommodation = plain.accommodation;
  trip.nearbyAttractions = plain.nearbyAttractions;
  trip.markModified('nearbyAttractions');
  return trip;
}

/** Drop invalid `geo` values from client-supplied itineraries before saving. */
function sanitizeItinerary(itinerary) {
  if (!Array.isArray(itinerary)) return itinerary;
  const fix = (item) => {
    if (!item || typeof item !== 'object') return item;
    const geo = cleanGeo(item.geo);
    const { geo: _drop, ...rest } = item;
    return geo ? { ...rest, geo } : rest;
  };
  return itinerary.map((day) => ({
    ...day,
    activities: (day.activities || []).map(fix),
    meals: (day.meals || []).map(fix)
  }));
}

/* ------------------------------------------------------------------ */
/* Map / statistics view                                               */
/* ------------------------------------------------------------------ */

function legStats(from, to) {
  const straight = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const road = straight * ROAD_FACTOR;
  return {
    km: round(road, 2),
    straightKm: round(straight, 2),
    min: estimateTravelMinutes(road),
    heading: compassDirection(bearingDeg(from.lat, from.lng, to.lat, to.lng))
  };
}

/** Everything the map needs for one trip. `trip` is a Mongoose doc or plain object. */
function buildGeoView(trip) {
  const t = typeof trip.toObject === 'function' ? trip.toObject() : trip;
  const stops = [];
  const mk = (kind, item, meta) => {
    const p = fromPoint(item.geo);
    return {
      id: meta.id,
      kind,
      dayNumber: meta.dayNumber ?? null,
      index: meta.index,
      title: meta.title,
      subtitle: meta.subtitle || '',
      timeOfDay: item.timeOfDay || item.mealTime || null,
      costUSD: item.estimatedCostUSD ?? item.estimatedCostPerNightUSD ?? null,
      mapsQuery: item.mapsSearchQuery || [meta.title, t.destination].filter(Boolean).join(', '),
      source: item.geoSource || null,
      lat: p ? p.lat : null,
      lng: p ? p.lng : null
    };
  };

  (t.accommodation || []).forEach((h, i) =>
    stops.push(mk('hotel', h, { id: `hotel-${i}`, index: i, title: h.name, subtitle: h.area || h.type }))
  );

  (t.itinerary || []).forEach((day) => {
    (day.activities || []).forEach((a, i) =>
      stops.push(mk('activity', a, { id: `activity-${day.dayNumber}-${i}`, dayNumber: day.dayNumber, index: i, title: a.title, subtitle: a.location }))
    );
    (day.meals || []).forEach((m, i) =>
      stops.push(mk('meal', m, { id: `meal-${day.dayNumber}-${i}`, dayNumber: day.dayNumber, index: i, title: m.restaurantName, subtitle: [m.mealTime, m.cuisine].filter(Boolean).join(' - ') }))
    );
  });

  (t.nearbyAttractions || []).forEach((n, i) => {
    if (n && typeof n === 'object') {
      stops.push(mk('attraction', n, { id: `attraction-${i}`, index: i, title: n.name, subtitle: n.distanceFromMain || '' }));
    }
  });

  // Per-day route statistics: hotel (if known) -> activities in order
  const hotel = stops.find((s) => s.kind === 'hotel' && s.lat !== null);
  const days = (t.itinerary || []).map((day) => {
    const acts = stops.filter((s) => s.kind === 'activity' && s.dayNumber === day.dayNumber);
    const located = acts.filter((s) => s.lat !== null);
    const path = [...(hotel ? [hotel] : []), ...located];
    const legs = [];
    for (let i = 1; i < path.length; i++) {
      legs.push({ from: path[i - 1].id, to: path[i].id, ...legStats(path[i - 1], path[i]) });
    }
    return {
      dayNumber: day.dayNumber,
      theme: day.dayTheme,
      activityCount: acts.length,
      locatedCount: located.length,
      startsAtHotel: Boolean(hotel),
      legs,
      km: round(legs.reduce((s, l) => s + l.km, 0), 1),
      straightKm: round(legs.reduce((s, l) => s + l.straightKm, 0), 1),
      travelMin: legs.reduce((s, l) => s + l.min, 0)
    };
  });

  const located = stops.filter((s) => s.lat !== null);
  const dest = fromPoint(t.destinationGeo && t.destinationGeo.geo);
  const orig = fromPoint(t.originGeo && t.originGeo.geo);

  const features = located.map((s) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    properties: {
      id: s.id, kind: s.kind, day: s.dayNumber, order: s.index + 1, name: s.title,
      description: s.subtitle, timeOfDay: s.timeOfDay, estimatedCostUSD: s.costUSD, positionSource: s.source
    }
  }));
  days.forEach((d) => {
    const coords = stops
      .filter((s) => s.kind === 'activity' && s.dayNumber === d.dayNumber && s.lat !== null)
      .map((s) => [s.lng, s.lat]);
    const path = hotel ? [[hotel.lng, hotel.lat], ...coords] : coords;
    if (path.length > 1) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: path },
        properties: { kind: 'day-route', day: d.dayNumber, estimatedRoadKm: d.km }
      });
    }
  });

  return {
    tripId: String(t._id),
    destinationName: t.destination,
    originName: t.from || null,
    destination: dest ? { name: t.destinationGeo.name || t.destination, ...dest, radiusKm: t.destinationGeo.radiusKm || null } : null,
    origin: orig ? { name: t.originGeo.name || t.from, ...orig } : null,
    stops,
    days,
    totals: {
      stops: stops.length,
      located: located.length,
      approximate: located.filter((s) => s.source === 'approximate').length,
      missing: stops.length - located.length,
      estRoadKm: round(days.reduce((s, d) => s + d.km, 0), 1),
      estTravelMin: days.reduce((s, d) => s + d.travelMin, 0),
      originToDestinationKm: t.routeDistanceKm ?? (dest && orig ? round(haversineKm(orig.lat, orig.lng, dest.lat, dest.lng), 1) : null)
    },
    bbox: boundingBox([...located, dest, orig].filter(Boolean)),
    geojson: { type: 'FeatureCollection', features }
  };
}

/* ------------------------------------------------------------------ */
/* Nearby search                                                       */
/* ------------------------------------------------------------------ */

/** Stops within `radiusKm` of a point, sorted nearest first, with distance + direction. */
function findNearby(stops, lat, lng, radiusKm, kinds = null) {
  return stops
    .filter((s) => s.lat !== null && (!kinds || kinds.includes(s.kind)))
    .map((s) => {
      const distanceKm = haversineKm(lat, lng, s.lat, s.lng);
      return { ...s, distanceKm: round(distanceKm, 2), heading: compassDirection(bearingDeg(lat, lng, s.lat, s.lng)) };
    })
    .filter((s) => s.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/* ------------------------------------------------------------------ */
/* Route optimisation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Compute the best visiting order for a day's activities.
 * Returns the proposed new order without changing the trip.
 */
function planDayOptimization(trip, dayNumber) {
  const day = (trip.itinerary || []).find((d) => d.dayNumber === dayNumber);
  if (!day) return null;

  const acts = day.activities || [];
  const locatedIdx = acts.map((a, i) => (fromPoint(a.geo) ? i : -1)).filter((i) => i !== -1);
  if (locatedIdx.length < 2) return { day, locatedIdx, changed: false, reason: 'Need at least two located activities' };

  const points = locatedIdx.map((i) => fromPoint(acts[i].geo));
  const hotelDoc = (trip.accommodation || []).find((h) => fromPoint(h.geo));
  const start = hotelDoc ? fromPoint(hotelDoc.geo) : null;

  const currentOrder = [...points.keys()];
  const pathLen = (order) => {
    let total = start ? haversineKm(start.lat, start.lng, points[order[0]].lat, points[order[0]].lng) : 0;
    for (let i = 1; i < order.length; i++) {
      total += haversineKm(points[order[i - 1]].lat, points[order[i - 1]].lng, points[order[i]].lat, points[order[i]].lng);
    }
    return total;
  };

  const before = pathLen(currentOrder) * ROAD_FACTOR;
  const { order } = optimizeOrder(points, start);
  const after = pathLen(order) * ROAD_FACTOR;
  const changed = order.some((v, i) => v !== i) && after < before - 0.05;

  return {
    day, locatedIdx, order, changed,
    beforeKm: round(before, 2), afterKm: round(after, 2), savedKm: round(Math.max(0, before - after), 2),
    savedMin: Math.max(0, estimateTravelMinutes(before) - estimateTravelMinutes(after)),
    startsAtHotel: Boolean(start)
  };
}

/** Apply a plan to a Mongoose trip doc (mutates). Reassigns time-of-day slots so the schedule stays coherent. */
function applyDayOptimization(trip, plan) {
  const day = trip.itinerary.find((d) => d.dayNumber === plan.day.dayNumber);
  const originals = plan.locatedIdx.map((i) => day.activities[i].toObject ? day.activities[i].toObject() : { ...day.activities[i] });
  const slots = originals
    .map((a) => a.timeOfDay)
    .sort((a, b) => (SLOT_ORDER[a] ?? 9) - (SLOT_ORDER[b] ?? 9));

  plan.order.forEach((originalPos, newPos) => {
    const moved = { ...originals[originalPos] };
    if (slots[newPos]) moved.timeOfDay = slots[newPos];
    day.activities[plan.locatedIdx[newPos]] = moved;
  });
}

module.exports = {
  cleanGeo, sanitizeItinerary, resolveEndpoints, enrichNewTrip, ensureTripGeo,
  buildGeoView, findNearby, planDayOptimization, applyDayOptimization
};
