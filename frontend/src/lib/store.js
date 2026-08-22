/**
 * Roomcast data layer — localStorage-backed CRUD.
 * Implements the Project / CatalogItem / PlacedItem data model.
 * The 3D viewport is a shell; this store is the single source of truth
 * that the external 3D code will eventually read from / write to.
 */

const STORAGE_KEY = 'roomcast_v1';

/* ------------------------------------------------------------------ */
/* Seed catalog                                                        */
/* ------------------------------------------------------------------ */

const CATALOG_SEED = [
  // Seating
  { id: 'c1',  name: 'Lounge Chair',   category: 'Seating',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 75,  depth: 80, height: 82 } },
  { id: 'c2',  name: '3-Seat Sofa',     category: 'Seating',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 200, depth: 90, height: 85 } },
  { id: 'c3',  name: 'Accent Stool',    category: 'Seating',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 40,  depth: 40, height: 45 } },
  // Tables
  { id: 'c4',  name: 'Coffee Table',    category: 'Tables',    thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 120, depth: 60, height: 40 } },
  { id: 'c5',  name: 'Side Table',       category: 'Tables',    thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 45,  depth: 45, height: 55 } },
  { id: 'c6',  name: 'Desk',             category: 'Tables',    thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 140, depth: 70, height: 75 } },
  // Lighting
  { id: 'c7',  name: 'Floor Lamp',       category: 'Lighting',  thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 35,  depth: 35, height: 160 } },
  { id: 'c8',  name: 'Table Lamp',       category: 'Lighting',  thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 25,  depth: 25, height: 50 } },
  // Storage
  { id: 'c9',  name: 'Bookshelf',       category: 'Storage',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 80,  depth: 30, height: 180 } },
  { id: 'c10', name: 'Sideboard',        category: 'Storage',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 150, depth: 45, height: 70 } },
  // Plants
  { id: 'c11', name: 'Fiddle Leaf Fig',  category: 'Plants',     thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 40,  depth: 40, height: 170 } },
  { id: 'c12', name: 'Snake Plant',      category: 'Plants',     thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 30,  depth: 30, height: 90 } },
  // Decor
  { id: 'c13', name: 'Area Rug',         category: 'Decor',     thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 200, depth: 140, height: 2 } },
  { id: 'c14', name: 'Framed Print',     category: 'Decor',     thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 60,  depth: 4,  height: 80 } },
];

const CATEGORIES = ['Seating', 'Tables', 'Lighting', 'Storage', 'Plants', 'Decor'];

/* ------------------------------------------------------------------ */
/* Persistence helpers                                                 */
/* ------------------------------------------------------------------ */

function getDefaultData() {
  return {
    projects: [],
    catalog: CATALOG_SEED.map((c) => ({ ...c })),
    placedItems: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    const parsed = JSON.parse(raw);
    // Ensure catalog always has seed items even if storage is partial
    if (!parsed.catalog || parsed.catalog.length === 0) {
      parsed.catalog = CATALOG_SEED.map((c) => ({ ...c }));
    }
    return {
      projects: parsed.projects || [],
      catalog: parsed.catalog,
      placedItems: parsed.placedItems || [],
    };
  } catch {
    return getDefaultData();
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------ */
/* Store API                                                           */
/* ------------------------------------------------------------------ */

export const store = {
  /* ---- Catalog ---- */
  listCatalogItems() {
    return load().catalog;
  },

  listCategories() {
    return CATEGORIES;
  },

  createCatalogItem(item) {
    const data = load();
    const newItem = {
      id: uid('cat'),
      name: item.name || 'Untitled',
      category: item.category || 'Decor',
      thumbnail_url: item.thumbnail_url || '',
      model_asset_url: item.model_asset_url || '',
      default_dimensions: item.default_dimensions || { width: 50, depth: 50, height: 50 },
    };
    data.catalog.push(newItem);
    save(data);
    return newItem;
  },

  updateCatalogItem(id, patch) {
    const data = load();
    const item = data.catalog.find((c) => c.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    save(data);
    return item;
  },

  deleteCatalogItem(id) {
    const data = load();
    data.catalog = data.catalog.filter((c) => c.id !== id);
    save(data);
  },

  /* ---- Projects ---- */
  listProjects() {
    return load().projects;
  },

  getProject(id) {
    return load().projects.find((p) => p.id === id) || null;
  },

  createProject({ name, source_video_url }) {
    const data = load();
    const project = {
      id: uid('proj'),
      name: name || 'Untitled room',
      owner: 'you',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'processing',
      source_video_url: source_video_url || '',
      splat_asset_url: '',
      thumbnail_url: '',
    };
    data.projects.unshift(project);
    save(data);
    return project;
  },

  updateProject(id, patch) {
    const data = load();
    const project = data.projects.find((p) => p.id === id);
    if (!project) return null;
    Object.assign(project, patch, { updated_at: new Date().toISOString() });
    save(data);
    return project;
  },

  deleteProject(id) {
    const data = load();
    data.projects = data.projects.filter((p) => p.id !== id);
    data.placedItems = data.placedItems.filter((p) => p.project_id !== id);
    save(data);
  },

  /* ---- Placed items ---- */
  listPlacedItems(projectId) {
    return load().placedItems.filter((p) => p.project_id === projectId);
  },

  addPlacedItem(projectId, catalogItemId) {
    const data = load();
    const catalogItem = data.catalog.find((c) => c.id === catalogItemId);
    if (!catalogItem) return null;

    const existing = data.placedItems.filter((p) => p.project_id === projectId);
    const offset = existing.length;
    const col = offset % 5;
    const row = Math.floor(offset / 5);

    const placed = {
      id: uid('placed'),
      project_id: projectId,
      catalog_item_id: catalogItemId,
      name: catalogItem.name,
      category: catalogItem.category,
      position: { x: col * 60 - 120, y: 0, z: row * 60 - 60 },
      rotation: 0,
      scale: 1,
      created_at: new Date().toISOString(),
    };
    data.placedItems.push(placed);

    // touch project updated_at
    const project = data.projects.find((p) => p.id === projectId);
    if (project) project.updated_at = new Date().toISOString();

    save(data);
    return placed;
  },

  updatePlacedItem(projectId, placedId, patch) {
    const data = load();
    const placed = data.placedItems.find(
      (p) => p.project_id === projectId && p.id === placedId
    );
    if (!placed) return null;
    Object.assign(placed, patch);

    const project = data.projects.find((p) => p.id === projectId);
    if (project) project.updated_at = new Date().toISOString();

    save(data);
    return placed;
  },

  removePlacedItem(projectId, placedId) {
    const data = load();
    data.placedItems = data.placedItems.filter(
      (p) => !(p.project_id === projectId && p.id === placedId)
    );
    save(data);
  },

  removeAllPlacedItems(projectId) {
    const data = load();
    data.placedItems = data.placedItems.filter((p) => p.project_id !== projectId);
    save(data);
  },

  /** Replace all placed items for a project (used by Editor undo). */
  setPlacedItems(projectId, items) {
    const data = load();
    data.placedItems = data.placedItems.filter((p) => p.project_id !== projectId);
    data.placedItems.push(...items);
    const project = data.projects.find((p) => p.id === projectId);
    if (project) project.updated_at = new Date().toISOString();
    save(data);
  },

  /* ---- Utility ---- */
  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
