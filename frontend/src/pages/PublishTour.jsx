import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TagInput from '@/components/TagInput';
import { publishTour, uploadTourFrames } from '@/api/tours';
import { extractFramesFromVideo, prepareImageFiles, MAX_FRAMES } from '@/lib/extract-frames';
import { Upload, Loader2, ArrowLeft, Video, Images } from 'lucide-react';

const MODES = [
  { id: 'video', label: 'Video walk-through', icon: Video },
  { id: 'photos', label: 'Photos', icon: Images },
];

export default function PublishTour() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('video');
  const [address, setAddress] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [searchTags, setSearchTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const hasUpload = mode === 'video' ? !!videoFile : photoFiles.length > 0;
  const canSubmit = address.trim() && hasUpload && !submitting;

  const switchMode = (next) => {
    setMode(next);
    setVideoFile(null);
    setPhotoFiles([]);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      // Frames are sampled here in the browser, so the original video is never
      // uploaded — only the handful of stills Marble actually needs.
      setProgress('Preparing frames...');
      const onProgress = (done, total) => setProgress(`Preparing frames... ${done}/${total}`);
      const frames =
        mode === 'video'
          ? await extractFramesFromVideo(videoFile, { onProgress })
          : await prepareImageFiles(photoFiles, { onProgress });

      if (frames.length === 0) {
        throw new Error('No usable frames could be read from that upload.');
      }

      setProgress('Creating tour...');
      const { tour_id } = await publishTour({
        address: address.trim(),
        video_url: null,
        search_tags: searchTags,
        estimated_value: estimatedValue ? Number(estimatedValue) : null,
      });

      setProgress(`Uploading ${frames.length} frames...`);
      await uploadTourFrames(tour_id, frames);

      navigate(`/processing?id=${tour_id}&address=${encodeURIComponent(address.trim())}`);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setProgress('');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to search
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Publish a 3D tour</h1>
      <p className="text-muted-foreground mb-8">
        Upload a video walk-through or a set of photos. We&apos;ll generate an interactive 3D
        world from your footage.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-2">
          <Label>Property address</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Maple Street, Portland, OR 97201"
            required
          />
        </div>

        <div className="space-y-3">
          <Label>Source footage</Label>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchMode(id)}
                aria-pressed={mode === id}
                className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  mode === id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border/60 text-muted-foreground hover:border-primary/40'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          <div className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
            {mode === 'video' ? (
              <>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="video-upload"
                />
                <label htmlFor="video-upload" className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">
                    {videoFile ? videoFile.name : 'Click to upload a video'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">MP4, MOV, or WebM</p>
                </label>
              </>
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">
                    {photoFiles.length > 0
                      ? `${photoFiles.length} photo${photoFiles.length === 1 ? '' : 's'} selected`
                      : 'Click to upload photos'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or WebP</p>
                </label>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === 'video'
              ? `We sample up to ${MAX_FRAMES} frames from the video in your browser — the video itself is never uploaded.`
              : `Upload as many as you like; we use up to ${MAX_FRAMES}, spread evenly across the set.`}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Search tags</Label>
          <TagInput
            tags={searchTags}
            onChange={setSearchTags}
            placeholder="e.g. hardwood floors, backyard, renovated"
          />
          <p className="text-xs text-muted-foreground">
            Add tags to help buyers find this tour. Press Enter to add each tag.
          </p>
        </div>

        <div className="space-y-2">
          <Label>
            Estimated value <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            type="number"
            min="0"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="e.g. 525000"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={!canSubmit} className="w-full" size="lg">
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> {progress || 'Publishing...'}
            </>
          ) : (
            'Publish tour'
          )}
        </Button>
      </form>
    </div>
  );
}
