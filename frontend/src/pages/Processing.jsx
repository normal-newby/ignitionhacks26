import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Check, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { getRoom } from '@/api/rooms';

/**
 * Marble reconstruction takes roughly five minutes, so this screen is the polled half of
 * the upload: it asks the backend for the room every few seconds until it goes ready or
 * failed. The backend is itself polling World Labs, so nothing here holds a long request.
 */
const POLL_INTERVAL_MS = 5000;

const STEPS = [
  { key: 'upload', label: 'Uploading to World Labs' },
  { key: 'reconstruct', label: 'Reconstructing room' },
  { key: 'ready', label: 'Ready' },
];

/** Which step is lit, inferred from what the backend has told us so far. */
function stepFor(room) {
  if (!room) return 0;
  if (room.status === 'ready') return 2;
  if (room.world_id || /reconstruct/i.test(room.progress_message || '')) return 1;
  // Once the operation is running the backend swaps the message off "Uploading".
  return /upload|queued/i.test(room.progress_message || '') ? 0 : 1;
}

export default function Processing() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await getRoom(projectId);
        if (cancelled) return;

        if (!next) {
          setNotFound(true);
          return;
        }

        setRoom(next);
        setLoadError('');

        if (next.status === 'ready') {
          // Brief pause so "Ready" is actually visible before the editor takes over.
          timerRef.current = setTimeout(() => navigate(`/editor/${projectId}`), 900);
          return;
        }
        if (next.status === 'failed') return;

        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        // A blip shouldn't end a five-minute wait — surface it and keep polling.
        setLoadError(err.message);
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectId, navigate]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4 font-body">Room not found.</p>
          <Link to="/" className="text-primary underline font-body">Back to projects</Link>
        </div>
      </div>
    );
  }

  const failed = room?.status === 'failed';
  const currentStep = stepFor(room);

  return (
    <div className="min-h-screen bg-background flex flex-col animate-fade-in">
      <div className="px-6 py-5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to projects
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">
          <h1 className="font-heading text-2xl font-semibold tracking-tight mb-1">
            {room?.name || 'Loading…'}
          </h1>
          <p className="text-muted-foreground text-sm mb-10 font-body">
            {failed
              ? 'Something went wrong while reconstructing the room.'
              : room?.progress_message || 'Reconstructing your room. This usually takes about five minutes.'}
          </p>

          {failed ? (
            <div className="flex flex-col items-start gap-5">
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="font-body text-sm">
                  {room.error_message ||
                    'The reconstruction failed. This can happen with low-light or shaky footage.'}
                </span>
              </div>
              {/* Retry means a new scan: the video isn't kept, so there's nothing to resend. */}
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Scan again
              </Link>
            </div>
          ) : (
            <ol className="space-y-1">
              {STEPS.map((step, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <li
                    key={step.key}
                    className="flex items-center gap-3.5 py-3 transition-opacity"
                    style={{ opacity: i <= currentStep ? 1 : 0.4 }}
                  >
                    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
                      {done ? (
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                          <Check className="w-4 h-4" style={{ color: 'hsl(var(--background))' }} />
                        </div>
                      ) : active ? (
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-border" />
                      )}
                    </div>
                    <span
                      className={`font-body text-sm ${
                        active ? 'font-medium text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {loadError && !failed && (
            <p className="mt-6 font-mono text-[11px] text-muted-foreground/70">
              Lost contact with the server — retrying.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
