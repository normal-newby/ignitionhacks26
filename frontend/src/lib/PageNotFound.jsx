import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="font-heading text-7xl font-light text-muted-foreground/30">404</h1>
        <div className="h-px w-16 bg-border mx-auto my-4" />
        <h2 className="font-heading text-2xl font-medium mb-2">Page not found</h2>
        <p className="text-muted-foreground text-sm mb-6 font-body">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 rounded-md border border-border text-sm font-body font-medium hover:bg-muted transition-colors"
        >
          Go to projects
        </Link>
      </div>
    </div>
  );
}
