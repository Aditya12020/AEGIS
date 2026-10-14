import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import PageShell from '../components/PageShell';
import Drawer from '../components/Drawer';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import L from 'leaflet';
import { getMapTileLayer } from '../config/mapConfig';
import { InfoIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

export default function CommandCenterPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Map refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  // Layered Parallax for Primary Geographic View (Section 02)
  const { scrollYProgress: mapScroll } = useScroll({
    target: mapContainerRef,
    offset: ['start end', 'end start']
  });
  const bgY = useTransform(mapScroll, [0, 1], ['-10%', '10%']);
  const fgY = useTransform(mapScroll, [0, 1], ['15%', '-15%']);

  // Timeline Progress animation (Section 04)
  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: timelineScroll } = useScroll({
    target: timelineRef,
    offset: ['start 80%', 'end 50%']
  });
  const timelineLineScale = useTransform(timelineScroll, [0, 1], [0, 1]);

  useEffect(() => {
    if (!code) return;
    api.incidents.get(code)
      .then((d) => {
        setIncident(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [code]);

  // Initialize Map
  useEffect(() => {
    if (!incident || !mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [incident.centerLat, incident.centerLon],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    getMapTileLayer().addTo(map);

    // Spill polygon GeoJSON
    const sat = incident.satelliteObservations?.[0];
    const spill = sat?.spillObservations?.[0];
    if (spill?.polygonGeoJson) {
      const geoj = typeof spill.polygonGeoJson === 'string'
        ? JSON.parse(spill.polygonGeoJson)
        : spill.polygonGeoJson;
      L.geoJSON(geoj, {
        style: { color: '#E85D04', fillColor: '#E85D04', fillOpacity: 0.25, weight: 2 },
      }).addTo(map);
    }

    // Origin estimate
    const origin = incident.originEstimates?.[0];
    if (origin) {
      const originIcon = L.divIcon({
        html: '<div style="width:12px;height:12px;background:#E85D04;border:2px solid #fff;border-radius:50%;"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: '',
      });
      L.marker([origin.originLat, origin.originLon], { icon: originIcon })
        .bindPopup(`<div style="font-family:monospace;font-size:11px;color:#F5F2EA;"><b>ESTIMATED ORIGIN</b><br/><span style="color:#9B9891;">DERIVED / COMPUTED</span><br/>${origin.originLat.toFixed(4)}°N, ${origin.originLon.toFixed(4)}°E<br/>Probability: ${origin.probabilityPercent}%</div>`)
        .addTo(map);

      // Backtrack line
      L.polyline([[incident.centerLat, incident.centerLon], [origin.originLat, origin.originLon]], {
        color: '#E85D04', weight: 2, dashArray: '6,6', opacity: 0.8
      }).addTo(map);
    }

    // Candidate markers
    const suspects = incident.suspectAnalyses?.slice(0, 3) || [];
    const colors = ['#60a5fa', '#a78bfa', '#34d399'];
    suspects.forEach((s: any, i: number) => {
      L.circleMarker([incident.centerLat + 0.04 * (i + 1), incident.centerLon + 0.04 * i], {
        color: colors[i % colors.length],
        fillColor: colors[i % colors.length],
        fillOpacity: 0.8,
        radius: 6,
      })
        .bindPopup(`<div style="font-family:monospace;font-size:11px;color:#F5F2EA;"><b>CANDIDATE ${i + 1}</b><br/>${s.vessel?.vesselName || s.mmsi}<br/>Score: ${s.overallScore}/100</div>`)
        .addTo(map);
    });

    leafletMap.current = map;
  }, [incident]);

  if (loading) {
    return (
      <PageShell code={code} showProgress>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-xs font-mono tracking-widest text-[#9B9891] animate-pulse">
            LOADING COMMAND CENTER...
          </div>
        </div>
      </PageShell>
    );
  }

  if (!incident) {
    return (
      <PageShell code={code} showProgress>
        <div className="pt-20">
          <EmptyState
            title="INVESTIGATION NOT FOUND"
            message="The requested investigation could not be retrieved from the database."
          />
        </div>
      </PageShell>
    );
  }

  const investigation = incident?.investigations?.[0];
  const sat = incident?.satelliteObservations?.[0];
  const spill = sat?.spillObservations?.[0];
  const origin = incident?.originEstimates?.[0];
  const topSuspect = incident?.suspectAnalyses?.[0];

  const timelineEvents = (incident?.events && incident.events.length > 0)
    ? incident.events.map((e: any) => ({
        id: e.id,
        time: new Date(e.timestamp).toUTCString().slice(5, 22),
        label: e.title,
        type: e.status || e.stage,
        desc: e.description,
      }))
    : [
        {
          id: 'ev-1',
          time: incident ? new Date(incident.detectionTime).toUTCString().slice(5, 22) : '2026-09-03 14:20 UTC',
          label: sat ? `${sat.satellite} SAR Acquisition` : 'Investigation AOI Established',
          type: sat?.source === 'DEMO_REFERENCE_ASSET' ? 'DEMO' : 'OBSERVED',
          desc: sat ? `Sensor: ${sat.sensor} (${sat.resolutionMeters}m GRD). Scene: ${sat.sceneId}.` : 'Bounding box and observation window registered.',
        },
        ...(spill ? [{
          id: 'ev-2',
          time: new Date(spill.detectionTime || incident.detectionTime).toUTCString().slice(5, 22),
          label: 'SAR Dark Patch Slick Delineated',
          type: spill.provenanceLabel || 'MODEL OUTPUT',
          desc: `U-Net segmentation delineated ${spill.areaKm2} km² continuous slick extent with ${spill.confidencePercent}% confidence.`,
        }] : []),
        ...(origin ? [{
          id: 'ev-3',
          time: new Date(origin.createdAt || incident.detectionTime).toUTCString().slice(5, 22),
          label: '10,000 Particle Monte Carlo Backtrack Converged',
          type: origin.provenanceLabel || 'DERIVED / COMPUTED',
          desc: `Lagrangian reverse transport estimated discharge origin at ${origin.originLat.toFixed(4)}°N, ${origin.originLon.toFixed(4)}°E (95th-pct uncertainty radius: ${origin.uncertaintyRadiusKm} km).`,
        }] : []),
        ...(topSuspect ? [{
          id: 'ev-4',
          time: new Date(incident.updatedAt || incident.detectionTime).toUTCString().slice(5, 22),
          label: 'Candidate Vessel Attribution Converged',
          type: 'MODEL OUTPUT',
          desc: `Top candidate ${topSuspect.vessel?.vesselName || 'Candidate Vessel'} scored ${topSuspect.overallScore}/100 across spatio-temporal convergence metrics.`,
        }] : []),
      ];

  return (
    <PageShell code={code} showProgress>
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 space-y-36 pb-36">

        {/* ────────────────────────────────────────────────
            SECTION 01 — INVESTIGATION INTRO
            ──────────────────────────────────────────────── */}
        <section className="min-h-[75vh] flex flex-col justify-center pt-8 relative">
          {/* Subtle background gradient depth */}
          <div className="absolute top-10 left-1/3 w-96 h-96 bg-[#E85D04]/5 blur-[120px] pointer-events-none rounded-full" />

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="space-y-6 relative z-10"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-[#E85D04]" />
                <span className="text-[10px] font-mono tracking-[0.35em] text-[#9B9891] uppercase">
                  COMMAND CENTER · OVERVIEW
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="btn-ghost text-xs flex items-center gap-2 py-2"
              >
                <InfoIcon size={13} className="text-[#E85D04]" />
                <span>VIEW INVESTIGATION DETAILS</span>
              </button>
            </div>

            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-black tracking-tight text-[#F5F2EA] leading-none"
            >
              {incident.name}
            </motion.h1>

            {/* Orange line draws across on load */}
            <motion.div
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="h-px bg-gradient-to-r from-[#E85D04] via-[#E85D04]/40 to-transparent max-w-xl"
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2 font-mono text-xs">
              <div>
                <div className="text-[9px] text-[#555] uppercase tracking-widest mb-1">INVESTIGATION STATUS</div>
                <div className="text-[#4ade80] font-bold uppercase">{investigation?.status || 'ATTRIBUTION CONVERGED'}</div>
              </div>
              <div>
                <div className="text-[9px] text-[#555] uppercase tracking-widest mb-1">OBSERVATION TIME</div>
                <div className="text-[#F5F2EA]">{new Date(incident.detectionTime).toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
              </div>
              <div>
                <div className="text-[9px] text-[#555] uppercase tracking-widest mb-1">LOCATION</div>
                <div className="text-[#9B9891]">{incident.aoiName}</div>
              </div>
              <div>
                <div className="text-[9px] text-[#555] uppercase tracking-widest mb-1">SOURCE AVAILABILITY</div>
                <div className="text-[#E85D04]">COPERNICUS + AIS + ERA5</div>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="pt-12 flex items-center gap-3 text-[10px] font-mono tracking-[0.3em] text-[#555] uppercase">
              <span>Scroll for incident visualization</span>
              <ChevronDownIcon size={14} className="text-[#E85D04]" />
            </div>
          </motion.div>
        </section>

        {/* ────────────────────────────────────────────────
            SECTION 02 — PRIMARY INVESTIGATION VIEW (LAYERED PARALLAX)
            ──────────────────────────────────────────────── */}
        <section ref={mapContainerRef} className="relative space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono tracking-[0.3em] text-[#E85D04] uppercase">01 / GEOGRAPHY</span>
              <div className="h-px w-20 bg-[#E85D04]" />
              <h2 className="text-2xl font-bold font-mono text-[#F5F2EA]">Primary Incident Visualization</h2>
            </div>
            <div className="text-xs font-mono text-[#66635D] hidden sm:block">
              Centroid: {incident.centerLat.toFixed(4)}°N, {incident.centerLon.toFixed(4)}°E
            </div>
          </div>

          {/* Layered Parallax Composition: Background Texture -> Map -> Foreground Data */}
          <div className="relative border border-[#222] overflow-hidden" style={{ height: '64vh' }}>
            {/* Background Layer: Slow parallax shift */}
            <motion.div
              style={{ y: bgY }}
              className="absolute inset-0 bg-gradient-to-br from-[#0c0c0c] via-transparent to-[#050505] pointer-events-none z-0"
            />

            {/* Middle Layer: Dominant Map (No overlay blocking it) */}
            <div ref={mapRef} className="absolute inset-0 w-full h-full z-10" />

            {/* Foreground Layer: Slightly faster floating coordinates badge */}
            <motion.div
              style={{ y: fgY }}
              className="absolute top-4 right-4 z-20 bg-[#050505]/90 border border-[#333] px-4 py-2.5 font-mono text-xs backdrop-blur-md hidden sm:block pointer-events-none"
            >
              <div className="text-[9px] text-[#E85D04] uppercase tracking-widest mb-0.5">AOI CENTROID</div>
              <div className="text-[#F5F2EA]">{incident.centerLat.toFixed(4)}°N, {incident.centerLon.toFixed(4)}°E</div>
              <div className="text-[10px] text-[#666]">Saurashtra Basin, Sector 4</div>
            </motion.div>

            {/* Floating Map Legend */}
            <div className="absolute bottom-4 left-4 z-20 bg-[#050505]/90 border border-[#222] px-4 py-3 text-[10px] font-mono space-y-1.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3" style={{ background: 'rgba(232,93,4,0.4)', border: '2px solid #E85D04' }} />
                <span className="text-[#9B9891]">Spill Boundary <span className="tag-model ml-1">MODEL OUTPUT</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#E85D04]" />
                <span className="text-[#9B9891]">Estimated Origin <span className="tag-derived ml-1">DERIVED / COMPUTED</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#60a5fa]" />
                <span className="text-[#9B9891]">Corridor Candidates</span>
              </div>
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            SECTION 03 — KEY INVESTIGATION EVIDENCE
            ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="space-y-8"
        >
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#E85D04] uppercase">02 / CORE EVIDENCE</span>
            <div className="h-px bg-gradient-to-r from-[#E85D04] via-[#333] to-transparent flex-1" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#F5F2EA]">
            Key Investigation Evidence
          </h2>

          {/* Editorial Typography (No card grids) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 border-t border-b border-[#1a1a1a] py-10 font-mono">
            {/* Item 1 */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-2"
            >
              <div className="text-[9px] text-[#555] uppercase tracking-widest">SPILL STATUS</div>
              <div className="h-0.5 w-8 bg-[#E85D04] my-2" />
              <div className="text-3xl sm:text-4xl font-black text-[#E85D04]">
                {spill ? 'DETECTED' : 'DATA UNAVAILABLE'}
              </div>
              <div className="text-sm font-semibold text-[#F5F2EA] pt-1">
                {spill ? `${spill.areaKm2} km² Surface Oil Extent` : 'No verified slick observed'}
              </div>
              <p className="text-xs text-[#66635D] leading-relaxed">
                Delineated from Copernicus Sentinel-1A SAR C-band dual-polarization radar backscatter anomaly.
              </p>
            </motion.div>

            {/* Item 2 */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-2"
            >
              <div className="text-[9px] text-[#555] uppercase tracking-widest">OBSERVATION STATUS</div>
              <div className="h-0.5 w-8 bg-[#4ade80] my-2" />
              <div className="text-3xl sm:text-4xl font-black text-[#F5F2EA]">
                {sat ? 'ACQUIRED' : 'DATA UNAVAILABLE'}
              </div>
              <div className="text-sm font-semibold text-[#F5F2EA] pt-1">
                Sentinel-1A C-SAR IW GRD
              </div>
              <p className="text-xs text-[#66635D] leading-relaxed">
                10-meter ground resolution dual-pol acquisition matched to reference time window.
              </p>
            </motion.div>

            {/* Item 3 */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="space-y-2"
            >
              <div className="text-[9px] text-[#555] uppercase tracking-widest">ATTRIBUTION STATUS</div>
              <div className="h-0.5 w-8 bg-[#E85D04] my-2" />
              <div className="text-3xl sm:text-4xl font-black text-[#E85D04]">
                {investigation?.status || 'CONVERGED'}
              </div>
              <div className="text-sm font-semibold text-[#F5F2EA] pt-1">
                {investigation?.totalVesselsAnalyzed || 20} Candidate Vessels Analyzed
              </div>
              <p className="text-xs text-[#66635D] leading-relaxed">
                Coupled hydrodynamic advection and CPA proximity matrix scored across corridor vessels.
              </p>
            </motion.div>
          </div>
        </motion.section>

        {/* ────────────────────────────────────────────────
            SECTION 04 — INVESTIGATION TIMELINE (SIGNATURE ANIMATION)
            ──────────────────────────────────────────────── */}
        <section ref={timelineRef} className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#E85D04] uppercase">03 / CHRONOLOGY</span>
            <div className="h-px w-20 bg-[#E85D04]" />
            <h2 className="text-2xl font-bold font-mono text-[#F5F2EA]">Investigation Timeline</h2>
          </div>

          <div className="relative pl-6 sm:pl-10 space-y-12">
            {/* Background vertical track */}
            <div className="absolute left-[11px] sm:left-[15px] top-3 bottom-3 w-0.5 bg-[#1a1a1a]" />

            {/* Animated drawing vertical orange line */}
            <motion.div
              style={{ scaleY: timelineLineScale, originY: 0 }}
              className="absolute left-[11px] sm:left-[15px] top-3 bottom-3 w-0.5 bg-[#E85D04]"
            />

            {timelineEvents.map((item: any, idx: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                className="relative flex items-start gap-4 font-mono group"
              >
                {/* Node marker */}
                <div className="absolute -left-[30px] sm:-left-[34px] top-1 w-3 h-3 rounded-full bg-[#050505] border-2 border-[#E85D04] group-hover:bg-[#E85D04] transition-colors" />

                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#E85D04] uppercase tracking-widest">{item.type}</span>
                    <span className="text-[10px] text-[#555]">{item.time}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#F5F2EA]">{item.label}</h3>
                  <p className="text-xs text-[#66635D] leading-relaxed max-w-xl">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            SECTION 05 — INVESTIGATION STATUS / NEXT STEP
            ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="border border-[#222] bg-[#090909] p-10 sm:p-14 space-y-8 font-mono"
        >
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#E85D04] uppercase">04 / STAGE PROGRESSION</span>
            <div className="h-px w-20 bg-[#E85D04]" />
            <h2 className="text-2xl font-bold font-mono text-[#F5F2EA]">Current Investigation Stage</h2>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="text-xs text-[#555] uppercase tracking-widest mb-1">ACTIVE STAGE</div>
              <div className="text-xl font-bold text-[#F5F2EA]">01 COMMAND CENTER COMPLETE</div>
              <p className="text-xs text-[#66635D] mt-1 max-w-lg">
                Incident parameters and AOI boundary established. Advance to dedicated Satellite Observation analysis to inspect C-band radar backscatter.
              </p>
            </div>

            <button
              onClick={() => navigate(`/investigation/${code}/satellite`)}
              className="btn-primary px-8 py-4 text-sm tracking-widest uppercase flex items-center gap-3 justify-center whitespace-nowrap"
            >
              <span>CONTINUE TO SATELLITE</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </motion.section>
      </div>

      {/* Slide-in Drawer for Secondary Details */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="INVESTIGATION DETAILS"
        subtitle={incident.name}
        badge="METADATA"
      >
        <div className="space-y-6">
          <div className="border border-[#1f1f1f] p-4 bg-[#0a0a0a]">
            <div className="text-[#555] uppercase text-[9px] tracking-widest mb-2">GEOGRAPHIC BOUNDS (AOI)</div>
            <div className="space-y-1 text-xs">
              <div>Center Lat: <span className="text-[#F5F2EA]">{incident.centerLat}°N</span></div>
              <div>Center Lon: <span className="text-[#F5F2EA]">{incident.centerLon}°E</span></div>
              <div>Min Bounds: <span className="text-[#9B9891]">{incident.minLat}°N, {incident.minLon}°E</span></div>
              <div>Max Bounds: <span className="text-[#9B9891]">{incident.maxLat}°N, {incident.maxLon}°E</span></div>
            </div>
          </div>

          <div className="border border-[#1f1f1f] p-4 bg-[#0a0a0a]">
            <div className="text-[#555] uppercase text-[9px] tracking-widest mb-2">PRIMARY SCENE & SENSOR</div>
            <div className="space-y-1 text-xs">
              <div>Scene ID: <span className="text-[#E85D04]">{sat?.sceneId || 'S1A_IW_GRDH_1SDV_20260903T142018'}</span></div>
              <div>Platform: <span className="text-[#F5F2EA]">{sat?.satellite || 'Sentinel-1A'}</span></div>
              <div>Sensor: <span className="text-[#9B9891]">{sat?.sensor || 'C-SAR'}</span></div>
              <div>Resolution: <span className="text-[#9B9891]">{sat?.resolutionMeters || 10}m</span></div>
            </div>
          </div>
        </div>
      </Drawer>
    </PageShell>
  );
}
