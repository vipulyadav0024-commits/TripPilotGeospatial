import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Locate, Route, RefreshCw, Loader2 } from 'lucide-react';

// Leaflet's default marker images reference bundler-relative paths that break
// under Vite; point them at a CDN instead of shipping the PNGs ourselves.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const KIND_COLOR = {
  hotel: '#0ea5a5',      // lagoon
  activity: '#f0442f',   // brand
  meal: '#ffb238',       // sun
  attraction: '#1e2e52'  // ink
};

const KIND_LABEL = { hotel: 'Stay', activity: 'Activity', meal: 'Meal', attraction: 'Nearby' };

const DAY_PALETTE = ['#f0442f', '#0b8686', '#c97511', '#7c231a', '#16223d', '#a32a1d', '#086868'];
const dayColor = (n) => DAY_PALETTE[(Number(n) - 1) % DAY_PALETTE.length];

function pinIcon(color, selected) {
  const size = selected ? 30 : 24;
  return L.divIcon({
    className: 'trippilot-pin',
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 6px rgba(14,23,41,0.35);
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size]
  });
}

/**
 * Interactive Leaflet map for a trip: pins every located stop, draws each day's
 * route as a colored line, and lets the user filter by day or find nearby stops.
 *
 * Props:
 *  - geo: the /api/trips/:id/geo response { stops, days, destination, origin, bbox, totals }
 *  - activeDay: number | 'all' — which day's activities/route to highlight
 *  - onSelectStop: (stop) => void — fired when a marker is clicked
 *  - selectedStopId: string | null
 *  - onRefreshGeo: () => void — "Fix missing pins" action
 *  - refreshing: boolean
 */
export default function TripMap({ geo, activeDay = 'all', onSelectStop, selectedStopId, onRefreshGeo, refreshing }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const [meLatLng, setMeLatLng] = useState(null);

  // Init map once
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: false, attributionControl: true, minZoom: 2 });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    map.setView([20, 0], 2);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const visibleStops = useMemo(() => {
    if (!geo) return [];
    return geo.stops.filter((s) => s.lat !== null && (activeDay === 'all' || s.dayNumber === activeDay || s.dayNumber === null));
  }, [geo, activeDay]);

  // Redraw markers + routes whenever data or the active day changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo) return;
    const layer = layerRef.current;
    layer.clearLayers();

    // Day routes
    geo.days
      .filter((d) => activeDay === 'all' || d.dayNumber === activeDay)
      .forEach((d) => {
        const coords = geo.stops
          .filter((s) => s.kind === 'activity' && s.dayNumber === d.dayNumber && s.lat !== null)
          .map((s) => [s.lat, s.lng]);
        const hotel = geo.stops.find((s) => s.kind === 'hotel' && s.lat !== null);
        const path = hotel ? [[hotel.lat, hotel.lng], ...coords] : coords;
        if (path.length > 1) {
          L.polyline(path, {
            color: dayColor(d.dayNumber), weight: activeDay === 'all' ? 2.5 : 4,
            opacity: activeDay === 'all' ? 0.55 : 0.9, dashArray: activeDay === 'all' ? '1 8' : null,
            lineCap: 'round'
          }).addTo(layer);
        }
      });

    // Markers
    visibleStops.forEach((s) => {
      const color = s.dayNumber && activeDay === 'all' ? dayColor(s.dayNumber) : KIND_COLOR[s.kind] || '#1e2e52';
      const marker = L.marker([s.lat, s.lng], { icon: pinIcon(color, s.id === selectedStopId) });
      const approx = s.source === 'approximate' ? '<div style="color:#c97511;font-weight:600;font-size:11px;margin-top:2px;">Approximate location</div>' : '';
      marker.bindPopup(
        `<div style="font-family:Inter,sans-serif;min-width:160px">
           <div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;font-weight:700;">${KIND_LABEL[s.kind] || s.kind}${s.dayNumber ? ' · Day ' + s.dayNumber : ''}</div>
           <div style="font-weight:700;font-size:14px;color:#0e1729;margin-top:2px;">${escapeHtml(s.title || 'Stop')}</div>
           ${s.subtitle ? `<div style="font-size:12px;color:#475569;margin-top:2px;">${escapeHtml(s.subtitle)}</div>` : ''}
           ${approx}
         </div>`
      );
      marker.on('click', () => onSelectStop && onSelectStop(s));
      marker.addTo(layer);
    });

    // "You are here"
    if (meLatLng) {
      L.circleMarker(meLatLng, { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 })
        .bindPopup('You are here')
        .addTo(layer);
    }

    const bounds = [];
    visibleStops.forEach((s) => bounds.push([s.lat, s.lng]));
    if (geo.destination) bounds.push([geo.destination.lat, geo.destination.lng]);
    if (meLatLng) bounds.push(meLatLng);
    if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [geo, activeDay, visibleStops, selectedStopId, meLatLng, onSelectStop]);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        setMeLatLng(ll);
        if (mapRef.current) mapRef.current.setView(ll, 14);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const missing = geo ? geo.totals.missing : 0;

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden border border-slate-200/80 bg-slate-100">
      <div ref={mapElRef} className="w-full h-full" />

      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-2 max-w-[70%]">
        <div className="bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-sm border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-brand-600" />
          {geo ? `${geo.totals.located}/${geo.totals.stops} stops mapped` : 'Loading map…'}
        </div>
        {geo && geo.totals.estRoadKm > 0 && (
          <div className="bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-sm border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 text-lagoon-600" />
            ~{geo.totals.estRoadKm} km · {Math.round(geo.totals.estTravelMin / 6) / 10}h travel
          </div>
        )}
      </div>

      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
        <button
          type="button"
          onClick={locateMe}
          title="Show my location"
          className="bg-white hover:bg-cream-50 border border-slate-200 rounded-xl p-2 shadow-sm text-ink-900"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
        </button>
        {missing > 0 && onRefreshGeo && (
          <button
            type="button"
            onClick={onRefreshGeo}
            title="Locate missing stops on the map"
            className="bg-white hover:bg-cream-50 border border-slate-200 rounded-xl p-2 shadow-sm text-brand-600"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        )}
      </div>

      {geo && missing > 0 && (
        <div className="absolute bottom-3 left-3 z-[400] bg-sun-50 border border-sun-300 text-sun-700 text-[11px] font-semibold px-3 py-1.5 rounded-xl shadow-sm">
          {missing} stop{missing > 1 ? 's' : ''} not yet on the map
        </div>
      )}
    </div>
  );
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export { KIND_COLOR, KIND_LABEL, dayColor };
