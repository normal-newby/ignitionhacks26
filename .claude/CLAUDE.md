# Roomcast — 3D Room Planner

24-hour hackathon build. Upload a video of one room → World Labs Marble reconstructs the
room shell (walls, floor, fixed architecture) → the user browses a small furniture catalog
and adds/moves/rotates/scales/deletes pieces inside the reconstructed room, to visualise a
layout without touching the real room. The layout persists in Postgres, so it survives a
reload.

## Stack

- **Backend:** Spring Boot 4.1 / Java 25, Maven
- **Database:** PostgreSQL on Render (metadata only — see Storage rules)
- **Frontend:** React 18 + Vite, Tailwind, shadcn/ui components, react-router
- **Hosting:** Render, one service. Maven builds the React app and packages `frontend/dist`
  into the jar's `static/`, so Spring serves both the API and the SPA from one origin.
- **3D generation:** World Labs Marble API

## Scope

In scope: upload → generate → poll → open the room in an editor; add catalog furniture and
move/rotate/scale/delete/swap it; layout persists across reloads.

Explicitly **out of scope — do not attempt**:

- Editing or removing objects that are part of the Marble scan (e.g. deleting a couch the
  camera captured). Marble's output is a monolithic fused mesh/splat with no per-object
  structure; decomposing it is an open research problem, not something buildable here. All
  furniture comes from our own catalog and sits *on top of* the scanned shell.
- Room-type / condition labelling via a vision LLM. This was an earlier direction and the
  Gemini integration behind it has been **removed** — don't reintroduce it.
- Property-listing / tour search (address lookup, tags, "similar homes"). Also a previous
  direction, also removed.
- Collision detection between placed items, multi-user auth, real undo/redo history beyond
  the editor's in-memory snapshot stack.

## World Labs Marble API

Base `https://api.worldlabs.ai`, paths under `/marble/v1`. Auth is a **`WLT-Api-Key`
header** — not a bearer token. The key comes from `WORLD_LABS_API_KEY`; note that
`application.properties` maps it explicitly to `marble.api-key`, because relaxed binding
won't bridge names that differ by more than case.

Video upload is three calls, all in `MarbleClient`:

1. `POST /marble/v1/media-assets:prepare_upload` with `{file_name, kind:"video", extension}`
   → `{media_asset:{media_asset_id, ...}, upload_info:{upload_url, upload_method, required_headers}}`.
   The id field is **`media_asset_id`, not `id`** — the published doc example says `id` and
   is wrong; verified against the live API.
2. `PUT` the raw bytes at `upload_url`, echoing back every entry in `required_headers`.
   Right now that's `x-goog-content-length-range: 0,104857600`, which is one of the two
   headers signed into the URL (`host;x-goog-content-length-range`), so it must be sent
   verbatim or the signature fails. Unsigned extras like `Content-Type` are ignored.
   **That range is also the real upload ceiling: 100MB.** The URL is valid for one hour.
   This goes to Google Cloud Storage, not the API, so it uses a **separate RestClient with
   no API key** — see `AppConfig.uploadRestClient`.
3. `POST /marble/v1/worlds:generate` with
   `{display_name, model, world_prompt:{type:"video", video_prompt:{source:"media_asset", media_asset_id}}}`
   → an operation with `done:false`.

Then poll `GET /marble/v1/operations/{operation_id}` until `done:true`. Generation takes
**~5 minutes**, so this is a polled UX end to end: the browser polls our API, and
`RoomPollingService` polls Marble on a fixed interval. Nothing holds a long request open.

The completed operation's `response` carries `assets.mesh.collider_mesh_url` (GLB, ~3-4MB —
this is the base scene the editor loads), `assets.splats.spz_urls.{100k,500k,full_res}`,
`assets.thumbnail_url`, `assets.imagery.pano_url`, `assets.caption`, and
`assets.splats.semantics_metadata.{ground_plane_offset, metric_scale_factor}`.

Use Marble's `ground_plane_offset` as the known floor height for placement — don't try to
detect the floor geometrically from the mesh.

**Open verification item:** whether Marble's hosted asset URLs are permanent or expire.
Test early — generate one world, wait a few hours, confirm the URL still resolves. If it
expires, add a re-hosting step (download on completion → push to S3-compatible storage →
store our own URL). Don't build that fallback preemptively.

## Data model (Postgres, `ddl-auto=update`)

- **`rooms`** — one uploaded video → one Marble world → one furnishable room. Holds `name`,
  `status`, `media_asset_id`, `operation_id`, `world_id`, the asset URLs,
  `ground_plane_offset`, `metric_scale_factor`, `progress_message`, `error_message`,
  timestamps.
- **`models`** — the user-editable layout: one catalog model placed in a room. `room_id` FK,
  many models per room. Carries `catalog_id`, `pos_x/pos_y/pos_z`, `rotation_y` (degrees,
  yaw only), `scale`, plus **denormalised copies** of the catalog entry's `name`, `category`
  and `model_url` — snapshotting keeps a saved layout renderable even if the catalog entry
  behind it is later edited or deleted. Deliberately not an FK to `furniture_catalog`.
- **`furniture_catalog`** — the placeable pieces. `name`, `category`, `model_url` +
  `model_object_key`, `thumbnail_url` + `thumbnail_object_key`, `width_cm/depth_cm/height_cm`,
  `built_in`, `sort_order`. The object keys are kept alongside the URLs because they're what
  a delete needs to clean the bucket. `CatalogSeeder` writes the 14 starter entries on an
  empty table — rows only, no binaries; see Storage rules.

`RoomStatus` is `PENDING → UPLOADING → GENERATING → READY | FAILED`, but
`RoomStatus.wireValue()` collapses that to the three strings the UI switches on:
`processing`, `ready`, `failed`. The detail behind "processing" rides in `progress_message`.

## Storage rules

Postgres stores metadata only: never store mesh or GLB binaries as bytea.

All GLB files (built-in catalog and user uploads) live in MinIO, not bundled as static
frontend assets — this changed once user uploads entered scope. Postgres stores only the
resulting object URL. Everything that touches the bucket goes through `StorageService`.

Two addresses, and they are not interchangeable:

- `MINIO_ENDPOINT` → `minio.endpoint`, what the **backend** dials. On Render use the
  internal/private address (`http://minio-server-byne:9000`): uploads then stay inside
  Render's network. Note the scheme — internal is plain HTTP on port 9000, and the MinIO SDK
  needs a full URL, not a bare `host:port`.
- `MINIO_PUBLIC_URL` → `minio.public-url`, what the **browser** fetches from
  (`https://minio-server-byne.onrender.com`), since the internal name doesn't resolve outside
  Render. Falls back to the endpoint when unset.

In `backend/.env` **both** are the public URL: local dev can't reach the internal address at
all. Only the Render backend service gets the internal one. Getting these backwards is easy
and the symptom is misleading — an internal endpoint fails locally with a DNS error, while a
public endpoint set on Render works but routes every upload out through the internet.

Credentials are `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`, set as env vars on the backend
service and found under the MinIO service's Environment tab. `application.properties` maps
all four explicitly — same relaxed-binding reason as the Marble key.

`StorageService.ensureBucket()` creates the bucket at startup and applies the anonymous-read
policy itself, so the frontend's `useGLTF` can fetch a GLB straight from MinIO with no auth
header. No `mc anonymous set download` step needed. Uploads still require credentials; only
reads are public. Failures there are logged, not fatal — a slow MinIO shouldn't take the API
down with it, and the app boots fine with MinIO absent entirely (uploads then 503 with a
clear message, mirroring how a missing Marble key behaves).

Upload flow: multipart form from React → `CatalogController` → `StorageService` streams to
MinIO in 10MB parts → `CatalogService` writes the `furniture_catalog` row with the public
URL. Presigned-direct-to-MinIO upload is a nice-to-have, not required.

Validation is extension plus declared size — 20MB for models, 5MB for thumbnails, both in
`MinioProperties`. No deep content scanning; the bucket is read-only to the public and the
GLTF loader rejects garbage on its own.

The two real GLBs live in `seed-assets/` at the repo root — **not** in `frontend/public` and
not on the backend classpath. They're 56MB and 33MB, so bundling them would put ~90MB into
every container image for files MinIO already holds permanently. `.dockerignore` excludes
the directory. Attach them once through `/catalog` and they stay attached across deploys.
Note both are over the 20MB upload cap as-is and need decimating first.

## API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/rooms` | multipart `video` + `name`; returns immediately, status `processing` |
| `GET` | `/api/rooms` | project grid |
| `GET` | `/api/rooms/{id}` | status, asset URLs, ground-plane offset, **and** the saved layout |
| `PATCH` | `/api/rooms/{id}` | rename |
| `DELETE` | `/api/rooms/{id}` | delete room (cascades to its models) |
| `GET`/`POST` | `/api/rooms/{id}/models` | list / add a placed model |
| `DELETE` | `/api/rooms/{id}/models` | clear the layout ("reset room") |
| `PATCH` | `/api/models/{id}` | update transform — partial, nulls mean "leave alone" |
| `DELETE` | `/api/models/{id}` | remove one placed model |
| `GET` | `/api/catalog` | the furniture catalog, grouped-order by category |
| `GET` | `/api/catalog/categories` | the fixed category list |
| `POST` | `/api/catalog` | multipart `name`/`category`/`width`/`depth`/`height` + optional `model` and `thumbnail` files |
| `PATCH` | `/api/catalog/{id}` | multipart, partial — omitted fields and omitted files both mean "leave alone" |
| `DELETE` | `/api/catalog/{id}` | remove the entry and its MinIO objects |

All request/response bodies are snake_case, matching what the React pages read.

## Frontend notes

- `src/api/rooms.js` and `src/api/catalog.js` are the only places that talk to the backend.
  `createRoom` and the catalog writes use XHR rather than fetch purely for upload progress —
  a bare spinner on a 400MB upload reads as a hang.
- Nothing is in localStorage. `src/lib/store.js` held the catalog and is **gone**; rooms,
  models and the catalog are all server-side. Don't put any of it back there.
- `Editor.jsx` owns the catalog fetch and passes the list into `CatalogPanel` as a prop,
  because adding an item needs the same list to resolve a catalog id into the name, category
  and model URL it snapshots onto the placed model.
- The editor debounces transform writes ~500ms per model id, so a drag is one PATCH.
- `#splat-viewport` in `components/editor/Viewport.jsx` is the reserved mount point for the
  3D renderer, which is **not built yet**. The collider mesh URL, splat URL, ground-plane
  offset and metric scale factor are already on that element as `data-*` attributes, so
  wiring a renderer in means reading them, not re-plumbing state.
- The `@/` import alias is declared in `vite.config.js` (it used to come from the base44
  plugin, which has been removed).

## Commands

```bash
# Frontend dev server (proxies /api to localhost:8080)
npm --prefix frontend run dev

# Frontend production build + lint
npm --prefix frontend run build
npm --prefix frontend run lint

# Backend (from backend/). The frontend-maven-plugin builds React into the jar on `package`;
# skip it while iterating on Java.
mvn spring-boot:run -Dskip.installnodenpm -Dskip.npm
mvn -B -ntp compile -DskipTests -Dskip.installnodenpm -Dskip.npm
mvn -B -ntp package -DskipTests    # full build, including the React bundle

# Container build (what Render runs)
docker build -t roomcast .
```

## Environment

`backend/.env` is imported by `application.properties` in local dev; Render supplies the
same names as real env vars.

- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`
- `WORLD_LABS_API_KEY` — and `WORLD_LABS_API_KEY_TEST` alongside it for test generations
- `MINIO_ENDPOINT`, `MINIO_PUBLIC_URL`, `MINIO_BUCKET` (defaults to `furniture`),
  `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` — see Storage rules for which URL goes where

The app boots without a Marble key or MinIO; the corresponding uploads just fail fast with a
clear message instead.

## Known risks

- Marble generation is ~5 minutes. The polling/loading UX exists — keep it working; don't
  regress it into a blocking request.
- Confirm a saved layout survives a page reload before the demo. That round-trip through
  Postgres is what makes this read as a product rather than a client-side toy.
- Source furniture GLBs early (Kenney.nl, Poly Pizza — CC0 packs). **No catalog entry has a
  model attached yet** — the seeder writes rows only, and the two GLBs in `seed-assets/` are
  56MB and 33MB, over the 20MB cap and far too heavy for the editor regardless. Decimate them
  (gltf-transform / gltfpack) and upload via `/catalog`. Asset-hunting quietly eats hackathon
  time if left to the end.
