# Project Brief — 3D Home Tour Companion

Built for Ignition Hacks (24hr hackathon, 3-person team). Submission is
**demo video + GitHub repo only — no live judging, no live Q&A.** That means
the deployed app never has to survive a judge poking at it live, but the
video has to look and flow correctly. Prioritize accordingly: things that
must *actually work end-to-end* (Marble pipeline, viewer, lookup flow) beat
things that just need to *look finished* in a recording.

## Category & Pitch

**Category: Fintech.**

Pitch (script this near-verbatim in the demo video, first 15 seconds):

> "Touring homes costs buyers time, travel, and lost income — and costs
> agents billable hours running showings that go nowhere. We cut that
> transaction friction by letting buyers tour and evaluate a property
> remotely, before either side spends a dollar on an in-person visit."

The financial framing rests on: reduced search/transaction cost for buyers
(no travel, no PTO, no scheduling back-and-forth with agents), reduced
wasted agent time, and a supporting estimated-value data point so the tool
gives a financial signal, not just a walkthrough. Do not pitch this as a
real estate listing site — it's explicitly a *companion* to listing sites,
not a competitor.

## Core User Flow (single direction — do not build the reverse flow)

1. User has already found a house on an external listing site (Zillow, etc.)
   and liked what they saw.
2. User comes to our site and searches by address.
3. **If published:** show room data (manually entered), a rough estimated
   value range (secondary, supporting element — not the headline), and the
   3D walkthrough.
4. **If not published:** show a clean "not yet available" empty state. This
   doubles as a soft pitch to homeowners to publish their own scan — don't
   treat it as a dead end, make it feel intentional.

Do **not** build: a browsable grid/marketplace of all houses, filter-by-tag
search, or the "owner-first" reverse flow. Address search/lookup is core
path now, not a stretch feature — without it the product doesn't make
sense.

## Tech Stack

- **Backend:** Spring Boot
- **Database:** PostgreSQL — metadata only, never mesh binaries
- **Frontend:** React + react-three-fiber (GLTF/GLB rendering). Boilerplate
  is being generated in **Base44**, exported, and pasted into this repo.
  Treat the Base44 output as the starting scaffold — extend it, don't
  regenerate the frontend from scratch. Pay attention to how Base44
  structures components/routing before adding r3f — it needs to slot into
  whatever page/routing convention Base44 used, not fight it.
- **Hosting:** Render
- **3D generation:** World Labs Marble API

## Data Model

```
scans
  id
  property_ref        -- links to whatever address/owner record exists
  address              -- searched against for the lookup flow
  world_id
  operation_id
  status                -- pending | processing | done | failed
  collider_mesh_url     -- fast-loading GLB, use this in the viewer
  high_quality_mesh_url -- not used in MVP viewer, store URL only
  thumbnail_url
  created_at

rooms
  id
  scan_id (FK -> scans.id)
  room_type            -- manually entered, no AI/vision pass
  estimated_sqft        -- manually entered
  condition_tags
  created_at
```

No AI vision pass on frames — that was cut early for cost/latency reasons.
All room data is manually entered by the uploader via a simple form.

## Estimated Value (secondary feature, not the headline)

Once room data exists for a scan: `estimated_value = sum(room.estimated_sqft) * price_per_sqft(region) * condition_adjustment`.
`price_per_sqft` can be a hardcoded static table by city/region — no need
for a live data source. Surface this quietly in the sidebar next to the
viewer. It exists to make the Fintech framing concrete, not to be the main
selling point — do not build this out into a full pricing engine.

## Marble API Integration

- `POST /marble/v1/worlds:generate` starts a job → returns an `Operation`
  with `done: false`.
- Poll `GET /marble/v1/operations/{operation_id}` until `done: true`.
  Generation takes ~5 minutes — **must be async/polled with a visible
  progress state**, never a blocking synchronous request.
- On completion, persist the returned URLs (collider mesh, high-quality
  mesh, splat files, thumbnail, panorama) to the `scans` row. **Never
  download or store mesh binaries in this app** — Postgres holds URLs only,
  no `bytea`, no Render persistent disk.
- Use the **collider mesh GLB** (~3-4MB) for the interactive viewer — it's
  the fast-loading option. The high-quality mesh (~100-200MB) is stored as
  a URL but not loaded in the MVP viewer.
- The frontend loads the GLB **directly from Marble's returned URL** via
  react-three-fiber's GLTF loader. This request bypasses our backend
  entirely — the backend's job is only to kick off generation, poll, and
  persist URLs, never to proxy or serve mesh data.
- Marble URLs are confirmed permanent — no need to refresh/re-fetch them
  after initial generation.

## Build Priority Order

1. Lock pitch framing into video script draft early (5 min, not a code task)
2. `scans` / `rooms` schema + upload endpoint (video/photo in, scan id out)
3. Marble integration end-to-end: kick off job → poll → persist URLs.
   Test with a real upload immediately — highest-risk external dependency.
4. Base44 frontend export dropped into repo; wire up r3f viewer loading the
   collider GLB directly from the Marble URL
5. Manual room-data entry form (room type, sqft, condition tags)
6. Address search/lookup (exact or fuzzy match against `scans.address`) +
   the two-state result view (published / not yet available)
7. Estimated value calculation, surfaced in the sidebar
8. Pre-generate 2-3 real scans well ahead of the deadline so the demo video
   never depends on live Marble latency
9. Record + edit the 3-minute demo video — cut the generation wait, keep
   the polling UI visible briefly so the async behavior reads as
   intentional rather than edited around entirely

## Explicit Non-Goals for This Build

- No AI/vision-LLM frame analysis
- No listing-site-style browsable grid or tag filters
- No reverse flow (owner-first discovery)
- No user accounts/auth
- No mesh binary storage of any kind
- No live/synchronous Marble request handling
- No full pricing engine — the value estimate is a static-table heuristic

## Prize Alignment

Architecture already qualifies for **Best of World Labs** (Marble is core,
not bolted on) and **Best use of Render** (hosting). Keep both explicitly
in mind when writing the demo script — call them out by name if there's a
natural moment to.