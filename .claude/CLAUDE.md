Project: 3D Room Planner

24-hour hackathon build. Upload photos/video of a room → World Labs Marble generates a 3D reconstruction of the room shell (walls, floor, fixed architecture) → user browses a small furniture catalog and adds/moves/removes/swaps pieces inside the reconstructed room to visualize it without changing the real room.

Stack
Backend: Spring Boot
Database: PostgreSQL (metadata only — see Storage rules below)
Frontend: React + react-three-fiber (GLTF/GLB rendering, drei's TransformControls for move/rotate/scale)
Hosting: Render
3D generation: World Labs Marble API
Scope for this build
Upload flow (photos/video) → trigger Marble generation → poll for completion → render the room shell as a walkable/viewable 3D scene.
Furniture placement: a small fixed catalog (5-10 items, 3-4 categories) the user can add into the scene, then move/rotate/scale/delete/swap. Layout persists across reloads.

Explicitly out of scope — do not attempt: editing or removing objects that are actually part of the Marble-reconstructed scan (e.g. deleting a couch the camera captured). Marble's output is a monolithic fused mesh/splat with no per-object structure — decomposing that into individually editable objects is an open research problem (see WorldAct paper, arXiv 2605.15843), not something buildable here. All "furniture" in this app is from our own catalog, placed on top of the scanned shell — never extracted from it.

Also out of scope: room-type/condition labeling via vision LLM (considered as an earlier direction, deprioritized in favor of this), collision detection between placed items, undo/redo history, multi-user auth beyond whatever minimal session ownership already exists.

Marble API integration
POST /marble/v1/worlds:generate to start a job → returns an Operation object with done: false.
Poll /marble/v1/operations/{operation_id} until done: true. Generation takes ~5 minutes — build this as a non-blocking, polled UX (loading/progress state), not a synchronous request.
On completion, the response includes hosted URLs for: collider mesh (GLB, ~3-4MB — use this one as the base scene, it's the fast-loading option and you're layering furniture models on top of it), high-quality mesh (GLB, ~100-200MB, not used in this build), Gaussian splat files (SPZ), thumbnail, panorama, plus AI-generated caption/scale/ground-plane offset metadata.
World Labs hosts the actual mesh files. Do not download or store mesh binaries in this app. The backend only ever handles the URLs.
Use the ground-plane offset value from Marble's response as the known floor height for placement raycasting — don't try to geometrically detect the floor from the mesh.
Open verification item

Whether Marble's hosted asset URLs are permanent or expire. Test early: generate one world, wait a few hours, confirm the URL still resolves. If it expires, add a re-hosting step (download on completion → push to S3-compatible storage → store your own permanent URL). Don't build this fallback preemptively.

Data model (Postgres)
scans: id, property/user ref, world_id, operation_id, status, collider_mesh_url, high_quality_mesh_url, thumbnail_url, ground_plane_offset, created_at.
furniture_catalog: id, name, category, model_url, thumbnail_url, default_scale. Static reference data — seed once via data.sql / migration, no admin UI, no dynamic write path.
placements: id, scan_id (FK), furniture_id (FK), position (x/y/z), rotation, scale, created_at, updated_at. This is the user-editable layout.
Storage rules
Postgres stores metadata only: never store mesh or GLB binaries as bytea.
Furniture catalog files (GLB models + thumbnails) are static assets bundled in the React app's public/ folder (e.g. public/models/sofa-01.glb), served directly off Render with the frontend build. No object storage, no CDN — overkill for a fixed 5-10 item catalog. Keep total catalog size under ~10MB; lazy-load each GLB via useGLTF only when a user adds that item, not on catalog list render.
No Render persistent disk. Not needed for either the room mesh (Marble-hosted) or the furniture catalog (static frontend assets).
API surface (Spring Boot)
POST /scans — upload photos/video, trigger Marble generation.
GET /scans/{id} — status, mesh URLs, ground-plane offset, current placements.
GET /furniture-catalog — list available items.
POST /scans/{id}/placements — add a placed item {furnitureId, position, rotation, scale}.
PATCH /placements/{id} — update transform (debounce frontend calls, ~500ms after drag ends).
DELETE /placements/{id} — remove a placed item.
Known risks
Marble generation (~5 min) means the polling/loading UX needs to be built early, not left for the end.
Test that a saved layout actually survives a page reload before the demo — that round-trip through Postgres is what makes this read as a real product instead of a client-side toy.
Source furniture GLBs early (Kenney.nl, Poly Pizza — CC0 packs), not last. Asset-hunting quietly eats hackathon time if left to the end.
Commands

(fill in once the repo is scaffolded: backend run/build/test commands, frontend dev server, migration commands, required env vars — e.g. MARBLE_API_KEY, DB connection string, Render service config)