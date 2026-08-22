/**
 * Furniture catalog — localStorage-backed CRUD.
 *
 * Rooms and their placed models live in Postgres (see src/api/rooms.js); the catalog does
 * not. It's a small fixed list of static GLBs bundled in public/models, so keeping it
 * client-side avoids a table, a seed migration, and an admin write path for data that
 * barely changes. CatalogAdmin edits this copy.
 */

const STORAGE_KEY = 'roomcast_catalog_v1';

/* ------------------------------------------------------------------ */
/* Seed catalog                                                        */
/* ------------------------------------------------------------------ */

// Items with a model_asset_url have a real GLB in public/models and will render in 3D.
// The rest are catalog entries waiting on an asset — sourcing more CC0 models (Kenney.nl,
// Poly Pizza) is the way to fill them in.
const CATALOG_SEED = [
  // Seating
  { id: 'c1',  name: 'Lounge Chair',    category: 'Seating',  thumbnail_url: '/images/chair_modern.avif', model_asset_url: '/models/chair_modern.glb', default_dimensions: { width: 75,  depth: 80,  height: 82 } },
  { id: 'c2',  name: '3-Seat Sofa',     category: 'Seating',  thumbnail_url: '/images/sofa_beige.avif',   model_asset_url: '/models/sofa_beige.glb',   default_dimensions: { width: 200, depth: 90,  height: 85 } },
  { id: 'c3',  name: 'Accent Stool',    category: 'Seating',  thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 40,  depth: 40,  height: 45 } },
  // Tables
  { id: 'c4',  name: 'Coffee Table',    category: 'Tables',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 120, depth: 60,  height: 40 } },
  { id: 'c5',  name: 'Side Table',      category: 'Tables',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 45,  depth: 45,  height: 55 } },
  { id: 'c6',  name: 'Desk',            category: 'Tables',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 140, depth: 70,  height: 75 } },
  // Lighting
  { id: 'c7',  name: 'Floor Lamp',      category: 'Lighting', thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 35,  depth: 35,  height: 160 } },
  { id: 'c8',  name: 'Table Lamp',      category: 'Lighting', thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 25,  depth: 25,  height: 50 } },
  // Storage
  { id: 'c9',  name: 'Bookshelf',       category: 'Storage',  thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 80,  depth: 30,  height: 180 } },
  { id: 'c10', name: 'Sideboard',       category: 'Storage',  thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 150, depth: 45,  height: 70 } },
  // Plants
  { id: 'c11', name: 'Fiddle Leaf Fig', category: 'Plants',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 40,  depth: 40,  height: 170 } },
  { id: 'c12', name: 'Snake Plant',     category: 'Plants',   thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 30,  depth: 30,  height: 90 } },
  // Decor
  { id: 'c13', name: 'Area Rug',        category: 'Decor',    thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 200, depth: 140, height: 2 } },
  { id: 'c14', name: 'Framed Print',    category: 'Decor',    thumbnail_url: '', model_asset_url: '', default_dimensions: { width: 60,  depth: 4,   height: 80 } },
];

const CATEGORIES = ['Seating', 'Tables', 'Lighting', 'Storage', 'Plants', 'Decor'];

/* ------------------------------------------------------------------ */
/* Persistence helpers                                                 */
/* ------------------------------------------------------------------ */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return CATALOG_SEED.map((c) => ({ ...c }));
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : CATALOG_SEED.map((c) => ({ ...c }));
  } catch {
    return CATALOG_SEED.map((c) => ({ ...c }));
  }
}

function save(catalog) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------ */
/* Store API                                                           */
/* ------------------------------------------------------------------ */

export const store = {
  listCatalogItems() {
    return load();
  },

  getCatalogItem(id) {
    return load().find((c) => c.id === id) || null;
  },

  listCategories() {
    return CATEGORIES;
  },

  createCatalogItem(item) {
    const catalog = load();
    const newItem = {
      id: uid('cat'),
      name: item.name || 'Untitled',
      category: item.category || 'Decor',
      thumbnail_url: item.thumbnail_url || '',
      model_asset_url: item.model_asset_url || '',
      default_dimensions: item.default_dimensions || { width: 50, depth: 50, height: 50 },
    };
    catalog.push(newItem);
    save(catalog);
    return newItem;
  },

  updateCatalogItem(id, patch) {
    const catalog = load();
    const item = catalog.find((c) => c.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    save(catalog);
    return item;
  },

  deleteCatalogItem(id) {
    save(load().filter((c) => c.id !== id));
  },

  /** Drop local edits and go back to the bundled catalog. */
  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
