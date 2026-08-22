export default function MarbleViewer({ worldId }) {
  if (!worldId) {
    return (
      <div className="w-full h-full rounded-xl border border-border/60 bg-muted/20 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No 3D world available.</p>
      </div>
    );
  }

  return (
    <iframe
      src={`https://marble.worldlabs.ai/world/${worldId}`}
      className="w-full h-full rounded-xl border border-border/60"
      allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
      allowFullScreen
      title="3D Tour"
    />
  );
}