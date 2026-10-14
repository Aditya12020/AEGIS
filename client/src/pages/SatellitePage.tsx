import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import PageShell from '../components/PageShell';
import ProvenanceBadge from '../components/ProvenanceBadge';
import Drawer from '../components/Drawer';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { Maximize2Icon, InfoIcon, ChevronDownIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react';

export default function SatellitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '8%']);

  useEffect(() => {
    if (!code) return;
    let isMounted = true;
    let pollTimer: any = null;

    async function checkSatellite() {
      try {
        const d = await api.satellite(code!);
        if (!isMounted) return;

        if (d && (d.status === 'READY' || d.status === 'SUCCESS') && d.scene) {
          setData(d);
          setLoading(false);
          setIsAcquiring(false);
        } else if (
          d && (
            d.status === 'SATELLITE_ACQUIRING' ||
            d.status === 'SATELLITE_PROCESSING' ||
            d.status === 'RUNNING' ||
            d.status === 'INITIALIZED' ||
            d.status === 'PENDING'
          )
        ) {
          setData(d);
          setLoading(false);
          setIsAcquiring(true);
          // Poll every 1.5 seconds until data is ready
          pollTimer = setTimeout(checkSatellite, 1500);
        } else {
          // Terminal non-ready states
          setData(d);
          setLoading(false);
          setIsAcquiring(false);
        }
      } catch {
        if (!isMounted) return;
        setData({ status: 'DATA_UNAVAILABLE' });
        setLoading(false);
        setIsAcquiring(false);
      }
    }

    checkSatellite();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [code]);

  if (loading) {
    return (
      <PageShell code={code} showProgress>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2Icon size={20} className="text-[#E85D04] animate-spin" />
            <div className="text-[11px] font-mono tracking-widest text-[#9B9891]">
              CONNECTING TO SATELLITE SUBSYSTEM...
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // Acquisition in Progress State (Condition A)
  if (isAcquiring || (data && (data.status === 'SATELLITE_ACQUIRING' || data.status === 'SATELLITE_PROCESSING'))) {
    return (
      <PageShell code={code} showProgress>
        <div className="min-h-[75vh] flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-[#E85D04]/40 bg-[#0c0c0c] p-8 sm:p-10 max-w-lg w-full text-center space-y-5 font-mono shadow-[0_0_30px_rgba(232,93,4,0.1)]"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#E85D04]/30 bg-[#E85D04]/10 text-[10px] text-[#E85D04] tracking-widest uppercase">
              <Loader2Icon size={13} className="animate-spin" />
              <span>SATELLITE ACQUISITION IN PROGRESS</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-[#F5F2EA] tracking-tight">
              Ingesting Sentinel-1 SAR Scene
            </h2>

            <p className="text-xs text-[#9B9891] leading-relaxed">
              Orbital synthetic aperture radar backscatter is being acquired and calibrated against the investigation AOI boundary.
            </p>

            <div className="pt-3 border-t border-[#1a1a1a] flex items-center justify-between text-[10px] text-[#555]">
              <span>COPERNICUS SENTINEL-1</span>
              <span className="text-[#E85D04] animate-pulse">SYNCHRONIZING ORBITAL PASS...</span>
            </div>
          </motion.div>
        </div>
      </PageShell>
    );
  }

  // Empty / Terminal States (Conditions B, C, E)
  if (!data || !data.scene || (data.status !== 'READY' && data.status !== 'SUCCESS' && data.status !== 'SATELLITE_ACQUIRED')) {
    let emptyTitle = 'SATELLITE DATA UNAVAILABLE';
    let emptyMsg = data?.message || data?.errorMessage || 'No verified satellite observation is currently available for this investigation window.';

    if (data?.status === 'NO_SATELLITE_COVERAGE') {
      emptyTitle = 'HISTORICAL INCIDENT (PRE-SATELLITE ERA)';
      emptyMsg = data.message || data.errorMessage || 'Sentinel-1 was launched on 2014-04-03. C-band SAR satellite imagery does not exist for this historical date.';
    } else if (data?.status === 'PROVIDER_NOT_CONFIGURED') {
      emptyTitle = 'PROVIDER NOT CONFIGURED';
      emptyMsg = data?.message || data?.errorMessage || 'The Copernicus Sentinel-1 Earth Observation provider credentials are not configured in the active environment.';
    } else if (data?.status === 'NO_OBSERVATION' || data?.status === 'NO_MATCHING_SCENE') {
      emptyTitle = 'NO SATELLITE OBSERVATION MATCHED';
      emptyMsg = data?.message || data?.errorMessage || 'Copernicus archive search completed, but no matching Sentinel-1 SAR scene intersected this AOI and temporal window.';
    }

    return (
      <PageShell code={code} showProgress>
        <div className="pt-16 max-w-4xl mx-auto px-6 space-y-8">
          <EmptyState title={emptyTitle} message={emptyMsg} />
          <div className="border-t border-[#1a1a1a] pt-6 flex justify-between items-center font-mono">
            <span className="text-xs text-[#555]">
              Advance investigation to temporal and hydrodynamic modules
            </span>
            <button
              onClick={() => navigate(`/investigation/${code}/time-machine`)}
              className="btn-primary text-xs py-3 px-6 flex items-center gap-2"
            >
              <span>PROCEED TO TIME MACHINE</span>
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  // Actual Satellite Result Exists (Condition D)
  const scene = data.scene;
  const spill = data.spill;
  const modelBlocked = data.modelStatus === 'MODEL COMPATIBILITY UNVERIFIED';

  return (
    <PageShell code={code} showProgress>
      <div className="min-h-screen space-y-32 pb-32">
        {/* STORY STAGE 01: SATELLITE OBSERVATION HERO */}
        <section ref={heroRef} className="relative min-h-[85vh] flex flex-col justify-center px-8 border-b border-[#141414] overflow-hidden">
          <motion.div className="absolute inset-0 w-full h-full" style={{ scale: imageScale, y: imageY }}>
            {scene.previewUrl ? (
              <img
                src={scene.previewUrl}
                alt={scene.sceneId}
                className="w-full h-full object-cover"
                style={{ filter: 'brightness(0.55) contrast(1.2)' }}
              />
            ) : data?.scene?.source?.includes('DEMO') ? (
              <img
                src="/images/sar_scene.jpg"
                alt="Demo SAR reference asset"
                className="w-full h-full object-cover"
                style={{ filter: 'brightness(0.35) contrast(1.15) saturate(0.7)' }}
              />
            ) : (
              <div className="w-full h-full bg-[#070707] flex items-center justify-center">
                <div className="max-w-xl px-8 text-center font-mono">
                  <div className="text-[10px] tracking-[0.3em] text-[#E85D04] mb-3">AUTOMATIC_SENTINEL1</div>
                  <div className="text-sm text-[#9B9891]">Authenticated Sentinel-1 product acquired. Generating raster visualization...</div>
                  <div className="text-[10px] text-[#555] mt-3">COPERNICUS SENTINEL-1 C-SAR</div>
                </div>
              </div>
            )}
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/80 pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative z-10 max-w-4xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-[#E85D04]" />
              <span className="text-[10px] font-mono tracking-[0.35em] text-[#9B9891] uppercase">
                STAGE 02 · SATELLITE SAR ACQUISITION
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#F5F2EA]">
              Copernicus Sentinel-1 C-Band
              {scene.source === 'DEMO_REFERENCE_ASSET' && (
                <span className="text-lg font-mono text-[#c084fc] block mt-1 tracking-wider">[DEMO REFERENCE BENCHMARK]</span>
              )}
            </h1>
            <p className="text-base text-[#9B9891] font-mono">
              {scene.source === 'DEMO_REFERENCE_ASSET'
                ? 'Reference radar backscatter scene (North Sea Benchmark OSC-093-B calibrated for slick segmentation testing).'
                : 'Authenticated Sentinel-1 GRD product acquired for the active investigation AOI.'}
            </p>
            <div className="pt-4 flex items-center gap-4">
              <button onClick={() => setModalOpen(true)} className="btn-primary text-xs flex items-center gap-2">
                <Maximize2Icon size={14} />
                <span>INSPECT FULL SCENE</span>
              </button>
              <button onClick={() => setDrawerOpen(true)} className="btn-ghost text-xs flex items-center gap-2">
                <InfoIcon size={14} className="text-[#E85D04]" />
                <span>VIEW SCENE DETAILS</span>
              </button>
            </div>
          </motion.div>

          <div className="absolute bottom-8 left-8 flex items-center gap-2 text-[10px] font-mono text-[#555] uppercase tracking-widest">
            <span>Scroll for scene provenance</span>
            <ChevronDownIcon size={14} className="text-[#E85D04]" />
          </div>
        </section>

        {/* STORY STAGE 02: HIGH-RESOLUTION SAR VISUAL */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.6 }}
          className="max-w-6xl mx-auto px-6 space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-[#E85D04] uppercase tracking-widest mb-1">RADAR BACKSCATTER</div>
              <h2 className="text-2xl font-bold font-mono text-[#F5F2EA]">Ground Range Detected (GRD) View</h2>
            </div>
            <ProvenanceBadge label={scene.source === 'DEMO_REFERENCE_ASSET' ? 'DEMO REFERENCE ASSET (North Sea Reference OSC-093-B)' : 'LIVE / REAL DATA'} />
          </div>

          <div
            onClick={() => setModalOpen(true)}
            className="relative border border-[#222] overflow-hidden group cursor-zoom-in h-[500px]"
          >
            {scene.previewUrl ? (
              <img
                src={scene.previewUrl}
                alt={scene.sceneId}
                className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-500 bg-[#070707]"
              />
            ) : data?.scene?.source?.includes('DEMO') ? (
              <img
                src="/images/sar_scene.jpg"
                alt="Demo SAR reference asset"
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                style={{ filter: 'brightness(0.85) contrast(1.1) saturate(0.6)' }}
              />
            ) : (
              <div className="w-full h-full min-h-[500px] bg-[#070707] flex items-center justify-center">
                <div className="text-center font-mono px-8">
                  <div className="text-[10px] text-[#E85D04] tracking-widest mb-2">REAL PRODUCT ACQUIRED</div>
                  <div className="text-xs text-[#666]">Generating raster preview from acquired SAR GeoTIFF...</div>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-[#050505]/85 border border-[#333] px-3 py-1.5 text-[10px] font-mono text-[#9B9891]">
              SCENE ID: {scene.sceneId} · {scene.resolutionMeters}m RESOLUTION {scene.source === 'DEMO_REFERENCE_ASSET' ? '· [DEMO BENCHMARK]' : ''}
            </div>
          </div>
        </motion.section>

        {modelBlocked && (
          <section className="max-w-6xl mx-auto px-6">
            <div className="border border-[#6b4a2b] bg-[#0c0c0c] p-6 font-mono">
              <ProvenanceBadge label="MODEL COMPATIBILITY UNVERIFIED" />
              <div className="text-sm text-[#F5F2EA] mt-3">U-Net checkpoint is integrated and loadable, but its training representation/preprocessing is not present in the supplied checkpoint. No segmentation result is fabricated.</div>
            </div>
          </section>
        )}

        {/* STORY STAGE 03: SLICK SEGMENTATION & DELINEATION */}
        {spill && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.15 }}
            transition={{ duration: 0.6 }}
            className="max-w-6xl mx-auto px-6 space-y-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-[#E85D04] uppercase tracking-widest mb-1">U-NET SEGMENTATION</div>
                <h2 className="text-2xl font-bold font-mono text-[#F5F2EA]">Spill Mask & Morphology</h2>
              </div>
              <ProvenanceBadge label="MODEL OUTPUT" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 font-mono text-xs">
              <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 space-y-2">
                <div className="text-[9px] text-[#555] uppercase">SURFACE EXTENT</div>
                <div className="text-3xl font-black text-[#E85D04]">{spill.areaKm2} km²</div>
                <div className="text-[#666] text-[11px] pt-2 border-t border-[#1a1a1a]">Continuous slick polygon</div>
              </div>
              <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 space-y-2">
                <div className="text-[9px] text-[#555] uppercase">ESTIMATED THICKNESS</div>
                {spill.thicknessMinMicrons != null && spill.thicknessMinMicrons >= 0 ? (
                  <div className="text-3xl font-black text-[#F5F2EA]">{spill.thicknessMinMicrons}–{spill.thicknessMaxMicrons} µm</div>
                ) : (
                  <div>
                    <div className="text-sm font-bold text-[#ef4444]">DATA UNAVAILABLE</div>
                    <div className="text-[#666] text-[10px] pt-1 leading-tight">Single-band C-SAR cannot resolve film thickness</div>
                  </div>
                )}
                <div className="text-[#666] text-[11px] pt-2 border-t border-[#1a1a1a]">Bonn Agreement Appearance</div>
              </div>
              <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 space-y-2">
                <div className="text-[9px] text-[#555] uppercase">COORDINATE CENTROID</div>
                <div className="text-xl font-bold text-[#F5F2EA]">{spill.centroid[0]?.toFixed(4)}°N</div>
                <div className="text-[#666] text-[11px] pt-2 border-t border-[#1a1a1a]">{spill.centroid[1]?.toFixed(4)}°E</div>
              </div>
              <div className="border border-[#1f1f1f] bg-[#0c0c0c] p-6 space-y-2">
                <div className="text-[9px] text-[#555] uppercase">MODEL CONFIDENCE</div>
                <div className="text-3xl font-black text-[#4ade80]">{spill.confidencePercent}%</div>
                <div className="text-[#666] text-[11px] pt-2 border-t border-[#1a1a1a]">{spill.modelArchitecture}</div>
              </div>
            </div>
          </motion.section>
        )}

        {/* STORY CONCLUSION / NEXT STEP */}
        <div className="max-w-6xl mx-auto px-6 pt-12 border-t border-[#1a1a1a] flex justify-between items-center font-mono">
          <div className="text-xs text-[#555]">
            Evidence layer 02 verified · Advance to time evolution
          </div>
          <button
            onClick={() => navigate(`/investigation/${code}/time-machine`)}
            className="btn-primary text-xs py-3 px-6 flex items-center gap-2"
          >
            <span>PROCEED TO TIME MACHINE</span>
            <ChevronRightIcon size={14} />
          </button>
        </div>

        {/* Drawers */}
        <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="SCENE METADATA" subtitle={scene.sceneId} badge="SAR SPECS">
          <div className="space-y-3 font-mono text-xs">
            {[
              { label: 'Sensor Mode', value: scene.sensor },
              { label: 'Polarization', value: scene.polarization },
              { label: 'Resolution', value: scene.resolutionMeters + ' meters' },
              { label: 'Incidence Angle', value: scene.incidenceAngleDeg + '°' },
              { label: 'Orbit Number', value: scene.orbitNumber },
              { label: 'Pass Direction', value: scene.orbitDirection },
              { label: 'Product Type', value: scene.productType },
            ].map(i => (
              <div key={i.label} className="flex justify-between py-2 border-b border-[#1a1a1a]">
                <span className="text-[#555] uppercase text-[9px]">{i.label}</span>
                <span className="text-[#F5F2EA]">{i.value}</span>
              </div>
            ))}
          </div>
        </Drawer>

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="SAR HIGH-RESOLUTION INSPECTION" badge="COPERNICUS">
          <div className="border border-[#222] overflow-hidden bg-[#070707] flex items-center justify-center min-h-[300px]">
            <img
              src={scene.previewUrl || (data?.scene?.source?.includes('DEMO') ? '/images/sar_scene.jpg' : '/images/sar_scene.jpg')}
              alt={scene.sceneId || 'Full SAR inspection'}
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          </div>
        </Modal>
      </div>
    </PageShell>
  );
}
