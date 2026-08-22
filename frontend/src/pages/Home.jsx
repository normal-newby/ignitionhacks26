import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Trash2, Loader2 } from 'lucide-react';
import { listRooms, deleteRoom } from '@/api/rooms';
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
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    listRooms()
      .then((data) => !cancelled && setRooms(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (e, id) => {
    // The card is a link; deleting shouldn't also navigate into it.
    e.preventDefault();
    e.stopPropagation();
    const previous = rooms;
    setRooms((current) => current.filter((r) => r.id !== id));
    try {
      await deleteRoom(id);
    } catch (err) {
      setRooms(previous);
      setError(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header row */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#252525]">
            SCANNED ROOMS
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-terminal text-[#5a6c80]">
            Film your room and bring it to life!
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-none bg-[#3b82f6] text-white font-terminal text-sm font-medium hover:opacity-90 transition-opacity border-2 border-[#1e40af] shadow-[2px_2px_0px_#1e40af] hover:shadow-[1px_1px_0px_#1e40af] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
>
          <Plus className="w-4 h-4" />
          SCAN
        </button>
      </div>

      {error && (
        <p className="mb-6 text-sm text-destructive font-terminal">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-none bg-[#e2e8f0] border-2 border-[#1e40af] flex items-center justify-center mb-5 shadow-[4px_4px_0px_#1e40af]">
            <Plus className="w-7 h-7 text-[#3b82f6]" />
          </div>
          <h2 className="font-heading text-xl font-medium mb-2 text-[#252525]">
            NO ROOMS YET
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm font-terminal text-[#5a6c80] mb-6">
            Upload a short video scan of a room and we'll turn it into an
            interactive 3D scene you can furnish.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-none bg-[#3b82f6] text-white font-terminal text-sm font-medium hover:opacity-90 transition-opacity border-2 border-[#1e40af] shadow-[2px_2px_0px_#1e40af] hover:shadow-[1px_1px_0px_#1e40af] active:shadow-none active:translate-x-0.5 active:translate-y-0.5"
>
            UPLOAD YOUR FIRST ROOM
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="group relative bg-[#e2e8f0] rounded-none border-2 border-[#1e40af] overflow-hidden hover:border-[#3b82f6] transition-colors shadow-[4px_4px_0px_#1e40af] hover:shadow-[6px_6px_0px_#1e40af]"
            >
              <Link to={room.status === 'ready' ? `/editor/${room.id}` : `/processing/${room.id}`}>
                <div className="aspect-[4/3] overflow-hidden border-b-2 border-[#1e40af]">
                  {/* Marble's own thumbnail once the world exists, placeholder before that. */}
                  <Thumbnail
                    url={room.thumbnail_url}
                    label={room.name}
                    category="Storage"
                    rounded="rounded-none"
                  />
                </div>
                <div className="p-4 bg-[#cbd5e1]">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="font-heading text-base font-medium truncate text-[#252525]">
                      {room.name}
                    </h3>
                    <StatusBadge status={room.status} className="border-2 border-[#1e40af]" />
                  </div>
                  <p className="text-xs text-[#5a6c80] font-terminal">
                    edited {formatDate(room.updated_at || room.created_at)}
                  </p>
                </div>
              </Link>
              <button
                onClick={(e) => handleDelete(e, room.id)}
                className="absolute top-2 right-2 p-1.5 rounded-none bg-[#e2e8f0]/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#3b82f6] hover:text-white border-2 border-[#1e40af]"
                title="Delete room"
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
