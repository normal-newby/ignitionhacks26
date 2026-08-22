import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Pencil, Check, X, Loader2, Box, AlertCircle, Sparkles } from 'lucide-react';
import {
  CATEGORIES,
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  estimateDimensions,
} from '@/api/catalog';
import Thumbnail from '@/components/Thumbnail';

const EMPTY_ITEM = {
  name: '',
  category: 'Seating',
  default_dimensions: { width: 50, depth: 50, height: 50 },
};

/** Mirrors the server-side caps in MinioProperties — checked here only to fail before upload. */
const MAX_MODEL_MB = 20;
const MAX_THUMBNAIL_MB = 5;

const MODEL_ACCEPT = '.glb,.gltf';
const THUMBNAIL_ACCEPT = '.png,.jpg,.jpeg,.webp,.avif';

function tooBig(file, limitMb) {
  return file && file.size > limitMb * 1024 * 1024;
}

/**
 * A file picker whose clickable area is the button and nothing else.
 *
 * A bare `<input type="file">` is a block-level box, so `w-full` gave it a hit area spanning
 * the whole form column: clicking the empty space to the right of "Choose File" — or past the
 * filename — opened the picker. Tailwind's `file:` variants only style the button part of that
 * box, they don't shrink it, so no amount of styling fixes it. The input has to stop being the
 * thing you click.
 *
 * So it's driven from a `<label>` instead, which is inline-block and therefore exactly as wide
 * as its own text. `sr-only` rather than `hidden` on the input, because `display:none` would
 * take it out of the tab order; this way it stays keyboard-reachable and `peer-focus-visible`
 * draws the ring on the label that the invisible input can't show itself.
 */
function FileField({ id, label, inputRef, accept, file, hint, onPick }) {
  return (
    <div>
      <span className="block text-sm font-body font-medium mb-1">{label}</span>
      <div className="flex items-center gap-3">
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="sr-only peer"
        />
        <label
          htmlFor={id}
          className="inline-flex items-center px-3 py-1.5 rounded-md bg-muted text-sm font-body font-medium cursor-pointer hover:bg-muted/70 transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
        >
          Choose file
        </label>
        <span className="font-body text-sm text-muted-foreground truncate min-w-0">
          {file ? file.name : 'No file chosen'}
        </span>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

/**
 * Catalog admin. Items live in Postgres and their GLBs in MinIO, so an upload here is
 * visible to every browser — the old localStorage catalog only ever existed in one.
 */
export default function CatalogAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [modelFile, setModelFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [estimating, setEstimating] = useState(false);
  // What the model said it assumed. Worth showing: "assumed a two-seater" is the difference
  // between trusting the numbers and checking them.
  const [estimateNote, setEstimateNote] = useState('');

  // Cleared explicitly on cancel/save: a File in state doesn't reset the input's own value,
  // so re-picking the same file after a cancel would otherwise fire no change event.
  const modelInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);

  const refresh = useCallback(
    () =>
      listCatalogItems()
        .then(setItems)
        .catch((err) => setError(err.message)),
    []
  );

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const editingItem = editingId && editingId !== 'new'
    ? items.find((i) => i.id === editingId)
    : null;

  const startCreate = () => {
    setError('');
    setEstimateNote('');
    setEditingId('new');
    setDraft({ ...EMPTY_ITEM, default_dimensions: { ...EMPTY_ITEM.default_dimensions } });
  };

  const startEdit = (item) => {
    setError('');
    setEstimateNote('');
    setEditingId(item.id);
    setDraft({
      name: item.name,
      category: item.category,
      default_dimensions: { ...item.default_dimensions },
    });
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(null);
    setModelFile(null);
    setThumbnailFile(null);
    setProgress(0);
    setEstimateNote('');
    if (modelInputRef.current) modelInputRef.current.value = '';
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
  };

  /**
   * Fills the dimension fields from an AI guess. It writes into the draft rather than saving,
   * so a wrong number is one edit away from right and nothing reaches the catalog unreviewed.
   *
   * Only a freshly picked thumbnail goes along as a reference image — an already-attached one
   * lives in MinIO, and re-fetching it here to re-upload it would be a round trip for a hint.
   */
  const estimate = async () => {
    if (!draft.name.trim()) {
      setError('Name the item first — that is what the estimate is based on.');
      return;
    }
    if (tooBig(thumbnailFile, MAX_THUMBNAIL_MB)) {
      setError(`That image is over the ${MAX_THUMBNAIL_MB}MB limit.`);
      return;
    }

    setEstimating(true);
    setError('');
    try {
      const { width, depth, height, note } = await estimateDimensions({
        name: draft.name,
        category: draft.category,
        thumbnail: thumbnailFile,
      });
      setDraft((current) => ({ ...current, default_dimensions: { width, depth, height } }));
      setEstimateNote(note || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setEstimating(false);
    }
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setError('Give the item a name.');
      return;
    }
    if (tooBig(modelFile, MAX_MODEL_MB)) {
      setError(`That GLB is over the ${MAX_MODEL_MB}MB limit.`);
      return;
    }
    if (tooBig(thumbnailFile, MAX_THUMBNAIL_MB)) {
      setError(`That image is over the ${MAX_THUMBNAIL_MB}MB limit.`);
      return;
    }

    setBusy(true);
    setError('');
    setProgress(0);
    const payload = { ...draft, model: modelFile, thumbnail: thumbnailFile };

    try {
      if (editingId === 'new') {
        await createCatalogItem(payload, setProgress);
      } else {
        await updateCatalogItem(editingId, payload, setProgress);
      }
      cancel();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await deleteCatalogItem(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 animate-fade-in">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1 font-body">
            Manage the furniture pieces available in the editor.
          </p>
        </div>
        <button
          onClick={startCreate}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add item
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2.5 p-3.5 rounded-md border border-destructive/40 bg-destructive/10">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

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
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <FileField
              id="catalog-model-file"
              label="Model (GLB)"
              inputRef={modelInputRef}
              accept={MODEL_ACCEPT}
              file={modelFile}
              onPick={setModelFile}
              hint={editingItem?.model_asset_url
                ? `Attached — pick a file to replace it. Max ${MAX_MODEL_MB}MB.`
                : `.glb or .gltf, max ${MAX_MODEL_MB}MB.`}
            />
            <FileField
              id="catalog-thumbnail-file"
              label="Thumbnail"
              inputRef={thumbnailInputRef}
              accept={THUMBNAIL_ACCEPT}
              file={thumbnailFile}
              onPick={setThumbnailFile}
              hint={editingItem?.thumbnail_url
                ? `Attached — pick a file to replace it. Max ${MAX_THUMBNAIL_MB}MB.`
                : `Optional. PNG, JPG, WebP or AVIF, max ${MAX_THUMBNAIL_MB}MB.`}
            />

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-body font-medium">
                  Default dimensions (cm)
                </label>
                <button
                  type="button"
                  onClick={estimate}
                  disabled={busy || estimating}
                  title="Guess the real-world size from the name, category and thumbnail"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border font-body text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {estimating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {estimating ? 'Estimating…' : 'Estimate with AI'}
                </button>
              </div>
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
              {estimateNote && (
                <p className="flex items-start gap-1.5 font-mono text-[10px] text-muted-foreground mt-1.5">
                  <Sparkles className="w-3 h-3 flex-shrink-0 mt-px" />
                  <span>Estimated — {estimateNote} Check the numbers before saving.</span>
                </p>
              )}
            </div>
          </div>

          {busy && progress > 0 && (
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-150"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
                Uploading… {Math.round(progress * 100)}%
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save item
            </button>
            <button
              onClick={cancel}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border font-body text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
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
              <th className="text-left px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Model</th>
              <th className="text-left px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Dimensions</th>
              <th className="text-right px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center font-body text-sm text-muted-foreground">
                  The catalog is empty. Add an item to get started.
                </td>
              </tr>
            )}
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
                <td className="px-4 py-3">
                  {item.model_asset_url ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                      <Box className="w-3 h-3" />
                      Attached
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      No model
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {item.default_dimensions.width}×{item.default_dimensions.depth}×{item.default_dimensions.height}cm
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => startEdit(item)}
                      disabled={busy}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-40"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={busy}
                      className="p-1.5 rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-40"
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
