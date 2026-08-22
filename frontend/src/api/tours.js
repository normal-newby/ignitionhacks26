import { base44 } from '@/api/base44Client';

/**
 * API client layer for tour operations.
 * On export, replace these implementations with calls to your Spring Boot REST endpoints
 * (e.g. fetch('/api/tours/search?address=...')) — the function signatures stay the same.
 */

export async function searchTourByAddress(address) {
    const all = await base44.entities.Tour.list();
    return all.find((t) => t.address.toLowerCase() === address.toLowerCase()) || null;
}

export async function searchToursByTag(tag) {
    const all = await base44.entities.Tour.list();
    const lower = tag.toLowerCase();
    return all.filter(
        (t) =>
            t.status === 'published' &&
            (t.search_tags || []).some((s) => s.toLowerCase() === lower)
    );
}

export async function searchSimilarTours(address) {
    const all = await base44.entities.Tour.list();
    const published = all.filter((t) => t.status === 'published');
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    let city;
    if (parts.length >= 2) {
        city = parts[parts.length - 2];
    } else if (parts.length === 1) {
        city = parts[0];
    } else {
        return [];
    }
    const cityLower = city.toLowerCase();
    const addressLower = address.toLowerCase();
    return published.filter(
        (t) =>
            t.address.toLowerCase().includes(cityLower) &&
            t.address.toLowerCase() !== addressLower
    );
}

export async function publishTour({ address, video_url, search_tags, estimated_value }) {
    const res = await base44.functions.invoke('publishTour', {
        address,
        video_url,
        search_tags,
        estimated_value,
    });
    return res.data;
}

export async function checkTourStatus(tour_id) {
    const res = await base44.functions.invoke('checkTourStatus', { tour_id });
    return res.data;
}