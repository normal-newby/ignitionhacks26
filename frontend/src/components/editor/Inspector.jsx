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
        className="w-full px-2 py-1 border-2 border-[#1e40af] bg-[#e2e8f0] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
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
    <div className="w-72 flex-shrink-0 border-l-2 border-[#1e40af] bg-[#e2e8f0] flex flex-col h-full animate-fade-in shadow-[-4px_4px_0px_#1e40af]">
      {/* Header */}
      <div className="p-4 border-b-2 border-[#1e40af] flex items-start gap-2 bg-[#e2e8f0]">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#5a6c80] mb-1" style={{ fontFamily: '"Press Start 2P"' }}>
            {placedItem.category}
          </p>
          <h2 className="font-heading text-lg font-medium truncate text-[#252525]" style={{ fontFamily: '"Press Start 2P"' }}>
            {placedItem.name}
          </h2>
        </div>
        {/* Mirrors the viewport's Done button — this rail is where the eye is after typing
            an exact position, so the way out needs to be here too. */}
        <button
          onClick={onDone}
          title="Done (Esc)"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-none bg-[#5a6c80] text-white font-body text-xs font-medium hover:opacity-90 transition-opacity border-2 border-[#1e40af] shadow-[2px_2px_0px_#1e40af] hover:shadow-[1px_1px_0px_#1e40af] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
          style={{ fontFamily: '"VT323"' }}
        >
          <Check className="w-3.5 h-3.5" />
          DONE
        </button>
      </div>

      {/* Editable fields */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-[#e2e8f0]">
        {/* Position */}
        <div>
          <h3 className="font-mono text-xs font-bold mb-2 text-[#252525] border-b border-[#1e40af] pb-1" style={{ fontFamily: '"Press Start 2P"' }}>
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
          <h3 className="font-mono text-xs font-bold mb-2 text-[#252525] border-b border-[#1e40af] pb-1" style={{ fontFamily: '"Press Start 2P"' }}>
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
          <h3 className="font-mono text-xs font-bold mb-2 text-[#252525] border-b border-[#1e40af] pb-1" style={{ fontFamily: '"Press Start 2P"' }}>
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
      <div className="p-3 border-t-2 border-[#1e40af] bg-[#cbd5e1]">
        <button
          onClick={() => onRemove(placedItem.id)}
          className="w-full inline-flex items-center justify-center gap-2 px-2 py-2 border-2 border-[#5a6c80] bg-[#e2e8f0] text-[#5a6c80] font-mono text-sm font-bold hover:bg-[#5a6c80] hover:text-white transition-colors active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          style={{ fontFamily: '"Press Start 2P"' }}
        >
          <Trash2 className="w-4 h-4" />
          REMOVE FROM ROOM
        </button>
      </div>
    </div>
  );
}
