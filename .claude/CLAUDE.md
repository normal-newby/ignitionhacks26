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

Errors come back as `{"detail": "..."}` with a plain 4xx — **not** the operation envelope.
A 422 from step 3 with "Unable to read video keyframes" means the file wasn't a decodable
video. `MarbleClient` unwraps `detail` into a `MarbleException` so that text reaches the
user, rather than a bare status line.

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
  and `model_url` — the catalog is a static frontend list rather than a table, so
  snapshotting keeps a saved layout renderable if the catalog is later reshuffled.

`RoomStatus` is `PENDING → UPLOADING → GENERATING → READY | FAILED`, but
`RoomStatus.wireValue()` collapses that to the three strings the UI switches on:
`processing`, `ready`, `failed`. The detail behind "processing" rides in `progress_message`.

## Storage rules

- Postgres holds metadata only. **Never** store mesh, GLB, or video binaries as `bytea`.
- The room video is spooled to a temp file, streamed to Marble, and deleted. This app never
  keeps it — which is why the processing screen's failure state offers "scan again" rather
  than a retry.
- Mesh binaries stay on World Labs' hosts; we only ever handle URLs.
- The furniture catalog is **static frontend assets**: GLBs and thumbnails under
  `frontend/public/models` and `frontend/public/images`, served with the React build. No
  object storage, no CDN, no catalog table. Keep the total under ~10MB, and lazy-load each
  GLB only when a user adds that item.
- No Render persistent disk. Nothing needs one.

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

All request/response bodies are snake_case, matching what the React pages read.

## Frontend notes

- `src/api/rooms.js` is the only place that talks to the backend. `createRoom` uses XHR
  rather than fetch purely for upload progress — a bare spinner on a 400MB upload reads as
  a hang.
- `src/lib/store.js` is the furniture catalog, and **only** the catalog, in localStorage.
  Rooms and models are server-side. Don't put layout state back in there.
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

The app boots without a Marble key; uploads just fail fast with a clear message instead.

## Known risks

- Marble generation is ~5 minutes. The polling/loading UX exists — keep it working; don't
  regress it into a blocking request.
- Confirm a saved layout survives a page reload before the demo. That round-trip through
  Postgres is what makes this read as a product rather than a client-side toy.
- Source furniture GLBs early (Kenney.nl, Poly Pizza — CC0 packs). Only two catalog entries
  currently have real models; the rest are placeholders. Asset-hunting quietly eats
  hackathon time if left to the end.
