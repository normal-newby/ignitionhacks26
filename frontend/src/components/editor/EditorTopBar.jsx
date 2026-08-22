import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Check, Loader2 } from 'lucide-react';

/**
 * Editor top bar — project name (editable inline) and save status.
 *
 * saveStatus is 'saved' | 'saving' | 'error'. The layout is persisted server-side, so a
 * failed write has to be visible: silently claiming "all changes saved" over a dropped
 * request is how someone loses a room they spent ten minutes arranging.
 */
export default function EditorTopBar({
  projectName,
  onRename,
  saveStatus,
}) {
  return (
    <div className="flex items-center justify-between px-3 h-12 border-b-2 border-[#1e40af] bg-[#cbd5e1] shadow-[0px_4px_0px_#1e40af]">
      {/* Left: back + editable name */}
      <div className="flex items-center gap-2 min-w-0">
        <Link
          to="/"
          className="p-1 border-2 border-[#1e40af] hover:bg-[#5a6c80] hover:text-white transition-colors flex-shrink-0 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          title="Back to projects"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <input
          type="text"
          value={projectName}
          onChange={(e) => onRename(e.target.value)}
          // `text-xs`, not the `text-md` that was here: `text-md` isn't a Tailwind class at
          // all, so this inherited the 16px body size — fine for a normal mono, oversized for
          // a pixel face that draws half again as wide.
          className="font-heading text-xs bg-transparent border-none focus:outline-none focus:ring-0 max-w-[240px] truncate text-[#252525] uppercase"
        />
      </div>

      {/* Right: save status. It sat centred while an export button held the right-hand slot;
          with that gone, `justify-between` puts it on the end rather than leaving a gap. */}
      <div className="flex items-center gap-1 text-[10px] font-heading text-[#252525]">
        {saveStatus === 'saving' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>SAVING…</span>
          </>
        ) : saveStatus === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4 text-[#ef4444]" />
            <span className="text-[#ef4444]">ERROR SAVING</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4 text-[#10b981]" />
            <span>ALL CHANGES SAVED</span>
          </>
        )}
      </div>

    </div>
  );
}
