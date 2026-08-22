import { Link, Outlet } from 'react-router-dom';
import { Box } from 'lucide-react';

export default function Layout() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
                            <Box className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="font-semibold text-lg tracking-tight">Roomcast</span>
                    </Link>
                    <nav className="flex items-center gap-6 text-sm text-muted-foreground">
                        <Link to="/" className="hover:text-foreground transition-colors">Search</Link>
                        <Link to="/publish" className="hover:text-foreground transition-colors">Publish a Tour</Link>
                    </nav>
                </div>
            </header>
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}