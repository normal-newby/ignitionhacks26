/**
 * Viewfinder — frames the 3D viewport like a camera focus overlay.
 * Thin corner brackets at the four corners. This is the one memorable visual idea of the app.
 */
export default function Viewfinder({ children }) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Corner brackets */}
      <span className="vf-corner vf-corner-tl" />
      <span className="vf-corner vf-corner-tr" />
      <span className="vf-corner vf-corner-bl" />
      <span className="vf-corner vf-corner-br" />

      {/* Content slot */}
      {children}
    </div>
  );
}

/**
 * The monospace status strip that reads along the bottom edge.
 *
 * Positioned by the caller, not by itself. It used to pin itself to `bottom-3 left-1/2`, which
 * meant three separate components — this, the scene list, the Done button, and in walk mode a
 * controls hint — each independently claimed the same twenty pixels and overlapped whenever
 * two of them were visible at once. Handing the position back to the caller is what lets them
 * share one row.
 *
 * No `backdrop-blur` here: over a WebGL canvas that makes the compositor re-blur the region on
 * every frame the canvas draws, which in a walkthrough is every frame.
 */
export function ViewfinderLabels({ labels = [] }) {
  if (labels.length === 0) return null;

  return (
    <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-primary/80 bg-background/70 px-3 py-1 rounded">
      {labels.map((label, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {label.dot && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          {label.text}
        </span>
      ))}
    </div>
  );
}
