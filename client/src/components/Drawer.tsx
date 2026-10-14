import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}

export default function Drawer({ isOpen, onClose, title, subtitle, badge, children }: DrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm cursor-pointer"
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#0c0c0c] border-l border-[#222] shadow-2xl flex flex-col"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#1a1a1a] flex items-start justify-between bg-[#080808]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-3 bg-[#E85D04]" />
                  {badge && (
                    <span className="text-[9px] font-mono tracking-widest text-[#E85D04] uppercase border border-[#E85D04]/30 px-1.5 py-0.5">
                      {badge}
                    </span>
                  )}
                  <span className="text-[10px] font-mono tracking-[0.25em] text-[#9B9891] uppercase">
                    Investigation Detail
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#F5F2EA] font-mono">{title}</h3>
                {subtitle && <p className="text-xs text-[#66635D] font-mono mt-0.5">{subtitle}</p>}
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center border border-[#222] text-[#9B9891] hover:text-[#F5F2EA] hover:border-[#E85D04] transition-colors"
                title="Close drawer (Esc)"
              >
                <XIcon size={14} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-[#9B9891] space-y-4">
              {children}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#1a1a1a] bg-[#080808] flex justify-between items-center text-[10px] font-mono text-[#555]">
              <span>AEGIS · DETAIL OVERLAY</span>
              <button
                onClick={onClose}
                className="text-[#9B9891] hover:text-[#E85D04] transition-colors"
              >
                CLOSE [ESC]
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
