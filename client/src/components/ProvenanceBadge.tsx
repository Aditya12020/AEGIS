interface ProvenanceBadgeProps {
  label: string;
  source?: string;
  className?: string;
}

export default function ProvenanceBadge({ label, source, className = '' }: ProvenanceBadgeProps) {
  const l = label.toLowerCase();
  
  let cls = 'tag-derived';
  if (l.includes('demo') || l.includes('benchmark')) {
    cls = 'tag-demo';
  } else if (l.includes('provider not configured') || l.includes('not configured')) {
    cls = 'tag-provider-error';
  } else if (l.includes('unavailable') || l.includes('failed') || l.includes('blocked') || l.includes('unverified')) {
    cls = 'tag-unavailable';
  } else if (l.includes('historical')) {
    cls = 'tag-historical';
  } else if (l.includes('observed') || l.includes('live') || l.includes('real')) {
    cls = 'tag-observed';
  } else if (l.includes('model') || l.includes('segmentation')) {
    cls = 'tag-model';
  } else if (l.includes('derived') || l.includes('computed') || l.includes('projected') || l.includes('interpolated')) {
    cls = 'tag-derived';
  }

  return (
    <span className={`${cls} ${className}`} title={source || label}>
      {label}
    </span>
  );
}
