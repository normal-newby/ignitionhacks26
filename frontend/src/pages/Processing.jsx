import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Check, Loader2, AlertCircle, ArrowLeft, RotateCw } from 'lucide-react';
import { store } from '@/lib/store';

const STEPS = [
  { key: 'upload', label: 'Uploading' },
  { key: 'reconstruct', label: 'Reconstructing room' },
  { key: 'ready', label: 'Ready' },
];

export default function Processing() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(() => store.getProject(projectId));
  const [currentStep, setCurrentStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const timersRef = useRef([]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const runProcessing = () => {
    setFailed(false);
    setCurrentStep(0);
    // Clear any existing timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // Step 1 → 2: Uploading done after 2.5s
    const t1 = setTimeout(() => setCurrentStep(1), 2500);
    // Step 2 → 3: Reconstruction done after 7s → mark ready & navigate
    const t2 = setTimeout(() => {
      store.updateProject(projectId, { status: 'ready' });
      setCurrentStep(2);
      // Brief pause so the user sees "Ready" before navigating
      const t3 = setTimeout(() => navigate(`/editor/${projectId}`), 900);
      timersRef.current.push(t3);
    }, 7000);

    timersRef.current.push(t1, t2);
  };

  useEffect(() => {
    if (!project) return;
    // If the project is already ready (e.g. user navigated back), go straight to editor
    if (project.status === 'ready') {
      navigate(`/editor/${projectId}`);
      return;
    }
    // If already failed in the store, show failure
    if (project.status === 'failed') {
      setFailed(true);
      return;
    }
    runProcessing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    store.updateProject(projectId, { status: 'processing' });
    setProject(store.getProject(projectId));
    runProcessing();
  };

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4 font-body">Project not found.</p>
          <Link to="/" className="text-primary underline font-body">Back to projects</Link>
        </div>
      </div>
    );
  }

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
            {project.name}
          </h1>
          <p className="text-muted-foreground text-sm mb-10 font-body">
            {failed
              ? 'Something went wrong while reconstructing the room.'
              : 'Reconstructing your room. This usually takes a few minutes.'}
          </p>

          {failed ? (
            /* Failure state */
            <div className="flex flex-col items-start gap-5">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="w-6 h-6" />
                <span className="font-body text-sm">
                  The reconstruction failed. This can happen with low-light or
                  shaky footage.
                </span>
              </div>
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <RotateCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          ) : (
            /* Step list */
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
                          <Check className="w-4 h-4 text-secondary-foreground" style={{ color: 'hsl(var(--background))' }} />
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
        </div>
      </div>
    </div>
  );
}
