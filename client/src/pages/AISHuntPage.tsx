import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import L from 'leaflet';
import { getMapTileLayer } from '../config/mapConfig';
import { XIcon, ChevronRightIcon } from 'lucide-react';

const VESSEL_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#fb923c', '#f472b6'];

export default function AISHuntPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMmsi, setSelectedMmsi] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const trackLayers = useRef<Map<string, L.LayerGroup>>(new Map());

  useEffect(() => {
    if (!code) return;
    Promise.all([
      api.ais(code),
      api.incidents.get(code).catch(() => null),
    ])
      .then(([d, inc]) => {
        setData(d);
        setIncident(inc);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [code]);

  useEffect(() => {
    if (!data || !mapRef.current || leafletMap.current) return;
    const centerLat = incident?.centerLat ?? 21.803333;
    const centerLon = incident?.centerLon ?? 68.908333;
    const map = L.map(mapRef.current, { center: [centerLat, centerLon], zoom: 9, zoomControl: true });
    getMapTileLayer().addTo(map);

    // Spill centroid
    L.circleMarker([centerLat, centerLon], {
      color: '#E85D04', fillColor: '#E85D04', fillOpacity: 0.8, radius: 8,
    }).bindPopup('<div style="font-family:monospace;font-size:11px;color:#F5F2EA;"><b>AOI / SPILL CENTROID</b></div>').addTo(map);

    // Vessel tracks
    (data.vessels || []).forEach((v: any, idx: number) => {
      const color = VESSEL_COLORS[idx % VESSEL_COLORS.length];
      const group = L.layerGroup().addTo(map);

      const pts: [number, number][] = (v.positions || []).map((p: any) => [p.lat, p.lon]);
      if (pts.length > 1) {
        L.polyline(pts, { color, weight: 1.5, opacity: 0.6 }).addTo(group);
      }
      if (pts.length > 0) {
        const marker = L.circleMarker(pts[pts.length - 1], { color, fillColor: color, fillOpacity: 1, radius: 5 });
        marker.on('click', () => focusVessel(v.mmsi));
        marker.bindPopup(`<div style="font-family:monospace;font-size:11px;color:#F5F2EA;"><b>${v.name}</b><br/>${v.mmsi}<br/>Attribution Score: ${v.overallScore}/100</div>`);
        marker.addTo(group);
      }
      trackLayers.current.set(v.mmsi, group);
    });

    leafletMap.current = map;
  }, [data]);

  function focusVessel(mmsi: string) {
    setSelectedMmsi(mmsi);
    const map = leafletMap.current;
    if (!map || !data) return;
    const v = data.vessels.find((item: any) => item.mmsi === mmsi);
    if (!v || !v.positions?.length) return;
    const last = v.positions[v.positions.length - 1];
    map.flyTo([last.lat, last.lon], 11, { duration: 0.8 });

    (data.vessels || []).forEach((vessel: any) => {
      const group = trackLayers.current.get(vessel.mmsi);
      if (!group) return;
      group.eachLayer((layer: any) => {
        if (layer.setStyle) layer.setStyle({ opacity: vessel.mmsi === mmsi ? 1 : 0.15 });
      });
    });
  }

  function clearSelection() {
    setSelectedMmsi(null);
    if (!data) return;
    (data.vessels || []).forEach((vessel: any) => {
      const group = trackLayers.current.get(vessel.mmsi);
      if (!group) return;
      group.eachLayer((layer: any) => {
        if (layer.setStyle) layer.setStyle({ opacity: 0.6 });
      });
    });
  }

  if (loading) return (
    <PageShell code={code} showProgress>
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-[11px] font-mono tracking-widest text-[#9B9891] animate-pulse">LOADING AIS DATA...</div>
      </div>
    </PageShell>
  );

  if (!data || !data.vessels || data.vessels.length === 0) return (
    <PageShell code={code} showProgress>
      <div className="pt-16 max-w-4xl mx-auto px-6 space-y-8">
        <EmptyState
          title="NO AIS OBSERVATIONS"
          message="No AIS vessel telemetry records match this investigation's geographic area and temporal window."
        />
        <div className="border-t border-[#1a1a1a] pt-6 flex justify-between items-center font-mono">
          <span className="text-xs text-[#555]">
            Advance to forensic candidate attribution scoring
          </span>
          <button
            onClick={() => navigate(`/investigation/${code}/forensics`)}
            className="btn-primary text-xs py-3 px-6 flex items-center gap-2"
          >
            <span>PROCEED TO FORENSICS</span>
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </div>
    </PageShell>
  );

  const selectedVessel = data.vessels.find((v: any) => v.mmsi === selectedMmsi);

  return (
    <PageShell code={code} showProgress>
      <div className="min-h-screen max-w-7xl mx-auto px-6 space-y-12 py-8 pb-32">
        {/* Header */}
        <div className="border-b border-[#141414] pb-6 flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-[0.35em] text-[#9B9891] uppercase mb-2">STAGE 05 · AIS VESSEL HUNT</div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#F5F2EA]">AIS Vessel Correlation</h1>
            <div className="text-[#66635D] text-xs font-mono mt-1">
              {data.totalTracked} vessels cross-referenced in corridor
            </div>
          </div>
        </div>

        {/* Map + Vessel Ranking Visual */}
        <div className="grid grid-cols-1 lg:grid-cols-3 relative border border-[#222]" style={{ minHeight: '68vh' }}>
          {/* Large Map */}
          <div className="lg:col-span-2 relative" style={{ minHeight: '60vh' }}>
            <div ref={mapRef} className="absolute inset-0 w-full h-full" />
            <div className="absolute top-3 left-3 z-[1000] bg-[#050505]/85 border border-[#222] px-3 py-2 text-[10px] font-mono text-[#9B9891]">
              Select vessel in list or on map to inspect
            </div>

            {/* Contextual Side Panel on Selection */}
            <AnimatePresence>
              {selectedVessel && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="absolute bottom-4 left-4 z-[1000] w-96 bg-[#0c0c0c]/95 backdrop-blur-md border border-[#222] p-5 shadow-2xl font-mono"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[9px] text-[#E85D04] uppercase tracking-widest border border-[#E85D04]/30 px-1.5 py-0.5">
                        INSPECTED VESSEL
                      </span>
                      <h4 className="text-sm font-bold text-[#F5F2EA] mt-1.5">{selectedVessel.name}</h4>
                      <div className="text-[10px] text-[#66635D]">MMSI: {selectedVessel.mmsi} · {selectedVessel.type}</div>
                    </div>
                    <button
                      onClick={clearSelection}
                      className="p-1 border border-[#222] text-[#9B9891] hover:text-[#F5F2EA] hover:border-[#444]"
                    >
                      <XIcon size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-[#1a1a1a] pt-3 mb-3">
                    <div>
                      <div className="text-[9px] text-[#555] uppercase">ATTRIBUTION SCORE</div>
                      <div className="text-sm font-bold text-[#E85D04] mt-0.5">{selectedVessel.overallScore} / 100</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#555] uppercase">CLOSEST CPA</div>
                      <div className="text-xs text-[#F5F2EA] mt-0.5">
                        {selectedVessel.closestDistanceKm != null
                          ? `${selectedVessel.closestDistanceKm} km from origin`
                          : <span className="text-[#555] italic">N/A — Origin Unavailable</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#555] uppercase">AIS BLACKOUT</div>
                      <div className="text-xs text-[#9B9891] mt-0.5">{selectedVessel.aisBlackoutMinutes} min</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#555] uppercase">SPEED DROP</div>
                      <div className="text-xs text-[#9B9891] mt-0.5">{selectedVessel.speedDropKnots} knots</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Compact Candidate Vessels Ranking */}
          <div className="border-l border-[#141414] overflow-y-auto bg-[#080808]" style={{ maxHeight: '68vh' }}>
            <div className="px-5 py-4 border-b border-[#141414]">
              <div className="section-label">Candidate Vessels (Ranked)</div>
            </div>

            {data.vessels.slice(0, 8).map((v: any, idx: number) => {
              const color = VESSEL_COLORS[idx % VESSEL_COLORS.length];
              const isSelected = selectedMmsi === v.mmsi;
              return (
                <button
                  key={v.mmsi}
                  onClick={() => focusVessel(v.mmsi)}
                  className={`w-full text-left px-5 py-4 border-b border-[#141414] transition-colors ${
                    isSelected ? 'bg-[#E85D04]/10' : 'hover:bg-[#111]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="font-medium text-[#F5F2EA] text-sm">{v.name}</span>
                    </div>
                    <div className={`text-sm font-bold font-mono ${v.overallScore >= 70 ? 'text-[#E85D04]' : 'text-[#9B9891]'}`}>
                      {v.overallScore}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-[#555] space-y-0.5">
                    <div>MMSI: {v.mmsi} · Type: {v.type}</div>
                    <div>CPA: {v.closestDistanceKm} km · Blackout: {v.aisBlackoutMinutes} min</div>
                  </div>
                  <div className="mt-2 h-1 bg-[#1a1a1a] overflow-hidden">
                    <div className="h-full bg-[#E85D04]" style={{ width: v.overallScore + '%' }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Progression CTA */}
        <div className="pt-8 border-t border-[#1a1a1a] flex justify-between items-center font-mono">
          <div className="text-xs text-[#555]">
            Evidence layer 05 verified · Advance to candidate forensics
          </div>
          <button
            onClick={() => navigate(`/investigation/${code}/forensics`)}
            className="btn-primary text-xs py-3 px-6 flex items-center gap-2"
          >
            <span>CONTINUE TO FORENSICS</span>
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </div>
    </PageShell>
  );
}
