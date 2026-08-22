import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { checkTourStatus } from '@/api/tours';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function Processing() {
  const [searchParams] = useSearchParams();
  const tourId = searchParams.get('id');
  const addressParam = searchParams.get('address') || '';
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [description, setDescription] = useState('Starting world generation...');
  const [address, setAddress] = useState(addressParam);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!tourId) return;
    let active = true;

    const poll = async () => {
      if (doneRef.current) return;
      try {
        const result = await checkTourStatus(tourId);
        if (!active) return;
        setStatus(result.status);
        setDescription(result.description || '');
        if (result.address) setAddress(result.address);
        if (result.status === 'published' || result.status === 'failed') {
          doneRef.current = true;
        }
      } catch {
        // keep polling on transient errors
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tourId]);

  if (!tourId) {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <p className="text-muted-foreground">No tour to process.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <div className="text-center">
        {status === 'published' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Your tour is live</h1>
            <p className="text-muted-foreground mb-8">
              The 3D world has been generated and is now viewable.
            </p>
            <Button onClick={() => navigate(`/tour?address=${encodeURIComponent(address)}`)}>
              View Tour
            </Button>
          </>
        ) : status === 'failed' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Generation failed</h1>
            <p className="text-muted-foreground mb-8">
              {description || 'The 3D world could not be generated. Please try again.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/publish')}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Processing your tour</h1>
            <p className="text-muted-foreground mb-8">
              This usually takes about 5 minutes. You can close this page and come back later.
            </p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </>
        )}
      </div>
    </div>
  );
}