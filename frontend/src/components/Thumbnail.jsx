import { cn } from '@/lib/utils';

const CATEGORY_COLORS = {
  Seating: 'hsl(29 39% 55%)',
  Tables: 'hsl(92 11% 49%)',
  Lighting: 'hsl(43 60% 58%)',
  Storage: 'hsl(30 7% 30%)',
  Plants: 'hsl(92 20% 40%)',
  Decor: 'hsl(13 46% 42%)',
};

/**
 * Thumbnail — shows an image if url is present, otherwise a styled
 * placeholder block (materials-board feel) with the item initial.
 */
export default function Thumbnail({ url, label, category, className, rounded = 'rounded-md' }) {
  if (url) {
    return (
      <img
        src={url}
        alt={label}
        className={cn('object-cover w-full h-full', rounded, className)}
      />
    );
  }

  const color = CATEGORY_COLORS[category] || 'hsl(29 39% 55%)';
  const initial = (label || '?').charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        'flex items-center justify-center w-full h-full',
        rounded,
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${color}22, ${color}08)`,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="font-heading text-2xl font-semibold select-none"
        style={{ color }}
      >
        {initial}
      </span>
    </div>
  );
}
