import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { store } from '@/lib/store';
import EditorTopBar from '@/components/editor/EditorTopBar';
import CatalogPanel from '@/components/editor/CatalogPanel';
import Viewport from '@/components/editor/Viewport';
import Inspector from '@/components/editor/Inspector';

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(() => store.getProject(projectId));
  const [placedItems, setPlacedItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [transformMode, setTransformMode] = useState('move');
  const [gridSnap, setGridSnap] = useState(false);
  const [projectName, setProjectName] = useState(project?.name || '');
  const [saveStatus, setSaveStatus] = useState('saved');

  const historyRef = useRef([]);
  const saveTimerRef = useRef(null);

  // Load placed items on mount
  useEffect(() => {
    if (!project) return;
    setPlacedItems(store.listPlacedItems(projectId));
  }, [projectId, project]);

  // Redirect if project doesn't exist or isn't ready
  useEffect(() => {
    if (!project) {
      navigate('/');
      return;
    }
    if (project.status !== 'ready') {
      navigate(`/processing/${projectId}`);
    }
  }, [project, projectId, navigate]);

  const pushHistory = useCallback(() => {
    historyRef.current.push(
      placedItems.map((p) => ({
        ...p,
        position: { ...p.position },
      }))
    );
  }, [placedItems]);

  const markSaving = useCallback(() => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('saved'), 800);
  }, []);

  const handleAddItem = useCallback(
    (catalogItemId) => {
      pushHistory();
      const placed = store.addPlacedItem(projectId, catalogItemId);
      if (placed) {
        setPlacedItems((prev) => [...prev, placed]);
        setSelectedId(placed.id);
        markSaving();
      }
    },
    [projectId, pushHistory, markSaving]
  );

  const handleSelectItem = useCallback((id) => {
    setSelectedId(id);
  }, []);

  const handleUpdateItem = useCallback(
    (placedId, patch) => {
      setPlacedItems((prev) =>
        prev.map((p) =>
          p.id === placedId
            ? {
                ...p,
                ...patch,
                position: patch.position ? { ...patch.position } : p.position,
              }
            : p
        )
      );
      store.updatePlacedItem(projectId, placedId, patch);
      markSaving();
    },
    [projectId, markSaving]
  );

  const handleRemoveItem = useCallback(
    (placedId) => {
      pushHistory();
      store.removePlacedItem(projectId, placedId);
      setPlacedItems((prev) => prev.filter((p) => p.id !== placedId));
      setSelectedId(null);
      markSaving();
    },
    [projectId, pushHistory, markSaving]
  );

  const handleResetRoom = useCallback(() => {
    if (placedItems.length === 0) return;
    pushHistory();
    store.removeAllPlacedItems(projectId);
    setPlacedItems([]);
    setSelectedId(null);
    markSaving();
  }, [projectId, placedItems, pushHistory, markSaving]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const snapshot = historyRef.current.pop();
    store.setPlacedItems(projectId, snapshot);
    setPlacedItems(snapshot);
    setSelectedId(null);
    markSaving();
  }, [projectId, markSaving]);

  const handleRename = useCallback(
    (name) => {
      setProjectName(name);
      store.updateProject(projectId, { name });
      markSaving();
    },
    [projectId, markSaving]
  );

  const handleExport = useCallback(() => {
    const url = `${window.location.origin}/editor/${projectId}`;
    navigator.clipboard?.writeText(url);
  }, [projectId]);

  if (!project || project.status !== 'ready') return null;

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
        <CatalogPanel onAdd={handleAddItem} />
        <Viewport
          placedItems={placedItems}
          selectedId={selectedId}
          transformMode={transformMode}
          gridSnap={gridSnap}
          canUndo={historyRef.current.length > 0}
          onSetTransformMode={setTransformMode}
          onToggleGridSnap={() => setGridSnap((v) => !v)}
          onUndo={handleUndo}
          onResetRoom={handleResetRoom}
          onSelectItem={handleSelectItem}
          onDropItem={handleAddItem}
        />
        <Inspector
          placedItem={selectedItem}
          onUpdate={handleUpdateItem}
          onRemove={handleRemoveItem}
        />
      </div>
    </div>
  );
}
