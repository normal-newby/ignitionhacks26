import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Share2 } from 'lucide-react';

/**
 * Editor top bar — project name (editable inline), save status, export action.
 */
export default function EditorTopBar({
  projectName,
  onRename,
  saveStatus,
  onExport,
}) {
  return (
    <div className="flex items-center justify-between px-4 h-14 border-b border-border/60 bg-card/80 backdrop-blur-sm">
      {/* Left: back + editable name */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          to="/"
          className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
          title="Back to projects"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <input
          type="text"
          value={projectName}
          onChange={(e) => onRename(e.target.value)}
          className="font-heading text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-0 max-w-[280px] truncate"
        />
      </div>

      {/* Center: save status */}
      <div className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
        {saveStatus === 'saving' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Saving…</span>
          </>
        ) : (
          <>
            <Check className="w-3.5 h-3.5 text-secondary" />
            <span>All changes saved</span>
          </>
        )}
      </div>

      {/* Right: export */}
      <button
        onClick={onExport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm font-body hover:bg-muted transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Export view
      </button>
    </div>
  );
}
