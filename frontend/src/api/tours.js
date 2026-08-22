/**
 * API client layer for tour operations, backed by the Spring Boot REST endpoints in
 * TourController (which persist to Postgres). All filtering happens server-side —
 * the browser no longer downloads every tour to search over it.
 */

const BASE = '/api/tours';

async function request(path, { method = 'GET', body } = {}) {
    // FormData sets its own multipart Content-Type (with the boundary) — setting it
    // by hand would corrupt the request.
    const isForm = body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });

    // The address and status lookups answer 404 when nothing matches; that's an
    // empty result for callers, not an error.
    if (res.status === 404) return null;

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`${method} ${BASE}${path} failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }

    if (res.status === 204) return null;
    return res.json();
}

export async function searchTourByAddress(address) {
    return request(`/search?address=${encodeURIComponent(address)}`);
}

export async function searchToursByTag(tag) {
    return (await request(`?tag=${encodeURIComponent(tag)}`)) ?? [];
}

export async function searchSimilarTours(address) {
    return (await request(`/similar?address=${encodeURIComponent(address)}`)) ?? [];
}

export async function publishTour({ address, video_url, search_tags, estimated_value }) {
    return request('', {
        method: 'POST',
        body: { address, video_url, search_tags, estimated_value },
    });
}

/**
 * Sends the sampled frames and kicks off world generation. Returns the tour's
 * status, same shape as checkTourStatus.
 */
export async function uploadTourFrames(tour_id, frames) {
    const form = new FormData();
    frames.forEach((frame) => form.append('frames', frame, frame.name));
    return request(`/${encodeURIComponent(tour_id)}/frames`, { method: 'POST', body: form });
}

export async function checkTourStatus(tour_id) {
    return request(`/${encodeURIComponent(tour_id)}/status`);
}
