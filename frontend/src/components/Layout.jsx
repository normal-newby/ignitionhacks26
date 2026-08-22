import { Link, Outlet } from 'react-router-dom';
import { Boxes } from 'lucide-react';

export default function Layout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-background/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-md bg-ink flex items-center justify-center transition-transform group-hover:scale-105" style={{ backgroundColor: 'hsl(var(--foreground))' }}>
              <Boxes className="w-4 h-4 text-background" style={{ color: 'hsl(var(--background))' }} />
            </div>
            <span className="font-heading text-xl font-semibold tracking-tight">Refurnish</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground font-body">
            <Link to="/" className="hover:text-foreground transition-colors">Rooms</Link>
            <Link to="/catalog" className="hover:text-foreground transition-colors">Catalog</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
