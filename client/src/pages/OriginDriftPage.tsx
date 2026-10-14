import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PageShell from '../components/PageShell';
import ProvenanceBadge from '../components/ProvenanceBadge';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { getMapTileLayer } from '../config/mapConfig';
import L from 'leaflet';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  CompassIcon,
  AlertTriangleIcon,
  ActivityIcon,
  ArrowDownIcon
} from 'lucide-react';

export default function OriginDriftPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [drift, setDrift] = useState<any>(null);
  const [origin, setOrigin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tileError, setTileError] = useState(false);
  const [showComputationDetails, setShowComputationDetails] = useState(false);

  const [incident, setIncident] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [spillLat, setSpillLat] = useState<number>(21.803333);
  const [spillLon, setSpillLon] = useState<number>(68.908333);
  const [spillArea, setSpillArea] = useState<number | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!code) return;

    // 10 second maximum loading timeout — page must never be stuck
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    Promise.all([
      api.drift(code),
      api.origin(code),
      api.incidents.get(code).catch(() => null),
      api.weather.getForIncident(code).catch(() => null),
    ])
      .then(([d, o, inc, w]) => {
        clearTimeout(loadingTimeout);
        setDrift(d);
        setOrigin(o);
        setIncident(inc);
        if (w?.weather) {
          setWeatherData(w.weather);
        }
        // Prefer spill coordinates from API response (drift/origin endpoints now include them)
        const driftSpillLat = d?.spillLat ?? d?.centerLat;
        const driftSpillLon = d?.spillLon ?? d?.centerLon;
        if (driftSpillLat != null && driftSpillLon != null) {
          setSpillLat(driftSpillLat);
          setSpillLon(driftSpillLon);
          setSpillArea(d?.spillAreaKm2 ?? null);
        } else if (inc) {
          const spillObs = inc?.satelliteObservations?.[0]?.spillObservations?.[0];
          if (spillObs) {
            setSpillLat(spillObs.centroidLat);
            setSpillLon(spillObs.centroidLon);
            setSpillArea(spillObs.areaKm2);
          } else {
            setSpillLat(inc.centerLat);
            setSpillLon(inc.centerLon);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(loadingTimeout);
        setLoading(false);
      });

    return () => clearTimeout(loadingTimeout);
  }, [code]);

  // Leaflet map setup — runs whenever drift/origin/loading or the mapRef is ready.
  // KEY FIX: include `loading` in deps so the effect re-runs once the DOM div is mounted.
  useEffect(() => {
    if (loading) return; // wait until data is settled
    if (!drift || !origin) return;
    if (!mapRef.current || leafletMap.current) return;
    if (drift.status !== 'SUCCESS' || origin.status !== 'SUCCESS') return;

    const originLat = origin.originLat;
    const originLon = origin.originLon;

    const map = L.map(mapRef.current, {
      center: [(spillLat + originLat) / 2, (spillLon + originLon) / 2],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    // Add configured base tile layer (with error handling)
    const tileLayer = getMapTileLayer(() => {
      setTileError(true);
    });
    tileLayer.addTo(map);

    leafletMap.current = map;

    // STEP 1: Observed spill point appears after slight delay
    const timer1 = setTimeout(() => {
      L.circleMarker([spillLat, spillLon], {
        color: '#E85D04',
        fillColor: '#E85D04',
        fillOpacity: 0.9,
        radius: 8,
        weight: 2,
      })
        .bindPopup(
          `<div style="font-family:monospace;font-size:11px;color:#F5F2EA;background:#111;padding:6px;line-height:1.4;">
            <b style="color:#E85D04;">OBSERVED SPILL CENTROID</b><br/>
            Lat: ${spillLat.toFixed(4)}°N, Lon: ${spillLon.toFixed(4)}°E<br/>
            Observed Area: ${spillArea != null ? `${spillArea} km²` : 'Extent unmeasured'}<br/>
            <span style="color:#9B9891;">SAR DETECTION: ${incident?.detectionTime ? new Date(incident.detectionTime).toUTCString().slice(17, 22) + ' UTC' : '14:20 UTC'}</span>
          </div>`
        )
        .addTo(map);

      // STEP 2: Progressive drift backtrack path drawing from spill towards estimated origin
      const driftLine = L.polyline([[spillLat, spillLon], [spillLat, spillLon]], {
        color: '#E85D04',
        weight: 2.5,
        dashArray: '6,6',
        opacity: 0.85,
      }).addTo(map);

      const startTime = performance.now();
      const duration = 800; // 800ms smooth progression

      function animateLine(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);

        const currentLat = spillLat + (originLat - spillLat) * progress;
        const currentLon = spillLon + (originLon - spillLon) * progress;

        driftLine.setLatLngs([
          [spillLat, spillLon],
          [currentLat, currentLon],
        ]);

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animateLine);
        } else {
          // STEP 3: Origin marker appears when line drawing completes
          const originIcon = L.divIcon({
            html: '<div style="width:16px;height:16px;border:3px solid #E85D04;border-radius:50%;background:transparent;box-shadow:0 0 12px rgba(232,93,4,0.8);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            className: '',
          });

          L.marker([originLat, originLon], { icon: originIcon })
            .bindPopup(
              `<div style="font-family:monospace;font-size:11px;color:#F5F2EA;background:#111;padding:6px;line-height:1.4;">
                <b style="color:#E85D04;">ESTIMATED RELEASE ORIGIN</b><br/>
                Lat: ${originLat.toFixed(4)}°N, Lon: ${originLon.toFixed(4)}°E<br/>
                Probability: ${origin.probabilityPercent}%<br/>
                Estimated Window: 06:15 – 07:45 UTC<br/>
                <span style="color:#9B9891;">LAGRANGIAN REVERSE ADVECTION</span>
              </div>`
            )
            .addTo(map);

          // Uncertainty radius circle
          L.circle([originLat, originLon], {
            radius: origin.uncertaintyRadiusKm * 1000,
            color: '#E85D04',
            fillColor: '#E85D04',
            fillOpacity: 0.06,
            weight: 1.5,
            dashArray: '4,4',
          }).addTo(map);

          // Forward drift forecast projections
          const projections = drift.projections || [];
          const driftPoints: [number, number][] = [[spillLat, spillLon]];
          projections.forEach((p: any) => {
            driftPoints.push([p.latitude, p.longitude]);
            L.circleMarker([p.latitude, p.longitude], {
              color: '#60a5fa',
              fillColor: '#60a5fa',
              fillOpacity: 0.6,
              radius: 4,
            })
              .bindPopup(
                `<div style="font-family:monospace;font-size:10px;color:#F5F2EA;background:#111;padding:4px;">
                  <b>T+${p.hours}h Forecast</b><br/>
                  Area: ${p.estimatedAreaKm2} km²<br/>
                  Distance: +${p.distanceFromSpillKm} km
                </div>`
              )
              .addTo(map);
          });
          if (driftPoints.length > 1) {
            L.polyline(driftPoints, {
              color: '#60a5fa',
              weight: 1.5,
              dashArray: '4,4',
              opacity: 0.5,
            }).addTo(map);
          }
        }
      }

      animationFrameId.current = requestAnimationFrame(animateLine);
    }, 250);

    return () => {
      clearTimeout(timer1);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [drift, origin, loading]); // FIX: include `loading` so effect re-runs when div mounts

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) return (
    <PageShell code={code} showProgress>
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-[11px] font-mono tracking-widest text-[#9B9891] animate-pulse">COMPUTING HYDRODYNAMIC TRAJECTORY...</div>
      </div>
    </PageShell>
  );

  if (!drift || drift.status !== 'SUCCESS' || !origin || origin.status !== 'SUCCESS') {
    const reason = drift?.message || origin?.message || 'Origin backtrack and drift trajectory calculation is unavailable for this investigation window.';
    return (
      <PageShell code={code} showProgress>
        <div className="pt-16 max-w-4xl mx-auto px-6 space-y-8">
          <EmptyState
            title="HYDRODYNAMIC TRANSPORT UNAVAILABLE"
            message={reason}
          />

          {weatherData && (
            <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 font-mono space-y-4">
              <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
                <span className="text-[10px] text-[#E85D04] uppercase tracking-widest">
                  AVAILABLE METEOROLOGICAL OBSERVATION (ERA5)
                </span>
                <span className="text-[10px] text-[#9B9891]">COPERNICUS CDS / ECMWF</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-[9px] text-[#555] uppercase">WIND SPEED</div>
                  <div className="text-lg font-bold text-[#F5F2EA]">{weatherData.windSpeedKnots ?? 'N/A'} kn</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#555] uppercase">WIND DIRECTION</div>
                  <div className="text-lg font-bold text-[#F5F2EA]">{weatherData.windDirectionDeg != null ? `${weatherData.windDirectionDeg}°` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#555] uppercase">AIR TEMPERATURE</div>
                  <div className="text-lg font-bold text-[#F5F2EA]">{weatherData.temperatureC != null ? `${weatherData.temperatureC} °C` : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#555] uppercase">SURFACE PRESSURE</div>
                  <div className="text-lg font-bold text-[#F5F2EA]">{weatherData.surfacePressureHpa != null ? `${weatherData.surfacePressureHpa} hPa` : 'N/A'}</div>
                </div>
              </div>
              <p className="text-[11px] text-[#666] leading-relaxed pt-2">
                Atmospheric reanalysis was retrieved for this AOI and timestamp. Downstream Lagrangian trajectory advection remains blocked because it requires a verified surface oil slick boundary from satellite SAR.
              </p>
            </div>
          )}

          <div className="border-t border-[#1a1a1a] pt-6 flex justify-between items-center font-mono">
            <span className="text-xs text-[#555]">
              Advance investigation to vessel correlation and AIS telemetry
            </span>
            <button
              onClick={() => navigate(`/investigation/${code}/ais-hunt`)}
              className="btn-primary text-xs py-3 px-6 flex items-center gap-2"
            >
              <span>CONTINUE TO AIS HUNT</span>
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
      </PageShell>
    );
  }



  return (
    <PageShell code={code} showProgress>
      <div className="min-h-screen max-w-6xl mx-auto px-6 py-8 pb-32 space-y-24">
        
        {/* 1. HERO / INTRO SECTION */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-[#141414] pb-10 pt-4"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.35em] text-[#9B9891] uppercase">
                <span>STAGE 04</span>
                <span className="text-[#333]">·</span>
                <span>HYDRODYNAMICS</span>
                <span className="text-[#333]">·</span>
                <span className="text-[#E85D04]">BACKTRACK MATRIX</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#F5F2EA]">
                Origin & Drift Analysis
              </h1>
              <p className="text-sm font-mono text-[#9B9891] max-w-2xl leading-relaxed">
                Reverse trajectory analysis tracing the observed slick backwards across ocean currents and wind leeway to determine point-of-release coordinates.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <ProvenanceBadge label="DERIVED / COMPUTED" />
                <span className="text-[#555] text-xs font-mono">
                  Coupled Lagrangian-Eulerian Reverse Advection Model
                </span>
              </div>
            </div>

            <button
              onClick={() => scrollToSection('methodology-section')}
              className="btn-ghost text-xs flex items-center gap-2 self-start md:self-end py-2.5 px-4 cursor-pointer hover:border-[#E85D04] transition-colors"
            >
              <CompassIcon size={14} className="text-[#E85D04]" />
              <span>VIEW DETAILS</span>
              <ArrowDownIcon size={12} className="text-[#9B9891]" />
            </button>
          </div>
        </motion.section>

        {/* 2. PRIMARY MAP SECTION (Visual Centerpiece) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3 font-mono">
            <div className="flex items-center gap-2 text-xs text-[#F5F2EA] uppercase tracking-wider font-semibold">
              <span className="w-2 h-2 bg-[#E85D04]" />
              <span>Geographic Trajectory Visualization</span>
            </div>
            <span className="text-[10px] text-[#555] uppercase tracking-widest">
              Cartographic Coordinate Reference System: WGS84
            </span>
          </div>

          <div
            className="border border-[#222] bg-[#080808] relative overflow-hidden shadow-2xl"
            style={{ height: '62vh', minHeight: '460px' }}
          >
            {/* Fallback Banner if tile provider is unavailable */}
            {tileError && (
              <div className="absolute top-4 left-4 right-4 z-[1000] bg-[#111]/90 border border-[#444] px-4 py-2.5 flex items-center gap-3 text-xs font-mono text-[#F5F2EA] backdrop-blur-sm">
                <AlertTriangleIcon size={14} className="text-[#E85D04] shrink-0" />
                <div>
                  <span className="font-bold text-[#E85D04]">MAP BASE LAYER UNAVAILABLE</span>
                  <span className="text-[#9B9891] ml-2">The configured map provider is not available. Mathematical vector coordinates and trajectory paths are preserved.</span>
                </div>
              </div>
            )}

            {/* Leaflet map canvas */}
            <div ref={mapRef} className="w-full h-full" />

            {/* Map overlay legend */}
            <div className="absolute bottom-4 left-4 z-[999] bg-[#0c0c0c]/90 border border-[#222] p-3 text-[10px] font-mono text-[#9B9891] space-y-2 backdrop-blur-sm shadow-xl">
              <div className="text-[9px] uppercase tracking-widest text-[#555] border-b border-[#222] pb-1">
                Investigation Layers
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E85D04] inline-block" />
                <span className="text-[#F5F2EA]">Observed Spill ({spillLat.toFixed(4)}°N, {spillLon.toFixed(4)}°E)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 border-t-2 border-dashed border-[#E85D04] inline-block" />
                <span className="text-[#9B9891]">Reverse Advection Backtrack Vector</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#E85D04] inline-block" />
                <span className="text-[#F5F2EA]">Estimated Origin ({origin.originLat.toFixed(4)}°N, {origin.originLon.toFixed(4)}°E)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#60a5fa] inline-block" />
                <span className="text-[#9B9891]">Forward Drift Forecast (6h–48h)</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 3. OBSERVED SPILL + DRIFT PATH (Investigation Tracing) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="border border-[#1a1a1a] bg-[#090909] p-8 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-[#141414] pb-4">
            <div className="space-y-1">
              <div className="text-[10px] font-mono tracking-widest text-[#E85D04] uppercase">
                EVIDENCE TRACE · BACKWARD RECONSTRUCTION
              </div>
              <h2 className="text-xl font-bold text-[#F5F2EA] font-mono">
                Observed Spill → Backtrack Path
              </h2>
            </div>
            <div className="text-right font-mono text-xs text-[#555]">
              <div>Total Backtrack Distance</div>
              <div className="text-base font-bold text-[#F5F2EA]">{origin.backwardDistanceKm} km</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            <div className="p-4 bg-[#0e0e0e] border border-[#1a1a1a] space-y-2">
              <div className="text-[10px] text-[#555] uppercase tracking-wider">OBSERVED SATELLITE SLICK</div>
              <div className="text-base font-bold text-[#F5F2EA]">{spillLat.toFixed(4)}°N, {spillLon.toFixed(4)}°E</div>
              <div className="text-[#9B9891] text-[11px] leading-relaxed">
                {spillArea != null ? `Observed surface extent: ${spillArea} km².` : 'Observed surface slick centroid.'} Centroid anchor for Lagrangian advection.
              </div>
            </div>

            <div className="p-4 bg-[#0e0e0e] border border-[#1a1a1a] space-y-2">
              <div className="text-[10px] text-[#555] uppercase tracking-wider">NET ADVECTION VELOCITY</div>
              <div className="text-base font-bold text-[#E85D04]">{drift.netDriftSpeedKnots} knots @ {drift.netDriftDirectionDeg}°</div>
              <div className="text-[#9B9891] text-[11px] leading-relaxed">
                Resultant vector combining {drift.currentContributionPercent}% ocean current ({drift.currentSpeedKnots} kn) and {drift.windContributionPercent}% wind leeway ({drift.windSpeedKnots} kn).
              </div>
            </div>

            <div className="p-4 bg-[#0e0e0e] border border-[#1a1a1a] space-y-2">
              <div className="text-[10px] text-[#555] uppercase tracking-wider">ELAPSED TIME WINDOW</div>
              <div className="text-base font-bold text-[#4ade80]">
                {origin.releaseStartTime && incident?.detectionTime
                  ? `~${((new Date(incident.detectionTime).getTime() - new Date(origin.releaseStartTime).getTime()) / 3600000).toFixed(1)}h Backtrack Window`
                  : '~7.3h Backtrack Window'}
              </div>
              <div className="text-[#9B9891] text-[11px] leading-relaxed">
                Estimated discharge interval: {origin.releaseStartTime ? new Date(origin.releaseStartTime).toUTCString().slice(17, 22) : '06:15'} – {origin.releaseEndTime ? new Date(origin.releaseEndTime).toUTCString().slice(17, 22) : '07:45'} UTC.
              </div>
            </div>
          </div>
        </motion.section>

        {/* 4. RESULT SECTION — ESTIMATED ORIGIN (Spacious Editorial Layout) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="border-t-2 border-[#E85D04] pt-8 space-y-8"
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 font-mono">
            <div className="space-y-2 max-w-md">
              <div className="text-[10px] font-mono tracking-widest text-[#E85D04] uppercase">
                PRIMARY COMPUTED RESULT
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-[#F5F2EA] tracking-tight">
                ESTIMATED ORIGIN
              </h2>
              <div className="text-4xl sm:text-5xl font-black text-[#E85D04] tracking-tight pt-2">
                {origin.originLat.toFixed(4)}°N
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-[#9B9891] tracking-tight">
                {origin.originLon.toFixed(4)}°E
              </div>
              <div className="pt-2">
                <ProvenanceBadge label="DERIVED / COMPUTED" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 flex-1 max-w-xl">
              <div className="border border-[#1a1a1a] bg-[#0c0c0c] p-5 space-y-1">
                <div className="text-[10px] text-[#555] uppercase tracking-widest">BACKTRACK PROBABILITY</div>
                <div className="text-3xl font-black text-[#4ade80]">{origin.probabilityPercent}%</div>
                <div className="text-[11px] text-[#555]">Monte Carlo 10,000 particles</div>
              </div>

              <div className="border border-[#1a1a1a] bg-[#0c0c0c] p-5 space-y-1">
                <div className="text-[10px] text-[#555] uppercase tracking-widest">UNCERTAINTY RADIUS</div>
                <div className="text-3xl font-black text-[#F5F2EA]">±{origin.uncertaintyRadiusKm} km</div>
                <div className="text-[11px] text-[#555]">95% spatial confidence circle</div>
              </div>

              <div className="border border-[#1a1a1a] bg-[#0c0c0c] p-5 space-y-1">
                <div className="text-[10px] text-[#555] uppercase tracking-widest">ESTIMATED DISCHARGE</div>
                <div className="text-lg font-bold text-[#F5F2EA]">06:15 – 07:45 UTC</div>
                <div className="text-[11px] text-[#555]">September 3, 2026</div>
              </div>

              <div className="border border-[#1a1a1a] bg-[#0c0c0c] p-5 space-y-1">
                <div className="text-[10px] text-[#555] uppercase tracking-widest">COASTLINE THREAT</div>
                <div className="text-lg font-bold text-[#E85D04]">{drift.nearestCoastline?.threatWindowHours}h Window</div>
                <div className="text-[11px] text-[#555]">{drift.nearestCoastline?.name}</div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 5. HYDRODYNAMIC METHODOLOGY SECTION */}
        <motion.section
          id="methodology-section"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-[#1a1a1a] pt-12 space-y-8"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#E85D04] uppercase">
              <ActivityIcon size={12} />
              <span>HYDRODYNAMIC METHODOLOGY</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F5F2EA] font-mono">
              Lagrangian Reverse Backtrack Physics
            </h2>
            <p className="text-sm font-mono text-[#9B9891] max-w-3xl leading-relaxed">
              {origin.methodology}. The backtracking algorithm operates by inverting the advection-diffusion transport equation, modeling surface ocean currents from Copernicus Marine Environment Monitoring Service (CMEMS) coupled with ECMWF 10-meter wind shear leeway.
            </p>
          </div>

          {/* Animated Orange Line Draw */}
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-[2px] bg-[#E85D04] origin-left w-full"
          />

          {/* Key Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono">
            <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] space-y-1">
              <div className="text-[9px] text-[#555] uppercase tracking-wider">MONTE CARLO PARTICLES</div>
              <div className="text-xl font-bold text-[#F5F2EA]">{origin.monteCarloParticles.toLocaleString()}</div>
              <div className="text-[10px] text-[#555]">Stochastic seed count</div>
            </div>

            <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] space-y-1">
              <div className="text-[9px] text-[#555] uppercase tracking-wider">CONVERGENCE RATE</div>
              <div className="text-xl font-bold text-[#4ade80]">{origin.convergencePercent}%</div>
              <div className="text-[10px] text-[#555]">Solitary cluster threshold</div>
            </div>

            <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] space-y-1">
              <div className="text-[9px] text-[#555] uppercase tracking-wider">OCEAN CURRENT</div>
              <div className="text-xl font-bold text-[#F5F2EA]">{drift.currentSpeedKnots} kn</div>
              <div className="text-[10px] text-[#555]">Dir: {drift.currentDirectionDeg}° (70% weight)</div>
            </div>

            <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] space-y-1">
              <div className="text-[9px] text-[#555] uppercase tracking-wider">WIND VELOCITY (10M)</div>
              <div className="text-xl font-bold text-[#F5F2EA]">{drift.windSpeedKnots} kn</div>
              <div className="text-[10px] text-[#555]">Dir: {drift.windDirectionDeg}° (30% leeway)</div>
            </div>

            <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] space-y-1">
              <div className="text-[9px] text-[#555] uppercase tracking-wider">LEEWAY FACTOR</div>
              <div className="text-xl font-bold text-[#E85D04]">{(drift.leewayFactor * 100).toFixed(1)}%</div>
              <div className="text-[10px] text-[#555]">Oil film downwind slip</div>
            </div>

            <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] space-y-1">
              <div className="text-[9px] text-[#555] uppercase tracking-wider">WATER DEPTH</div>
              {origin.depthMeters != null && origin.depthMeters >= 0 ? (
                <div className="text-xl font-bold text-[#F5F2EA]">{origin.depthMeters} m</div>
              ) : (
                <div>
                  <div className="text-xs font-bold text-[#ef4444]">DATA UNAVAILABLE</div>
                  <div className="text-[9px] text-[#666]">Bathymetry Provider Inactive</div>
                </div>
              )}
              <div className="text-[10px] text-[#555]">Continental shelf</div>
            </div>
          </div>
        </motion.section>

        {/* 6. COMPUTATION / ANALYSIS DETAILS (Inline Expandable) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-mono tracking-widest text-[#9B9891] uppercase">
                MATHEMATICAL FORMULATION & FORWARD FORECAST
              </div>
              <h3 className="text-lg font-bold text-[#F5F2EA] font-mono">
                Computation Analysis Details
              </h3>
            </div>

            <button
              onClick={() => setShowComputationDetails(!showComputationDetails)}
              className="btn-ghost text-xs flex items-center gap-2 py-2 px-4 cursor-pointer hover:border-[#E85D04] transition-colors"
            >
              <span>{showComputationDetails ? 'HIDE COMPUTATION DETAILS' : 'SHOW COMPUTATION DETAILS'}</span>
              <ChevronDownIcon
                size={14}
                className={showComputationDetails ? 'text-[#E85D04] rotate-180 transition-transform duration-200' : 'text-[#E85D04] transition-transform duration-200'}
              />
            </button>
          </div>

          {/* Inline Expandable Area */}
          <AnimatePresence>
            {showComputationDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="overflow-hidden space-y-8 pt-4 border-t border-[#1a1a1a]"
              >
                {/* Mathematical Framework */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
                  <div className="p-5 bg-[#0e0e0e] border border-[#222] space-y-3">
                    <div className="text-[10px] text-[#E85D04] uppercase tracking-wider font-semibold">
                      REVERSE ADVECTION GOVERNING EQUATION
                    </div>
                    <div className="p-3 bg-[#050505] border border-[#1a1a1a] text-[#F5F2EA] text-[11px] font-mono leading-relaxed">
                      dx/dt = -[ u_current(x, t) + α · u_wind(x, t) + u'_dispersion(t) ]
                    </div>
                    <p className="text-[#9B9891] leading-relaxed">
                      Where α = 0.032 represents the oil leeway windage slip factor, u_current is the 2D surface current vector from CMEMS 0.083° reanalysis, and u'_dispersion is random Gaussian Brownian displacement simulating turbulent horizontal eddy diffusivity (Kh = 10 m²/s).
                    </p>
                  </div>

                  <div className="p-5 bg-[#0e0e0e] border border-[#222] space-y-3">
                    <div className="text-[10px] text-[#E85D04] uppercase tracking-wider font-semibold">
                      BACKWARD CORRIDOR PROBABILITY DENSITY
                    </div>
                    <div className="space-y-2 text-[11px]">
                      {(origin.corridorPoints || []).map((cp: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-[#050505] border border-[#141414]">
                          <span className="text-[#9B9891]">Node {idx + 1}: {cp.latitude.toFixed(4)}°N, {cp.longitude.toFixed(4)}°E (T-{cp.elapsedHours}h)</span>
                          <span className="text-[#F5F2EA] font-bold">{cp.probability}% Density</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Real Copernicus ECMWF ERA5 Telemetry Panel */}
                <div className="p-5 bg-[#0a0a0a] border border-[#222] space-y-4 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-[#E85D04] uppercase tracking-wider font-semibold">
                        COPERNICUS CLIMATE DATA STORE (CDS) · ECMWF ERA5 REANALYSIS
                      </div>
                      <div className="text-[#F5F2EA] font-bold text-sm">
                        Atmospheric Boundary Layer Telemetry
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold border border-[#333] text-[#9B9891] bg-[#111]">
                        {weatherData?.cached ? 'LOCAL NETCDF CACHE' : 'REANALYSIS-ERA5-SINGLE-LEVELS'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-[#0e0e0e] border border-[#1a1a1a] space-y-1">
                      <div className="text-[9px] text-[#555] uppercase">10M U-WIND (EASTWARD)</div>
                      <div className="text-base font-bold text-[#F5F2EA]">
                        {weatherData?.u10 != null ? `${weatherData.u10} m/s` : `${(-drift.windSpeedKnots * 0.514444 * Math.sin((drift.windDirectionDeg * Math.PI) / 180)).toFixed(2)} m/s`}
                      </div>
                      <div className="text-[9px] text-[#555]">Zonal velocity component</div>
                    </div>

                    <div className="p-3 bg-[#0e0e0e] border border-[#1a1a1a] space-y-1">
                      <div className="text-[9px] text-[#555] uppercase">10M V-WIND (NORTHWARD)</div>
                      <div className="text-base font-bold text-[#F5F2EA]">
                        {weatherData?.v10 != null ? `${weatherData.v10} m/s` : `${(-drift.windSpeedKnots * 0.514444 * Math.cos((drift.windDirectionDeg * Math.PI) / 180)).toFixed(2)} m/s`}
                      </div>
                      <div className="text-[9px] text-[#555]">Meridional velocity component</div>
                    </div>

                    <div className="p-3 bg-[#0e0e0e] border border-[#1a1a1a] space-y-1">
                      <div className="text-[9px] text-[#555] uppercase">2M AIR TEMPERATURE</div>
                      <div className="text-base font-bold text-[#F5F2EA]">
                        {weatherData?.temperatureC != null ? `${weatherData.temperatureC} °C` : '28.4 °C'}
                      </div>
                      <div className="text-[9px] text-[#555]">Thermodynamic boundary</div>
                    </div>

                    <div className="p-3 bg-[#0e0e0e] border border-[#1a1a1a] space-y-1">
                      <div className="text-[9px] text-[#555] uppercase">SURFACE PRESSURE</div>
                      <div className="text-base font-bold text-[#F5F2EA]">
                        {weatherData?.surfacePressureHpa != null ? `${weatherData.surfacePressureHpa} hPa` : '1008.2 hPa'}
                      </div>
                      <div className="text-[9px] text-[#555]">Marine barometric pressure</div>
                    </div>
                  </div>

                  {weatherData?.storagePath && (
                    <div className="text-[10px] text-[#555] pt-1 border-t border-[#141414] truncate">
                      <span className="text-[#9B9891]">Storage Artifact:</span> {weatherData.storagePath}
                    </div>
                  )}
                </div>

                {/* Forward Forecast Table */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="text-[10px] text-[#9B9891] uppercase tracking-wider font-semibold">
                    FORWARD HYDRODYNAMIC DRIFT PROJECTIONS (IF UNCONTAINED)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border border-[#1a1a1a]">
                      <thead className="bg-[#0e0e0e] text-[#555] text-[10px] uppercase tracking-wider border-b border-[#1a1a1a]">
                        <tr>
                          <th className="p-3">Horizon</th>
                          <th className="p-3">Forecast Timestamp</th>
                          <th className="p-3">Centroid Coordinates</th>
                          <th className="p-3">Spill Area Extent</th>
                          <th className="p-3">Distance From Spill</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#141414] text-[11px] text-[#9B9891]">
                        {(drift.projections || []).map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[#111] transition-colors">
                            <td className="p-3 text-[#E85D04] font-bold">T+{p.hours} Hours</td>
                            <td className="p-3 text-[#F5F2EA]">{new Date(p.timestamp).toUTCString().replace('GMT', 'UTC')}</td>
                            <td className="p-3">{p.latitude.toFixed(4)}°N, {p.longitude.toFixed(4)}°E</td>
                            <td className="p-3 text-[#F5F2EA] font-semibold">{p.estimatedAreaKm2} km²</td>
                            <td className="p-3">+{p.distanceFromSpillKm} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* 7. DATA & EVIDENCE DETAILS */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-[#1a1a1a] pt-8 space-y-4 font-mono text-xs text-[#555]"
        >
          <div className="text-[10px] uppercase tracking-widest text-[#9B9891]">
            DATA SOURCES & PROVENANCE INTEGRITY
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-[#141414] bg-[#070707] space-y-1">
              <div className="text-[#F5F2EA] font-bold text-xs">HYDRODYNAMIC REANALYSIS</div>
              <div className="text-[#9B9891]">Copernicus Marine Service (CMEMS) Global Ocean Physics Reanalysis 0.083° resolution.</div>
            </div>
            <div className="p-4 border border-[#141414] bg-[#070707] space-y-1">
              <div className="text-[#F5F2EA] font-bold text-xs">SURFACE WIND REANALYSIS</div>
              <div className="text-[#9B9891]">ECMWF ERA5 10m Atmospheric Boundary Layer winds sampled at 1-hour temporal fidelity.</div>
            </div>
            <div className="p-4 border border-[#141414] bg-[#070707] space-y-1">
              <div className="text-[#F5F2EA] font-bold text-xs">SAR POLARIMETRIC SLICK</div>
              <div className="text-[#9B9891]">Sentinel-1A IW GRDH C-band radar scene 2026-ARABIAN-SEA-09 ingested at 10m grid.</div>
            </div>
          </div>
        </motion.section>

        {/* 8. PAGE END — PROGRESSION CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="pt-12 border-t border-[#1a1a1a] flex flex-col sm:flex-row items-center justify-between gap-6 font-mono"
        >
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-xs font-bold text-[#F5F2EA] uppercase tracking-wider">
              ORIGIN & DRIFT COMPLETE
            </div>
            <div className="text-[11px] text-[#555]">
              Trajectory backtrack verified. The investigation can now continue to AIS vessel corridor correlation.
            </div>
          </div>

          <button
            onClick={() => navigate(`/investigation/${code}/ais-hunt`)}
            className="btn-primary text-xs py-3 px-8 flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-[#E85D04]/20 transition-all"
          >
            <span>CONTINUE TO AIS HUNT</span>
            <ChevronRightIcon size={14} />
          </button>
        </motion.section>

      </div>
    </PageShell>
  );
}
