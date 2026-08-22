/**
 * Client for the Spring Boot room/model endpoints.
 *
 * A room is one scanned space (video -> World Labs Marble -> 3D shell); its models are the
 * furniture layout placed on top. Both live in Postgres, which is what makes a layout
 * survive a reload.
 */

const BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });

    // A missing room is an empty result for callers, not an error — the pages redirect on null.
    if (res.status === 404) return null;

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`${method} ${path} failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }

    if (res.status === 204) return null;
    return res.json();
}

/* ---------------------------------------------------------------- */
/* Rooms                                                             */
/* ---------------------------------------------------------------- */

export function listRooms() {
    return request('/rooms').then((rooms) => rooms ?? []);
}

/** Full read: metadata, mesh URLs, and the saved layout under `models`. */
export function getRoom(roomId) {
    return request(`/rooms/${roomId}`);
}

export function renameRoom(roomId, name) {
    return request(`/rooms/${roomId}`, { method: 'PATCH', body: { name } });
}

export function deleteRoom(roomId) {
    return request(`/rooms/${roomId}`, { method: 'DELETE' });
}

/**
 * Uploads a room-scan video and returns the created room, already in "processing".
 *
 * Uses XHR rather than fetch purely for `onProgress` — these are large files and a bare
 * spinner for a 400MB upload reads as a hang. The server answers as soon as the row exists;
 * the push to World Labs and the ~5 minute reconstruction happen after that, so the caller
 * polls `getRoom` from the processing screen.
 */
export function createRoom({ name, video, onProgress }) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('video', video, video.name);
        if (name) form.append('name', name);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE}/rooms`);

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
                reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
            }
        };
        xhr.onerror = () => reject(new Error('The upload could not reach the server.'));
        xhr.onabort = () => reject(new Error('The upload was cancelled.'));

        xhr.send(form);
    });
}

/* ---------------------------------------------------------------- */
/* Models (the furniture layout)                                     */
/* ---------------------------------------------------------------- */

export function listModels(roomId) {
    return request(`/rooms/${roomId}/models`).then((models) => models ?? []);
}

export function addModel(roomId, model) {
    return request(`/rooms/${roomId}/models`, { method: 'POST', body: model });
}

/** Partial: send only the fields that changed. */
export function updateModel(modelId, patch) {
    return request(`/models/${modelId}`, { method: 'PATCH', body: patch });
}

export function deleteModel(modelId) {
    return request(`/models/${modelId}`, { method: 'DELETE' });
}

export function clearModels(roomId) {
    return request(`/rooms/${roomId}/models`, { method: 'DELETE' });
}
