/**
 * Turns a walk-through video (or a pile of photos) into a small set of JPEG frames
 * for Marble.
 *
 * All of this runs in the browser on purpose: the original video never leaves the
 * user's machine, so there's no multi-hundred-megabyte upload and no ffmpeg
 * dependency in the deployed image. Only the sampled frames are sent to the backend.
 */

/** Hard ceiling on frames per tour. Marble needs coverage, not a flipbook. */
export const MAX_FRAMES = 12;

/** Below this, sampling more often just sends near-duplicate frames. */
const SECONDS_PER_FRAME = 2;
const MIN_FRAMES = 4;

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

function scaledSize(width, height) {
    const longest = Math.max(width, height);
    if (!longest || longest <= MAX_EDGE) return { width, height };
    const ratio = MAX_EDGE / longest;
    return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function canvasToJpeg(canvas, filename) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) =>
                blob
                    ? resolve(new File([blob], filename, { type: 'image/jpeg' }))
                    : reject(new Error('Could not encode frame')),
            'image/jpeg',
            JPEG_QUALITY
        );
    });
}

function loadVideo(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        const cleanup = () => URL.revokeObjectURL(url);

        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.addEventListener('loadeddata', () => resolve({ video, cleanup }), { once: true });
        video.addEventListener(
            'error',
            () => {
                cleanup();
                reject(new Error("That video couldn't be read. Try an MP4, MOV, or WebM file."));
            },
            { once: true }
        );
        video.src = url;
    });
}

/**
 * Files produced by MediaRecorder (and some WebM captures) report a duration of
 * Infinity until they've been forced to seek past the end.
 */
async function resolveDuration(video) {
    if (Number.isFinite(video.duration) && video.duration > 0) {
        return video.duration;
    }
    await new Promise((resolve) => {
        video.addEventListener('seeked', resolve, { once: true });
        video.currentTime = 1e6;
    });
    return Number.isFinite(video.duration) ? video.duration : 0;
}

function seek(video, time) {
    return new Promise((resolve, reject) => {
        const onSeeked = () => {
            teardown();
            resolve();
        };
        const onError = () => {
            teardown();
            reject(new Error('Could not seek through that video'));
        };
        const teardown = () => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
        };
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('error', onError);
        video.currentTime = time;
    });
}

/** Picks `max` items spread evenly across the list, preserving order. */
function evenlySample(items, max) {
    if (items.length <= max) return items;
    if (max === 1) return [items[0]];
    return Array.from(
        { length: max },
        (_, i) => items[Math.round((i * (items.length - 1)) / (max - 1))]
    );
}

/**
 * Samples frames evenly across the video, skipping the first and last 5% — a
 * walk-through almost always opens and closes on a black frame or a hand
 * reaching for the phone.
 */
export async function extractFramesFromVideo(file, { maxFrames = MAX_FRAMES, onProgress } = {}) {
    const { video, cleanup } = await loadVideo(file);
    try {
        const duration = await resolveDuration(video);
        if (!duration) {
            throw new Error('That video appears to be empty.');
        }

        const { width, height } = scaledSize(video.videoWidth, video.videoHeight);
        if (!width || !height) {
            throw new Error('That video has no visible picture.');
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const count = Math.min(
            maxFrames,
            Math.max(MIN_FRAMES, Math.round(duration / SECONDS_PER_FRAME))
        );
        const start = duration * 0.05;
        const span = duration * 0.9;

        const frames = [];
        for (let i = 0; i < count; i += 1) {
            const target = start + ((i + 0.5) * span) / count;
            await seek(video, Math.min(target, Math.max(0, duration - 0.01)));
            ctx.drawImage(video, 0, 0, width, height);
            frames.push(await canvasToJpeg(canvas, `frame-${String(i + 1).padStart(2, '0')}.jpg`));
            onProgress?.(i + 1, count);
        }
        return frames;
    } finally {
        cleanup();
    }
}

/**
 * Photo path: takes an evenly-spread subset of the selection (order preserved, so
 * a walk-through shot as stills keeps its sequence) and downscales each one to the
 * same budget the video path uses.
 */
export async function prepareImageFiles(files, { maxFrames = MAX_FRAMES, onProgress } = {}) {
    const selected = evenlySample(Array.from(files), maxFrames);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const frames = [];
    for (let i = 0; i < selected.length; i += 1) {
        const bitmap = await createImageBitmap(selected[i]);
        try {
            const { width, height } = scaledSize(bitmap.width, bitmap.height);
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(bitmap, 0, 0, width, height);
            frames.push(await canvasToJpeg(canvas, `photo-${String(i + 1).padStart(2, '0')}.jpg`));
        } finally {
            bitmap.close();
        }
        onProgress?.(i + 1, selected.length);
    }
    return frames;
}
