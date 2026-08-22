import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Check, Loader2, Share2 } from 'lucide-react';

/**
 * Editor top bar — project name (editable inline), save status, export action.
 *
 * saveStatus is 'saved' | 'saving' | 'error'. The layout is persisted server-side, so a
 * failed write has to be visible: silently claiming "all changes saved" over a dropped
 * request is how someone loses a room they spent ten minutes arranging.
 */
export default function EditorTopBar({
  projectName,
  onRename,
  saveStatus,
  onExport,
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

      {/* Center: save status */}
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

      {/* Right: export */}
      <button
        onClick={onExport}
        className="inline-flex items-center gap-1 px-2 py-1 border-2 border-black bg-[#EDE7DD] text-black font-mono text-xs font-bold hover:bg-[#9B4F3A] hover:text-[#F5E6C8] transition-colors active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        <Share2 className="w-3.5 h-3.5" />
        EXPORT VIEW
      </button>
    </div>
  );
}
