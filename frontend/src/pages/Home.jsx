import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Trash2 } from 'lucide-react';
import { store } from '@/lib/store';
import StatusBadge from '@/components/StatusBadge';
import Thumbnail from '@/components/Thumbnail';

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    setProjects(store.listProjects());
  }, []);

  const handleDelete = (id) => {
    store.deleteProject(id);
    setProjects(store.listProjects());
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header row */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Your rooms</h1>
          <p className="text-muted-foreground text-sm mt-1 font-body">
            Scan a space, then furnish it in 3D.
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Scan a room
        </button>
      </div>

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <Plus className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-heading text-xl font-medium mb-2">No rooms yet</h2>
          <p className="text-muted-foreground text-sm max-w-sm font-body">
            Upload a short video scan of a room and we'll turn it into an
            interactive 3D scene you can furnish.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Scan your first room
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Project grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <div
              key={p.id}
              className="group relative bg-card rounded-lg border border-border/60 overflow-hidden hover:border-primary/40 transition-colors"
            >
              <Link to={p.status === 'ready' ? `/editor/${p.id}` : `/processing/${p.id}`}>
                <div className="aspect-[4/3] overflow-hidden">
                  <Thumbnail
                    url={p.thumbnail_url}
                    label={p.name}
                    category="Storage"
                    rounded="rounded-none"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="font-heading text-base font-medium truncate">{p.name}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    edited {formatDate(p.updated_at || p.created_at)}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => handleDelete(p.id)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                title="Delete project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
