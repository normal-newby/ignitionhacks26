/**
 * Pulls the human-readable reason out of a Spring error body.
 *
 * The backend raises ResponseStatusException with messages written to be read ("That file is
 * 56MB; the limit is 20MB"), but they arrive wrapped in Spring's error JSON. Showing the raw
 * body puts a timestamp and a path in front of the user; showing nothing is worse. Falls back
 * to the raw text for anything that isn't that shape — a proxy error page, say.
 */
export function errorMessageFrom(body, status) {
    if (!body) {
        return `Request failed (${status})`;
    }

    try {
        const parsed = JSON.parse(body);
        // `message` is the classic shape, `detail` the RFC 9457 one.
        const reason = parsed.message || parsed.detail;
        if (reason && reason !== 'No message available') {
            return reason;
        }
        if (parsed.error) {
            return `${parsed.error} (${status})`;
        }
    } catch {
        // Not JSON — fall through and show whatever came back.
    }

    return body;
}
