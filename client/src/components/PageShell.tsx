import { motion } from 'framer-motion';
import TopNav from './TopNav';
import InvestigationProgress from './InvestigationProgress';
import { useLocation } from 'react-router-dom';

interface PageShellProps {
  code?: string;
  showProgress?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function PageShell({ code, showProgress = false, children, className = '' }: PageShellProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F2EA] relative selection:bg-[#E85D04] selection:text-black">
      {/* Top Laser Travel Line on Page Switch */}
      <motion.div
        key={location.pathname}
        initial={{ scaleX: 0, originX: 0, opacity: 1 }}
        animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 h-[2px] bg-[#E85D04] z-[100] pointer-events-none"
      />

      <TopNav code={code} />

      {/* Sticky Physical Investigation Progress Track */}
      {showProgress && code && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-[#050505]/95 backdrop-blur-md border-b border-[#141414] px-6 py-2">
          <div className="max-w-7xl mx-auto">
            <InvestigationProgress code={code} />
          </div>
        </div>
      )}

      {/* Main Content with Directional Evidence Reveal */}
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className={`${showProgress ? 'pt-[98px]' : 'pt-14'} ${className}`}
      >
        {children}
      </motion.main>
    </div>
  );
}
