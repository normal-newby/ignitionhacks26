import { cn } from '@/lib/utils';

const CATEGORY_COLORS = {
  Seating: '#3b82f6',
  Tables: '#5a6c80',
  Lighting: '#64748b',
  Storage: '#1e40af',
  Plants: '#10b981',
  Decor: '#8b5cf6',
};

/**
 * Thumbnail — shows an image if url is present, otherwise a styled
 * placeholder block (materials-board feel) with the item initial.
 */
export default function Thumbnail({ url, label, category, className, rounded = 'rounded-none' }) {
  if (url) {
    return (
      <img
        src={url}
        alt={label}
        className={cn('object-cover w-full h-full', rounded, className)}
      />
    );
  }

  const color = CATEGORY_COLORS[category] || '#3b82f6';
  const initial = (label || '?').charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        'flex items-center justify-center w-full h-full border-2 border-black',
        rounded,
        className
      )}
      style={{
        backgroundColor: color,
      }}
    >
      <span
        className="font-mono text-lg font-bold select-none text-black"
      >
        {initial}
      </span>
    </div>
  );
}
