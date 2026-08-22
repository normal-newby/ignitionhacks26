import { cn } from '@/lib/utils';

const CATEGORY_COLORS = {
  Seating: '#B98A5E',
  Tables: '#7C8B6F',
  Lighting: '#D4A76A',
  Storage: '#9B4F3A',
  Plants: '#5E8C61',
  Decor: '#A06A92',
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

  const color = CATEGORY_COLORS[category] || '#B98A5E';
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
