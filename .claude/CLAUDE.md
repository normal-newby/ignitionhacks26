Project: 3D Home Walkthrough

24-hour hackathon build. Upload photos/video of a home → World Labs Marble generates a 3D reconstruction → user gets a walkable 3D tour in the browser, with structured room data (type, est. sqft, condition tags) extracted alongside it.

Stack
Backend: Spring Boot
Database: PostgreSQL (metadata only — see Storage rules below)
Frontend: React + react-three-fiber (GLTF/GLB rendering)
Hosting: Render
3D generation: World Labs Marble API
Scope for this build
Upload flow (photos/video) → trigger Marble generation → poll for completion → render walkable 3D tour.
Structured room data: one vision-LLM pass per uploaded frame → extract room type, estimated sqft, condition tags → persist to Postgres → display in a sidebar next to the 3D viewer.

Nothing else is in scope right now (no listing-page generation, no renovation before/after, no multiplayer, no temporal scans). Don't build toward those unless explicitly asked — they were considered and deferred.

Marble API integration
POST /marble/v1/worlds:generate to start a job → returns an Operation object with done: false.
Poll /marble/v1/operations/{operation_id} until done: true. Generation takes ~5 minutes — this must be a non-blocking, polled UX (loading/progress state), not a synchronous request.
On completion, the response includes hosted URLs for: collider mesh (GLB, ~3-4MB — use this one for the interactive viewer, it's the fast-loading option), high-quality mesh (GLB, ~100-200MB), Gaussian splat files (SPZ, multiple resolutions), thumbnail, panorama, plus AI-generated caption/scale/ground-plane metadata.
World Labs hosts the actual mesh files. Do not download or store mesh binaries in this app. The backend only ever handles the URLs.
Open verification item

Whether Marble's hosted asset URLs are permanent or expire. Test this early: generate one world, wait a few hours, confirm the URL still resolves. If it expires, add a re-hosting step (download on completion → push to S3-compatible storage, e.g. Cloudflare R2 → store your own permanent URL in Postgres instead of Marble's). Do not build this fallback preemptively — only if expiry is confirmed.

Storage rules
Postgres stores metadata only: never store mesh binaries as bytea.
scans table: id, property/user ref, world_id, operation_id, status, collider_mesh_url, high_quality_mesh_url, thumbnail_url, created_at.
rooms table: id, scan_id (FK), room_type, estimated_sqft, condition_tags, created_at.
No Render persistent disk. Not needed — files aren't self-hosted, and disks block horizontal scaling and force downtime on deploy anyway.
Frontend loads GLB directly from Marble's returned URL via react-three-fiber's GLTF loader — this request bypasses the backend entirely.
Known risks
Marble generation (~5 min) means the polling/loading UX needs to be built early, not left for the end.
The bare 3D tour alone isn't very differentiated from existing tools (e.g. Matterport-style walkthroughs) — the room-data sidebar is what's supposed to make this feel like a product rather than a tech demo. Keep it visible and central in the final demo, not a buried feature.
Commands

(fill in once the repo is scaffolded: backend run/build/test commands, frontend dev server, migration commands, required env vars — e.g. MARBLE_API_KEY, DB connection string, Render service config)