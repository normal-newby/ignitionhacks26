import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchTourByAddress, searchToursByTag, searchSimilarTours } from '@/api/tours';
import MarbleViewer from '@/components/MarbleViewer';
import SearchBar from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { MapPin, Box, ArrowRight, Loader2, Clock, ArrowLeft, Tag } from 'lucide-react';

export default function TourView() {
  const [searchParams] = useSearchParams();
  const address = searchParams.get('address') || '';
  const tag = searchParams.get('tag') || '';
  const [loading, setLoading] = useState(true);
  const [tour, setTour] = useState(null);
  const [tagResults, setTagResults] = useState([]);
  const [similarTours, setSimilarTours] = useState([]);

  useEffect(() => {
    setLoading(true);
    if (address) {
      Promise.all([
        searchTourByAddress(address),
        searchSimilarTours(address),
      ])
        .then(([t, similar]) => {
          setTour(t);
          setSimilarTours(similar);
          setLoading(false);
        })
        .catch(() => {
          setTour(null);
          setSimilarTours([]);
          setLoading(false);
        });
    } else if (tag) {
      searchToursByTag(tag)
        .then((results) => {
          setTagResults(results);
          setLoading(false);
        })
        .catch(() => {
          setTagResults([]);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [address, tag]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!address && !tag) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20">
        <SearchBar />
      </div>
    );
  }

  // Tag filter view
  if (tag && !address) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to search
        </Link>
        <div className="flex items-center gap-2 mb-6">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight">
            Tours tagged &ldquo;{tag}&rdquo;
          </h1>
        </div>
        {tagResults.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center">No tours found with this tag.</p>
        ) : (
          <div className="space-y-3">
            {tagResults.map((t) => (
              <Link
                key={t.id}
                to={`/tour?address=${encodeURIComponent(t.address)}`}
                className="block border border-border/60 rounded-xl p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{t.address}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(t.search_tags || []).map((tagName) => (
                    <span
                      key={tagName}
                      className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                    >
                      {tagName}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Single tour view
  const isPublished = tour && tour.status === 'published';
  const isProcessing = tour && tour.status === 'processing';
  const isFailed = tour && tour.status === 'failed';

  if (!tour || isFailed) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>{address}</span>
          </div>
        </div>
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5">
            <Box className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">
            {isFailed ? 'Tour generation failed' : 'No 3D tour available for this address'}
          </h2>
          <p className="text-muted-foreground max-w-md mb-8">
            {isFailed
              ? 'The 3D world could not be generated from the uploaded video. Please try again.'
              : "The homeowner hasn't published a 3D tour yet. If you own this property, you can publish one in minutes."}
          </p>
          {!isFailed && (
            <Button asChild>
              <Link to="/publish">
                Publish a tour <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          )}
        </div>
        {!isFailed && similarTours.length > 0 && (
          <div className="mt-8 border-t border-border/60 pt-8">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Similar tours in this area
            </h3>
            <div className="space-y-3">
              {similarTours.map((t) => (
                <Link
                  key={t.id}
                  to={`/tour?address=${encodeURIComponent(t.address)}`}
                  className="block border border-border/60 rounded-xl p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{t.address}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(t.search_tags || []).map((tagName) => (
                      <span
                        key={tagName}
                        className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                      >
                        {tagName}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>{address}</span>
          </div>
        </div>
        <div className="flex flex-col items-center text-center py-12">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5">
            <Clock className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">
            This 3D tour is being prepared
          </h2>
          <p className="text-muted-foreground max-w-md mb-8">
            The homeowner has uploaded footage and the 3D world is being generated. Check back soon.
          </p>
          {tour.id && (
            <Button asChild variant="outline">
              <Link to={`/processing?id=${tour.id}&address=${encodeURIComponent(address)}`}>
                View progress
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Published tour
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span>{tour.address}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">3D Tour</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="aspect-[4/3] lg:aspect-[16/10] w-full">
            <MarbleViewer worldId={tour.world_id} />
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="border border-border/60 rounded-xl bg-card h-full min-h-[400px] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border/60">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tags
              </h2>
            </div>
            <div className="flex-1 p-5">
              {tour.search_tags && tour.search_tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tour.search_tags.map((tagName) => (
                    <Link
                      key={tagName}
                      to={`/tour?tag=${encodeURIComponent(tagName)}`}
                      className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {tagName}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tags added.</p>
              )}
            </div>
            {tour.estimated_value != null && tour.estimated_value !== '' && (
              <div className="px-5 py-4 border-t border-border/60">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Estimated Value
                </p>
                <p className="text-lg font-medium tabular-nums text-muted-foreground">
                  ${Number(tour.estimated_value).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}