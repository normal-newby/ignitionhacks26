import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, UploadCloud, Film, Loader2 } from 'lucide-react';
import { createRoom } from '@/api/rooms';

const ACCEPTED = '.mp4,.mov,.webm';
// Marble's own ceiling — its signed upload URLs carry a 100MB content-length range, so a
// larger file is rejected by object storage regardless. Checked here too, so a doomed
// upload fails instantly instead of after a few minutes of streaming.
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_LENGTH = '~5 min';

export default function Upload() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = (f) => {
    if (!f) return;
    if (!/\.(mp4|mov|webm)$/i.test(f.name)) {
      setError('Please choose an MP4, MOV, or WebM file.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`That file is ${(f.size / 1024 / 1024).toFixed(0)} MB — the limit is 100 MB.`);
      return;
    }
    setError('');
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || uploading) {
      if (!file) setError('Choose a video file to continue.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError('');

    try {
      // Resolves once the row exists server-side; reconstruction carries on without us.
      const room = await createRoom({
        name: name || file.name.replace(/\.[^.]+$/, ''),
        video: file,
        onProgress: setProgress,
      });
      navigate(`/processing/${room.id}`);
    } catch (err) {
      setError(err.message || 'The upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col animate-fade-in">
      {/* Minimal top bar */}
      <div className="px-6 py-5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to projects
        </Link>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-lg">
          <h1 className="font-heading text-3xl font-semibold tracking-tight mb-1">
            Scan a room
          </h1>
          <p className="text-muted-foreground text-sm mb-8 font-body">
            Upload a short video of one room. We'll reconstruct it as a 3D scene
            you can furnish.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { if (!uploading) handleDrop(e); else e.preventDefault(); }}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`rounded-lg border-2 border-dashed transition-colors p-10 text-center ${
                uploading ? 'cursor-default opacity-70' : 'cursor-pointer'
              } ${
                dragging
                  ? 'border-primary bg-primary/5'
                  : file
                  ? 'border-secondary/50 bg-secondary/5'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <Film className="w-8 h-8 text-secondary" />
                  <span className="font-body text-sm font-medium">{file.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <UploadCloud className="w-8 h-8 text-primary" />
                  <span className="font-body text-sm font-medium">
                    Drop a video here, or click to browse
                  </span>
                </div>
              )}
            </div>

            {/* Format info */}
            <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
              <span>MP4 · MOV · WebM</span>
              <span className="text-border">|</span>
              <span>Max 100 MB</span>
              <span className="text-border">|</span>
              <span>Max {MAX_LENGTH}</span>
            </div>

            {/* Name field */}
            <div>
              <label className="block text-sm font-body font-medium mb-1.5">
                Room name
              </label>
              <input
                type="text"
                value={name}
                disabled={uploading}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Living room"
                className="w-full px-3 py-2.5 rounded-md bg-card border border-input text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>

            {/* Upload progress — large files take a while, so show the bytes moving */}
            {uploading && (
              <div>
                <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground mb-1.5">
                  <span>Uploading</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-200"
                    style={{ width: `${Math.max(2, progress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive font-body">{error}</p>
            )}

            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? 'Uploading…' : 'Start scan'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
