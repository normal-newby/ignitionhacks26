import { Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';

const POPULAR_TAGS = [
  'Hardwood Floors',
  'Renovated Kitchen',
  'Backyard',
  'Garage',
  'Swimming Pool',
  'Move-in Ready',
  'Open Floor Plan',
  'Natural Light',
];

export default function Landing() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <div className="relative max-w-2xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-card text-xs text-muted-foreground mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          3D home tours
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4 leading-tight">
          Tour any home in 3D<br />before you visit
        </h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
          Enter an address to check if a 3D tour is available. Walk through every room remotely.
        </p>
        <SearchBar />
        <p className="text-xs text-muted-foreground/60 mt-4">
          Try:{' '}
          <Link
            to="/tour?address=123%20Maple%20Street%2C%20Portland%2C%20OR"
            className="underline hover:text-foreground transition-colors"
          >
            123 Maple Street, Portland, OR
          </Link>
        </p>
        <div className="mt-10">
          <p className="text-sm text-muted-foreground mb-3">Or browse by tag:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {POPULAR_TAGS.map((tag) => (
              <Link
                key={tag}
                to={`/tour?tag=${encodeURIComponent(tag)}`}
                className="text-sm px-3.5 py-1.5 rounded-full border border-border bg-card text-foreground/70 hover:border-primary hover:text-primary transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}