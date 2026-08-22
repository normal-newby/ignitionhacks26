/**
 * Where the signed-in account is kept between page loads, and the one place that decides what
 * an authenticated request looks like.
 *
 * This is the *only* thing in localStorage. Rooms, models and the catalog are all server-side
 * and must stay there — a layout that lives in one browser isn't saved. The session is the
 * exception because it has nowhere else to go: the backend's whole notion of "who is asking"
 * is an `X-User-Id` header (see CurrentUserResolver), so the browser has to remember what to
 * send. Nothing else belongs here.
 */

const KEY = 'roomcast.session';

/** Fired when a stored session stops working, so React can drop back to the login screen. */
export const SIGNED_OUT_EVENT = 'roomcast:signed-out';

export function readSession() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const user = JSON.parse(raw);
        return user && user.id ? user : null;
    } catch {
        // Corrupt or unreadable (private mode, cleared storage) — treat as signed out.
        return null;
    }
}

export function writeSession(user) {
    localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearSession() {
    localStorage.removeItem(KEY);
}

/**
 * Header for every call that needs an account. Returns an empty object when signed out, so a
 * request made in that state fails as a clean 401 rather than sending the string "null".
 */
export function authHeaders() {
    const user = readSession();
    return user ? { 'X-User-Id': user.id } : {};
}

/**
 * Handles the server saying the stored session is no good — a deleted account, a wiped
 * database, an id from an older build.
 *
 * The api modules aren't React, so they can't route anywhere themselves. They clear the
 * session and announce it; AuthProvider listens and re-renders, and RequireAuth does the
 * redirect. That keeps the "where do we go now" decision in one place.
 */
export function handleUnauthorized() {
    if (readSession()) {
        clearSession();
        window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
    }
}
