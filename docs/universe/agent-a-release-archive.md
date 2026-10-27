# Agent A — Discography, Release Registry, Individual Pages
Role: ONE of TWO parallel implementation agents. Ticket set A01–A06.
Read first: docs/universe/public-archive-two-agent-master.md. Do not read Agent B's history.
Objective: a scalable, accurate, indexable public discography with one durable detail URL per owner-confirmed released album/EP/single. Implement the mechanism and safely publish only source-cleared entries.

## Start state / inspect only these paths

- git rev-parse HEAD; git status --short; record exact main SHA before creating own branch feature/discography-archive-<date>.
- music/index.html — current music world plus release shelf/track search/Spotify consent.
- assets/music-catalog.json — schema 1, rights flags, presently empty content entries; preserve compatibility.
- assets/music-world.js — streaming links guard, rights-gated rendering and no autoplay.
- docs/universe/S3-S4.md — existing public/private and player contracts.
- tests/s3-s4.test.mjs, tests/seo-metadata.test.mjs, tests/universe-artist-connections.test.mjs, package.json, sitemap.xml (READ ONLY).
- Then inspect any specifically needed CSS/HTML neighboring structure. Only read private Notion/media if specifically cleared for the intended fact; no bulk Drive/Notion import.

## Exclusive write allowlist DURING P1

- data/public-discography.json (new)
- data/discography-sources.md (new; public safe evidence references ONLY, not private contact data)
- scripts/build-discography.mjs (new)
- templates/music-release.html (new)
- assets/release-pages.css (new)
- tests/discography-pages.test.mjs (new)
- music/<approved-release-slug>/index.html (generated public pages only)
- music/index.html (existing A ownership)
- assets/music-catalog.json or assets/music-world.js ONLY for backward-compatible adapter fixes, with tests preserving the original player. If not needed, do not touch.

Forbidden in parallel: sitemap.xml, robots.txt, index.html, about/index.html, shared CSS/JS/navigation/search, tests/seo-metadata.test.mjs, notes/**, Atlas, GitHub workflows, Cloudflare, secrets. Integration agent handles shared sitemap after BOTH streams, and no one publishes empty fake URLs.

## Required data model

Use a separate schema/versioned JSON top-level:
schemaVersion, reviewedAt, releases[], tracks[], sources?; avoid mixing local draft data into public export. JSON checked into Git for published non-sensitive records only. If notes about pending rights would reveal private content, maintain them in private owner workspace, NOT this repo.

Release:
- id stable string such as release:... (not a title-derived UUID that changes on rename);
- slug unique, kind single/ep/album/mixtape/other; title; primaryArtistIds; status public/review/draft/withdrawn;
- releaseDate or null with datePrecision; platform release URLs verified individually; same release vs reissue version relation;
- cover approved asset path + alt, or absent entirely; trackIds; credited contributors with roles + evidence;
- public text fields only if explicitly owner-approved: introduction, whyIMadeIt, whatItRepresents, process, intentionalLyricNotes, creativeTimeline;
- related edges only with public references; reviewed source entries and rights/approvals metadata.
Track:
- immutable track ID, title, linked releaseIds, order on album, optional duration/ISRC, versions, feature credit, verified stream destinations; optional verified BPM/key (artist/audio source, not guessed).
- Track included on album does not itself require a thin standalone page. Standalone single RELEASE has independent canonical /music/<release-slug>/. Avoid ambiguity when the single also appears on an album.

Public guard function: canPublish(record) only true for explicit status public, owner-approved metadata, validated title/id/slug and a verified public official listing or direct owner approval. Approving platform listing does NOT grant reuse of art/lyrics/full master. Cover/lyric/audio approvals separately independent.

Evidence: for every factual field record source URL/owner-confirmed provenance; conflicting attributes marked unresolved and hidden until reconciled. Link to Apple Music, Spotify, SoundCloud, YouTube when exact release URLs verified, not just inferred from an artist homepage. To seed inventory, use public artist profiles and owner-supplied release evidence; do not assume one platform contains full catalog. Music categories and edition relationships must not imply unconfirmed solo authorship.

Example public slug targets discussed by owner: what-winter-feels-like, heart-closed-off, manhattan. Examples are NOT yet a publication checklist; verify particular release, date/edition, artwork and source first. No automatic public pages for all of owner's privately staged song ideas.

## Renderer and template

Deterministic build command: node scripts/build-discography.mjs. If package.json change is blocked by shared freeze, document command and run direct Node. Generator validates schema and slugs strictly; rejects path traversal, duplicate slug, malformed external URLs, unexpected protocols, missing published evidence and unsafe HTML. Escape text. No unsafe raw owner-provided HTML. Generated site pages must be actual static HTML checked into working branch for GitHub Pages, not runtime routing or client fetch-only shells.

Each published release page:
- canonical https://princejona.me/music/<slug>/
- unique title + description, OG values with actual approved imagery when available, H1, breadcrumbs, static visible editorial paragraphs, genre/type/date when confirmed, approved track list and true contributor roles.
- JSON-LD @graph Person reference existing #prince-jona, WebPage, BreadcrumbList, schema.org MusicAlbum OR MusicRecording where appropriate, with verified URLs/tracks/credits ONLY, and correct artist relation; no contradictory markup.
- links back to /music/, optional notes article where actually published, apps/JonaAudio or rhythmcut as context (not forced upsell), services/creator identity only where relevant.
- accessible images with alt, semantic ordered tracklist, phone layout and reduced-motion. No autoplay. Direct playback deferred; link safely to verified providers.
- lyric annotations only explicitly approved snippets; do not automatically pull full external lyrics.

Discography index:
- music/index.html still operates its S3 rights-controlled audio player and catalog. Add release discovery independent of JS for server/static readability, with accurate cards from approved registry. Avoid duplicate blocks from JS shelf; one source of truth or clear distinct presentations.
- Genre/type filters and verified metadata nice-to-have after core; if JS enhancements fail, core anchors visible.

## Ticket order and acceptance

A01 AUDIT: produce sources/claim table for candidate public releases, distinguish public listings vs unapproved site reuse, record current SHA, baseline files, exact scope, risks. PASS if no staged works described as released.
A02 REGISTRY: schemaVersion, validation, unique slugs/IDs, public gating, normalizer for releases/track versions, synthetic fixtures for tests, rights isolation. PASS malformed/no-permission records fail closed.
A03 GENERATOR: one template, escaping, deterministic output/diff behavior, correct canonical/meta/JSON-LD. PASS same data => byte-identical output; no duplicate pages.
A04 MUSIC INDEX: crawlable release cards and safe links; existing audio features unchanged. PASS page works without JS and player tests remain green. Do NOT publish example release until sufficient evidence.
A05 QA: tests for all above, URL traversal, XSS, missing images/links, duplicate standalone/album track identity, withheld draft exclusion, mobile layout and keyboard focus, public JSON-LD. Existing node tests + targeted browser acceptance.
A06 PR: create scoped PR and handoff with changed-file list, commits, source/rights blockers, commands/results, example rendered page paths, one next move. Never merge unrelated branches.

Operational boundary: when exact public releases are not verified, ship infrastructure plus synthetic tests and clear "no verified releases published" statement; do NOT index placeholder pages. The first real release is an editorial approval gate after implementation.

## Copy-and-start prompt for Agent A

Work only on Agent A of the Prince Jona Universe two-agent plan. Read docs/universe/public-archive-two-agent-master.md and docs/universe/agent-a-release-archive.md, then the exact initial files listed. Work on your own branch, edit ONLY the Agent A allowlist, and implement A01–A06 sequentially. Preserve existing S3 public audio rights and player behavior. Use source-verified releases; no fabricated tracks, dates, artwork, credits, lyrics or personal explanations. Do not touch shared sitemap/nav/global CSS or Notes. Run targeted and full relevant tests; create one scoped PR. Leave a <=400-word status handoff with one exact next action. Stop on rights or shared-file blockers instead of overriding them.

## Compact handoff format

AGENT A — A0x — READY / IN_PROGRESS / BLOCKED / DONE
Base main SHA:
Branch / commit / PR:
File allowlist changes:
Sources and permission status:
Checks passed/failed/deferred:
Blocking question (only if needed):
NEXT ACTION: exactly one specific file/function/test and observable result.
