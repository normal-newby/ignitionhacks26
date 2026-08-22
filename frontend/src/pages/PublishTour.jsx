import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TagInput from '@/components/TagInput';
import { publishTour } from '@/api/tours';
import { Upload, Loader2, ArrowLeft } from 'lucide-react';

export default function PublishTour() {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [searchTags, setSearchTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!address.trim() || !videoFile) return;
    setSubmitting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: videoFile });
      const result = await publishTour({
        address: address.trim(),
        video_url: file_url,
        search_tags: searchTags,
        estimated_value: estimatedValue ? Number(estimatedValue) : null,
      });
      navigate(
        `/processing?id=${result.tour_id}&address=${encodeURIComponent(address.trim())}`
      );
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to search
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Publish a 3D tour</h1>
      <p className="text-muted-foreground mb-8">
        Upload a video walk-through of the property. We'll generate an interactive 3D world from your footage.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-2">
          <Label>Property address</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Maple Street, Portland, OR 97201"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Video walk-through</Label>
          <div className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              className="hidden"
              id="video-upload"
            />
            <label htmlFor="video-upload" className="cursor-pointer block">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">
                {videoFile ? videoFile.name : 'Click to upload a video'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">MP4, MOV, or WebM</p>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Search tags</Label>
          <TagInput
            tags={searchTags}
            onChange={setSearchTags}
            placeholder="e.g. hardwood floors, backyard, renovated"
          />
          <p className="text-xs text-muted-foreground">
            Add tags to help buyers find this tour. Press Enter to add each tag.
          </p>
        </div>

        <div className="space-y-2">
          <Label>
            Estimated value <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            type="number"
            min="0"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="e.g. 525000"
          />
        </div>

        <Button
          type="submit"
          disabled={submitting || !address.trim() || !videoFile}
          className="w-full"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Publishing...
            </>
          ) : (
            'Publish tour'
          )}
        </Button>
      </form>
    </div>
  );
}