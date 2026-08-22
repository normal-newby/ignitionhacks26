import { Move, RotateCw, Maximize, Grid3x3, Undo2, RotateCcw } from 'lucide-react';
import Viewfinder from '@/components/Viewfinder';

const TRANSFORM_MODES = [
  { key: 'move', label: 'Move', icon: Move },
  { key: 'rotate', label: 'Rotate', icon: RotateCw },
  { key: 'scale', label: 'Scale', icon: Maximize },
];

/**
 * Center pane — the 3D viewport shell.
 *
 * Still a shell: #splat-viewport is the reserved mount point that the renderer will fill.
 * Everything it needs is on the element as data attributes — the Marble collider mesh URL
 * and the ground-plane offset that furniture sits on — so wiring the renderer in is a
 * matter of reading them, not of plumbing new state through here.
 */
export default function Viewport({
  room,
  placedItems,
  selectedId,
  transformMode,
  gridSnap,
  canUndo,
  onSetTransformMode,
  onToggleGridSnap,
  onUndo,
  onResetRoom,
  onSelectItem,
  onDropItem,
}) {
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const catalogItemId = e.dataTransfer.getData('text/plain');
    if (catalogItemId) onDropItem(catalogItemId);
  };

  return (
    <div className="flex-1 relative flex flex-col bg-background min-w-0">
      {/* Toolbar overlay */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg border border-border/60 p-1 shadow-sm">
        {/* Transform mode toggles */}
        <div className="flex items-center gap-0.5">
          {TRANSFORM_MODES.map((mode) => {
            const Icon = mode.icon;
            const active = transformMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => onSetTransformMode(mode.key)}
                title={mode.label}
                className={`p-2 rounded-md transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        <div className="w-px h-6 bg-border/60 mx-1" />

        {/* Grid snap toggle */}
        <button
          onClick={onToggleGridSnap}
          title="Grid snap"
          className={`p-2 rounded-md transition-colors ${
            gridSnap
              ? 'bg-secondary/20 text-secondary'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Grid3x3 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border/60 mx-1" />

        {/* Undo + Reset */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          className="p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onResetRoom}
          title="Reset room"
          className="p-2 rounded-md text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Viewport canvas with viewfinder */}
      <div
        className="flex-1 p-4"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Viewfinder
          bottomLabels={[
            { text: transformMode, dot: true },
            { text: gridSnap ? 'snap on' : 'snap off' },
          ]}
        >
          <div
            id="splat-viewport"
            data-collider-mesh-url={room?.collider_mesh_url || ''}
            data-splat-url={room?.splat_url || ''}
            data-ground-plane-offset={room?.ground_plane_offset ?? 0}
            data-metric-scale-factor={room?.metric_scale_factor ?? 1}
            className="w-full h-full rounded-md bg-foreground/[0.03] border border-border/30 relative overflow-hidden"
          >
            {/* Marble's panorama of the real room, until the renderer takes over */}
            {room?.pano_url && (
              <img
                src={room.pano_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40"
              />
            )}

            {/* Placeholder grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />

            {/* Empty state */}
            {placedItems.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <p className="font-heading text-lg text-muted-foreground/60 mb-1">
                  Your room scene
                </p>
                <p className="font-body text-sm text-muted-foreground/50 max-w-xs">
                  Drag furniture from the catalog onto this viewport, or tap an
                  item to place it. The 3D renderer will fill this space.
                </p>
              </div>
            )}

            {/* Scene items overlay — placeholder for 3D selection */}
            {placedItems.length > 0 && (
              <div className="absolute bottom-3 left-3 max-w-[220px]">
                <div className="bg-card/90 backdrop-blur-sm rounded-md border border-border/60 shadow-sm overflow-hidden">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 px-3 py-1.5 border-b border-border/40">
                    Scene · {placedItems.length} {placedItems.length === 1 ? 'item' : 'items'}
                  </p>
                  <div className="max-h-[200px] overflow-y-auto">
                    {placedItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onSelectItem(item.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                          selectedId === item.id
                            ? 'bg-destructive/10'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`w-1 h-6 rounded-full flex-shrink-0 ${
                            selectedId === item.id ? 'bg-destructive' : 'bg-transparent'
                          }`}
                        />
                        <span className="font-body text-xs font-medium truncate">
                          {item.name}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                          {item.position.x.toFixed(1)},{item.position.z.toFixed(1)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Viewfinder>
      </div>
    </div>
  );
}
