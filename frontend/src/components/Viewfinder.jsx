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
 *
 * Press Start 2P at 8px, not 10px: it draws roughly half again as wide as a normal mono at the
 * same size, so matching the old 10px would have made this strip a third wider than the row it
 * has to fit inside. `tracking-wider` comes off for the same reason — the face is already
 * generously spaced.
 */
export function ViewfinderLabels({ labels = [] }) {
  if (labels.length === 0) return null;

  return (
    // `max-w-full` + `flex-wrap`: this sits in a column that shrinks with the window, and
    // without both it keeps its max-content width and spills over whatever is beside it.
    <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 max-w-full font-heading text-[8px] uppercase text-[#1e40af] bg-[#e2e8f0] border-2 border-[#1e40af] px-2.5 py-1.5">
      {labels.map((label, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {label.dot && <span className="w-1.5 h-1.5 bg-[#3b82f6]" />}
          {label.text}
        </span>
      ))}
    </div>
  );
}
