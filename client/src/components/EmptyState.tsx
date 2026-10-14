interface EmptyStateProps {
  title: string;
  message: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="unavailable-state">
      <div className="w-12 h-12 border border-[#333] flex items-center justify-center mb-6">
        <div className="w-3 h-3 border border-[#555]" />
      </div>
      <div className="text-[11px] font-mono tracking-[0.25em] text-[#E85D04] uppercase mb-3">{title}</div>
      <p className="text-[#66635D] text-sm max-w-sm leading-relaxed mb-6">{message}</p>
      {action}
    </div>
  );
}
