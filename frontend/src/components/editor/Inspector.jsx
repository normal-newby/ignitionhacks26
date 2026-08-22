import { Trash2 } from 'lucide-react';

function NumberField({ label, value, onChange, step = 1, min, max }) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2.5 py-1.5 rounded-md bg-background border border-input font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

/**
 * Right rail — inspector for the selected placed item.
 * Collapses to nothing when no item is selected.
 */
export default function Inspector({ placedItem, onUpdate, onRemove }) {
  if (!placedItem) return null;

  return (
    <div className="w-72 flex-shrink-0 border-l border-border/60 bg-card flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border/40">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
          {placedItem.category}
        </p>
        <h2 className="font-heading text-lg font-medium truncate">
          {placedItem.name}
        </h2>
      </div>

      {/* Editable fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Position */}
        <div>
          <h3 className="font-body text-xs font-semibold mb-2.5 text-muted-foreground">
            Position
          </h3>
          <div className="grid grid-cols-3 gap-2">
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
          <h3 className="font-body text-xs font-semibold mb-2.5 text-muted-foreground">
            Rotation
          </h3>
          <NumberField
            label="Degrees"
            value={placedItem.rotation}
            min={0}
            max={360}
            onChange={(v) => onUpdate(placedItem.id, { rotation: v })}
          />
        </div>

        {/* Scale */}
        <div>
          <h3 className="font-body text-xs font-semibold mb-2.5 text-muted-foreground">
            Scale
          </h3>
          <NumberField
            label="Multiplier"
            value={placedItem.scale}
            step={0.1}
            min={0.1}
            onChange={(v) => onUpdate(placedItem.id, { scale: v })}
          />
        </div>
      </div>

      {/* Remove button */}
      <div className="p-4 border-t border-border/40">
        <button
          onClick={() => onRemove(placedItem.id)}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-destructive/30 text-destructive font-body text-sm font-medium hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Remove from room
        </button>
      </div>
    </div>
  );
}
