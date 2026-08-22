import { Trash2, Check } from 'lucide-react';

function NumberField({ label, value, onChange, step = 1, min, max }) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-wider text-black/80 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1 border-2 border-black bg-[#EDE7DD] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#9B4F3A]"
      />
    </div>
  );
}

/**
 * Right rail — inspector for the selected placed item.
 * Collapses to nothing when no item is selected.
 */
export default function Inspector({ placedItem, onUpdate, onRemove, onDone }) {
  if (!placedItem) return null;

  return (
    <div className="w-72 flex-shrink-0 border-l-2 border-black bg-[#F5E6C8] flex flex-col h-full animate-fade-in shadow-[-4px_4px_0px_#000]">
      {/* Header */}
      <div className="p-4 border-b border-border/40 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
            {placedItem.category}
          </p>
          <h2 className="font-heading text-lg font-medium truncate">
            {placedItem.name}
          </h2>
        </div>
        {/* Mirrors the viewport's Done button — this rail is where the eye is after typing
            an exact position, so the way out needs to be here too. */}
        <button
          onClick={onDone}
          title="Done (Esc)"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground font-body text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Check className="w-3.5 h-3.5" />
          Done
        </button>
      </div>

      {/* Editable fields */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-[#F5E6C8]">
        {/* Position */}
        <div>
          <h3 className="font-mono text-xs font-bold mb-2 text-black border-b border-black/50 pb-1">
            POSITION
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            <NumberField
              label="X"
              value={placedItem.position.x}
              onChange={(v) =>
                onUpdate(placedItem.id, { position: { ...placedItem.position, x: v } })
              }
            />
            <NumberField
              label="Y"
              value={placedItem.position.y}
              onChange={(v) =>
                onUpdate(placedItem.id, { position: { ...placedItem.position, y: v } })
              }
            />
            <NumberField
              label="Z"
              value={placedItem.position.z}
              onChange={(v) =>
                onUpdate(placedItem.id, { position: { ...placedItem.position, z: v } })
              }
            />
          </div>
        </div>

        {/* Rotation */}
        <div>
          <h3 className="font-mono text-xs font-bold mb-2 text-black border-b border-black/50 pb-1">
            ROTATION
          </h3>
          <NumberField
            label="DEGREES"
            value={placedItem.rotation}
            min={0}
            max={360}
            onChange={(v) => onUpdate(placedItem.id, { rotation: v })}
          />
        </div>

        {/* Scale */}
        <div>
          <h3 className="font-mono text-xs font-bold mb-2 text-black border-b border-black/50 pb-1">
            SCALE
          </h3>
          <NumberField
            label="MULTIPLIER"
            value={placedItem.scale}
            step={0.1}
            min={0.1}
            onChange={(v) => onUpdate(placedItem.id, { scale: v })}
          />
        </div>
      </div>

      {/* Remove button */}
      <div className="p-3 border-t-2 border-black bg-[#D4A76A]">
        <button
          onClick={() => onRemove(placedItem.id)}
          className="w-full inline-flex items-center justify-center gap-2 px-2 py-2 border-2 border-[#9B4F3A] bg-[#EDE7DD] text-[#9B4F3A] font-mono text-sm font-bold hover:bg-[#9B4F3A] hover:text-[#F5E6C8] transition-colors active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <Trash2 className="w-4 h-4" />
          REMOVE FROM ROOM
        </button>
      </div>
    </div>
  );
}
