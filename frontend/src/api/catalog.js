/**
 * Client for the furniture catalog endpoints.
 *
 * The catalog used to be a hard-coded list in localStorage backed by GLBs bundled into the
 * frontend build. It's server-side now: rows in Postgres, binaries in MinIO. That's what
 * makes an uploaded model show up for everyone rather than only in the browser that added it.
 */

import { errorMessageFrom } from './errors';
import { authHeaders, handleUnauthorized } from './session';

const BASE = '/api/catalog';

/** Mirrors CatalogService.CATEGORIES — the backend rejects anything outside this set. */
export const CATEGORIES = ['Seating', 'Tables', 'Lighting', 'Storage', 'Plants', 'Decor'];

async function readError(res) {
    if (res.status === 401) handleUnauthorized();
    const body = await res.text().catch(() => '');
    return new Error(errorMessageFrom(body, res.status));
}

/**
 * Everything the signed-in user can place: all public pieces plus their own private uploads.
 * Each item carries `mine` and `is_public`, which is what the admin page's owner filter and
 * its edit/delete buttons key off — one list, no second request for "my items".
 */
export async function listCatalogItems() {
    const res = await fetch(BASE, { headers: authHeaders() });
    if (!res.ok) throw await readError(res);
    return res.json();
}

/**
 * Builds the multipart body shared by create and update. Anything undefined is left out
 * entirely, which is how the PATCH stays partial — an absent field means "leave alone",
 * not "clear".
 */
function toForm({ name, category, default_dimensions, is_public, model, thumbnail }) {
    const form = new FormData();
    if (name !== undefined) form.append('name', name);
    if (category !== undefined) form.append('category', category);
    if (default_dimensions) {
        form.append('width', default_dimensions.width);
        form.append('depth', default_dimensions.depth);
        form.append('height', default_dimensions.height);
    }
    if (is_public !== undefined) form.append('is_public', is_public);
    if (model) form.append('model', model, model.name);
    if (thumbnail) form.append('thumbnail', thumbnail, thumbnail.name);
    return form;
}

/**
 * Uploads a catalog entry with its GLB and thumbnail.
 *
 * XHR rather than fetch for the same reason createRoom uses it: these are multi-megabyte
 * model files and a bare spinner reads as a hang.
 */
function send(method, path, form, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, path);
        Object.entries(authHeaders()).forEach(([key, value]) => xhr.setRequestHeader(key, value));

        if (onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(e.loaded / e.total);
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    reject(new Error('The server returned a response we could not read.'));
                }
            } else {
                if (xhr.status === 401) handleUnauthorized();
                reject(new Error(errorMessageFrom(xhr.responseText, xhr.status)));
            }
        };
        xhr.onerror = () => reject(new Error('The upload could not reach the server.'));
        xhr.onabort = () => reject(new Error('The upload was cancelled.'));

        xhr.send(form);
    });
}

export function createCatalogItem(item, onProgress) {
    return send('POST', BASE, toForm(item), onProgress);
}

/** Partial. Omit `model`/`thumbnail` to keep the files already attached. */
export function updateCatalogItem(id, patch, onProgress) {
    return send('PATCH', `${BASE}/${id}`, toForm(patch), onProgress);
}

/**
 * Asks the server to guess an item's real-world size from its name, category and thumbnail.
 * Returns `{ width, depth, height, note }` in centimetres — nothing is saved, the caller drops
 * the numbers into the form and the user still presses Save.
 *
 * Plain fetch rather than the XHR path above: the only file involved is a thumbnail, and
 * there's no progress worth drawing for it.
 */
export async function estimateDimensions({ name, category, thumbnail }) {
    const form = new FormData();
    form.append('name', name);
    if (category) form.append('category', category);
    if (thumbnail) form.append('thumbnail', thumbnail, thumbnail.name);

    const res = await fetch(`${BASE}/estimate-dimensions`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
    });
    if (!res.ok) throw await readError(res);
    return res.json();
}

export async function deleteCatalogItem(id) {
    const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw await readError(res);
}
