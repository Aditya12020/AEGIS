import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

const STEPS = [
  { num: '01', label: 'Command', path: '/command', fullTitle: 'Command Center' },
  { num: '02', label: 'Satellite', path: '/satellite', fullTitle: 'Satellite SAR' },
  { num: '03', label: 'Time', path: '/time-machine', fullTitle: 'Spill Time Machine' },
  { num: '04', label: 'Origin', path: '/origin-drift', fullTitle: 'Origin & Drift' },
  { num: '05', label: 'AIS', path: '/ais-hunt', fullTitle: 'AIS Vessel Hunt' },
  { num: '06', label: 'Forensics', path: '/forensics', fullTitle: 'Forensic Candidates' },
  { num: '07', label: 'Report', path: '/report', fullTitle: 'Investigation Dossier' },
];

export default function InvestigationProgress({ code }: { code: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentIdx = STEPS.findIndex((s) => location.pathname.endsWith(s.path));

  const prevStep = currentIdx > 0 ? STEPS[currentIdx - 1] : null;
  const nextStep = currentIdx >= 0 && currentIdx < STEPS.length - 1 ? STEPS[currentIdx + 1] : null;

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Previous Step Quick Action */}
      <div className="flex-shrink-0">
        {prevStep ? (
          <button
            onClick={() => navigate(`/investigation/${code}${prevStep.path}`)}
            className="flex items-center gap-1.5 px-2.5 py-1 border border-[#222] bg-[#0a0a0a] text-[10px] font-mono tracking-widest text-[#9B9891] hover:text-[#F5F2EA] hover:border-[#444] transition-colors"
            title={`Step back to ${prevStep.fullTitle}`}
          >
            <ChevronLeftIcon size={12} className="text-[#E85D04]" />
            <span className="hidden sm:inline">PREV: {prevStep.label.toUpperCase()}</span>
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* ── PHYSICAL PROGRESS BAR WITH CONNECTING TRACK ── */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1 justify-center flex-1">
        {STEPS.map((step, idx) => {
          const href = `/investigation/${code}${step.path}`;
          const isActive = idx === currentIdx;
          const isDone = idx < currentIdx;

          return (
            <div key={step.path} className="flex items-center flex-shrink-0">
              <Link
                to={href}
                className="relative flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors group"
              >
                {/* Traveling Physical Active Pill */}
                {isActive && (
                  <motion.div
                    layoutId="activeInvestigationPill"
                    transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                    className="absolute inset-0 bg-[#E85D04]/10 border border-[#E85D04]"
                  />
                )}

                {/* Node marker */}
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold z-10 transition-colors ${
                    isActive
                      ? 'bg-[#E85D04] text-black'
                      : isDone
                      ? 'bg-[#222] text-[#4ade80]'
                      : 'bg-[#141414] text-[#555] group-hover:text-[#9B9891]'
                  }`}
                >
                  {isDone ? <CheckIcon size={9} className="stroke-[3]" /> : step.num}
                </div>

                <span
                  className={`z-10 uppercase transition-colors hidden md:inline ${
                    isActive
                      ? 'text-[#F5F2EA] font-semibold'
                      : isDone
                      ? 'text-[#9B9891]'
                      : 'text-[#444] group-hover:text-[#777]'
                  }`}
                >
                  {step.label}
                </span>
              </Link>

              {/* Connecting physical line */}
              {idx < STEPS.length - 1 && (
                <div className="relative w-4 sm:w-6 h-0.5 bg-[#1a1a1a] flex-shrink-0">
                  <motion.div
                    className="absolute left-0 top-0 bottom-0 bg-[#E85D04]"
                    initial={false}
                    animate={{ width: idx < currentIdx ? '100%' : '0%' }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Next Step Quick Action */}
      <div className="flex-shrink-0 text-right">
        {nextStep ? (
          <button
            onClick={() => navigate(`/investigation/${code}${nextStep.path}`)}
            className="flex items-center gap-1.5 px-3 py-1 border border-[#E85D04]/40 bg-[#E85D04]/10 text-[10px] font-mono tracking-widest text-[#E85D04] hover:bg-[#E85D04] hover:text-black transition-all"
            title={`Proceed to ${nextStep.fullTitle}`}
          >
            <span className="hidden sm:inline">NEXT: {nextStep.label.toUpperCase()}</span>
            <ChevronRightIcon size={12} />
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>
    </div>
  );
}
