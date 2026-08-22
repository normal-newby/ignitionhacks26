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
    <div className="flex items-center justify-between px-3 h-12 border-b-2 border-black bg-[#D4A76A] shadow-[0px_4px_0px_#000]">
      {/* Left: back + editable name */}
      <div className="flex items-center gap-2 min-w-0">
        <Link
          to="/"
          className="p-1 border-2 border-black hover:bg-[#9B4F3A] hover:text-[#F5E6C8] transition-colors flex-shrink-0 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          title="Back to projects"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <input
          type="text"
          value={projectName}
          onChange={(e) => onRename(e.target.value)}
          className="font-mono text-md font-bold bg-transparent border-none focus:outline-none focus:ring-0 max-w-[240px] truncate text-black uppercase"
        />
      </div>

      {/* Right: save status. It sat centred while the export button held the right-hand slot;
          with that gone, `justify-between` puts it on the end rather than leaving a gap. */}
      <div className="flex items-center gap-1 text-xs font-mono text-black">
        {saveStatus === 'saving' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>SAVING…</span>
          </>
        ) : saveStatus === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4 text-[#9B4F3A]" />
            <span className="text-[#9B4F3A]">ERROR SAVING</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4 text-[#7C8B6F]" />
            <span>ALL CHANGES SAVED</span>
          </>
        )}
      </div>
    </div>
  );
}
