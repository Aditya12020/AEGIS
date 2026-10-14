import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  SatelliteIcon,
  PlusCircleIcon,
  LogOutIcon,
  ShieldCheckIcon,
  ChevronRightIcon
} from 'lucide-react';

export default function InvestigationHubPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.incidents.list()
      .then((data) => {
        setIncidents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setIncidents([]);
        setLoading(false);
      });
  }, []);

  function handleOpenInvestigation(code: string) {
    navigate(`/investigation/${code}/command`);
  }

  function handleSignOut() {
    logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F2EA] font-sans selection:bg-[#E85D04] selection:text-black">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/90 backdrop-blur-md border-b border-[#141414] px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-5 h-5 bg-[#E85D04] flex items-center justify-center">
            <span className="text-black text-[9px] font-black tracking-widest">A</span>
          </div>
          <span className="font-bold text-[#F5F2EA] tracking-[0.2em] text-xs">AEGIS</span>
        </Link>

        {/* User Identity & Logout */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="text-right hidden sm:block">
              <div className="text-[#F5F2EA] font-semibold">{user?.name}</div>
              <div className="text-[10px] text-[#66635D]">{user?.badgeNumber || user?.email}</div>
            </div>
            <span className={`text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 border ${
              user?.role === 'OFFICER'
                ? 'text-[#E85D04] border-[#E85D04]/40 bg-[#E85D04]/5'
                : 'text-[#9B9891] border-[#333] bg-[#111]'
            }`}>
              {user?.role}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-mono text-[#555] hover:text-[#E85D04] transition-colors border-l border-[#222] pl-4 cursor-pointer"
            title="Sign out of AEGIS"
          >
            <LogOutIcon size={14} />
            <span className="hidden sm:inline">SIGN OUT</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-28 pb-32 space-y-16">
        {/* Hub Title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-[#141414] pb-8"
        >
          <div className="flex items-center gap-2 mb-2 text-[10px] font-mono tracking-[0.35em] text-[#E85D04] uppercase">
            <ShieldCheckIcon size={13} />
            <span>AUTHENTICATED INVESTIGATION WORKSTATION</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#F5F2EA] font-mono">
            INVESTIGATION HUB
          </h1>
          <p className="text-sm font-mono text-[#9B9891] mt-2 max-w-xl">
            Start a new live or manual investigation, or open authorized operational investigation dossiers.
          </p>
        </motion.div>

        {/* 1. START A NEW INVESTIGATION (Two Primary Actions) */}
        <section className="space-y-6">
          <div className="text-xs font-mono tracking-widest text-[#9B9891] uppercase">
            START A NEW INVESTIGATION
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* OPTION A: LIVE DATA INVESTIGATION */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="border border-[#222] bg-[#0c0c0c] p-8 flex flex-col justify-between group hover:border-[#E85D04] transition-all relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 border border-[#333] flex items-center justify-center text-[#E85D04] bg-[#050505] group-hover:border-[#E85D04] transition-colors">
                    <SatelliteIcon size={24} />
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-[#E85D04] border border-[#E85D04]/30 px-2 py-0.5 uppercase bg-[#E85D04]/5">
                    LIVE DATA
                  </span>
                </div>

                <h2 className="text-xl font-bold text-[#F5F2EA] tracking-wider mb-3 font-mono">
                  LIVE DATA INVESTIGATION
                </h2>

                <p className="text-xs font-mono text-[#9B9891] leading-relaxed mb-6">
                  Use available real satellite observations across maritime sectors. Connects directly to verified Copernicus Sentinel-1 C-Band SAR scenes and geofenced AIS telemetry.
                </p>

                <div className="text-[11px] font-mono text-[#555] space-y-1.5 border-t border-[#1a1a1a] pt-4">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#4ade80] rounded-full" />
                    <span>Real-time SAR anomaly detection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#4ade80] rounded-full" />
                    <span>Dual-polarization slick delineation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#4ade80] rounded-full" />
                    <span>Copernicus / Access AIS integration</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => navigate('/new-investigation?mode=live')}
                  className="btn-primary w-full justify-center text-xs py-3.5 tracking-widest uppercase cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>START LIVE INVESTIGATION</span>
                    <ChevronRightIcon size={14} />
                  </span>
                </button>
              </div>
            </motion.div>

            {/* OPTION B: CREATE NEW INVESTIGATION */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="border border-[#222] bg-[#0c0c0c] p-8 flex flex-col justify-between group hover:border-[#E85D04] transition-all relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 border border-[#333] flex items-center justify-center text-[#E85D04] bg-[#050505] group-hover:border-[#E85D04] transition-colors">
                    <PlusCircleIcon size={24} />
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-[#9B9891] border border-[#222] px-2 py-0.5 uppercase bg-[#111]">
                    MANUAL / CUSTOM
                  </span>
                </div>

                <h2 className="text-xl font-bold text-[#F5F2EA] tracking-wider mb-3 font-mono">
                  CREATE NEW INVESTIGATION
                </h2>

                <p className="text-xs font-mono text-[#9B9891] leading-relaxed mb-6">
                  Manually create an incident and begin an investigation. Define target coordinates, reference temporal bounds, and custom hydrodynamic leeway parameters.
                </p>

                <div className="text-[11px] font-mono text-[#555] space-y-1.5 border-t border-[#1a1a1a] pt-4">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#E85D04] rounded-full" />
                    <span>Custom geographic AOI definition</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#E85D04] rounded-full" />
                    <span>Historical temporal backtrack window</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#E85D04] rounded-full" />
                    <span>Attribution candidate corridor scoring</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => navigate('/new-investigation?mode=manual')}
                  className="btn-ghost w-full justify-center text-xs py-3.5 tracking-widest uppercase cursor-pointer hover:border-[#E85D04]"
                >
                  <span className="flex items-center gap-2">
                    <span>CREATE INVESTIGATION</span>
                    <ChevronRightIcon size={14} />
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 2. INVESTIGATION HISTORY */}
        <section className="space-y-6 pt-6 border-t border-[#141414]">
          <div className="flex items-center justify-between font-mono">
            <div className="space-y-1">
              <div className="text-xs font-mono tracking-widest text-[#9B9891] uppercase">
                INVESTIGATION HISTORY
              </div>
              <div className="text-[11px] text-[#555]">
                Authorized operational investigation records available to your credential level ({user?.role})
              </div>
            </div>
            <span className="text-xs font-mono text-[#E85D04]">
              {incidents.length} {incidents.length === 1 ? 'RECORD' : 'RECORDS'}
            </span>
          </div>

          {loading ? (
            <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-12 text-center font-mono text-xs text-[#555] animate-pulse">
              LOADING AUTHORIZED INVESTIGATION ARCHIVE...
            </div>
          ) : incidents.length > 0 ? (
            <div className="border border-[#1a1a1a] bg-[#090909] divide-y divide-[#141414] overflow-hidden">
              {incidents.map((inc) => (
                <div
                  key={inc.id || inc.incidentCode}
                  onClick={() => handleOpenInvestigation(inc.incidentCode)}
                  className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 group cursor-pointer hover:bg-[#111] transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-sm font-bold text-[#E85D04] group-hover:underline">
                        [{inc.incidentCode}]
                      </span>
                      <span className="text-[10px] px-2 py-0.5 border border-[#333] text-[#9B9891] uppercase bg-[#050505]">
                        {inc.status || 'ACTIVE'}
                      </span>
                    </div>
                    <div className="text-base font-semibold text-[#F5F2EA]">
                      {inc.name}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-xs font-mono text-[#66635D]">
                    <div>
                      <div className="text-[#444] text-[9px] uppercase tracking-widest">AREA</div>
                      <div className="text-[#9B9891]">{inc.aoiName || 'Maritime Sector'}</div>
                    </div>
                    <div>
                      <div className="text-[#444] text-[9px] uppercase tracking-widest">DETECTION DATE</div>
                      <div className="text-[#9B9891]">
                        {inc.detectionTime ? new Date(inc.detectionTime).toISOString().slice(0, 10) : '2026-09-03'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#444] text-[9px] uppercase tracking-widest">EVIDENCE</div>
                      <div className="text-[#E85D04]">SAR + AIS + DRIFT</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#E85D04] group-hover:translate-x-1 transition-transform">
                      <span>OPEN</span>
                      <ChevronRightIcon size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-[#1a1a1a] bg-[#0c0c0c] p-12 text-center max-w-xl mx-auto space-y-4 font-mono">
              <div className="text-sm text-[#E85D04] uppercase tracking-widest">
                NO AUTHORIZED INVESTIGATIONS FOUND
              </div>
              <p className="text-[#66635D] text-xs leading-relaxed">
                No active or archived investigations match your account authorization. Start a new investigation above to begin building your dossier.
              </p>
              <button
                onClick={() => navigate('/new-investigation?mode=manual')}
                className="btn-primary text-xs py-2.5 px-6"
              >
                CREATE FIRST INVESTIGATION →
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
