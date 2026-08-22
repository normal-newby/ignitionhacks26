import { memo, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import Thumbnail from '@/components/Thumbnail';
import { CATEGORIES } from '@/api/catalog';

/**
 * Left rail — furniture catalog grouped by category.
 * Drag a card onto the viewport, or click/tap to add.
 *
 * Items are passed in rather than fetched here: the editor needs the same list to resolve a
 * card into a placed model, so one load upstream serves both.
 *
 * Memoised, and its three props are all stable once the catalog has loaded. Dragging a piece
 * of furniture around the viewport sets state on the editor on every mouse move; without this
 * the whole rail — every card, every thumbnail — re-rendered on each of those, for a list that
 * hadn't changed since page load.
 */
function CatalogPanel({ items = [], loading = false, onAdd }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const categories = ['All', ...CATEGORIES];

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchCat = activeCategory === 'All' || item.category === activeCategory;
      const matchQuery =
        !query || item.name.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [items, query, activeCategory]);

  // Group by category for display
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((item) => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    return map;
  }, [filtered]);

  return (
    <div className="w-72 flex-shrink-0 border-r-2 border-b-2 border-r-[#808080] border-b-[#808080] border-t-white border-l-white bg-[#c0c0c0] flex flex-col h-full">
      {/* Title bar - Pixel art style */}
      <div className="p-2 bg-[#3b82f6] text-white flex justify-between items-center border-b-2 border-[#1e40af]">
        <h2 className="font-mono text-sm font-bold uppercase" style={{ fontFamily: '"Press Start 2P"' }}>
          CATALOG
        </h2>
        <div className="flex gap-1">
          <div className="w-3 h-3 border-2 border-t-white border-l-white border-r-[#1e40af] border-b-[#1e40af] bg-[#cbd5e1]"></div>
          <div className="w-3 h-3 border-2 border-t-white border-l-white border-r-[#1e40af] border-b-[#1e40af] bg-[#cbd5e1]"></div>
          <div className="w-3 h-3 border-2 border-t-white border-l-white border-r-[#1e40af] border-b-[#1e40af] bg-[#cbd5e1]"></div>
        </div>
      </div>

      {/* Search panel */}
      <div className="p-2 border-b-2 border-b-[#1e40af] bg-[#e2e8f0]">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#252525]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SEARCH FURNITURE…"
            className="w-full pl-8 pr-2 py-1 border-2 border-t-[#e2e8f0] border-l-[#e2e8f0] border-r-[#1e40af] border-b-[#1e40af] bg-white text-sm font-mono text-[#252525]"
            style={{ fontFamily: '"VT323"' }}
          />
        </div>
        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-0.5 border-2 border-t-[#e2e8f0] border-l-[#e2e8f0] border-r-[#1e40af] border-b-[#1e40af] text-[10px] font-mono font-bold transition-colors ${
                activeCategory === cat
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#e2e8f0] text-[#252525] hover:bg-[#3b82f6] hover:text-white'
              }`}
              style={{ fontFamily: '"VT323"' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable item list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[#e2e8f0]">
        {loading && (
          <p className="text-sm text-[#252525] text-center py-4 font-mono" style={{ fontFamily: '"VT323"' }}>
            LOADING CATALOG…
          </p>
        )}
        {!loading && Object.keys(grouped).length === 0 && (
          <p className="text-sm text-[#252525] text-center py-4 font-mono" style={{ fontFamily: '"VT323"' }}>
            NO ITEMS MATCH SEARCH
          </p>
        )}
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category}>
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-[#252525] mb-1 px-1 border-b border-[#1e40af]" style={{ fontFamily: '"Press Start 2P"' }}>
              {category}
            </h3>
            <div className="space-y-1">
              {catItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => onAdd(item.id)}
                  className="flex items-center gap-2 p-1 border-2 border-t-[#e2e8f0] border-l-[#e2e8f0] border-r-[#1e40af] border-b-[#1e40af] bg-white cursor-pointer hover:bg-[#3b82f6] hover:text-white transition-colors group shadow-[2px_2px_0px_#1e40af] hover:shadow-[1px_1px_0px_#1e40af] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
                >
                  <div className="w-8 h-8 flex-shrink-0">
                    <Thumbnail
                      url={item.thumbnail_url}
                      label={item.name}
                      category={item.category}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold truncate text-[#252525] group-hover:text-white" style={{ fontFamily: '"VT323"' }}>{item.name}</p>
                    <p className="font-mono text-[9px] text-[#5a6c80] group-hover:text-white/70" style={{ fontFamily: '"VT323"' }}>
                      {item.default_dimensions.width}×{item.default_dimensions.depth}×{item.default_dimensions.height}CM
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className="p-1 border-t-2 border-[#1e40af] bg-[#cbd5e1]">
        <p className="font-mono text-[10px] text-[#252525] text-center" style={{ fontFamily: '"Press Start 2P"' }}>
          DRAG ONTO VIEWPORT OR TAP TO ADD
        </p>
      </div>
    </div>
  );
}

export default memo(CatalogPanel);
