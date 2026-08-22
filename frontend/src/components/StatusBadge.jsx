import { cn } from '@/lib/utils';

const STYLES = {
  processing: 'bg-primary/15 text-primary border-primary/30',
  ready: 'bg-secondary/15 text-secondary border-secondary/40',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
};

const LABELS = {
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
};

export default function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium font-body',
        STYLES[status] || STYLES.processing,
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'ready' && 'bg-secondary',
          status === 'processing' && 'bg-primary animate-pulse',
          status === 'failed' && 'bg-destructive'
        )}
      />
      {LABELS[status] || status}
    </span>
  );
}
