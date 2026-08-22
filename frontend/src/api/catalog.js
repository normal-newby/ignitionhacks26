/**
 * Client for the furniture catalog endpoints.
 *
 * The catalog used to be a hard-coded list in localStorage backed by GLBs bundled into the
 * frontend build. It's server-side now: rows in Postgres, binaries in MinIO. That's what
 * makes an uploaded model show up for everyone rather than only in the browser that added it.
 */

import { errorMessageFrom } from './errors';

const BASE = '/api/catalog';

/** Mirrors CatalogService.CATEGORIES — the backend rejects anything outside this set. */
export const CATEGORIES = ['Seating', 'Tables', 'Lighting', 'Storage', 'Plants', 'Decor'];

async function readError(res) {
    const body = await res.text().catch(() => '');
    return new Error(errorMessageFrom(body, res.status));
}

export async function listCatalogItems() {
    const res = await fetch(BASE);
    if (!res.ok) throw await readError(res);
    return res.json();
}

/**
 * Builds the multipart body shared by create and update. Anything undefined is left out
 * entirely, which is how the PATCH stays partial — an absent field means "leave alone",
 * not "clear".
 */
function toForm({ name, category, default_dimensions, model, thumbnail }) {
    const form = new FormData();
    if (name !== undefined) form.append('name', name);
    if (category !== undefined) form.append('category', category);
    if (default_dimensions) {
        form.append('width', default_dimensions.width);
        form.append('depth', default_dimensions.depth);
        form.append('height', default_dimensions.height);
    }
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

export async function deleteCatalogItem(id) {
    const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await readError(res);
}
