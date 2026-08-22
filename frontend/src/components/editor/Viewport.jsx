import { Move, RotateCw, Maximize, Grid3x3, Undo2, RotateCcw, Orbit, Footprints, Check, Sparkles, Boxes } from 'lucide-react';
import Viewfinder, { ViewfinderLabels } from '@/components/Viewfinder';
import RoomScene from './scene/RoomScene';

const TRANSFORM_MODES = [
  { key: 'move', label: 'Move', icon: Move },
  { key: 'rotate', label: 'Rotate', icon: RotateCw },
  { key: 'scale', label: 'Scale', icon: Maximize },
];

const NAV_MODES = [
  { key: 'orbit', label: 'Orbit the room', icon: Orbit },
  { key: 'walk', label: 'Walk around inside', icon: Footprints },
];

const ROOM_MODES = [
  { key: 'splat', label: 'Photoreal scan', icon: Sparkles },
  { key: 'mesh', label: 'Fast mesh', icon: Boxes },
];

/**
 * Centre pane — the 3D viewport.
 *
 * The renderer lives in scene/RoomScene; this is the chrome around it. The toolbar's two
 * halves do different jobs: the transform modes drive the gizmo on the selected piece, and
 * only mean anything in orbit mode, while the nav modes decide whether you're arranging the
 * room from outside or standing in it.
 *
 * Everything that sits along the bottom edge shares one lane, so it gets laid out rather than
 * stacked blind — see the comment on the bottom row below.
 */
export default function Viewport({
  room,
  placedItems,
  catalogById,
  selectedId,
  transformMode,
  gridSnap,
  navMode,
  roomMode,
  splatQuality,
  canUndo,
  apiRef,
  onSetTransformMode,
  onSetNavMode,
  onSetRoomMode,
  onSetSplatQuality,
  onToggleGridSnap,
  onUndo,
  onResetRoom,
  onSelectItem,
  onUpdateItem,
  onDropItem,
}) {
  const arranging = navMode === 'orbit';
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
            const active = arranging && transformMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => onSetTransformMode(mode.key)}
                disabled={!arranging}
                title={arranging ? mode.label : `${mode.label} — switch to orbit to arrange`}
                className={`p-2 rounded-md transition-colors disabled:opacity-30 ${
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
          disabled={!arranging}
          title="Grid snap"
          className={`p-2 rounded-md transition-colors disabled:opacity-30 ${
            gridSnap
              ? 'bg-secondary/20 text-secondary'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Grid3x3 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border/60 mx-1" />

        {/* Orbit / walk */}
        <div className="flex items-center gap-0.5">
          {NAV_MODES.map((mode) => {
            const Icon = mode.icon;
            const active = navMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => onSetNavMode(mode.key)}
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

      {/* Viewport canvas with viewfinder */}
      <div className="flex-1 p-4">
        <Viewfinder>
          <RoomScene
            room={room}
            placedItems={placedItems}
            catalogById={catalogById}
            selectedId={selectedId}
            transformMode={transformMode}
            gridSnap={gridSnap}
            navMode={navMode}
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
              <p className="font-body text-sm text-muted-foreground/70 max-w-xs bg-background/70 rounded px-3 py-2">
                Drag furniture from the catalog onto the room, or tap an item to place it.
              </p>
            </div>
          )}

          {/*
            One lane along the bottom edge.

            These used to be three components each pinning *itself* to `bottom-3`: the scene
            list on the left, the Done button on the right, the status labels dead centre —
            and in walk mode a controls hint landing directly on top of those labels, since
            both claimed `left-1/2 -translate-x-1/2`. Laying them out in a single flex row is
            what makes "they don't overlap" a property of the layout rather than something to
            re-check by eye every time one of them grows.

            The two outer columns are `flex-1`, so they're always equal width and the middle
            one is genuinely centred; `min-w-0` lets them shrink instead of pushing it off
            centre. The row itself is click-through, and each occupied cell turns pointer
            events back on — otherwise the empty columns would eat drags meant for the room.
          */}
          <div className="absolute inset-x-3 bottom-3 z-10 flex items-end gap-3 pointer-events-none">
            {/* Left: scene list — clicking a small model in 3D is fiddly; this is reliable. */}
            <div className="flex-1 min-w-0 flex justify-start">
              {placedItems.length > 0 && arranging && (
                <div className="pointer-events-auto max-w-[220px] bg-card/90 rounded-md border border-border/60 shadow-sm overflow-hidden">
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
              )}
            </div>

            {/* Centre: the walk hint stacked above the status labels, never across them. */}
            <div className="flex-none flex flex-col items-center gap-1.5">
              {!arranging && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-primary/90 bg-background/70 px-3 py-1 rounded">
                  Click to look · WASD to move · Shift to hurry · Esc to release
                </p>
              )}
              <ViewfinderLabels
                labels={[
                  { text: arranging ? transformMode : 'walking', dot: true },
                  { text: gridSnap ? 'snap on' : 'snap off' },
                  ...(hasSplat
                    ? [{ text: roomMode !== 'splat' ? 'mesh' : splatQuality === 'high' ? 'photoreal hd' : 'photoreal' }]
                    : []),
                ]}
              />
            </div>

            {/* Right: Done — the way out of the gizmo. Clicking empty space and Escape both
                work too, but neither is discoverable mid-drag with a piece selected. */}
            <div className="flex-1 min-w-0 flex justify-end">
              {selectedId && arranging && (
                <button
                  onClick={() => onSelectItem(null)}
                  className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
                >
                  <Check className="w-4 h-4" />
                  Done
                  <span className="font-mono text-[10px] opacity-70 ml-0.5">ESC</span>
                </button>
              )}
            </div>
          </div>
        </Viewfinder>
      </div>
    </div>
  );
}
