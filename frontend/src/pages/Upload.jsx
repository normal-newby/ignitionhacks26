import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, UploadCloud, Film } from 'lucide-react';
import { store } from '@/lib/store';

const ACCEPTED = '.mp4,.mov,.webm';
const MAX_SIZE = '500 MB';
const MAX_LENGTH = '~5 min';

export default function Upload() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (f) => {
    if (!f) return;
    if (!/\.(mp4|mov|webm)$/i.test(f.name)) {
      setError('Please choose an MP4, MOV, or WebM file.');
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a video file to continue.');
      return;
    }
    const project = store.createProject({
      name: name || file.name.replace(/\.[^.]+$/, ''),
      source_video_url: URL.createObjectURL(file),
    });
    navigate(`/processing/${project.id}`);
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
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed transition-colors p-10 text-center ${
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
              <span>Max {MAX_SIZE}</span>
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
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Living room"
                className="w-full px-3 py-2.5 rounded-md bg-card border border-input text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive font-body">{error}</p>
            )}

            <button
              type="submit"
              disabled={!file}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start scan
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
