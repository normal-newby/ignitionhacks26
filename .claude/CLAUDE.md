# Refurnish — 3D Room Planner

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
  Gemini integration behind it has been **removed** — don't reintroduce it. Gemini *is* back
  for one narrow job, catalog dimension estimates (see below), and that's the whole of it:
  nothing infers anything about a scanned room.
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

Operations stay readable after they finish, which is what `SplatBackfillService` relies on: at
startup it re-reads the operation for any READY room missing `splat_url_full_res` and stores
the tiers it finds. That's the recovery path for rooms generated before all three were kept —
no regeneration, no 5-minute wait. It's guarded by that null check, so it does nothing once
filled and makes no Marble calls on a normal boot; verified by restarting.

The completed operation's `response` carries `assets.mesh.collider_mesh_url` (GLB, ~3-4MB —
this is the base scene the editor loads), `assets.splats.spz_urls.{100k,500k,full_res}`,
`assets.thumbnail_url`, `assets.imagery.pano_url`, `assets.caption`, and
`assets.splats.semantics_metadata.{ground_plane_offset, metric_scale_factor}`.

**`ground_plane_offset` does not describe the collider mesh.** On the test scan the mesh's
floor sits at 1.719 metric while the offset reads 1.610 — 11cm out, enough to leave furniture
hovering. It ships under `assets.splats.semantics_metadata`, so it most likely describes a
frame that isn't quite the mesh's. `RoomShell` measures the floor off the mesh's own `Box3`
instead (the **max**, since the frame is Y-down — see the renderer section) and keeps the
offset only as a fallback for a mesh with no usable bounds. `metric_scale_factor` *is*
trustworthy: 3.262 native units × 0.862 = a 2.81m floor-to-ceiling room, which is right.

**Open verification item:** whether Marble's hosted asset URLs are permanent or expire.
Test early — generate one world, wait a few hours, confirm the URL still resolves. If it
expires, add a re-hosting step (download on completion → push to S3-compatible storage →
store our own URL). Don't build that fallback preemptively.

## Accounts and ownership

Everything except the landing page and the login screen requires an account. This is
**identity, not security** — the whole session is an `X-User-Id` header carrying the user's
UUID, and a UUID is not a secret, so anyone who knows another account's id can send it. That's
deliberate and it's what "don't worry about authentication" bought. The ownership rules exist
to keep one person's rooms out of another person's grid, not to withstand a forged header.
Replacing it with a signed token is a change to `CurrentUserResolver` plus what the frontend
stores from `/api/auth/*`; nothing downstream cares where its `UserEntity` came from.

Passwords are BCrypt-hashed anyway, via **`spring-security-crypto` — not
`spring-boot-starter-security`**. The starter would install a filter chain over every endpoint
in the app; the crypto artifact alone carries no autoconfiguration at all. Don't "upgrade" to
the starter without meaning to.

- `@CurrentUser UserEntity` on a controller parameter is how a handler gets the caller.
  `CurrentUserResolver` reads the header, loads the user, and 401s when it's missing or
  unknown; `WebConfig` registers it. `required = false` makes the parameter nullable instead.
- **Rooms are owner-scoped everywhere.** List, read, rename, delete, and every `/models`
  endpoint under a room. Someone else's room id answers **404, not 403** — a 403 would confirm
  the room exists, which the asker has no claim to. `/api/models/{id}` inherits the room's
  owner; a placed model has none of its own.
- **Rooms scanned before accounts existed have `owner_id` null and are visible to nobody.**
  The null check in `RoomService.ownedBy` is what makes that true rather than the opposite; a
  null owner matching every user would show everyone's rooms to everyone.
- **The catalog has three kinds of row, and the difference is entirely the owner column.**
  Built-in entries have no owner, are always public, and are **read-only to everyone** — they
  ship with the app and every account's rail is built on them, so one person renaming or
  deleting one would change what everybody else sees. Uploads belong to their uploader;
  `is_public` decides whether anyone else sees them at all. Making a piece public lets others
  *place* it, never rename or delete it. Both refusals are 403, with different messages,
  because "that's not yours" and "that's nobody's" are different situations.

  Built-ins were editable by anyone up to Aug 2026, on the reasoning that attaching their GLBs
  was shared setup work. That work is finished — all 16 have models — and the reasoning expired
  with it. **Nothing in the UI can attach a GLB to a built-in row now**; a new one has to come
  from `CatalogSeeder` or the database.
- `CatalogItemResponse` computes **`mine`, `editable` and `built_in` per request**, not from
  storage. `editable` currently equals `mine`, and is still a separate field on purpose: "did I
  upload it" and "may I change it" are different questions that have already diverged once, so
  keeping them apart makes a future rule change one line in `requireEditable` plus one in the
  DTO, with no frontend edit. That's also why the frontend must not re-derive it — it used to
  compute `mine || built_in` and **got it wrong on rows with no owner and a false `built_in`
  column**, which is what a database predating the seeder's flag is full of.
  `CatalogAdmin.canEdit` just reads `item.editable`.
- For the same reason `built_in` on the *response* means "has no owner", not the value of the
  stored column. "Belongs to the app" is what the UI needs and what the permission check keys
  off; the stored flag is only ever true for rows the seeder wrote.

## Data model (Postgres, `ddl-auto=update`)

- **`users`** — `username` (unique, stored lower-cased), `display_name`, `password_hash`,
  `created_at`. Nothing else; there is no role, no email, no verification.
- **`rooms`** — one uploaded video → one Marble world → one furnishable room. Holds `owner_id`,
  `name`, `status`, `media_asset_id`, `operation_id`, `world_id`, the asset URLs,
  `ground_plane_offset`, `metric_scale_factor`, `progress_message`, `error_message`,
  timestamps. All three SPZ tiers are stored (`splat_url` = 500k, plus `splat_url_100k` and
  `splat_url_full_res`) because **the tiers have unrelated file names** — full_res is
  `<a-different-uuid>_ceramic.spz`, not the 500k URL with a suffix swapped, and guessing 404s.
  Without keeping them the only route back to a higher tier is re-reading the operation.
  `splat_url_100k` is stored but not yet exposed on `RoomResponse`; nothing consumes it.
- **`models`** — the user-editable layout: one catalog model placed in a room. `room_id` FK,
  many models per room. Carries `catalog_id`, `pos_x/pos_y/pos_z` (metres, `pos_y` = height
  above the floor, since `RoomShell` puts the scanned floor on y=0), `rotation_y` (degrees,
  yaw only), `scale`, plus **denormalised copies** of the catalog entry's `name`, `category`
  and `model_url` — snapshotting keeps a saved layout renderable even if the catalog entry
  behind it is later edited or deleted. Deliberately not an FK to `furniture_catalog`.
- **`furniture_catalog`** — the placeable pieces. `owner_id`, `is_public`, `name`, `category`,
  `model_url` + `model_object_key`, `thumbnail_url` + `thumbnail_object_key`,
  `width_cm/depth_cm/height_cm`, `built_in`, `sort_order`. The object keys are kept alongside
  the URLs because they're what a delete needs to clean the bucket. `CatalogSeeder` writes the
  14 starter entries on an empty table — rows only, no binaries; see Storage rules.

  Two things about `is_public` are there for `ddl-auto=update` on a database that already has
  rows, and both look redundant on a fresh one. The column carries an explicit
  `columnDefinition = "boolean not null default false"` because Postgres refuses a plain
  `add column ... not null` when there's existing data to fill. And `CatalogSeeder` marks every
  owner-less row public on a non-empty table, because the new column defaults to false and an
  owner-less private row belongs to nobody and so shows up for nobody — the 14 seeded pieces
  would silently vanish from every account's rail. Both are idempotent.
- `owner` is **eager on `CatalogItemEntity` and lazy on `RoomEntity`**, which is not an
  oversight: every catalog read serialises the owner's display name, so `findVisibleTo`
  join-fetches it and the whole rail is still one query. A room's owner is only ever compared
  inside a transaction and never serialised.

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

The internal hostname is **not** derivable from the public one. `minio-server-byne.onrender.com`
carries a random suffix Render adds for global uniqueness; the internal name is the service's
own name, and the internal port is whatever MinIO binds (a Render web service must listen on
`$PORT`, typically 10000, not MinIO's default 9000). Read both off the service's Connect panel
rather than guessing. Guessing produces `UnknownHostException: minio-server-byne`, which
`StorageService.storageFailureMessage` now translates into something that names the cause.

`ensureBucket()` logs the same failure at startup, so a bad endpoint is visible in the deploy
log before anyone tries an upload — check there first.

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

Every path below except `/api/auth/register` and `/api/auth/login` needs the `X-User-Id`
header and answers 401 without it.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | `{username, password, display_name?}` → the account; signs in |
| `POST` | `/api/auth/login` | `{username, password}` → the account |
| `GET` | `/api/auth/me` | confirms a stored session still resolves |
| `POST` | `/api/rooms` | multipart `video` + `name`; returns immediately, status `processing` |
| `GET` | `/api/rooms` | project grid — the caller's rooms only |
| `GET` | `/api/rooms/{id}` | status, asset URLs, ground-plane offset, **and** the saved layout |
| `PATCH` | `/api/rooms/{id}` | rename |
| `DELETE` | `/api/rooms/{id}` | delete room (cascades to its models) |
| `GET`/`POST` | `/api/rooms/{id}/models` | list / add a placed model |
| `DELETE` | `/api/rooms/{id}/models` | clear the layout ("reset room") |
| `PATCH` | `/api/models/{id}` | update transform — partial, nulls mean "leave alone" |
| `DELETE` | `/api/models/{id}` | remove one placed model |
| `GET` | `/api/catalog` | everything public plus the caller's own private uploads, grouped-order by category; each item carries `mine` and `is_public` |
| `GET` | `/api/catalog/categories` | the fixed category list |
| `POST` | `/api/catalog` | multipart `name`/`category`/`width`/`depth`/`height`/`is_public` + optional `model` and `thumbnail` files |
| `POST` | `/api/catalog/estimate-dimensions` | multipart `name` + optional `category`/`thumbnail`; AI guess at real-world size, saves nothing |
| `PATCH` | `/api/catalog/{id}` | multipart, partial — omitted fields and omitted files both mean "leave alone" |
| `DELETE` | `/api/catalog/{id}` | remove the entry and its MinIO objects |

All request/response bodies are snake_case, matching what the React pages read.

## Dimension estimates (Gemini)

`DimensionEstimator` guesses a catalog item's real-world size from its name, its category and —
when the admin has just picked one — its thumbnail, sent inline as base64. It exists because
`PlacedModel` scales every GLB so its height matches `height_cm`: the catalog dimensions are
what size a model on screen, and an entry left at the default 50×50×50 renders a 50cm sofa.

The estimate is **never persisted from the estimator**. It comes back to the catalog form, the
admin sees it alongside the model's one-line note about what it assumed, and the ordinary
create/update write is what saves it. Values are rounded and clamped to 1–10000cm so an
estimate is always something `CatalogService` will accept.

Verified against the live API, not assumed:

- **`gemini-2.5-flash` is gone** — the API answers "no longer available to new users" and
  names `gemini-3.6-flash` as the replacement. That's the default in `GeminiProperties`.
- **Thinking is configured as `thinkingConfig: {"thinkingLevel": "low"}`.** The 2.5-era
  `{"thinkingBudget": 0}` is a flat 400 on 3.x, and `thinkingLevel` beside `thinkingConfig`
  rather than inside it is a second 400. Low, not off: off isn't offered, and the admin is
  watching a spinner.
- The reply is pinned to a `responseSchema` with `responseMimeType: application/json`. Asking
  for JSON in the prompt alone gets a code fence or units inside the numbers often enough to
  matter.
- Auth is an `x-goog-api-key` header rather than `?key=`, which would put the secret in every
  access log between here and Google.
- Inline images must be PNG, JPEG or WebP. AVIF is accepted by the catalog's thumbnail upload
  but rejected here with a message saying so.

Only a freshly picked thumbnail is sent as a reference. One already attached to the row lives
in MinIO, and round-tripping it through the browser to re-upload it is a lot of bytes for a
hint.

## Theme and type

Blue/grey pixel-art. Colour tokens live in `index.css` as HSL vars and are wired into Tailwind,
and **`--radius: 0rem`**, so every `rounded-*` utility in the app already renders square — no
need to strip them. Depth comes from `border-2 border-[#1e40af]` plus an offset hard shadow
(`shadow-[2px_2px_0px_#1e40af]`), not from blur.

The palette as used in the components: `#1e40af` borders, `#3b82f6` primary/active, `#5a6c80`
secondary and muted text, `#e2e8f0` panels, `#cbd5e1` recessed backgrounds, `#252525` body text,
`#ef4444` destructive, `#10b981` success.

**Three pixel faces, one way to reach each.** `index.html` loads Press Start 2P, VT323 and Space
Mono; `index.css` maps them onto the font vars:

| Utility | Face | For |
| --- | --- | --- |
| `font-heading` / `font-display` | Press Start 2P | headings, short uppercase labels |
| `font-body` / `font-mono` | Space Mono | body and data text |
| `font-terminal` | VT323 | buttons |

Those vars used to name **`JetBrains Mono`, which is not loaded anywhere** — so every
`font-heading`/`font-body`/`font-mono` in the app silently fell through to the system monospace,
and the only way anything got a pixel face was an inline `style={{ fontFamily: ... }}` on the
element. That is why those inline styles existed; they have all been replaced by the utilities
above, and there should be no `fontFamily` in JSX. Naming a font inline again would put the app
straight back into two competing mechanisms.

**Press Start 2P draws about half again as wide as a normal mono at the same size**, and has no
lowercase worth reading. Anything switched onto `font-heading` needs its `text-*` stepped down
at the same time — that is why the viewfinder labels are `text-[8px]` and the top bar's room
name is `text-xs`. It is also why the viewport's bottom-centre controls hint is `hidden
xl:block`: the catalog rail and inspector take a fixed ~580px, so below 1280 the viewport pane
is under 400px and that one line stacked seven rows deep over the room.

There is **no export button**. It has been removed twice — once on request, and once after a UI
commit reinstated the markup without the `onExport` prop or the `Share2` import, which is a
render-time `ReferenceError` that takes the whole editor page down with it. `Editor.jsx` has no
export handler at all, so re-adding the button means writing one first.

## Frontend notes

- `src/api/rooms.js`, `src/api/catalog.js` and `src/api/auth.js` are the only places that talk
  to the backend. `createRoom` and the catalog writes use XHR rather than fetch purely for
  upload progress — a bare spinner on a 400MB upload reads as a hang. The XHR paths have to set
  the auth header themselves; `authHeaders()` is spread into both.
- **The signed-in account is the only thing in localStorage**, under `refurnish.session`, and
  `src/api/session.js` is the only module that touches it. Rooms, models and the catalog stay
  server-side — `src/lib/store.js` held the catalog and is **gone**. Don't put any of that
  back. The session is the one exception because it has nowhere else to live: the backend's
  notion of who is asking *is* the header, so the browser has to remember what to send.
- A 401 from any api module calls `handleUnauthorized()`, which clears the session and fires
  a `refurnish:signed-out` event. The api modules aren't React and can't route anywhere;
  `AuthProvider` listens, and `RequireAuth` does the redirecting. One place decides where a
  dead session lands.
- **Routing is two tiers.** `/` and `/login` are public; everything else sits behind
  `RequireAuth`. The project grid moved from `/` to **`/rooms`** so the front door could be a
  landing page — `LandingOrRooms` renders the pitch signed out and redirects to `/rooms`
  signed in, and both it and `RequireAuth` wait out `checking` rather than rendering, so a
  hard reload doesn't flash the login screen at someone who is already signed in. Any new
  client route also needs adding to `SpaController`, or a hard reload on it 404s.
- `Layout` is signed-in chrome only, rendered inside `RequireAuth`, so `user` is always set
  there and the account chip needs no fallback. `Landing` carries its own header because its
  destinations are different.
- **Two catalog surfaces, both with search + category filter, and they are not the same
  component.** `CatalogPanel` is the editor's rail (drag a card into the room);
  `CatalogAdmin` is the `/catalog` page (a table, plus the owner filter and the upload form).
  They filter the same server list independently — don't try to share the filter state. On the
  admin page the three filters compose, and the owner tab counts come off the *searched* list
  rather than the whole catalog, so a tab reading 0 means "nothing here matches what you typed"
  instead of contradicting the rows on screen.
- `Editor.jsx` owns the catalog fetch and passes the list into `CatalogPanel` as a prop,
  because adding an item needs the same list to resolve a catalog id into the name, category
  and model URL it snapshots onto the placed model.
- The editor debounces transform writes ~500ms per model id, so a drag is one PATCH.
- The 3D renderer lives in `components/editor/scene/` (react-three-fiber + drei). `Viewport`
  is now just the chrome around `RoomScene`; the old `#splat-viewport` div and its `data-*`
  attributes are gone, since props carry all of it.
- The `@/` import alias is declared in `vite.config.js` (it used to come from the base44
  plugin, which has been removed).

## The 3D renderer

`components/editor/scene/`, built on react-three-fiber 8 + drei 9 (React 18 caps both at
those majors). The whole scene is **metres with the floor at y=0** — see Storage rules for how
Marble's frame gets mapped onto that, and why the mapping isn't the documented one.

- `RoomScene` — the Canvas: lights, controls, drop handling, and the one `TransformControls`
  gizmo, attached by object reference to whichever piece is selected. Models register their
  group in a ref map so the gizmo can find them.
- `RoomSplat` — the photoreal room, Marble's Gaussian splat rendered with Spark. See below.
- `RoomShell` — the Marble scan. Not editable, and clicking it clears the selection — but it
  carries **no event handler of its own**, deliberately. r3f only raycasts objects that have
  handlers, so a handler here put 206k triangles into every click test, and the shell's
  bounding sphere wraps the whole room so three's cheap early-out never fired. Without one a
  click on the room is a miss and the Canvas's `onPointerMissed` clears the selection, which
  is what the handler did. It also inherits that path's 2px movement threshold, so an orbit
  drag ending on a wall no longer deselects the piece being arranged. It
  **replaces the material**, which is not optional: the mesh ships as bare geometry with
  `COLOR_0` vertex colours, `materials: []` and no textures, so glTF hands it the spec's
  default PBR material — **`metalness: 1`, `roughness: 1`, no environment map**. A fully
  metallic surface with nothing to reflect has no diffuse response, so the room renders as
  flat grey and every vertex colour in the file is thrown away. Swapping in a
  `MeshBasicMaterial` with `vertexColors: true` is what makes it look like a room; measured on
  the test scan that moves the frame from 0% to ~20% coloured pixels. Basic rather than
  Standard because photogrammetry colour already has the room's lighting baked in — relighting
  it would light it twice — and `toneMapped: false` for the same reason.
- `PlacedModel` — one piece of furniture. Splits into a GLB branch and a placeholder-box
  branch rather than branching inside one component, because `useGLTF` can't be called
  conditionally. Catalog GLBs are measured and rescaled so their height matches the catalog
  entry's `height_cm` — **the catalog dimensions are what size a model on screen**, so an
  entry left at the default 50×50×50 renders a 50cm-tall sofa.
- `WalkControls` — pointer-lock first person, WASD, shift to hurry. Deliberately
  collisionless and pinned to 1.6m eye height. Paired with `OrbitControls` behind the toolbar's
  orbit/walk toggle: orbit is for arranging, walk drops you inside the room.

  `UnifiedControls` sits unused beside it. It was a single-mode camera — right-drag to look,
  WASD/QE to move — that replaced the pair for a while; the orbit/walk toggle was restored on
  request. One thing it recorded is worth keeping if anyone revives it: **do not put right-drag
  pan on an `OrbitControls` with a fixed `target` while WASD moves the camera.** OrbitControls
  scales a pan by the camera-to-target distance, so walking up to the target takes the pan to
  nearly zero and the drag silently does nothing — a fixed orbit point and free first-person
  movement can't both be true.

Two things that will silently break the room if disturbed:

- **Marble's collider meshes are DRACO-compressed.** Without a decoder the room doesn't
  appear at all. drei defaults to pulling one from `gstatic.com` at load time; `RoomScene`
  calls `useGLTF.setDecoderPath('/draco/')` so it comes from `public/draco/` instead and the
  demo doesn't depend on a third-party CDN. Those three files are copied from
  `three/examples/jsm/libs/draco/gltf/` — re-copy them if three is upgraded.
- The scene tree has its own eslint override turning off `react/no-unknown-property`. r3f
  makes every three.js class a JSX intrinsic, so there's no allow-list worth maintaining.

The mesh is ~5MB and takes a good few seconds; the loading percentage comes from drei's
`useProgress`.

**The collider mesh is low-poly by design** — 103k vertices / 206k triangles for a whole room,
so it always looks soft. It's built for collision, not for looking at. `RoomSplat` renders the
photoreal alternative, Marble's 500k-splat `.spz`, via Spark (`@sparkjsdev/spark`). The
toolbar switches between them; splat is the default and mesh is the escape hatch for a machine
that can't keep up.

**The mesh renders in both modes**, as the fallback when a splat won't load; under the splat
it just isn't visible. It is *not* what clears the selection — see `RoomShell` above.

Facts about the splat path, each measured against a real scan rather than assumed:

- **Spark is pinned to 0.1.10.** 2.x requires `three >= 0.180`, and three is held at 0.171 by
  drei 9 / r3f 8, which React 18 caps. 0.1.10 declares no `three` peer at all and works.
- **Marble's frame is Y-down — both assets need a 180° flip about X.** This is the single
  easiest thing to get wrong here, and it was wrong for a while: a floor and a ceiling are
  both large flat horizontal surfaces, so an upside-down room looks entirely plausible until
  someone notices the light fitting underfoot. Neither density nor bounds nor
  `ground_plane_offset` settles it. **What settles it is the lighting baked into the scan:**
  the brightest 0.1% of splats sit at y≈-0.64, hard against the surface at -0.8, while the
  darkest average y≈+1.5. Ceiling lights are the brightest thing in a room and shadow pools
  low, so -0.8 is the ceiling and the floor is the largest y. After the fix the brightest
  splats land at world y=2.54 under a 2.66m ceiling, which is where a light belongs. Re-run
  that check on a new scan before trusting any orientation change.
- **Do not apply `metric_scale_factor` to the splat.** Unlike the mesh it already measures
  ~2.75m floor to ceiling. Scaling it too would shrink the room to 2.37m.
- **The floor is the densest 10cm band *above* the median, not the densest band overall.**
  The test scan's ceiling holds 168k splats to the floor's 62k, so "densest band" alone finds
  the ceiling. Bounds are no better: floaters push the box to y=10.2 in a 2.75m room.
- **That search reads `packedSplats.packedArray` directly and bins in one pass.** It used to
  collect every height into an array and sort it; at the full_res tier that was **1038ms of
  blocked main thread, now 18ms** — the single most expensive thing on the HD load path.
  Two reasons it was slow, and both had to go: `forEachSplat` fully unpacks each splat before
  handing it over (three `Math.exp` for the scales, an octahedral quaternion decode, a colour)
  when only the centre's y is wanted, and sorting ~2M floats to read the median off the middle
  is far more work than binning them. The centre's y is the top 16 bits of word 1 of each
  4-word splat, decoded through a 65536-entry half-float table; **verified bit-exact against
  Spark's own `forEachSplat` across all 494k splats of a test cloud** (`maxYDiff = 0`), and
  both algorithms return the same floor. `packedArray`/`numSplats` are public on Spark's
  `PackedSplats` and are never freed after the GPU upload, but the `forEachSplat` path is kept
  as a fallback in case a future Spark changes that.
- **Detail tiers.** `splat_url` is Marble's 500k tier (7.6MB) and the default; the HD button
  swaps in `splat_url_full_res` (27.9MB, 1.92M splats). Both land the floor at y=0 and the
  ceiling at 2.661m on the test scan, so toggling doesn't move the room. `RoomScene` keys the
  splat on its URL, so changing tier rebuilds rather than swapping a URL under live GPU
  buffers, and falls back to 500k whenever full_res is absent.
- **Splats and furniture occlude each other correctly.** Verified both ways: a box inside the
  room draws over the splat, a box behind a wall is fully hidden by it. No render-order work
  needed.
- **`antialias: false` on the Canvas is required, not a preference.** Spark's own docs say
  MSAA "doesn't improve Gaussian Splatting rendering and significantly reduces performance" —
  splats are soft-edged already. r3f defaults it to true, so it has to be turned off
  explicitly. It costs a little crispness on furniture edges; that's the trade.
- **`SparkRenderer` is tuned on two axes**, both of which a 1.9M-splat room is bound by.
  `maxStdDev: Math.sqrt(5)` (Spark documents sqrt(5)..sqrt(8) as the usable range, default
  sqrt(8)) makes each splat quad ~21% narrower, so ~37% fewer shaded pixels. `sortDistance:
  0.05` is how far the camera may travel before a full back-to-front re-sort; the 0.01m
  default re-sorts on essentially every frame of an orbit, and 5cm of parallax across a 3m
  room reorders nothing visible.

Render resolution is the other dial, and the one that reliably buys frames on a fill-rate-bound
splat: `performance={{ min: 0.75 }}` on the Canvas, `<AdaptiveDpr/>` inside it, and
`regress` on `OrbitControls` together drop resolution while the camera moves and restore full
resolution once it settles.

Two React-side costs worth keeping down, because the gizmo commits a transform on **every mouse
move** of a drag and each commit replaces `placedItems` upstream:

- `PlacedModel` and `CatalogPanel` are both `memo`'d. Without it, every piece in the room and
  every card in the rail reconciled 60 times a second while one item was being dragged.
  `CatalogPanel`'s props only stay stable because `pushHistory` reads `placedItemsRef` instead
  of closing over `placedItems` — restore that dependency and the memo silently stops working.
- The load percentage lives in its own `LoadingOverlay` component. Read from `RoomScene`,
  `useProgress` re-rendered the whole scene graph on every progress tick, during exactly the
  stretch where the main thread is busiest.

The overlays sitting on top of the canvas carry no `backdrop-blur`. `backdrop-filter` over a
WebGL canvas makes the compositor re-blur that region every frame the canvas draws — every
frame, in a walkthrough — and at `bg-card/90` it was blurring the 10% of backdrop that showed
through.

Both paths import `three` as a bare specifier so Vite dedupes them to one instance. Reaching
past that — importing `three/build/three.module.js` directly, say — gives Spark a second copy
and it fails with `Can not resolve #include <splatDefines>`.

Selection has three ways out, because a gizmo you can't dismiss is a trap: the **Done** button
in the viewport, the one in the inspector header, and **Escape**. Escape is orbit-only —
while walking it belongs to the pointer lock, and stealing it would leave you captured.

**Everything along the bottom edge of the viewport shares one flex row**, in `Viewport`. The
scene list, the status labels and the Done button each used to pin *themselves* to `bottom-3`,
and in walk mode a controls hint landed exactly on the labels — both claimed
`left-1/2 -translate-x-1/2`. `ViewfinderLabels` is exported separately from `Viewfinder` for
this reason: the caller owns the position, so only one thing decides that layout.

**Which cell shrinks is the load-bearing part.** The outer columns are `flex-none`, sized to
the scene list and the Done button; the middle is `flex-1 min-w-0` and wraps into whatever is
left. Both the hint and the labels carry `max-w-full`, and the labels `flex-wrap` — without
those they keep their max-content width and spill straight over the neighbours no matter what
the cells do. Getting this backwards is easy and the failure is quiet: with shrinkable sides,
the Done button overflows its own cell and lands back on the labels at ~1024px, which is
exactly the bug this row was built to end. Verified at 1024 and 1280, orbit and walk: no
overlapping pairs.

The controls hint is per-mode, and in walk mode per pointer-lock state — read off
`document.pointerlockchange` in `Viewport` rather than plumbed out of `WalkControls`, since the
lock can end without us asking (Escape, tab switch, lost focus). Unlocked walk mode also gets a
centred call to action, because a walk mode that hasn't captured the pointer looks exactly like
a camera that has stopped responding. It is `pointer-events-none`: the click it asks for has to
reach the canvas underneath to trigger the lock at all.

**The camera starts from the middle of the room, both modes** — `CameraRig`, off the collider
mesh's world box, which `RoomShell` measures and hands up. Marble's frame is not centred on the
room; on the test scan the room spans x -3.17..4.17, z -3.66..3.14, so the centre is (0.5,
-0.26) and the world origin is nowhere near it. The old fixed `[3.2, 2.4, 3.6]` put the orbit
camera at z=3.6 against a wall at z=3.14 — outside the room, looking at the back of a surface.
RoomShell derives that box arithmetically from the `Box3` it already computes for the floor
rather than measuring twice; the transform is axis-aligned, so it maps exactly, and a second
`setFromObject` would walk all 206k triangles again.

`OrbitControls` gets **no `target` prop**. The pivot is set imperatively in `CameraRig`, because
OrbitControls pans by moving its own target and a prop would re-apply on every render and yank
it back mid-pan.

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
docker build -t refurnish .
```

## Environment

`backend/.env` is imported by `application.properties` in local dev; Render supplies the
same names as real env vars.

- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`
- `WORLD_LABS_API_KEY` — and `WORLD_LABS_API_KEY_TEST` alongside it for test generations
- `MINIO_ENDPOINT`, `MINIO_PUBLIC_URL`, `MINIO_BUCKET` (defaults to `furniture`),
  `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` — see Storage rules for which URL goes where
- `GEMINI_API_KEY` — catalog dimension estimates only

The app boots without a Marble key, a Gemini key or MinIO; the corresponding uploads just fail
fast with a clear message instead.

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
