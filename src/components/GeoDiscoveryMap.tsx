import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface GeoDiscoveryMapProps {
  workers?: any[];
  jobs?: any[];
  center?: [number, number]; // [lat, lng]
  zoom?: number;
  heightClass?: string;
  onSelectWorker?: (worker: any) => void;
  onSelectJob?: (job: any) => void;
}

export function GeoDiscoveryMap({
  workers = [],
  jobs = [],
  center = [18.4088, 76.5604], // Default: Latur, Maharashtra
  zoom = 7,
  heightClass = 'h-[440px]',
  onSelectWorker,
  onSelectJob,
}: GeoDiscoveryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      scrollWheelZoom: false,
      preferCanvas: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;
    const group = layerGroupRef.current;
    group.clearLayers();

    // Render approximate privacy-preserving circles (~850m) for workers
    workers.forEach((w) => {
      const coords = w.profile?.location?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const [lng, lat] = coords;

      const circle = L.circle([lat, lng], {
        radius: 850,
        color: '#0d9488',
        fillColor: '#0d9488',
        fillOpacity: 0.22,
        weight: 1.5,
      });

      const score = w.reputation?.overallScore ?? 72;
      const genderLabel = w.gender && w.gender !== 'Unspecified' ? ` · ${w.gender}` : '';
      circle.bindPopup(
        `<div style="font-family: sans-serif; min-width: 195px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${w.name}</div>
          <div style="color: #475569; font-size: 11px; margin-top: 2px;">${w.profile?.category || 'Trade'}${genderLabel} · ${w.city}</div>
          <div style="color: #0d9488; font-weight: 600; font-size: 11px; margin-top: 4px;">Reputation: ${score}/100 · ₹${w.profile?.expectedDailyWage || 750}/day</div>
          <div style="color: #64748b; font-size: 10px; margin-top: 3px;">Approximate ~850m zone (exact address protected)</div>
        </div>`
      );
      if (onSelectWorker) {
        circle.on('click', () => onSelectWorker(w));
      }
      circle.addTo(group);
    });

    // Render open & emergency job markers
    jobs.forEach((j) => {
      const coords = j.location?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const [lng, lat] = coords;

      const marker = L.circleMarker([lat, lng], {
        radius: j.isEmergency ? 9 : 7,
        color: j.isEmergency ? '#dc2626' : '#0f1d38',
        fillColor: j.isEmergency ? '#ef4444' : '#1e3a8a',
        fillOpacity: 0.85,
        weight: 2,
      });

      marker.bindPopup(
        `<div style="font-family: sans-serif; min-width: 200px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${j.isEmergency ? '[URGENT] ' : ''}${j.title}</div>
          <div style="color: #475569; font-size: 11px; margin-top: 2px;">${j.category} · ${j.city}</div>
          <div style="color: #0f1d38; font-weight: 600; font-size: 11px; margin-top: 4px;">Budget: ₹${j.dailyWageBudget}/day · ${j.durationDays} day(s)</div>
        </div>`
      );
      if (onSelectJob) {
        marker.on('click', () => onSelectJob(j));
      }
      marker.addTo(group);
    });
  }, [workers, jobs]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
      <div ref={containerRef} className={`w-full ${heightClass}`} />
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 bg-white border-t border-slate-200 text-xs text-slate-600">
        <div className="flex items-center gap-5">
          <span>Teal Zone: Skilled Worker (~850m privacy radius)</span>
          <span>·</span>
          <span>Navy Marker: Open Job</span>
          <span>·</span>
          <span>Crimson Marker: Emergency Hiring</span>
        </div>
        <span className="text-slate-500">2dsphere Geospatial Discovery · OpenStreetMap</span>
      </div>
    </div>
  );
}
