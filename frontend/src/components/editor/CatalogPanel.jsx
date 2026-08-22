import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import Thumbnail from '@/components/Thumbnail';
import { CATEGORIES } from '@/api/catalog';

/**
 * Left rail — furniture catalog grouped by category.
 * Drag a card onto the viewport, or click/tap to add.
 *
 * Items are passed in rather than fetched here: the editor needs the same list to resolve a
 * card into a placed model, so one load upstream serves both.
 */
export default function CatalogPanel({ items = [], loading = false, onAdd }) {
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
    <div className="w-72 flex-shrink-0 border-r border-border/60 bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/40">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Catalog
        </h2>
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search furniture…"
            className="w-full pl-8 pr-3 py-2 rounded-md bg-background border border-input text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-body font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-primary/15'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable item list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8 font-body">
            Loading catalog…
          </p>
        )}
        {!loading && Object.keys(grouped).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 font-body">
            No items match your search.
          </p>
        )}
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category}>
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2 px-1">
              {category}
            </h3>
            <div className="space-y-1.5">
              {catItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => onAdd(item.id)}
                  className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-primary/10 transition-colors group"
                >
                  <div className="w-10 h-10 flex-shrink-0">
                    <Thumbnail
                      url={item.thumbnail_url}
                      label={item.name}
                      category={item.category}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm font-medium truncate">{item.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {item.default_dimensions.width}×{item.default_dimensions.depth}×{item.default_dimensions.height}cm
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-border/40">
        <p className="font-mono text-[10px] text-muted-foreground/70 text-center">
          Drag onto viewport or tap to add
        </p>
      </div>
    </div>
  );
}
