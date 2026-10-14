import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PageShell from '../components/PageShell';
import ExpandableSection from '../components/ExpandableSection';
import { api } from '../api/client';
import { SatelliteIcon, FileTextIcon, SearchIcon } from 'lucide-react';

export default function NewInvestigationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'live' ? 'A' : searchParams.get('mode') === 'manual' ? 'B' : null;
  const [selectedPath, setSelectedPath] = useState<'A' | 'B' | null>(initialMode);

  // Path A presets & state (Live Satellite)
  const AOI_PRESETS: Record<string, { minLat: number; maxLat: number; minLon: number; maxLon: number; centerLat: number; centerLon: number; defaultTime: string }> = {
    'Arabian Sea - Sector 4 (Saurashtra Basin)': {
      minLat: 21.65,
      maxLat: 22.05,
      minLon: 68.75,
      maxLon: 69.25,
      centerLat: 21.8033,
      centerLon: 68.9083,
      defaultTime: '2026-09-03T14:20:18.000Z',
    },
    'Persian Gulf - Strait of Hormuz': {
      minLat: 26.20,
      maxLat: 26.65,
      minLon: 56.10,
      maxLon: 56.65,
      centerLat: 26.425,
      centerLon: 56.375,
      defaultTime: '2026-09-03T14:20:18.000Z',
    },
    'Gulf of Aden - Bab-el-Mandeb': {
      minLat: 12.40,
      maxLat: 12.85,
      minLon: 43.15,
      maxLon: 43.65,
      centerLat: 12.625,
      centerLon: 43.40,
      defaultTime: '2026-09-03T14:20:18.000Z',
    },
  };

  const [satelliteAoi, setSatelliteAoi] = useState('Arabian Sea - Sector 4 (Saurashtra Basin)');
  const [satelliteStartDate, setSatelliteStartDate] = useState('2026-09-01');
  const [satelliteEndDate, setSatelliteEndDate] = useState('2026-09-05');
  const [searchingSatellite, setSearchingSatellite] = useState(false);
  const [satelliteSearchResult, setSatelliteSearchResult] = useState<any>(null);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);

  // Path B state (User Created)
  const [isDemoBenchmark, setIsDemoBenchmark] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: 'Maritime Spill Investigation',
    aoiName: 'Offshore Sector 4',
    detectionTime: '2026-09-03T14:20',
    minLat: '21.65',
    maxLat: '22.05',
    minLon: '68.75',
    maxLon: '69.25',
    centerLat: '21.8033',
    centerLon: '68.9083',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Search real satellite provider via backend CDSE integration
  async function handleSearchSatellite() {
    setSearchingSatellite(true);
    setSatelliteSearchResult(null);
    setSelectedScene(null);
    setError('');

    const preset = AOI_PRESETS[satelliteAoi] || AOI_PRESETS['Arabian Sea - Sector 4 (Saurashtra Basin)'];

    try {
      const result = await api.satellite.search({
        minLat: preset.minLat,
        minLon: preset.minLon,
        maxLat: preset.maxLat,
        maxLon: preset.maxLon,
        startDate: satelliteStartDate,
        endDate: satelliteEndDate,
        limit: 10,
      });

      setSatelliteSearchResult(result);
      if (result && result.scenes && result.scenes.length > 0) {
        setSelectedScene(result.scenes[0].sceneId);
      }
    } catch (err: any) {
      setSatelliteSearchResult({
        providerConfigured: false,
        scenes: [],
        errorMessage: err.message || 'Satellite provider query failed',
      });
    } finally {
      setSearchingSatellite(false);
    }
  }

  // Handle final creation
  async function handleCreateInvestigation(sourceType: 'LIVE SATELLITE' | 'USER CREATED') {
    setSubmitting(true);
    setError('');

    try {
      const preset = AOI_PRESETS[satelliteAoi] || AOI_PRESETS['Arabian Sea - Sector 4 (Saurashtra Basin)'];
      const incidentName = sourceType === 'LIVE SATELLITE'
        ? `Satellite SAR Investigation - ${satelliteAoi.split('(')[0].trim()}`
        : manualForm.name;

      const aoi = sourceType === 'LIVE SATELLITE' ? satelliteAoi : manualForm.aoiName;

      const matchedScene = satelliteSearchResult?.scenes?.find((s: any) => s.sceneId === selectedScene);
      const detTime = sourceType === 'LIVE SATELLITE'
        ? (matchedScene?.acquisitionTime || preset.defaultTime)
        : new Date(manualForm.detectionTime).toISOString();

      const minLat = sourceType === 'LIVE SATELLITE' ? preset.minLat : parseFloat(manualForm.minLat);
      const maxLat = sourceType === 'LIVE SATELLITE' ? preset.maxLat : parseFloat(manualForm.maxLat);
      const minLon = sourceType === 'LIVE SATELLITE' ? preset.minLon : parseFloat(manualForm.minLon);
      const maxLon = sourceType === 'LIVE SATELLITE' ? preset.maxLon : parseFloat(manualForm.maxLon);
      const centerLat = sourceType === 'LIVE SATELLITE' ? preset.centerLat : parseFloat(manualForm.centerLat);
      const centerLon = sourceType === 'LIVE SATELLITE' ? preset.centerLon : parseFloat(manualForm.centerLon);

      const isDemo = sourceType === 'LIVE SATELLITE' ? false : isDemoBenchmark;
      const created = await api.incidents.create({
        name: incidentName,
        aoiName: aoi,
        detectionTime: detTime,
        minLat,
        maxLat,
        minLon,
        maxLon,
        centerLat,
        centerLon,
        isDemo,
      });

      // Pass details via state to confirmation page
      navigate(`/investigation/${created.incidentCode}/created`, {
        state: {
          name: incidentName,
          aoiName: aoi,
          detectionTime: detTime,
          sourceType: sourceType,
          sceneId: selectedScene,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create investigation');
      setSubmitting(false);
    }
  }

  return (
    <PageShell>
      <div className="min-h-screen py-16 px-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <Link to="/hub" className="inline-flex items-center gap-2 text-xs font-mono text-[#9B9891] hover:text-[#E85D04] mb-4 transition-colors">
            ← BACK TO INVESTIGATION HUB
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-6 bg-[#E85D04]" />
            <span className="text-[10px] font-mono tracking-[0.35em] text-[#9B9891] uppercase">
              Investigation Setup
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[#F5F2EA] tracking-tight mb-3">
            CREATE NEW INVESTIGATION
          </h1>
          <p className="text-[#9B9891] text-sm font-mono max-w-xl">
            Select an investigation pathway to begin ingesting maritime observations, hydrodynamic modeling, and AIS correlation.
          </p>
        </div>

        {/* ────────────────────────────────────────────────
            TWO PRIMARY CHOICES
            ──────────────────────────────────────────────── */}
        {!selectedPath && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
            {/* OPTION A */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedPath('A')}
              className="border border-[#222] bg-[#0c0c0c] p-8 flex flex-col justify-between cursor-pointer group hover:border-[#E85D04] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 border border-[#333] flex items-center justify-center text-[#E85D04] group-hover:border-[#E85D04] transition-colors">
                    <SatelliteIcon size={20} />
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-[#9B9891] border border-[#222] px-2 py-0.5">
                    OPTION A
                  </span>
                </div>

                <h2 className="text-lg font-bold text-[#F5F2EA] tracking-wider mb-3 font-mono">
                  LIVE SATELLITE INVESTIGATION
                </h2>

                <p className="text-xs font-mono text-[#9B9891] leading-relaxed mb-6">
                  Search available real satellite observations for the selected area and time window, then create an investigation from an actual observation.
                </p>

                <div className="text-[11px] font-mono text-[#555] space-y-1 border-t border-[#1a1a1a] pt-4">
                  <div>• Copernicus Sentinel-1 SAR C-Band</div>
                  <div>• Dual-polarization GRD Product</div>
                  <div>• Automatic Slick Segmentation</div>
                </div>
              </div>

              <div className="pt-8 flex items-center gap-2 text-xs font-mono text-[#E85D04] group-hover:translate-x-1 transition-transform">
                <span>SELECT PATHWAY</span>
                <span>→</span>
              </div>
            </motion.div>

            {/* OPTION B */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedPath('B')}
              className="border border-[#222] bg-[#0c0c0c] p-8 flex flex-col justify-between cursor-pointer group hover:border-[#E85D04] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 border border-[#333] flex items-center justify-center text-[#E85D04] group-hover:border-[#E85D04] transition-colors">
                    <FileTextIcon size={20} />
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-[#9B9891] border border-[#222] px-2 py-0.5">
                    OPTION B
                  </span>
                </div>

                <h2 className="text-lg font-bold text-[#F5F2EA] tracking-wider mb-3 font-mono">
                  USER CREATED INVESTIGATION
                </h2>

                <p className="text-xs font-mono text-[#9B9891] leading-relaxed mb-6">
                  Create an investigation manually using an existing satellite observation, uploaded evidence, or available investigation inputs.
                </p>

                <div className="text-[11px] font-mono text-[#555] space-y-1 border-t border-[#1a1a1a] pt-4">
                  <div>• Manual AOI & Coordinate Center</div>
                  <div>• Flexible Reference Temporal Bounds</div>
                  <div>• Ingest Custom Evidence Sources</div>
                </div>
              </div>

              <div className="pt-8 flex items-center gap-2 text-xs font-mono text-[#E85D04] group-hover:translate-x-1 transition-transform">
                <span>SELECT PATHWAY</span>
                <span>→</span>
              </div>
            </motion.div>
          </div>
        )}

        {/* ────────────────────────────────────────────────
            PATH A: LIVE SATELLITE INVESTIGATION FLOW
            ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {selectedPath === 'A' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="border border-[#222] bg-[#0a0a0a] p-8 max-w-2xl"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#E85D04] font-bold">OPTION A</span>
                  <span className="text-sm font-mono text-[#F5F2EA] font-semibold">LIVE SATELLITE INVESTIGATION</span>
                </div>
                <button
                  onClick={() => setSelectedPath(null)}
                  className="text-xs font-mono text-[#555] hover:text-[#F5F2EA]"
                >
                  ← BACK TO OPTIONS
                </button>
              </div>

              {/* Provider Status Callout */}
              <div className="mb-6 p-3 border border-[#222] bg-[#111] flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#9B9891]">COPERNICUS DATA SPACE ECOSYSTEM</span>
                {satelliteSearchResult?.providerConfigured === false ? (
                  <span className="text-[9px] font-mono tracking-widest text-[#ef4444] border border-[#ef4444]/30 px-2 py-0.5 bg-[#ef4444]/10">
                    COPERNICUS PROVIDER NOT CONFIGURED
                  </span>
                ) : (
                  <span className="text-[9px] font-mono tracking-widest text-[#4ade80] border border-[#4ade80]/30 px-2 py-0.5 bg-[#4ade80]/10">
                    COPERNICUS SENTINEL-1 READY
                  </span>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#9B9891] block mb-2">
                    Area of Interest (AOI)
                  </label>
                  <select
                    value={satelliteAoi}
                    onChange={(e) => setSatelliteAoi(e.target.value)}
                    className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-3 text-xs font-mono focus:border-[#E85D04] outline-none"
                  >
                    <option value="Arabian Sea - Sector 4 (Saurashtra Basin)">Arabian Sea - Sector 4 (Saurashtra Basin, India)</option>
                    <option value="Persian Gulf - Strait of Hormuz">Persian Gulf - Strait of Hormuz Corridor</option>
                    <option value="Gulf of Aden - Bab-el-Mandeb">Gulf of Aden - Bab-el-Mandeb Strait</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#9B9891] block mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={satelliteStartDate}
                      onChange={(e) => setSatelliteStartDate(e.target.value)}
                      className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-3 text-xs font-mono focus:border-[#E85D04] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#9B9891] block mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={satelliteEndDate}
                      onChange={(e) => setSatelliteEndDate(e.target.value)}
                      className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-3 text-xs font-mono focus:border-[#E85D04] outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSearchSatellite}
                  disabled={searchingSatellite}
                  className="btn-ghost w-full justify-center text-xs py-3 font-mono"
                >
                  {searchingSatellite ? (
                    <span className="flex items-center gap-2">
                      <SearchIcon size={14} className="animate-spin text-[#E85D04]" />
                      SEARCHING SATELLITE PROVIDER...
                    </span>
                  ) : (
                    'SEARCH SATELLITE OBSERVATIONS'
                  )}
                </button>

                {/* Search Results Display */}
                {satelliteSearchResult && (
                  <div className="pt-4 border-t border-[#1a1a1a]">
                    <div className="text-[10px] font-mono tracking-widest text-[#9B9891] uppercase mb-3">
                      Available Satellite Scenes
                    </div>

                    {satelliteSearchResult.scenes.length > 0 ? (
                      <div className="space-y-3">
                        {satelliteSearchResult.scenes.map((sc: any) => (
                          <div
                            key={sc.sceneId}
                            onClick={() => setSelectedScene(sc.sceneId)}
                            className={`p-4 border cursor-pointer transition-colors ${
                              selectedScene === sc.sceneId
                                ? 'border-[#E85D04] bg-[#E85D04]/5'
                                : 'border-[#222] bg-[#111] hover:border-[#333]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-xs text-[#F5F2EA] font-semibold">{sc.sceneId}</span>
                              <span className="text-[9px] font-mono text-[#E85D04] border border-[#E85D04]/30 px-1.5 py-0.5">
                                {sc.status}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-[#66635D] grid grid-cols-2 gap-2">
                              <div>Satellite: {sc.satellite} ({sc.sensor})</div>
                              <div>Resolution: {sc.resolution} ({sc.polarization})</div>
                              <div>Acquisition: {new Date(sc.acquisitionTime).toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 border border-[#222] text-center">
                        <div className="text-xs font-mono text-[#E85D04] uppercase tracking-widest mb-1">
                          NO SATELLITE OBSERVATION AVAILABLE
                        </div>
                        <p className="text-[11px] font-mono text-[#66635D]">
                          No verified scene matches the selected AOI and time window.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="p-3 border border-red-900/50 bg-red-900/10 text-red-400 text-xs font-mono">
                    {error}
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="button"
                    disabled={submitting || (satelliteSearchResult && satelliteSearchResult.scenes.length === 0)}
                    onClick={() => handleCreateInvestigation('LIVE SATELLITE')}
                    className="btn-primary w-full justify-center text-sm py-3.5 font-mono uppercase"
                  >
                    {submitting ? 'CREATING INVESTIGATION...' : 'PROCEED TO CONFIRMATION →'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ────────────────────────────────────────────────
            PATH B: USER CREATED INVESTIGATION
            ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {selectedPath === 'B' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="border border-[#222] bg-[#0a0a0a] p-8 max-w-2xl"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#E85D04] font-bold">OPTION B</span>
                  <span className="text-sm font-mono text-[#F5F2EA] font-semibold">USER CREATED INVESTIGATION</span>
                </div>
                <button
                  onClick={() => setSelectedPath(null)}
                  className="text-xs font-mono text-[#555] hover:text-[#F5F2EA]"
                >
                  ← BACK TO OPTIONS
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateInvestigation('USER CREATED');
                }}
                className="space-y-5"
              >
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#9B9891] block mb-2">
                    Investigation Name
                  </label>
                  <input
                    type="text"
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    required
                    className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-3 text-xs font-mono focus:border-[#E85D04] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#9B9891] block mb-2">
                    Area of Interest (AOI)
                  </label>
                  <input
                    type="text"
                    value={manualForm.aoiName}
                    onChange={(e) => setManualForm({ ...manualForm, aoiName: e.target.value })}
                    required
                    className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-3 text-xs font-mono focus:border-[#E85D04] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#9B9891] block mb-2">
                    Observation Date & Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    value={manualForm.detectionTime}
                    onChange={(e) => setManualForm({ ...manualForm, detectionTime: e.target.value })}
                    required
                    className="w-full bg-[#111] border border-[#222] text-[#F5F2EA] px-4 py-3 text-xs font-mono focus:border-[#E85D04] outline-none"
                  />
                  {manualForm.detectionTime && new Date(manualForm.detectionTime) < new Date('2014-04-03T00:00:00Z') && (
                    <div className="text-[10px] font-mono text-[#eab308] border border-[#eab308]/30 bg-[#eab308]/5 p-2.5 mt-2 space-y-1">
                      <div className="font-bold">HISTORICAL INCIDENT COMPATIBILITY NOTE</div>
                      <div className="text-[#9B9891] leading-relaxed">
                        This incident date ({manualForm.detectionTime.slice(0, 10)}) predates the launch of Sentinel-1 (April 3, 2014). Satellite SAR radar imagery will not be available. Historical atmospheric ERA5 reanalysis and AIS kinematics remain active.
                      </div>
                    </div>
                  )}
                </div>

                {/* AOI Bounding Box Coordinates */}
                <div className="space-y-3 p-4 border border-[#222] bg-[#111]">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#9B9891]">AOI Bounding Box Coordinates</div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDemoBenchmark(true);
                        setManualForm({
                          ...manualForm,
                          name: 'Arabian Sea Demo Benchmark',
                          aoiName: 'Arabian Sea Sector 4 (Demo)',
                          detectionTime: '2026-09-03T14:20',
                          minLat: '21.65', maxLat: '22.05',
                          minLon: '68.75', maxLon: '69.25',
                          centerLat: '21.8033', centerLon: '68.9083',
                        });
                      }}
                      className="text-[9px] font-mono text-[#c084fc] border border-[#c084fc]/40 px-2 py-0.5 hover:bg-[#c084fc]/10 transition-colors"
                    >
                      LOAD DEMO BENCHMARK
                    </button>
                  </div>
                  {isDemoBenchmark && (
                    <div className="text-[9px] font-mono text-[#c084fc] border border-[#c084fc]/30 bg-[#c084fc]/5 px-2 py-1">
                      ⬡ DEMO BENCHMARK MODE — Pre-seeded Arabian Sea reference coordinates. Investigation will be tagged DEMO.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-mono text-[#555] uppercase block mb-1">Min Lat (°N)</label>
                      <input type="number" step="0.0001" value={manualForm.minLat}
                        onChange={(e) => { setIsDemoBenchmark(false); setManualForm({ ...manualForm, minLat: e.target.value }); }}
                        required className="w-full bg-[#0a0a0a] border border-[#222] text-[#F5F2EA] px-3 py-2 text-xs font-mono focus:border-[#E85D04] outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-[#555] uppercase block mb-1">Max Lat (°N)</label>
                      <input type="number" step="0.0001" value={manualForm.maxLat}
                        onChange={(e) => { setIsDemoBenchmark(false); setManualForm({ ...manualForm, maxLat: e.target.value }); }}
                        required className="w-full bg-[#0a0a0a] border border-[#222] text-[#F5F2EA] px-3 py-2 text-xs font-mono focus:border-[#E85D04] outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-[#555] uppercase block mb-1">Min Lon (°E)</label>
                      <input type="number" step="0.0001" value={manualForm.minLon}
                        onChange={(e) => { setIsDemoBenchmark(false); setManualForm({ ...manualForm, minLon: e.target.value }); }}
                        required className="w-full bg-[#0a0a0a] border border-[#222] text-[#F5F2EA] px-3 py-2 text-xs font-mono focus:border-[#E85D04] outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-[#555] uppercase block mb-1">Max Lon (°E)</label>
                      <input type="number" step="0.0001" value={manualForm.maxLon}
                        onChange={(e) => { setIsDemoBenchmark(false); setManualForm({ ...manualForm, maxLon: e.target.value }); }}
                        required className="w-full bg-[#0a0a0a] border border-[#222] text-[#F5F2EA] px-3 py-2 text-xs font-mono focus:border-[#E85D04] outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-[#555] uppercase block mb-1">Center Lat (°N)</label>
                      <input type="number" step="0.0001" value={manualForm.centerLat}
                        onChange={(e) => { setIsDemoBenchmark(false); setManualForm({ ...manualForm, centerLat: e.target.value }); }}
                        required className="w-full bg-[#0a0a0a] border border-[#222] text-[#F5F2EA] px-3 py-2 text-xs font-mono focus:border-[#E85D04] outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-[#555] uppercase block mb-1">Center Lon (°E)</label>
                      <input type="number" step="0.0001" value={manualForm.centerLon}
                        onChange={(e) => { setIsDemoBenchmark(false); setManualForm({ ...manualForm, centerLon: e.target.value }); }}
                        required className="w-full bg-[#0a0a0a] border border-[#222] text-[#F5F2EA] px-3 py-2 text-xs font-mono focus:border-[#E85D04] outline-none" />
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-[#555] leading-snug pt-1">
                    Coordinates are required for real investigations. Satellite search, hydrodynamic drift, and AIS geofence are scoped to this bounding box.
                  </div>
                </div>

                {error && (
                  <div className="p-3 border border-red-900/50 bg-red-900/10 text-red-400 text-xs font-mono">
                    {error}
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full justify-center text-sm py-3.5 font-mono uppercase"
                  >
                    {submitting ? 'CREATING INVESTIGATION...' : 'PROCEED TO CONFIRMATION →'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  );
}
