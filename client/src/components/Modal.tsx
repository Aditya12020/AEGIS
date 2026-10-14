import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badge?: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, badge, children }: ModalProps) {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
          />

          {/* Modal box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative z-10 w-full max-w-4xl bg-[#0c0c0c] border border-[#222] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-[#080808]">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-4 bg-[#E85D04]" />
                {badge && (
                  <span className="text-[9px] font-mono tracking-widest text-[#E85D04] uppercase border border-[#E85D04]/30 px-1.5 py-0.5">
                    {badge}
                  </span>
                )}
                <h3 className="text-sm font-bold font-mono text-[#F5F2EA]">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center border border-[#222] text-[#9B9891] hover:text-[#F5F2EA] hover:border-[#E85D04] transition-colors"
              >
                <XIcon size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-[#9B9891]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
