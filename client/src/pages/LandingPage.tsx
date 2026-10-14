import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  ChevronRightIcon,
  ArrowDownIcon,
  CompassIcon,
  RadioIcon,
  SatelliteIcon,
  WindIcon,
  CpuIcon,
  SearchIcon,
  CrosshairIcon,
  ShieldCheckIcon,
} from 'lucide-react';

const CAPABILITIES = [
  {
    id: 'observe',
    num: '01',
    step: 'OBSERVE',
    title: 'Satellite / SAR Observation',
    subtitle: 'ORBITAL SURVEILLANCE',
    desc: 'Acquires high-resolution Sentinel-1 C-band synthetic aperture radar scenes across coastal and deep-sea maritime corridors.',
    hoverDetail: 'Wide-swath radar scanning penetrates cloud cover & darkness to detect surface dielectric anomalies.',
    microMeta: 'EO-SAR // C-BAND GRD',
  },
  {
    id: 'analyze',
    num: '02',
    step: 'ANALYZE',
    title: 'Oil-Spill Segmentation & Delineation',
    subtitle: 'SPATIAL SEGMENTATION',
    desc: 'Isolates dark radar backscatter patches to map boundary geometry, calculate surface oil coverage, and evaluate perimeter morphology.',
    hoverDetail: 'Delineates slick polygon coordinates and computes geographic surface extent.',
    microMeta: 'POLYGON // MORPHOMETRIC MESH',
  },
  {
    id: 'trace',
    num: '03',
    step: 'TRACE',
    title: 'Hydrodynamic Origin & Drift Backtracking',
    subtitle: 'LAGRANGIAN ADVECTION',
    desc: 'Couples surface current fields and wind leeway forcing to simulate reverse advection trajectories back to the discharge coordinate.',
    hoverDetail: 'Runs backward temporal integration across hourly current vectors to pinpoint origin zone.',
    microMeta: 'LAGRANGIAN // REVERSE DRIFT',
  },
  {
    id: 'identify',
    num: '04',
    step: 'IDENTIFY',
    title: 'Corridor AIS Vessel Hunt',
    subtitle: 'TELEMETRY CORRELATION',
    desc: 'Cross-references historical AIS trajectories in the temporal window, computing CPA distance and speed anomalies against candidate tracks.',
    hoverDetail: 'Filters vessels intersecting the backtrack corridor at the precise estimated release window.',
    microMeta: 'AIS GEOFENCE // CPA MATRIX',
  },
  {
    id: 'document',
    num: '05',
    step: 'DOCUMENT',
    title: 'Evidence-Backed Investigation Dossier',
    subtitle: 'LEGAL PROVENANCE',
    desc: 'Consolidates SAR evidence, AIS tracks, attribution scores, and algorithmic methodology into a tamper-evident technical dossier.',
    hoverDetail: 'Produces unalterable intelligence packages formatted for regulatory enforcement and legal proceedings.',
    microMeta: 'CHAIN-OF-CUSTODY // SECURE RECORD',
  },
];

const METHOD_STEPS = [
  {
    num: '01',
    title: 'CREATE / DETECT',
    desc: 'Define AOI and temporal window or search live satellite acquisitions.',
    phase: 'PHASE // 01 · DETECTION',
    tag: 'AOI DEFINITION',
  },
  {
    num: '02',
    title: 'ACQUIRE EVIDENCE',
    desc: 'Ingest verified SAR scenes and geofenced AIS vessel telemetry.',
    phase: 'PHASE // 02 · ACQUISITION',
    tag: 'DATA INGESTION',
  },
  {
    num: '03',
    title: 'ANALYZE SPILL',
    desc: 'Segment slick boundary and calculate surface oil area.',
    phase: 'PHASE // 03 · SEGMENTATION',
    tag: 'SLICK DELINEATION',
  },
  {
    num: '04',
    title: 'TRACE ORIGIN',
    desc: 'Compute coupled hydrodynamic reverse advection corridor.',
    phase: 'PHASE // 04 · TRAJECTORY',
    tag: 'LAGRANGIAN DRIFT',
  },
  {
    num: '05',
    title: 'HUNT AIS VESSELS',
    desc: 'Track all candidate vessels traversing the discharge corridor.',
    phase: 'PHASE // 05 · CORRELATION',
    tag: 'CANDIDATE INTERCEPT',
  },
  {
    num: '06',
    title: 'BUILD FORENSIC CASE',
    desc: 'Score candidate attribution across spatial, temporal, and speed anomalies.',
    phase: 'PHASE // 06 · ATTRIBUTION',
    tag: 'CRITERIA MATRIX',
  },
  {
    num: '07',
    title: 'GENERATE DOSSIER',
    desc: 'Export complete intelligence dossier with complete provenance.',
    phase: 'PHASE // 07 · PROVENANCE',
    tag: 'FINAL DOSSIER',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const methodologyRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const lifecycleRef = useRef<HTMLDivElement>(null);

  const [transitioning, setTransitioning] = useState(false);
  const [hoveredCapability, setHoveredCapability] = useState<string | null>(null);
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const providerStatus = {
    copernicus: { connected: false, label: 'PROVIDER NOT CONFIGURED' },
    era5: { connected: false, label: 'PROVIDER NOT CONFIGURED' },
    ais: { connected: true, label: 'DATABASE CONNECTED' },
    ml: { connected: true, label: 'U-NET PIPELINE READY' },
  };

  const sourcesData = [
    {
      id: 'sentinel',
      num: '01',
      title: 'SENTINEL-1 / SATELLITE',
      subtitle: 'Satellite Evidence · C-Band SAR',
      status: providerStatus.copernicus.label,
      isLive: providerStatus.copernicus.connected,
      desc: 'C-band Synthetic Aperture Radar (SAR) dual-polarization (VV/VH) level-1 Ground Range Detected (GRD) scenes.',
      hoverDetail: 'SAR imagery used for surface slick observation & boundary delineation.',
      icon: SatelliteIcon,
    },
    {
      id: 'ais',
      num: '02',
      title: 'AIS / VESSEL DATA',
      subtitle: 'Vessel Movement · Geofenced Telemetry',
      status: providerStatus.ais.label,
      isLive: providerStatus.ais.connected,
      desc: 'Terrestrial and satellite Automatic Identification System vessel position reports, headings, SOG, and draft.',
      hoverDetail: 'Vessel movement data used for corridor vessel tracing & CPA calculation.',
      icon: RadioIcon,
    },
    {
      id: 'environmental',
      num: '03',
      title: 'ENVIRONMENTAL DATA',
      subtitle: 'Ocean Dynamics · Hydrodynamics & Wind',
      status: providerStatus.era5.label,
      isLive: providerStatus.era5.connected,
      desc: 'Lagrangian advection dynamics coupled with hydrodynamic surface currents and ERA5 wind leeway forcing.',
      hoverDetail: 'Hydrodynamic surface current & wind leeway vectors for Lagrangian drift.',
      icon: WindIcon,
    },
    {
      id: 'ml',
      num: '04',
      title: 'ML / OIL-SPILL ANALYSIS',
      subtitle: 'Model Output · U-Net Segmentation',
      status: providerStatus.ml.label,
      isLive: providerStatus.ml.connected,
      desc: 'High-contrast SAR dark patch delineation, feature extraction, and surface area polygon calculation.',
      hoverDetail: 'Segmentation model output used to identify spill extent & geometry.',
      icon: CpuIcon,
    },
  ];

  // Hero scroll transforms
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.02, 1.14]);
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);
  const overlayDarken = useTransform(scrollYProgress, [0, 0.85], [0.35, 0.95]);
  const textY = useTransform(scrollYProgress, [0, 0.5], ['0%', '-24%']);
  const textOpacity = useTransform(scrollYProgress, [0, 0.42], [1, 0]);
  const hudOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  // Section 2: WHAT AEGIS DOES scroll transforms
  const { scrollYProgress: methodScroll } = useScroll({
    target: methodologyRef,
    offset: ['start 75%', 'end 85%'],
  });
  const methodBgY = useTransform(methodScroll, [0, 1], ['-3%', '3%']);
  const cap1Opacity = useTransform(methodScroll, [0.03, 0.16], [0, 1]);
  const cap2Opacity = useTransform(methodScroll, [0.18, 0.32], [0, 1]);
  const cap3Opacity = useTransform(methodScroll, [0.34, 0.48], [0, 1]);
  const cap4Opacity = useTransform(methodScroll, [0.50, 0.64], [0, 1]);
  const cap5Opacity = useTransform(methodScroll, [0.66, 0.80], [0, 1]);
  const statementOpacity = useTransform(methodScroll, [0.82, 0.96], [0, 1]);
  const methodPathProgress = useTransform(methodScroll, [0.10, 0.85], [0, 1]);

  // Section 3: Sources section scroll transforms
  const { scrollYProgress: sourcesScroll } = useScroll({
    target: sourcesRef,
    offset: ['start 75%', 'end 85%'],
  });
  const source1Opacity = useTransform(sourcesScroll, [0.05, 0.22], [0, 1]);
  const source2Opacity = useTransform(sourcesScroll, [0.18, 0.35], [0, 1]);
  const source3Opacity = useTransform(sourcesScroll, [0.32, 0.48], [0, 1]);
  const source4Opacity = useTransform(sourcesScroll, [0.45, 0.62], [0, 1]);
  const lineProgress = useTransform(sourcesScroll, [0.25, 0.75], [0, 1]);
  const coreScale = useTransform(sourcesScroll, [0.6, 0.82], [0.95, 1]);
  const coreOpacity = useTransform(sourcesScroll, [0.55, 0.78], [0.4, 1]);
  const outputOpacity = useTransform(sourcesScroll, [0.75, 0.95], [0, 1]);
  const sourcesBgY = useTransform(sourcesScroll, [0, 1], ['-3%', '3%']);

  // Section 4: Lifecycle section scroll-linked path progression
  const { scrollYProgress: lifecycleProgress } = useScroll({
    target: lifecycleRef,
    offset: ['start 65%', 'end 85%'],
  });
  const pathHeight = useTransform(lifecycleProgress, [0, 1], ['0%', '100%']);
  const bgParallaxY = useTransform(lifecycleProgress, [0, 1], ['-4%', '4%']);

  async function handleStart() {
    setTransitioning(true);
    await new Promise((r) => setTimeout(r, 600));
    if (user) {
      navigate('/hub');
    } else {
      navigate('/login');
    }
  }

  const scrollToMethodology = () => {
    document.getElementById('methodology-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-[#050505] text-[#F5F2EA] min-h-screen selection:bg-[#E85D04] selection:text-black">
      {/* Full-screen Iris Page Transition */}
      <AnimatePresence>
        {transitioning && (
          <motion.div
            className="fixed inset-0 bg-[#E85D04] z-[200] flex items-center justify-center"
            initial={{ clipPath: 'circle(0% at 50% 50%)' }}
            animate={{ clipPath: 'circle(150% at 50% 50%)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="text-black font-bold text-lg tracking-[0.4em] uppercase font-mono">
              AEGIS — INITIALIZING SECURE GATEWAY
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top minimal brand bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/75 backdrop-blur-md border-b border-[#141414] px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-[#E85D04] flex items-center justify-center shadow-md shadow-[#E85D04]/20">
            <span className="text-black text-[10px] font-black tracking-widest font-mono">A</span>
          </div>
          <span className="font-bold text-[#F5F2EA] tracking-[0.25em] text-xs font-mono">AEGIS</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-[10px] font-mono text-[#66635D] tracking-widest uppercase hidden md:inline">
            MARITIME OIL SPILL INTELLIGENCE
          </div>

          {user ? (
            <Link
              to="/hub"
              className="text-xs font-mono text-[#E85D04] hover:text-[#FF7A30] transition-colors flex items-center gap-1.5 border border-[#E85D04]/30 px-3 py-1.5 bg-[#E85D04]/5"
            >
              <span>INVESTIGATION HUB</span>
              <ChevronRightIcon size={12} />
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-xs font-mono text-[#9B9891] hover:text-[#F5F2EA] transition-colors border border-[#222] px-3 py-1.5 hover:border-[#E85D04]"
            >
              [ OFFICER SIGN IN ]
            </Link>
          )}
        </div>
      </header>

      {/* ========================================================= */}
      {/* 1. CINEMATIC FULL-SCREEN HERO (100vw × 100vh) */}
      {/* ========================================================= */}
      <div ref={heroRef} className="relative w-full h-screen overflow-hidden flex flex-col justify-between">
        {/* Layer 1: Background HD Maritime Tanker Image */}
        <motion.div
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ scale: imageScale, y: imageY }}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1.02 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <img
            src="/images/tanker_hero.jpg"
            alt="Maritime Tanker Vessel Navigating Open Ocean"
            className="w-full h-full object-cover object-[center_35%]"
            style={{ filter: 'brightness(0.72) contrast(1.12) saturate(0.92)' }}
          />
        </motion.div>

        {/* Layer 2: Atmospheric Gradient Overlays & Vignette */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/92 via-[#050505]/45 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-[#050505]/85 via-[#050505]/30 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent pointer-events-none" />

        <motion.div
          className="absolute inset-0 bg-[#050505] pointer-events-none"
          style={{ opacity: overlayDarken }}
        />

        {/* Layer 3: Minimal Investigation HUD Framing */}
        <motion.div
          style={{ opacity: hudOpacity }}
          className="absolute inset-0 pointer-events-none z-10 p-8 sm:p-12 flex flex-col justify-between"
        >
          <div className="flex justify-between items-start pt-14">
            <div className="flex items-center gap-2 font-mono text-[10px] text-white/30 tracking-[0.25em] uppercase">
              <span className="text-[#E85D04]">+</span>
              <span>SURVEILLANCE SECTOR // EO-SAR</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 font-mono text-[10px] text-white/30 tracking-[0.2em] uppercase">
              <CompassIcon size={12} className="text-[#E85D04]" />
              <span>COUPLED ADVECTION GRID</span>
              <span className="text-[#E85D04]">+</span>
            </div>
          </div>

          <div className="hidden lg:flex justify-end items-end pb-8">
            <div className="border border-white/10 bg-[#050505]/40 backdrop-blur-sm p-4 text-[10px] font-mono text-[#9B9891] space-y-1 max-w-xs text-right">
              <div className="text-[#E85D04] uppercase font-bold tracking-widest flex items-center justify-end gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E85D04] animate-ping" />
                <span>ACTIVE SENSING SPHERE</span>
              </div>
              <div className="text-white/40">Synthetic Aperture Radar · Geofenced AIS Telemetry</div>
            </div>
          </div>
        </motion.div>

        {/* Layer 4: Foreground Hero Typography & CTA */}
        <motion.div
          className="relative z-20 h-full flex flex-col justify-center px-8 sm:px-16 lg:px-24 max-w-5xl"
          style={{ y: textY, opacity: textOpacity }}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
        >
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-5 bg-[#E85D04]" />
              <span className="text-[11px] font-mono tracking-[0.35em] text-[#9B9891] uppercase">
                STAGE // 01 · SURVEILLANCE & RECONSTRUCTION
              </span>
            </div>

            <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black tracking-tight text-[#F5F2EA] leading-none font-mono">
              AEGIS
            </h1>

            <div className="pt-2">
              <div className="text-xl sm:text-2xl lg:text-3xl text-[#9B9891] font-light tracking-[0.18em] uppercase font-mono">
                MARITIME OIL SPILL
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl text-[#F5F2EA] font-bold tracking-[0.18em] uppercase font-mono">
                INTELLIGENCE
              </div>
            </div>
          </div>

          <p className="text-[#9B9891] text-base sm:text-lg leading-relaxed max-w-md mb-10 font-mono">
            Investigate. <span className="text-[#F5F2EA] font-semibold">Trace.</span> Understand.
          </p>

          <div>
            <button
              onClick={handleStart}
              className="btn-primary text-xs sm:text-sm px-8 py-4 font-mono uppercase tracking-[0.2em] shadow-xl shadow-[#E85D04]/15 hover:shadow-[#E85D04]/30 transition-all cursor-pointer group flex items-center gap-3"
            >
              <span>[ START INVESTIGATION ]</span>
              <ChevronRightIcon size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* Subtle Minimal Scroll Indicator at bottom */}
        <div className="relative z-20 pb-8 flex flex-col items-center gap-2 pointer-events-none">
          <button
            onClick={scrollToMethodology}
            className="pointer-events-auto flex flex-col items-center gap-1.5 text-[10px] font-mono tracking-[0.3em] text-[#9B9891] uppercase hover:text-[#E85D04] transition-colors"
          >
            <span>SCROLL TO EXPLORE</span>
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ArrowDownIcon size={12} className="text-[#E85D04]" />
            </motion.div>
          </button>
        </div>

        {/* Vertical Orange Connection Line Linking to Section 2 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-16 bg-gradient-to-b from-[#E85D04]/0 via-[#E85D04]/50 to-[#E85D04] pointer-events-none z-20" />
      </div>

      {/* ========================================================= */}
      {/* 2. WHAT AEGIS DOES — CINEMATIC CONTINUOUS INVESTIGATION PROCESS */}
      {/* ========================================================= */}
      <section
        id="methodology-section"
        ref={methodologyRef}
        className="relative py-32 px-6 sm:px-12 lg:px-20 border-t border-[#141414] bg-[#050505] overflow-hidden"
      >
        {/* Layer 1: Background Subtle Maritime/Technical Grid with Parallax */}
        <motion.div
          style={{ y: prefersReducedMotion ? '0%' : methodBgY }}
          className="absolute inset-0 pointer-events-none opacity-20"
        >
          <div
            className="w-full h-[120%] -mt-[10%]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 60% 40%, rgba(232,93,4,0.08) 0%, transparent 60%), linear-gradient(to right, #141414 1px, transparent 1px), linear-gradient(to bottom, #141414 1px, transparent 1px)',
              backgroundSize: '100% 100%, 44px 44px, 44px 44px',
            }}
          />
        </motion.div>

        <div className="max-w-6xl mx-auto relative z-10 space-y-20">
          {/* Hero-like Section Intro with Sequential Scroll Entrance */}
          <div className="max-w-3xl space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 border border-[#E85D04]/30 bg-[#E85D04]/5 text-[10px] font-mono tracking-[0.35em] text-[#E85D04] uppercase"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D04]" />
              <span>CORE CAPABILITIES</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-black tracking-tight text-[#F5F2EA] font-mono leading-tight"
            >
              WHAT AEGIS DOES
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-xl font-mono text-[#9B9891] leading-relaxed max-w-2xl"
            >
              From the first detected signal to a defensible investigation dossier.
            </motion.p>

            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.25 }}
              className="h-[2px] bg-[#E85D04] origin-left w-28"
            />
          </div>

          {/* ========================================================= */}
          {/* DESKTOP & TABLET: CONTINUOUS SPATIAL INVESTIGATION PROCESS */}
          {/* ========================================================= */}
          <div className="hidden md:block relative pt-6 pb-8">
            {/* SVG Connecting Path Layer */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              viewBox="0 0 1000 780"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="capPathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E85D04" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#A83A00" stopOpacity="0.5" />
                </linearGradient>
              </defs>

              {/* Inactive Guide Track: 01 -> 02 -> 03 -> 04 -> 05 */}
              <path
                d="M 280 100 L 720 100 L 720 360 L 280 360 L 280 620 L 500 620"
                fill="none"
                stroke="#1c1c1c"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Active Scroll-Driven Progressive Drawing Line */}
              <motion.path
                d="M 280 100 L 720 100 L 720 360 L 280 360 L 280 620 L 500 620"
                fill="none"
                stroke="url(#capPathGrad)"
                strokeWidth="2.5"
                style={{
                  pathLength: prefersReducedMotion ? 1 : methodPathProgress,
                  opacity: prefersReducedMotion ? 1 : 0.9,
                }}
              />
            </svg>

            {/* Spatial Layout Container (3-Tier Process Flow) */}
            <div className="relative min-h-[760px] flex flex-col justify-between">
              {/* TIER 1: OBSERVE (Left) ────────► ANALYZE (Right) */}
              <div className="flex items-center justify-between">
                {/* 01 OBSERVE */}
                <motion.div
                  style={{ opacity: prefersReducedMotion ? 1 : cap1Opacity }}
                  onMouseEnter={() => setHoveredCapability('observe')}
                  onMouseLeave={() => setHoveredCapability(null)}
                  className="w-80 lg:w-96 z-20"
                >
                  <div className={`p-6 border bg-[#0b0b0b]/90 backdrop-blur-sm transition-all duration-300 ${
                    hoveredCapability === 'observe'
                      ? 'border-[#E85D04] -translate-y-1 shadow-[0_6px_24px_rgba(232,93,4,0.18)]'
                      : 'border-[#1b1b1b] hover:border-[#333]'
                  }`}>
                    <div className="flex items-center justify-between mb-3 text-[10px] font-mono tracking-widest text-[#66635D]">
                      <span className="text-[#E85D04] font-bold">[ {CAPABILITIES[0].num} ] {CAPABILITIES[0].step}</span>
                      <span className="text-[#9B9891]">{CAPABILITIES[0].microMeta}</span>
                    </div>

                    <h3 className="text-base lg:text-lg font-bold font-mono text-[#F5F2EA] mb-2 group-hover:text-white">
                      {CAPABILITIES[0].title}
                    </h3>
                    <p className="text-xs font-mono text-[#9B9891] leading-relaxed mb-3">
                      {CAPABILITIES[0].desc}
                    </p>

                    <div className="pt-2 border-t border-[#181818] flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[#E85D04]">&gt; {CAPABILITIES[0].hoverDetail}</span>
                      <CrosshairIcon size={12} className="text-[#E85D04]/60" />
                    </div>
                  </div>
                </motion.div>

                {/* 02 ANALYZE */}
                <motion.div
                  style={{ opacity: prefersReducedMotion ? 1 : cap2Opacity }}
                  onMouseEnter={() => setHoveredCapability('analyze')}
                  onMouseLeave={() => setHoveredCapability(null)}
                  className="w-80 lg:w-96 z-20"
                >
                  <div className={`p-6 border bg-[#0b0b0b]/90 backdrop-blur-sm transition-all duration-300 ${
                    hoveredCapability === 'analyze'
                      ? 'border-[#E85D04] -translate-y-1 shadow-[0_6px_24px_rgba(232,93,4,0.18)]'
                      : 'border-[#1b1b1b] hover:border-[#333]'
                  }`}>
                    <div className="flex items-center justify-between mb-3 text-[10px] font-mono tracking-widest text-[#66635D]">
                      <span className="text-[#E85D04] font-bold">[ {CAPABILITIES[1].num} ] {CAPABILITIES[1].step}</span>
                      <span className="text-[#9B9891]">{CAPABILITIES[1].microMeta}</span>
                    </div>

                    <h3 className="text-base lg:text-lg font-bold font-mono text-[#F5F2EA] mb-2 group-hover:text-white">
                      {CAPABILITIES[1].title}
                    </h3>
                    <p className="text-xs font-mono text-[#9B9891] leading-relaxed mb-3">
                      {CAPABILITIES[1].desc}
                    </p>

                    <div className="pt-2 border-t border-[#181818] flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[#E85D04]">&gt; {CAPABILITIES[1].hoverDetail}</span>
                      <CpuIcon size={12} className="text-[#E85D04]/60" />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* TIER 2: IDENTIFY (Left) ◄──────── TRACE (Right) */}
              <div className="flex items-center justify-between">
                {/* 04 IDENTIFY */}
                <motion.div
                  style={{ opacity: prefersReducedMotion ? 1 : cap4Opacity }}
                  onMouseEnter={() => setHoveredCapability('identify')}
                  onMouseLeave={() => setHoveredCapability(null)}
                  className="w-80 lg:w-96 z-20"
                >
                  <div className={`p-6 border bg-[#0b0b0b]/90 backdrop-blur-sm transition-all duration-300 ${
                    hoveredCapability === 'identify'
                      ? 'border-[#E85D04] -translate-y-1 shadow-[0_6px_24px_rgba(232,93,4,0.18)]'
                      : 'border-[#1b1b1b] hover:border-[#333]'
                  }`}>
                    <div className="flex items-center justify-between mb-3 text-[10px] font-mono tracking-widest text-[#66635D]">
                      <span className="text-[#E85D04] font-bold">[ {CAPABILITIES[3].num} ] {CAPABILITIES[3].step}</span>
                      <span className="text-[#9B9891]">{CAPABILITIES[3].microMeta}</span>
                    </div>

                    <h3 className="text-base lg:text-lg font-bold font-mono text-[#F5F2EA] mb-2 group-hover:text-white">
                      {CAPABILITIES[3].title}
                    </h3>
                    <p className="text-xs font-mono text-[#9B9891] leading-relaxed mb-3">
                      {CAPABILITIES[3].desc}
                    </p>

                    <div className="pt-2 border-t border-[#181818] flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[#E85D04]">&gt; {CAPABILITIES[3].hoverDetail}</span>
                      <SearchIcon size={12} className="text-[#E85D04]/60" />
                    </div>
                  </div>
                </motion.div>

                {/* 03 TRACE */}
                <motion.div
                  style={{ opacity: prefersReducedMotion ? 1 : cap3Opacity }}
                  onMouseEnter={() => setHoveredCapability('trace')}
                  onMouseLeave={() => setHoveredCapability(null)}
                  className="w-80 lg:w-96 z-20"
                >
                  <div className={`p-6 border bg-[#0b0b0b]/90 backdrop-blur-sm transition-all duration-300 ${
                    hoveredCapability === 'trace'
                      ? 'border-[#E85D04] -translate-y-1 shadow-[0_6px_24px_rgba(232,93,4,0.18)]'
                      : 'border-[#1b1b1b] hover:border-[#333]'
                  }`}>
                    <div className="flex items-center justify-between mb-3 text-[10px] font-mono tracking-widest text-[#66635D]">
                      <span className="text-[#E85D04] font-bold">[ {CAPABILITIES[2].num} ] {CAPABILITIES[2].step}</span>
                      <span className="text-[#9B9891]">{CAPABILITIES[2].microMeta}</span>
                    </div>

                    <h3 className="text-base lg:text-lg font-bold font-mono text-[#F5F2EA] mb-2 group-hover:text-white">
                      {CAPABILITIES[2].title}
                    </h3>
                    <p className="text-xs font-mono text-[#9B9891] leading-relaxed mb-3">
                      {CAPABILITIES[2].desc}
                    </p>

                    <div className="pt-2 border-t border-[#181818] flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[#E85D04]">&gt; {CAPABILITIES[2].hoverDetail}</span>
                      <WindIcon size={12} className="text-[#E85D04]/60" />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* TIER 3: DOCUMENT (Centered Terminal Node) */}
              <div className="flex justify-center">
                <motion.div
                  style={{ opacity: prefersReducedMotion ? 1 : cap5Opacity }}
                  onMouseEnter={() => setHoveredCapability('document')}
                  onMouseLeave={() => setHoveredCapability(null)}
                  className="w-80 lg:w-96 z-20"
                >
                  <div className={`p-6 border-2 bg-[#0b0b0b] backdrop-blur-sm transition-all duration-300 ${
                    hoveredCapability === 'document'
                      ? 'border-[#E85D04] -translate-y-1 shadow-[0_6px_24px_rgba(232,93,4,0.22)]'
                      : 'border-[#E85D04]/50 hover:border-[#E85D04]'
                  }`}>
                    <div className="flex items-center justify-between mb-3 text-[10px] font-mono tracking-widest text-[#66635D]">
                      <span className="text-[#E85D04] font-bold">[ {CAPABILITIES[4].num} ] {CAPABILITIES[4].step}</span>
                      <span className="text-[#4ade80]">{CAPABILITIES[4].microMeta}</span>
                    </div>

                    <h3 className="text-base lg:text-lg font-bold font-mono text-[#F5F2EA] mb-2 group-hover:text-white">
                      {CAPABILITIES[4].title}
                    </h3>
                    <p className="text-xs font-mono text-[#9B9891] leading-relaxed mb-3">
                      {CAPABILITIES[4].desc}
                    </p>

                    <div className="pt-2 border-t border-[#181818] flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[#E85D04]">&gt; {CAPABILITIES[4].hoverDetail}</span>
                      <ShieldCheckIcon size={12} className="text-[#4ade80]" />
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* MOBILE: CLEAN VERTICAL INVESTIGATION PROCESS (< md) */}
          {/* ========================================================= */}
          <div className="md:hidden space-y-6">
            {CAPABILITIES.map((cap, idx) => (
              <div key={cap.id} className="relative">
                <div className="border border-[#1a1a1a] bg-[#0c0c0c] p-6 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-[#66635D]">
                    <span className="text-[#E85D04] font-bold">[ {cap.num} ] {cap.step}</span>
                    <span className="text-[#9B9891]">{cap.microMeta}</span>
                  </div>

                  <h3 className="text-base font-bold font-mono text-[#F5F2EA]">{cap.title}</h3>
                  <p className="text-xs font-mono text-[#9B9891] leading-relaxed">{cap.desc}</p>
                  <div className="text-[10px] font-mono text-[#E85D04] pt-1">
                    &gt; {cap.hoverDetail}
                  </div>
                </div>

                {idx < CAPABILITIES.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowDownIcon size={14} className="text-[#E85D04]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ========================================================= */}
          {/* CENTER STATEMENT: TYPOGRAPHY-DRIVEN MINIMAL TRANSITION */}
          {/* ========================================================= */}
          <motion.div
            style={{ opacity: prefersReducedMotion ? 1 : statementOpacity }}
            className="pt-16 pb-6 text-center space-y-4 max-w-xl mx-auto"
          >
            <div className="text-[10px] font-mono tracking-[0.4em] text-[#66635D] uppercase">
              METHODOLOGY CONVERGENCE
            </div>

            <div className="space-y-1 font-mono font-black text-xl sm:text-3xl tracking-wider uppercase">
              <div className="text-[#9B9891]">FROM SIGNAL</div>
              <div className="text-[#E85D04]">TO EVIDENCE</div>
              <div className="text-[#F5F2EA]">TO INVESTIGATION</div>
            </div>

            {/* Seamless Transition Line connecting into Investigation Sources */}
            <div className="pt-8 flex flex-col items-center">
              <div className="w-px h-16 bg-gradient-to-b from-[#E85D04] via-[#E85D04]/60 to-transparent" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. INVESTIGATION SOURCES — CINEMATIC EVIDENCE CONVERGENCE */}
      {/* ========================================================= */}
      <section
        ref={sourcesRef}
        className="relative py-32 px-6 sm:px-12 lg:px-20 border-t border-[#141414] bg-[#070707] overflow-hidden"
      >
        {/* Layer 2: Subtle technical grid texture with parallax */}
        <motion.div
          style={{ y: prefersReducedMotion ? '0%' : sourcesBgY }}
          className="absolute inset-0 pointer-events-none opacity-25"
        >
          <div
            className="w-full h-[120%] -mt-[10%]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 45%, rgba(232,93,4,0.08) 0%, transparent 55%), linear-gradient(to right, #151515 1px, transparent 1px), linear-gradient(to bottom, #151515 1px, transparent 1px)',
              backgroundSize: '100% 100%, 40px 40px, 40px 40px',
            }}
          />
        </motion.div>

        <div className="max-w-6xl mx-auto relative z-10 space-y-16">
          {/* Section Header */}
          <div className="max-w-2xl space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 border border-[#E85D04]/30 bg-[#E85D04]/5 text-[10px] font-mono tracking-[0.35em] text-[#E85D04] uppercase"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D04]" />
              <span>INVESTIGATION SOURCES</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-5xl font-bold tracking-tight text-[#F5F2EA] font-mono"
            >
              Where the Evidence Comes From
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xs sm:text-sm font-mono text-[#9B9891] leading-relaxed max-w-xl"
            >
              AEGIS combines satellite observation, vessel movement, environmental context, and model analysis into a single investigative workflow.
            </motion.p>

            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.25 }}
              className="h-[2px] bg-[#E85D04] origin-left w-28"
            />
          </div>

          {/* ========================================================= */}
          {/* DESKTOP & TABLET: SPATIAL EVIDENCE CONVERGENCE (md and above) */}
          {/* ========================================================= */}
          <div className="hidden md:block relative pt-4 pb-12">
            {/* SVG Connecting Paths Layer */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              viewBox="0 0 1000 680"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="lineGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E85D04" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#A83A00" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* Path 1: Sentinel (Top-Left 280,120) -> AEGIS Center (440,250) */}
              <motion.path
                d="M 280 120 L 440 250"
                fill="none"
                stroke={hoveredSource === 'sentinel' ? '#E85D04' : '#262626'}
                strokeWidth={hoveredSource === 'sentinel' ? '2.5' : '1.5'}
                strokeDasharray="4 3"
                className="transition-colors duration-300"
              />
              <motion.path
                d="M 280 120 L 440 250"
                fill="none"
                stroke="#E85D04"
                strokeWidth="2"
                style={{
                  pathLength: prefersReducedMotion ? 1 : lineProgress,
                  opacity: prefersReducedMotion ? 1 : source1Opacity,
                }}
              />

              {/* Path 2: AIS (Bottom-Left 280,450) -> AEGIS Center (440,320) */}
              <motion.path
                d="M 280 450 L 440 320"
                fill="none"
                stroke={hoveredSource === 'ais' ? '#E85D04' : '#262626'}
                strokeWidth={hoveredSource === 'ais' ? '2.5' : '1.5'}
                strokeDasharray="4 3"
                className="transition-colors duration-300"
              />
              <motion.path
                d="M 280 450 L 440 320"
                fill="none"
                stroke="#E85D04"
                strokeWidth="2"
                style={{
                  pathLength: prefersReducedMotion ? 1 : lineProgress,
                  opacity: prefersReducedMotion ? 1 : source2Opacity,
                }}
              />

              {/* Path 3: Environmental (Top-Right 720,120) -> AEGIS Center (560,250) */}
              <motion.path
                d="M 720 120 L 560 250"
                fill="none"
                stroke={hoveredSource === 'environmental' ? '#E85D04' : '#262626'}
                strokeWidth={hoveredSource === 'environmental' ? '2.5' : '1.5'}
                strokeDasharray="4 3"
                className="transition-colors duration-300"
              />
              <motion.path
                d="M 720 120 L 560 250"
                fill="none"
                stroke="#E85D04"
                strokeWidth="2"
                style={{
                  pathLength: prefersReducedMotion ? 1 : lineProgress,
                  opacity: prefersReducedMotion ? 1 : source3Opacity,
                }}
              />

              {/* Path 4: ML (Bottom-Right 720,450) -> AEGIS Center (560,320) */}
              <motion.path
                d="M 720 450 L 560 320"
                fill="none"
                stroke={hoveredSource === 'ml' ? '#E85D04' : '#262626'}
                strokeWidth={hoveredSource === 'ml' ? '2.5' : '1.5'}
                strokeDasharray="4 3"
                className="transition-colors duration-300"
              />
              <motion.path
                d="M 720 450 L 560 320"
                fill="none"
                stroke="#E85D04"
                strokeWidth="2"
                style={{
                  pathLength: prefersReducedMotion ? 1 : lineProgress,
                  opacity: prefersReducedMotion ? 1 : source4Opacity,
                }}
              />

              {/* Downstream Output Path: AEGIS Center (500,370) -> Downstream Bridge (500,550) */}
              <motion.path
                d="M 500 370 L 500 550"
                fill="none"
                stroke="#2a2a2a"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <motion.path
                d="M 500 370 L 500 550"
                fill="none"
                stroke="#E85D04"
                strokeWidth="2"
                style={{
                  pathLength: prefersReducedMotion ? 1 : outputOpacity,
                  opacity: prefersReducedMotion ? 1 : outputOpacity,
                }}
              />
            </svg>

            {/* Spatial Layout Container */}
            <div className="relative min-h-[640px] flex items-center justify-center">
              {/* --- SOURCE 1: Top-Left (Sentinel-1) --- */}
              <motion.div
                style={{ opacity: prefersReducedMotion ? 1 : source1Opacity }}
                onMouseEnter={() => setHoveredSource('sentinel')}
                onMouseLeave={() => setHoveredSource(null)}
                className="absolute top-4 left-0 lg:left-4 w-72 lg:w-80 z-20"
              >
                <div className={`p-5 border bg-[#0d0d0d]/90 backdrop-blur-sm transition-all duration-300 ${
                  hoveredSource === 'sentinel'
                    ? 'border-[#E85D04] -translate-y-1 shadow-[0_4px_20px_rgba(232,93,4,0.15)]'
                    : 'border-[#1e1e1e] hover:border-[#333]'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SatelliteIcon size={14} className="text-[#E85D04]" />
                      <span className="text-[10px] font-mono tracking-widest text-[#E85D04] font-bold">
                        [01] SATELLITE
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono tracking-widest px-2 py-0.5 border ${
                      sourcesData[0].isLive
                        ? 'text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/5'
                        : 'text-[#9B9891] border-[#292929] bg-[#141414]'
                    }`}>
                      {sourcesData[0].status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold font-mono text-[#F5F2EA] mb-1">
                    {sourcesData[0].title}
                  </h3>
                  <p className="text-[11px] font-mono text-[#66635D] leading-relaxed mb-2">
                    {sourcesData[0].desc}
                  </p>
                  <div className="pt-2 border-t border-[#1a1a1a] text-[10px] font-mono text-[#E85D04]/90">
                    &gt; {sourcesData[0].hoverDetail}
                  </div>
                </div>
              </motion.div>

              {/* --- SOURCE 2: Bottom-Left (AIS) --- */}
              <motion.div
                style={{ opacity: prefersReducedMotion ? 1 : source2Opacity }}
                onMouseEnter={() => setHoveredSource('ais')}
                onMouseLeave={() => setHoveredSource(null)}
                className="absolute bottom-28 left-0 lg:left-4 w-72 lg:w-80 z-20"
              >
                <div className={`p-5 border bg-[#0d0d0d]/90 backdrop-blur-sm transition-all duration-300 ${
                  hoveredSource === 'ais'
                    ? 'border-[#E85D04] -translate-y-1 shadow-[0_4px_20px_rgba(232,93,4,0.15)]'
                    : 'border-[#1e1e1e] hover:border-[#333]'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <RadioIcon size={14} className="text-[#E85D04]" />
                      <span className="text-[10px] font-mono tracking-widest text-[#E85D04] font-bold">
                        [02] AIS TELEMETRY
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono tracking-widest px-2 py-0.5 border ${
                      sourcesData[1].isLive
                        ? 'text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/5'
                        : 'text-[#9B9891] border-[#292929] bg-[#141414]'
                    }`}>
                      {sourcesData[1].status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold font-mono text-[#F5F2EA] mb-1">
                    {sourcesData[1].title}
                  </h3>
                  <p className="text-[11px] font-mono text-[#66635D] leading-relaxed mb-2">
                    {sourcesData[1].desc}
                  </p>
                  <div className="pt-2 border-t border-[#1a1a1a] text-[10px] font-mono text-[#E85D04]/90">
                    &gt; {sourcesData[1].hoverDetail}
                  </div>
                </div>
              </motion.div>

              {/* --- CENTRAL AEGIS INVESTIGATION NODE --- */}
              <motion.div
                style={{
                  scale: prefersReducedMotion ? 1 : coreScale,
                  opacity: prefersReducedMotion ? 1 : coreOpacity,
                }}
                className="relative z-30 w-72 lg:w-84 text-center my-auto"
              >
                <div className="relative p-7 border-2 border-[#E85D04]/50 bg-[#0c0c0c] shadow-[0_0_30px_rgba(232,93,4,0.15)] transition-all duration-300 hover:border-[#E85D04]">
                  {/* Subtle Corner Reticles */}
                  <div className="absolute top-1.5 left-2 text-[8px] font-mono text-[#E85D04] select-none">+</div>
                  <div className="absolute top-1.5 right-2 text-[8px] font-mono text-[#E85D04] select-none">+</div>
                  <div className="absolute bottom-1.5 left-2 text-[8px] font-mono text-[#E85D04] select-none">+</div>
                  <div className="absolute bottom-1.5 right-2 text-[8px] font-mono text-[#E85D04] select-none">+</div>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border border-[#E85D04]/30 bg-[#E85D04]/10 text-[9px] font-mono tracking-widest text-[#E85D04] uppercase mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E85D04] animate-pulse" />
                    <span>EVIDENCE CONVERGENCE</span>
                  </div>

                  <h2 className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-[#F5F2EA] leading-none mb-1">
                    AEGIS
                  </h2>
                  <div className="text-[11px] font-bold font-mono tracking-[0.2em] text-[#E85D04] uppercase mb-3">
                    INVESTIGATION ENGINE
                  </div>

                  <p className="text-[10px] font-mono text-[#9B9891] leading-relaxed uppercase tracking-wider">
                    Harmonizing SAR imagery, AIS corridors, hydrodynamic drift, and U-Net segmentation
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#1f1f1f] flex items-center justify-center gap-3 text-[9px] font-mono text-[#66635D]">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                      <span>COUPLED RECONSTRUCTION</span>
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* --- SOURCE 3: Top-Right (Environmental) --- */}
              <motion.div
                style={{ opacity: prefersReducedMotion ? 1 : source3Opacity }}
                onMouseEnter={() => setHoveredSource('environmental')}
                onMouseLeave={() => setHoveredSource(null)}
                className="absolute top-4 right-0 lg:right-4 w-72 lg:w-80 z-20"
              >
                <div className={`p-5 border bg-[#0d0d0d]/90 backdrop-blur-sm transition-all duration-300 ${
                  hoveredSource === 'environmental'
                    ? 'border-[#E85D04] -translate-y-1 shadow-[0_4px_20px_rgba(232,93,4,0.15)]'
                    : 'border-[#1e1e1e] hover:border-[#333]'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <WindIcon size={14} className="text-[#E85D04]" />
                      <span className="text-[10px] font-mono tracking-widest text-[#E85D04] font-bold">
                        [03] OCEAN DYNAMICS
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono tracking-widest px-2 py-0.5 border ${
                      sourcesData[2].isLive
                        ? 'text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/5'
                        : 'text-[#9B9891] border-[#292929] bg-[#141414]'
                    }`}>
                      {sourcesData[2].status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold font-mono text-[#F5F2EA] mb-1">
                    {sourcesData[2].title}
                  </h3>
                  <p className="text-[11px] font-mono text-[#66635D] leading-relaxed mb-2">
                    {sourcesData[2].desc}
                  </p>
                  <div className="pt-2 border-t border-[#1a1a1a] text-[10px] font-mono text-[#E85D04]/90">
                    &gt; {sourcesData[2].hoverDetail}
                  </div>
                </div>
              </motion.div>

              {/* --- SOURCE 4: Bottom-Right (ML Analysis) --- */}
              <motion.div
                style={{ opacity: prefersReducedMotion ? 1 : source4Opacity }}
                onMouseEnter={() => setHoveredSource('ml')}
                onMouseLeave={() => setHoveredSource(null)}
                className="absolute bottom-28 right-0 lg:right-4 w-72 lg:w-80 z-20"
              >
                <div className={`p-5 border bg-[#0d0d0d]/90 backdrop-blur-sm transition-all duration-300 ${
                  hoveredSource === 'ml'
                    ? 'border-[#E85D04] -translate-y-1 shadow-[0_4px_20px_rgba(232,93,4,0.15)]'
                    : 'border-[#1e1e1e] hover:border-[#333]'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CpuIcon size={14} className="text-[#E85D04]" />
                      <span className="text-[10px] font-mono tracking-widest text-[#E85D04] font-bold">
                        [04] ML SEGMENTATION
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono tracking-widest px-2 py-0.5 border ${
                      sourcesData[3].isLive
                        ? 'text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/5'
                        : 'text-[#9B9891] border-[#292929] bg-[#141414]'
                    }`}>
                      {sourcesData[3].status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold font-mono text-[#F5F2EA] mb-1">
                    {sourcesData[3].title}
                  </h3>
                  <p className="text-[11px] font-mono text-[#66635D] leading-relaxed mb-2">
                    {sourcesData[3].desc}
                  </p>
                  <div className="pt-2 border-t border-[#1a1a1a] text-[10px] font-mono text-[#E85D04]/90">
                    &gt; {sourcesData[3].hoverDetail}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* --- DOWNSTREAM EVIDENCE PIPELINE BRIDGE --- */}
            <motion.div
              style={{ opacity: prefersReducedMotion ? 1 : outputOpacity }}
              className="mt-6 flex flex-col items-center text-center space-y-3"
            >
              <div className="inline-flex items-center gap-1.5 text-[9px] font-mono tracking-[0.25em] text-[#E85D04] uppercase">
                <span>DOWNSTREAM INVESTIGATION PIPELINE</span>
                <ArrowDownIcon size={11} className="animate-bounce" />
              </div>

              <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-4 p-3 border border-[#1a1a1a] bg-[#0c0c0c] text-[10px] font-mono">
                <span className="text-[#F5F2EA] font-semibold">EVIDENCE INGESTION</span>
                <span className="text-[#E85D04]">→</span>
                <span className="text-[#9B9891]">ANALYSIS</span>
                <span className="text-[#E85D04]">→</span>
                <span className="text-[#9B9891]">ORIGIN DRIFT</span>
                <span className="text-[#E85D04]">→</span>
                <span className="text-[#9B9891]">FORENSICS</span>
                <span className="text-[#E85D04]">→</span>
                <span className="text-[#4ade80] font-bold">DOSSIER</span>
              </div>
            </motion.div>
          </div>

          {/* ========================================================= */}
          {/* MOBILE: VERTICAL EVIDENCE PIPELINE (< md) */}
          {/* ========================================================= */}
          <div className="md:hidden space-y-6">
            {sourcesData.map((src, idx) => {
              const Icon = src.icon;
              return (
                <div key={src.id} className="relative">
                  <div className="border border-[#1a1a1a] bg-[#0c0c0c] p-5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="text-[#E85D04]" />
                        <span className="text-[10px] font-mono tracking-widest text-[#E85D04] font-bold">
                          [{src.num}] {src.title.split('/')[0]}
                        </span>
                      </div>
                      <span className={`text-[8px] font-mono tracking-widest px-2 py-0.5 border ${
                        src.isLive
                          ? 'text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/5'
                          : 'text-[#9B9891] border-[#292929] bg-[#141414]'
                      }`}>
                        {src.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold font-mono text-[#F5F2EA]">{src.title}</h3>
                    <p className="text-xs font-mono text-[#66635D] leading-relaxed">{src.desc}</p>
                    <div className="text-[10px] font-mono text-[#E85D04]/90 pt-1">
                      &gt; {src.hoverDetail}
                    </div>
                  </div>

                  {idx < sourcesData.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDownIcon size={12} className="text-[#E85D04]" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Mobile Central Node */}
            <div className="border-2 border-[#E85D04]/40 bg-[#0c0c0c] p-6 text-center space-y-2 mt-6">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-[#E85D04]/30 bg-[#E85D04]/10 text-[9px] font-mono tracking-widest text-[#E85D04] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E85D04] animate-pulse" />
                <span>EVIDENCE CONVERGENCE</span>
              </div>
              <h2 className="text-2xl font-black font-mono tracking-tight text-[#F5F2EA]">AEGIS</h2>
              <div className="text-[10px] font-bold font-mono tracking-[0.2em] text-[#E85D04] uppercase">
                INVESTIGATION ENGINE
              </div>
              <p className="text-[11px] font-mono text-[#9B9891]">
                Harmonizing SAR imagery, AIS corridors, hydrodynamic drift, and U-Net segmentation.
              </p>
            </div>

            {/* Mobile Downstream Output */}
            <div className="p-4 border border-[#1a1a1a] bg-[#080808] text-center space-y-2">
              <div className="text-[9px] font-mono tracking-widest text-[#E85D04] uppercase">
                INVESTIGATION OUTPUT
              </div>
              <div className="text-[10px] font-mono text-[#9B9891] leading-relaxed">
                ORIGIN → AIS CORRELATION → FORENSICS → DOSSIER
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. INVESTIGATION LIFECYCLE — CINEMATIC ZIG-ZAG OPERATIONAL TIMELINE */}
      {/* ========================================================= */}
      <section
        ref={lifecycleRef}
        className="relative py-32 px-6 sm:px-12 lg:px-20 border-t border-[#141414] bg-[#050505] overflow-hidden"
      >
        {/* Layer 2: Subtle Atmospheric Texture / Grid drifting via Parallax */}
        <motion.div
          style={{ y: prefersReducedMotion ? '0%' : bgParallaxY }}
          className="absolute inset-0 pointer-events-none opacity-20"
        >
          <div
            className="w-full h-[120%] -mt-[10%]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 30%, rgba(232,93,4,0.06) 0%, transparent 60%), linear-gradient(to right, #111 1px, transparent 1px), linear-gradient(to bottom, #111 1px, transparent 1px)',
              backgroundSize: '100% 100%, 48px 48px, 48px 48px',
            }}
          />
        </motion.div>

        <div className="max-w-6xl mx-auto relative z-10 space-y-24">
          {/* Section Header with sequential reveal */}
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 border border-[#E85D04]/30 bg-[#E85D04]/5 text-[10px] font-mono tracking-[0.35em] text-[#E85D04] uppercase"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D04]" />
              <span>INVESTIGATION LIFECYCLE</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-5xl font-bold tracking-tight text-[#F5F2EA] font-mono"
            >
              How an Investigation Works
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xs sm:text-sm font-mono text-[#66635D] uppercase tracking-widest max-w-lg mx-auto"
            >
              Sequential operational pipeline from orbital acquisition to legally actionable forensic dossier
            </motion.p>

            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.25 }}
              className="h-[2px] bg-[#E85D04] origin-center w-28 mx-auto"
            />
          </div>

          {/* Continuous Zig-Zag Timeline Container */}
          <div className="relative pt-6 pb-12">
            {/* Layer 3: Central Vertical Timeline Track */}
            <div className="absolute top-0 bottom-0 left-6 md:left-1/2 -translate-x-1/2 w-0.5 bg-[#181818]" />

            {/* Dynamic Active Progress Line (Orange) */}
            <motion.div
              className="absolute top-0 left-6 md:left-1/2 -translate-x-1/2 w-0.5 bg-[#E85D04] origin-top shadow-[0_0_12px_rgba(232,93,4,0.7)]"
              style={{
                height: prefersReducedMotion ? '100%' : pathHeight,
              }}
            />

            {/* Subtle Vertical Label beside Central Spine (Desktop only) */}
            <div className="hidden lg:flex absolute top-12 left-1/2 ml-4 -translate-y-1/2 flex-col items-start select-none pointer-events-none opacity-40">
              <span className="text-[9px] font-mono tracking-[0.35em] text-[#66635D] uppercase [writing-mode:vertical-rl]">
                CASE PROGRESSION // OPERATIONAL TIMELINE
              </span>
            </div>

            {/* Alternating Stages */}
            <div className="space-y-16 sm:space-y-24 relative z-10">
              {METHOD_STEPS.map((step, idx) => {
                const isLeft = idx % 2 === 0; // 01, 03, 05, 07 are LEFT (odd stage numbers)
                return (
                  <div
                    key={step.num}
                    className="relative flex flex-col md:flex-row items-start md:items-center"
                  >
                    {/* Layer 4: Stage Node Marker on the Spine */}
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: false, amount: 0.5 }}
                      transition={{ duration: 0.4 }}
                      className="absolute left-6 md:left-1/2 -translate-x-1/2 z-30 flex items-center justify-center top-6 md:top-auto"
                    >
                      <div className="relative flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-[#050505] border border-[#262626] flex items-center justify-center transition-all duration-300 group-hover:border-[#E85D04] group-hover:shadow-[0_0_12px_rgba(232,93,4,0.3)]">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#E85D04]" />
                        </div>
                        <div className="absolute -top-1 -right-1 text-[8px] text-[#E85D04]/60 font-mono select-none">
                          +
                        </div>
                      </div>
                    </motion.div>

                    {/* Horizontal Connector Branch between Node and Content */}
                    <div className="md:hidden absolute top-10 left-6 w-8 h-px bg-gradient-to-r from-[#E85D04] to-[#262626]" />

                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: false, amount: 0.4 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`hidden md:block absolute top-1/2 -translate-y-1/2 h-px bg-gradient-to-r ${
                        isLeft
                          ? 'right-1/2 w-16 from-transparent to-[#E85D04] origin-right'
                          : 'left-1/2 w-16 from-[#E85D04] to-transparent origin-left'
                      }`}
                    />

                    {/* Layer 5: Stage Content Card */}
                    <div
                      className={`w-full pl-16 sm:pl-20 md:pl-0 md:w-1/2 ${
                        isLeft ? 'md:pr-16 md:text-right' : 'md:ml-auto md:pl-16 md:text-left'
                      }`}
                    >
                      <motion.div
                        initial={{
                          opacity: 0,
                          x: prefersReducedMotion ? 0 : isLeft ? -35 : 35,
                        }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: false, amount: 0.3 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className={`group relative border border-[#1a1a1a] bg-[#0c0c0c]/85 backdrop-blur-sm p-6 sm:p-7 transition-all duration-300 hover:border-[#E85D04]/60 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)] ${
                          isLeft ? 'md:border-r-2 md:border-r-[#E85D04]/40' : 'md:border-l-2 md:border-l-[#E85D04]/40'
                        }`}
                      >
                        {/* Micro Technical Header */}
                        <div
                          className={`flex items-center gap-3 mb-3 text-[10px] font-mono tracking-widest text-[#66635D] ${
                            isLeft ? 'md:justify-end' : 'md:justify-start'
                          }`}
                        >
                          <span className="text-[#E85D04] font-semibold">{step.phase}</span>
                          <span>·</span>
                          <span className="text-[#9B9891]">{step.tag}</span>
                        </div>

                        {/* Stage Number & Title */}
                        <div
                          className={`flex items-baseline gap-3 mb-2.5 ${
                            isLeft ? 'md:flex-row-reverse' : 'flex-row'
                          }`}
                        >
                          <span className="text-xl sm:text-2xl font-black font-mono text-[#E85D04] tracking-tight group-hover:text-[#FF7A30] transition-colors">
                            [{step.num}]
                          </span>
                          <h3 className="text-base sm:text-lg font-bold font-mono tracking-wide text-[#F5F2EA] group-hover:text-white transition-colors">
                            {step.title}
                          </h3>
                        </div>

                        {/* Description */}
                        <p
                          className={`text-xs sm:text-sm font-mono text-[#9B9891] leading-relaxed group-hover:text-[#b8b5ad] transition-colors max-w-lg ${
                            isLeft ? 'md:ml-auto' : ''
                          }`}
                        >
                          {step.desc}
                        </p>

                        {/* Subtle Corner Indicator Mark */}
                        <div
                          className={`absolute top-2 text-[9px] font-mono text-[#333] group-hover:text-[#E85D04]/60 transition-colors select-none ${
                            isLeft ? 'left-2' : 'right-2'
                          }`}
                        >
                          +
                        </div>
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Operational Sequence Terminal Tag at bottom of timeline */}
            <div className="relative mt-16 flex flex-col items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 border border-[#222] bg-[#0c0c0c] px-4 py-2 font-mono text-[10px] tracking-[0.25em] text-[#9B9891] uppercase"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                <span>EVIDENCE PROVENANCE SECURED // TECHNICAL DOSSIER READY</span>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* FOOTER */}
      {/* ========================================================= */}
      <footer className="py-16 px-8 lg:px-20 border-t border-[#141414] bg-[#050505]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-[#E85D04]" />
              <span className="font-bold text-[#F5F2EA] tracking-[0.2em] text-xs font-mono">AEGIS</span>
            </div>
            <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest">
              Maritime Oil Spill Intelligence Platform
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono text-[#66635D]">
            {['Investigation', 'Satellite', 'Time Machine', 'Origin & Drift', 'AIS Hunt', 'Forensics', 'Report'].map((item) => (
              <span key={item} className="hover:text-[#9B9891] transition-colors cursor-default">
                {item}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
