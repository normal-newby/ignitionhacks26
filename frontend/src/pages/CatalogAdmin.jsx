import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { store } from '@/lib/store';
import Thumbnail from '@/components/Thumbnail';

const EMPTY_ITEM = {
  name: '',
  category: 'Seating',
  thumbnail_url: '',
  model_asset_url: '',
  default_dimensions: { width: 50, depth: 50, height: 50 },
};

export default function CatalogAdmin() {
  const [items, setItems] = useState(() => store.listCatalogItems());
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const refresh = () => setItems(store.listCatalogItems());

  const startCreate = () => {
    setEditingId('new');
    setDraft({ ...EMPTY_ITEM, default_dimensions: { ...EMPTY_ITEM.default_dimensions } });
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setDraft({
      ...item,
      default_dimensions: { ...item.default_dimensions },
    });
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(null);
  };

  const save = () => {
    if (!draft.name.trim()) return;
    if (editingId === 'new') {
      store.createCatalogItem(draft);
    } else {
      store.updateCatalogItem(editingId, draft);
    }
    cancel();
    refresh();
  };

  const handleDelete = (id) => {
    store.deleteCatalogItem(id);
    refresh();
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 animate-fade-in">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Catalog admin</h1>
          <p className="text-muted-foreground text-sm mt-1 font-body">
            Manage the furniture pieces available in the editor.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add item
        </button>
      </div>

      {/* Inline editor form */}
      {editingId && (
        <div className="mb-6 p-5 rounded-lg border border-primary/30 bg-card animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-body font-medium mb-1">Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-body font-medium mb-1">Category</label>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {store.listCategories().map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-body font-medium mb-1">Thumbnail URL</label>
              <input
                type="text"
                value={draft.thumbnail_url}
                onChange={(e) => setDraft({ ...draft, thumbnail_url: e.target.value })}
                placeholder="Optional — leave blank for placeholder"
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-body font-medium mb-1">Model asset URL</label>
              <input
                type="text"
                value={draft.model_asset_url}
                onChange={(e) => setDraft({ ...draft, model_asset_url: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-body font-medium mb-1">
                Default dimensions (cm)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['width', 'depth', 'height'].map((dim) => (
                  <div key={dim}>
                    <span className="block font-mono text-[10px] uppercase text-muted-foreground mb-1">{dim}</span>
                    <input
                      type="number"
                      value={draft.default_dimensions[dim]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          default_dimensions: {
                            ...draft.default_dimensions,
                            [dim]: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-2.5 py-2 rounded-md bg-background border border-input font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={save}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Check className="w-4 h-4" />
              Save item
            </button>
            <button
              onClick={cancel}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border font-body text-sm font-medium hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border/60">
              <th className="text-left px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Item</th>
              <th className="text-left px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Category</th>
              <th className="text-left px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Dimensions</th>
              <th className="text-right px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 flex-shrink-0">
                      <Thumbnail url={item.thumbnail_url} label={item.name} category={item.category} />
                    </div>
                    <span className="font-body text-sm font-medium">{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-body text-sm text-muted-foreground">{item.category}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {item.default_dimensions.width}×{item.default_dimensions.depth}×{item.default_dimensions.height}cm
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
