import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageShell from '../components/PageShell';

export default function CreatedInvestigationPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const name = state.name || 'Maritime Oil Spill Investigation';
  const aoi = state.aoiName || 'Arabian Sea Sector 4';
  const time = state.detectionTime || '2026-09-03T14:20:18.000Z';
  const source = state.sourceType || 'USER CREATED';

  return (
    <PageShell>
      <div className="min-h-screen flex items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-[#222] bg-[#0c0c0c] p-10 max-w-xl w-full"
        >
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-6 bg-[#E85D04]" />
              <span className="text-[10px] font-mono tracking-[0.35em] text-[#9B9891] uppercase">
                Investigation Confirmation
              </span>
            </div>
            <h1 className="text-2xl font-bold font-mono text-[#F5F2EA] tracking-tight">
              INVESTIGATION CREATED
            </h1>
          </div>

          <div className="space-y-6 border-t border-b border-[#1a1a1a] py-6 font-mono">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#555] mb-1">
                INVESTIGATION CODE
              </div>
              <div className="text-sm font-bold text-[#E85D04]">
                {code}
              </div>
            </div>

            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#555] mb-1">
                INVESTIGATION NAME
              </div>
              <div className="text-sm text-[#F5F2EA]">
                {name}
              </div>
            </div>

            <div>
              <div className="text-[9px] uppercase tracking-widest text-[#555] mb-1">
                AREA
              </div>
              <div className="text-xs text-[#9B9891]">
                {aoi}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[9px] uppercase tracking-widest text-[#555] mb-1">
                  TIME
                </div>
                <div className="text-xs text-[#9B9891]">
                  {new Date(time).toISOString().slice(0, 16).replace('T', ' ')} UTC
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-widest text-[#555] mb-1">
                  SOURCE
                </div>
                <div className="text-xs text-[#E85D04]">
                  {source}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8">
            <button
              onClick={() => navigate(`/investigation/${code}/run`)}
              className="btn-primary w-full justify-center py-4 text-sm font-mono tracking-widest uppercase"
            >
              RUN INVESTIGATION →
            </button>
          </div>
        </motion.div>
      </div>
    </PageShell>
  );
}
