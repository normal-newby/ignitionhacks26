import { cn } from '@/lib/utils';

const STYLES = {
  processing: 'bg-[#e2e8f0] text-[#3b82f6] border-2 border-[#3b82f6]',
  ready: 'bg-[#e2e8f0] text-[#10b981] border-2 border-[#10b981]',
  failed: 'bg-[#e2e8f0] text-[#ef4444] border-2 border-[#ef4444]',
};

const LABELS = {
  processing: 'PROCESSING',
  ready: 'READY',
  failed: 'FAILED',
};

export default function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-mono font-bold',
        STYLES[status] || STYLES.processing,
        className
      )}
    >
      <span
        className={cn(
          'w-2 h-2',
          status === 'ready' && 'bg-[#10b981]',
          status === 'processing' && 'bg-[#3b82f6] animate-pulse',
          status === 'failed' && 'bg-[#ef4444]'
        )}
      />
      {LABELS[status] || status}
    </span>
  );
}
