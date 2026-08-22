import { Link } from 'react-router-dom';

export default function PageNotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm font-medium tracking-widest text-muted-foreground">404</p>
            <h1 className="text-3xl font-semibold">Page not found</h1>
            <p className="text-muted-foreground">
                That page doesn&apos;t exist or has been moved.
            </p>
            <Link to="/" className="mt-2 text-sm font-medium underline underline-offset-4">
                Back to home
            </Link>
        </div>
    );
}
