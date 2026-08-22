import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  getRoom,
  renameRoom,
  addModel,
  updateModel,
  deleteModel,
  clearModels,
} from '@/api/rooms';
import { listCatalogItems } from '@/api/catalog';
import EditorTopBar from '@/components/editor/EditorTopBar';
import CatalogPanel from '@/components/editor/CatalogPanel';
import Viewport from '@/components/editor/Viewport';
import Inspector from '@/components/editor/Inspector';

/** Transforms are pushed this long after the last edit, so a drag is one write, not fifty. */
const SAVE_DEBOUNCE_MS = 500;

/** Server model -> the shape the viewport and inspector read. */
function toUi(model) {
  return {
    id: model.id,
    catalog_item_id: model.catalog_id,
    name: model.name,
    category: model.category,
    model_url: model.model_url,
    position: { x: model.pos_x, y: model.pos_y, z: model.pos_z },
    rotation: model.rotation_y,
    scale: model.scale,
  };
}

/** UI patch -> the snake_case partial the backend expects. */
function toApi(patch) {
  const body = {};
  if (patch.position) {
    body.pos_x = patch.position.x;
    body.pos_y = patch.position.y;
    body.pos_z = patch.position.z;
  }
  if (patch.rotation !== undefined) body.rotation_y = patch.rotation;
  if (patch.scale !== undefined) body.scale = patch.scale;
  if (patch.name !== undefined) body.name = patch.name;
  return body;
}

/**
 * Where a newly added item lands when there's no drop point — a loose grid on the floor, so
 * successive clicks from the catalog rail don't stack on one spot.
 *
 * Y is 0 because RoomShell lifts the scanned room by Marble's ground-plane offset, putting
 * the real floor on y=0. So `pos_y` means "height above the floor", not a coordinate in
 * Marble's frame.
 */
function spawnPosition(count) {
  const col = count % 5;
  const row = Math.floor(count / 5);
  return {
    x: col * 0.6 - 1.2,
    y: 0,
    z: row * 0.6 - 0.6,
  };
}

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placedItems, setPlacedItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [transformMode, setTransformMode] = useState('move');
  const [navMode, setNavMode] = useState('orbit');
  // Photoreal by default — it's the whole point of scanning the room. The mesh is one click
  // away for anyone whose machine struggles with half a million splats.
  const [roomMode, setRoomMode] = useState('splat');
  // 'balanced' is Marble's 500k tier. full_res is a much larger download, so it's opt-in.
  const [splatQuality, setSplatQuality] = useState('balanced');
  const [gridSnap, setGridSnap] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const historyRef = useRef([]);
  // One pending timer per model id, so dragging two things doesn't cancel one of the saves.
  const pendingSavesRef = useRef(new Map());
  const renameTimerRef = useRef(null);
  /**
   * Next slot in the spawn grid, reserved synchronously on click. It can't be derived from
   * placedItems.length: that only grows once the POST comes back, and against a remote
   * database that round-trip is slower than a person clicking twice — so several adds would
   * all read the same length and land on top of each other.
   */
  const spawnCountRef = useRef(0);

  /* ---------------- load ---------------- */

  useEffect(() => {
    let cancelled = false;

    getRoom(projectId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          navigate('/');
          return;
        }
        if (data.status !== 'ready') {
          navigate(`/processing/${projectId}`);
          return;
        }
        setRoom(data);
        setProjectName(data.name);
        setPlacedItems((data.models || []).map(toUi));
        spawnCountRef.current = (data.models || []).length;
      })
      .catch(() => !cancelled && navigate('/'))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [projectId, navigate]);

  // Loaded once and held here rather than inside CatalogPanel, because adding an item needs
  // to resolve a catalog id into a name/category/model URL to snapshot onto the placed model.
  useEffect(() => {
    let cancelled = false;

    listCatalogItems()
      .then((items) => !cancelled && setCatalog(items))
      .catch((err) => !cancelled && console.error('Could not load the catalog', err))
      .finally(() => !cancelled && setCatalogLoading(false));

    return () => { cancelled = true; };
  }, []);

  // Flush nothing on unmount beyond clearing timers — the debounce is short enough that a
  // pending write survives normal navigation within the app.
  useEffect(() => {
    const pending = pendingSavesRef.current;
    return () => {
      pending.forEach(clearTimeout);
      if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
    };
  }, []);

  /* ---------------- save plumbing ---------------- */

  const runSave = useCallback(async (work) => {
    setSaveStatus('saving');
    try {
      await work();
      setSaveStatus('saved');
      return true;
    } catch (err) {
      console.error('Save failed', err);
      setSaveStatus('error');
      return false;
    }
  }, []);

  const pushHistory = useCallback(() => {
    historyRef.current.push(
      placedItems.map((p) => ({ ...p, position: { ...p.position } }))
    );
  }, [placedItems]);

  /* ---------------- mutations ---------------- */

  /**
   * `dropPoint` is where the cursor met the floor, when the item arrived by drag. Falling
   * back to the spawn grid covers a click from the catalog rail, and a drop aimed above the
   * horizon where the ray never meets the floor.
   */
  const handleAddItem = useCallback(
    async (catalogItemId, dropPoint) => {
      const catalogItem = catalog.find((c) => c.id === catalogItemId);
      if (!catalogItem) return;

      pushHistory();
      const position = dropPoint
        ? { x: dropPoint.x, y: 0, z: dropPoint.z }
        : spawnPosition(spawnCountRef.current++);

      await runSave(async () => {
        const created = await addModel(projectId, {
          catalog_id: catalogItem.id,
          name: catalogItem.name,
          category: catalogItem.category,
          model_url: catalogItem.model_asset_url,
          pos_x: position.x,
          pos_y: position.y,
          pos_z: position.z,
          rotation_y: 0,
          scale: 1,
        });
        const ui = toUi(created);
        setPlacedItems((prev) => [...prev, ui]);
        setSelectedId(ui.id);
      });
    },
    [projectId, room, catalog, pushHistory, runSave]
  );

  const handleSelectItem = useCallback((id) => setSelectedId(id), []);

  /**
   * Escape drops the selection, which is the other half of the Done button. Only in orbit
   * mode: while walking, Escape belongs to the pointer lock, and stealing it would leave you
   * captured with no way out.
   */
  useEffect(() => {
    if (navMode !== 'orbit') return undefined;

    const onKeyDown = (e) => {
      // Not while typing a position into the inspector.
      if (e.key !== 'Escape' || e.target.tagName === 'INPUT') return;
      setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navMode]);

  /** Catalog lookup for the renderer, which sizes each model from its entry's dimensions. */
  const catalogById = useMemo(
    () => Object.fromEntries(catalog.map((c) => [c.id, c])),
    [catalog]
  );

  /**
   * Applies the edit locally straight away and debounces the write. The inspector's number
   * fields fire on every keystroke, so this is the difference between one PATCH and thirty.
   */
  const handleUpdateItem = useCallback(
    (placedId, patch) => {
      setPlacedItems((prev) =>
        prev.map((p) =>
          p.id === placedId
            ? { ...p, ...patch, position: patch.position ? { ...patch.position } : p.position }
            : p
        )
      );

      const pending = pendingSavesRef.current;
      if (pending.has(placedId)) clearTimeout(pending.get(placedId));

      setSaveStatus('saving');
      pending.set(
        placedId,
        setTimeout(() => {
          pending.delete(placedId);
          runSave(() => updateModel(placedId, toApi(patch)));
        }, SAVE_DEBOUNCE_MS)
      );
    },
    [runSave]
  );

  const handleRemoveItem = useCallback(
    async (placedId) => {
      pushHistory();
      setPlacedItems((prev) => prev.filter((p) => p.id !== placedId));
      setSelectedId(null);
      await runSave(() => deleteModel(placedId));
    },
    [pushHistory, runSave]
  );

  const handleResetRoom = useCallback(async () => {
    if (placedItems.length === 0) return;
    pushHistory();
    setPlacedItems([]);
    setSelectedId(null);
    spawnCountRef.current = 0;
    await runSave(() => clearModels(projectId));
  }, [projectId, placedItems.length, pushHistory, runSave]);

  /**
   * Undo replays a snapshot against the server by diffing it with what's there now: drop
   * what was added, re-create what was removed, patch what moved. Re-created items get new
   * ids — the layout comes back, the identities don't.
   */
  const handleUndo = useCallback(async () => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;

    const currentById = new Map(placedItems.map((p) => [p.id, p]));
    const snapshotIds = new Set(snapshot.map((p) => p.id));

    await runSave(async () => {
      await Promise.all(
        placedItems.filter((p) => !snapshotIds.has(p.id)).map((p) => deleteModel(p.id))
      );

      const restored = await Promise.all(
        snapshot.map(async (item) => {
          const live = currentById.get(item.id);
          if (!live) {
            const created = await addModel(projectId, {
              catalog_id: item.catalog_item_id,
              name: item.name,
              category: item.category,
              model_url: item.model_url,
              pos_x: item.position.x,
              pos_y: item.position.y,
              pos_z: item.position.z,
              rotation_y: item.rotation,
              scale: item.scale,
            });
            return toUi(created);
          }

          const moved =
            live.position.x !== item.position.x ||
            live.position.y !== item.position.y ||
            live.position.z !== item.position.z ||
            live.rotation !== item.rotation ||
            live.scale !== item.scale;

          if (moved) {
            await updateModel(item.id, toApi(item));
          }
          return item;
        })
      );

      setPlacedItems(restored);
      setSelectedId(null);
      spawnCountRef.current = restored.length;
    });
  }, [projectId, placedItems, runSave]);

  const handleRename = useCallback(
    (name) => {
      setProjectName(name);
      if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
      setSaveStatus('saving');
      renameTimerRef.current = setTimeout(() => {
        runSave(() => renameRoom(projectId, name.trim() || 'Untitled room'));
      }, SAVE_DEBOUNCE_MS);
    },
    [projectId, runSave]
  );

  const handleExport = useCallback(() => {
    navigator.clipboard?.writeText(`${window.location.origin}/editor/${projectId}`);
  }, [projectId]);

  /* ---------------- render ---------------- */

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!room) return null;

  const selectedItem = placedItems.find((p) => p.id === selectedId);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <EditorTopBar
        projectName={projectName}
        onRename={handleRename}
        saveStatus={saveStatus}
        onExport={handleExport}
      />
      <div className="flex-1 flex min-h-0">
        <CatalogPanel items={catalog} loading={catalogLoading} onAdd={handleAddItem} />
        <Viewport
          room={room}
          placedItems={placedItems}
          catalogById={catalogById}
          selectedId={selectedId}
          transformMode={transformMode}
          gridSnap={gridSnap}
          navMode={navMode}
          roomMode={roomMode}
          splatQuality={splatQuality}
          canUndo={historyRef.current.length > 0}
          onSetTransformMode={setTransformMode}
          onSetNavMode={setNavMode}
          onSetRoomMode={setRoomMode}
          onSetSplatQuality={setSplatQuality}
          onToggleGridSnap={() => setGridSnap((v) => !v)}
          onUndo={handleUndo}
          onResetRoom={handleResetRoom}
          onSelectItem={handleSelectItem}
          onUpdateItem={handleUpdateItem}
          onDropItem={handleAddItem}
        />
        <Inspector
          placedItem={selectedItem}
          onUpdate={handleUpdateItem}
          onRemove={handleRemoveItem}
          onDone={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
