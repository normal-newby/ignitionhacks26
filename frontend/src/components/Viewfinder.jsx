/**
 * Viewfinder — frames the 3D viewport like a camera focus overlay.
 * Thin corner brackets at the four corners, with monospace status labels
 * along the bottom edge. This is the one memorable visual idea of the app.
 */
export default function Viewfinder({ bottomLabels = [], children }) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Corner brackets */}
      <span className="vf-corner vf-corner-tl" />
      <span className="vf-corner vf-corner-tr" />
      <span className="vf-corner vf-corner-bl" />
      <span className="vf-corner vf-corner-br" />

      {/* Content slot */}
      {children}

      {/* Bottom-edge monospace labels */}
      {bottomLabels.length > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-primary/80 bg-background/60 backdrop-blur-sm px-3 py-1 rounded">
          {bottomLabels.map((label, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {label.dot && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
              {label.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
