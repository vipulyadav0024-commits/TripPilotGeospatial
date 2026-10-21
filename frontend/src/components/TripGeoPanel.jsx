import React, { useState, useEffect, useCallback } from 'react';
import {
  MapIcon, Wand2, Search, Loader2, ChevronRight, Navigation2,
  Hotel, Utensils, Landmark, MapPinned
} from 'lucide-react';
import TripMap, { KIND_COLOR, KIND_LABEL } from './TripMap';

const baseUrl = () => import.meta.env.VITE_API_URL || 'http://localhost:5000';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const KIND_ICON = { hotel: Hotel, activity: MapPinned, meal: Utensils, attraction: Landmark };

/**
 * Geospatial workspace for one trip: interactive map, day filter, per-day
 * route-optimization, and a "nearby" radius search. Sits inside the trip
 * detail view as its own tab/section.
 */
export default function TripGeoPanel({ trip, onTripUpdated }) {
  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDay, setActiveDay] = useState('all');
  const [selectedStop, setSelectedStop] = useState(null);

  const [optimizing, setOptimizing] = useState(false);
  const [optimizePlan, setOptimizePlan] = useState(null);

  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState(3);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyResults, setNearbyResults] = useState(null);
  const [nearbyOrigin, setNearbyOrigin] = useState(null);

  const loadGeo = useCallback(async () => {
    if (!trip?._id) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl()}/api/trips/${trip._id}/geo`, { headers: authHeaders() });
      if (res.ok) setGeo(await res.json());
    } catch (err) {
      console.error('Failed to load map data', err);
    } finally {
      setLoading(false);
    }
  }, [trip?._id]);

  useEffect(() => { loadGeo(); setActiveDay('all'); setOptimizePlan(null); setNearbyResults(null); }, [loadGeo]);

  const refreshMissing = async () => {
    if (!trip?._id) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${baseUrl()}/api/trips/${trip._id}/geo/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        setGeo(data.geo);
        onTripUpdated && onTripUpdated(data.trip);
      }
    } catch (err) {
      console.error('Geo refresh failed', err);
    } finally {
      setRefreshing(false);
    }
  };

  const previewOptimize = async (dayNumber) => {
    setOptimizing(true);
    setOptimizePlan(null);
    try {
      const res = await fetch(`${baseUrl()}/api/trips/${trip._id}/optimize-day/${dayNumber}`, { headers: authHeaders() });
      if (res.ok) setOptimizePlan(await res.json());
    } catch (err) {
      console.error('Optimize preview failed', err);
    } finally {
      setOptimizing(false);
    }
  };

  const applyOptimize = async (dayNumber) => {
    setOptimizing(true);
    try {
      const res = await fetch(`${baseUrl()}/api/trips/${trip._id}/optimize-day/${dayNumber}`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.trip) onTripUpdated && onTripUpdated(data.trip);
        if (data.geo) setGeo(data.geo);
        setOptimizePlan((prev) => (prev ? { ...prev, changed: false, appliedJustNow: true } : prev));
      }
    } catch (err) {
      console.error('Optimize apply failed', err);
    } finally {
      setOptimizing(false);
    }
  };

  const runNearbySearch = async () => {
    if (!selectedStop) return;
    setNearbyLoading(true);
    setNearbyOrigin(selectedStop);
    try {
      const params = new URLSearchParams({ lat: selectedStop.lat, lng: selectedStop.lng, radiusKm: nearbyRadius });
      const res = await fetch(`${baseUrl()}/api/trips/${trip._id}/nearby?${params.toString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNearbyResults(data.results.filter((r) => r.id !== selectedStop.id));
      }
    } catch (err) {
      console.error('Nearby search failed', err);
    } finally {
      setNearbyLoading(false);
    }
  };

  if (loading && !geo) {
    return (
      <div className="h-[420px] flex items-center justify-center bg-white border border-slate-200/80 rounded-3xl">
        <Loader2 className="h-6 w-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  const days = geo?.days || [];

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-brand-600" /> Trip Map
        </h3>
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
          <DayPill active={activeDay === 'all'} onClick={() => { setActiveDay('all'); setOptimizePlan(null); }} label="All days" />
          {days.map((d) => (
            <DayPill
              key={d.dayNumber}
              active={activeDay === d.dayNumber}
              onClick={() => { setActiveDay(d.dayNumber); setOptimizePlan(null); }}
              label={`Day ${d.dayNumber}`}
            />
          ))}
        </div>
      </div>

      <div className="h-[420px]">
        <TripMap
          geo={geo}
          activeDay={activeDay}
          selectedStopId={selectedStop?.id}
          onSelectStop={(s) => { setSelectedStop(s); setNearbyResults(null); }}
          onRefreshGeo={refreshMissing}
          refreshing={refreshing}
        />
      </div>

      {/* Per-day route optimizer */}
      {activeDay !== 'all' && (
        <div className="bg-cream-50 border border-slate-150 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Wand2 className="h-4 w-4 text-brand-600" /> Route optimizer — Day {activeDay}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Reorders this day's activities to cut backtracking, using the shortest visiting path from your hotel.</p>
            </div>
            <button
              type="button"
              onClick={() => previewOptimize(activeDay)}
              disabled={optimizing}
              className="text-xs font-semibold bg-ink-900 hover:bg-ink-950 text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-60"
            >
              {optimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation2 className="h-3.5 w-3.5" />}
              Check route
            </button>
          </div>

          {optimizePlan && (
            <div className="mt-3 bg-white border border-slate-200 rounded-xl p-3 text-sm">
              {optimizePlan.appliedJustNow ? (
                <p className="text-lagoon-700 font-semibold">Route updated — activities reordered on this day.</p>
              ) : !optimizePlan.changed ? (
                <p className="text-slate-600">{optimizePlan.reason || 'Your current order is already close to the shortest route.'}</p>
              ) : (
                <>
                  <p className="text-slate-700">
                    Current order: <b>{optimizePlan.beforeKm} km</b>. Optimized: <b className="text-lagoon-700">{optimizePlan.afterKm} km</b>
                    {' '}— saves ~<b>{optimizePlan.savedKm} km</b> ({optimizePlan.savedMin} min) of travel.
                  </p>
                  <p className="text-xs text-slate-500 mt-2 flex flex-wrap items-center gap-1">
                    {optimizePlan.proposedOrder.map((t, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="bg-cream-100 px-2 py-0.5 rounded-full font-semibold text-slate-700">{t}</span>
                        {i < optimizePlan.proposedOrder.length - 1 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                      </span>
                    ))}
                  </p>
                  <button
                    type="button"
                    onClick={() => applyOptimize(activeDay)}
                    disabled={optimizing}
                    className="mt-3 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 rounded-xl disabled:opacity-60"
                  >
                    Apply this order
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nearby search */}
      <div className="bg-cream-50 border border-slate-150 rounded-2xl p-4">
        <button
          type="button"
          onClick={() => setNearbyOpen((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-bold text-slate-800"
        >
          <span className="flex items-center gap-1.5"><Search className="h-4 w-4 text-brand-600" /> Find what's nearby</span>
          <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${nearbyOpen ? 'rotate-90' : ''}`} />
        </button>

        {nearbyOpen && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-500">
              {selectedStop
                ? <>Searching around <b className="text-slate-700">{selectedStop.title}</b></>
                : 'Tap a pin on the map to search around it.'}
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range" min="0.5" max="20" step="0.5"
                value={nearbyRadius}
                onChange={(e) => setNearbyRadius(Number(e.target.value))}
                className="flex-1 accent-brand-600"
              />
              <span className="text-xs font-bold text-slate-700 w-14 text-right">{nearbyRadius} km</span>
              <button
                type="button"
                onClick={runNearbySearch}
                disabled={!selectedStop || nearbyLoading}
                className="text-xs font-semibold bg-ink-900 hover:bg-ink-950 text-white px-3 py-2 rounded-xl disabled:opacity-40 flex items-center gap-1.5"
              >
                {nearbyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
              </button>
            </div>

            {nearbyResults && (
              nearbyResults.length === 0 ? (
                <p className="text-xs text-slate-500">Nothing else from this trip is within {nearbyRadius} km of {nearbyOrigin?.title}.</p>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {nearbyResults.map((r) => {
                    const Icon = KIND_ICON[r.kind] || MapPinned;
                    return (
                      <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${KIND_COLOR[r.kind]}1a`, color: KIND_COLOR[r.kind] }}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-slate-800 truncate">{r.title}</span>
                          <span className="block text-[11px] text-slate-500">{KIND_LABEL[r.kind]}{r.dayNumber ? ` · Day ${r.dayNumber}` : ''}</span>
                        </span>
                        <span className="text-xs font-bold text-slate-600 shrink-0">{r.distanceKm} km {r.heading}</span>
                      </li>
                    );
                  })}
                </ul>
              )
            )}
          </div>
        )}
      </div>

      {geo && (
        <p className="text-[11px] text-slate-400 text-center">
          Map data &copy; OpenStreetMap contributors · routes are road-distance estimates, not turn-by-turn directions.
        </p>
      )}
    </div>
  );
}

function DayPill({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition ${
        active ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'
      }`}
    >
      {label}
    </button>
  );
}
