/**
 * Accounts. Two writes and a check — there is no token to refresh and no server-side session
 * to end, so signing out is just forgetting what's in localStorage.
 */

import { errorMessageFrom } from './errors';
import { authHeaders } from './session';

const BASE = '/api/auth';

async function post(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(errorMessageFrom(text, res.status));
    }
    return res.json();
}

export function register({ username, password, displayName }) {
    return post('/register', { username, password, display_name: displayName });
}

export function login({ username, password }) {
    return post('/login', { username, password });
}

/**
 * Confirms a stored session still resolves server-side. Null rather than throwing when it
 * doesn't: on boot that isn't an error to show anybody, it just means "sign in again".
 */
export async function fetchCurrentUser() {
    const res = await fetch(`${BASE}/me`, { headers: authHeaders() });
    return res.ok ? res.json() : null;
}
