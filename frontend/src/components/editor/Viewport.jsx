import { Move, RotateCw, Maximize, Grid3x3, Undo2, RotateCcw, Check, Sparkles, Boxes } from 'lucide-react';
import Viewfinder from '@/components/Viewfinder';
import RoomScene from './scene/RoomScene';

const TRANSFORM_MODES = [
  { key: 'move', label: 'Move', icon: Move },
  { key: 'rotate', label: 'Rotate', icon: RotateCw },
  { key: 'scale', label: 'Scale', icon: Maximize },
];

const ROOM_MODES = [
  { key: 'splat', label: 'Photoreal scan', icon: Sparkles },
  { key: 'mesh', label: 'Fast mesh', icon: Boxes },
];

/**
 * Centre pane — the 3D viewport.
 *
 * The renderer lives in scene/RoomScene; this is the chrome around it. You're always standing
 * in the room — the orbit/walk pair this toolbar used to carry is gone, and with the pointer
 * no longer locked the gizmo works from in there, so the transform modes apply the whole time.
 */
export default function Viewport({
  room,
  placedItems,
  catalogById,
  selectedId,
  transformMode,
  gridSnap,
  roomMode,
  splatQuality,
  canUndo,
  apiRef,
  onSetTransformMode,
  onSetRoomMode,
  onSetSplatQuality,
  onToggleGridSnap,
  onUndo,
  onResetRoom,
  onSelectItem,
  onUpdateItem,
  onDropItem,
}) {
  const hasSplat = Boolean(room?.splat_url);
  const hasHighRes = Boolean(room?.splat_url_full_res);

  return (
    <div className="flex-1 relative flex flex-col bg-background min-w-0">
      {/* Toolbar overlay.
          No backdrop-blur here or on the scene list below, on purpose: backdrop-filter over a
          WebGL canvas makes the compositor re-blur that region every frame the canvas draws,
          which in a walkthrough is every frame. At 90% opacity the blur was working on the
          10% of backdrop that shows through, so it cost real frames and looked the same. */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-card/90 rounded-lg border border-border/60 p-1 shadow-sm">
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

        {/* Photoreal splat vs fast mesh. Hidden when the room has no splat — an older room,
            or one whose generation predates us storing the URL. */}
        {hasSplat && (
          <>
            <div className="flex items-center gap-0.5">
              {ROOM_MODES.map((mode) => {
                const Icon = mode.icon;
                const active = roomMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    onClick={() => onSetRoomMode(mode.key)}
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

            {/* Detail tier, only meaningful while the splat is showing. full_res is a much
                bigger download, so it stays opt-in rather than the default. */}
            {roomMode === 'splat' && hasHighRes && (
              <button
                onClick={() => onSetSplatQuality(splatQuality === 'high' ? 'balanced' : 'high')}
                title={splatQuality === 'high'
                  ? 'Full-resolution splat — switch back to the lighter one'
                  : 'Load the full-resolution splat (slower)'}
                className={`px-2 py-1.5 rounded-md font-mono text-[10px] font-medium tracking-wider transition-colors ${
                  splatQuality === 'high'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                HD
              </button>
            )}

            <div className="w-px h-6 bg-border/60 mx-1" />
          </>
        )}

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

      {/* Controls hint. Right-drag to look isn't guessable, and it's the only way to turn. */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground bg-card/90 px-3 py-1 rounded border border-border/60">
          Right-drag to look · WASD to walk · Q/E up-down · Shift to hurry · Scroll to dolly
        </p>
      </div>

      {/* Viewport canvas with viewfinder */}
      <div className="flex-1 p-4">
        <Viewfinder
          bottomLabels={[
            { text: transformMode, dot: true },
            { text: gridSnap ? 'snap on' : 'snap off' },
            ...(hasSplat
              ? [{ text: roomMode !== 'splat' ? 'mesh' : splatQuality === 'high' ? 'photoreal hd' : 'photoreal' }]
              : []),
          ]}
        >
          <RoomScene
            room={room}
            placedItems={placedItems}
            catalogById={catalogById}
            selectedId={selectedId}
            transformMode={transformMode}
            gridSnap={gridSnap}
            roomMode={roomMode}
            splatQuality={splatQuality}
            apiRef={apiRef}
            onSelectItem={onSelectItem}
            onUpdateItem={onUpdateItem}
            onDropItem={onDropItem}
          />

          {/* Empty state — sits over the scene so the room is still visible behind it. */}
          {placedItems.length === 0 && (
            <div className="absolute inset-x-0 top-16 flex flex-col items-center text-center px-6 pointer-events-none">
              <p className="font-body text-sm text-muted-foreground/70 max-w-xs bg-background/70 backdrop-blur-sm rounded px-3 py-2">
                Drag furniture from the catalog onto the room, or tap an item to place it.
              </p>
            </div>
          )}

          {/* Done — the way out of the gizmo. Clicking empty space and Escape both work too,
              but neither is discoverable while you're mid-drag with a piece selected. */}
          {selectedId && (
            <div className="absolute bottom-3 right-3">
              <button
                onClick={() => onSelectItem(null)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
              >
                <Check className="w-4 h-4" />
                Done
                <span className="font-mono text-[10px] opacity-70 ml-0.5">ESC</span>
              </button>
            </div>
          )}

          {/* Scene list — clicking a small model in 3D is fiddly; this is the reliable way. */}
          {placedItems.length > 0 && (
            <div className="absolute bottom-3 left-3 max-w-[220px]">
              <div className="bg-card/90 rounded-md border border-border/60 shadow-sm overflow-hidden">
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
        </Viewfinder>
      </div>
    </div>
  );
}
