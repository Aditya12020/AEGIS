import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpandableSectionProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export default function ExpandableSection({ label, children, className = '' }: ExpandableSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border-t border-[#1f1f1f] ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-left group"
      >
        <span className="text-[11px] font-mono tracking-[0.2em] text-[#9B9891] uppercase group-hover:text-[#F5F2EA] transition-colors">
          {label}
        </span>
        <ChevronDownIcon
          size={14}
          className={`text-[#555] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
