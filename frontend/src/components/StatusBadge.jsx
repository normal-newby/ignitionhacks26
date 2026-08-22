import { cn } from '@/lib/utils';

const STYLES = {
  processing: 'bg-[#F5E6C8] text-[#B98A5E] border-2 border-[#B98A5E]',
  ready: 'bg-[#F5E6C8] text-[#7C8B6F] border-2 border-[#7C8B6F]',
  failed: 'bg-[#F5E6C8] text-[#9B4F3A] border-2 border-[#9B4F3A]',
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
          status === 'ready' && 'bg-[#7C8B6F]',
          status === 'processing' && 'bg-[#B98A5E] animate-pulse',
          status === 'failed' && 'bg-[#9B4F3A]'
        )}
      />
      {LABELS[status] || status}
    </span>
  );
}
