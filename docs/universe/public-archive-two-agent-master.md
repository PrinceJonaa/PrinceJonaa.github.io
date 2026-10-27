# Prince Jona Universe: Two-Agent Public Archive Expansion

Status: PLANNED ONLY; this document does not claim features are implemented.
Created: 2026-10-27. Site: https://princejona.me. Repo: https://github.com/PrinceJonaa/PrinceJonaa.github.io.
Owner orchestrates exactly TWO concurrent implementation agents. Agent tasks are in sibling docs.

## 1. Product objective and invariant

Build a public, navigable personal universe with Prince Jona at the center. Visitors may enter through an album, single, tool, note, collaborator, public research concept, project or service, and explore meaningful connections without an obligatory sales funnel. Music matters but is not the whole identity; bands, groups, companies and projects are related branches, not parents of Prince Jona.

Core interaction principle: every content object has one durable address, meaningful adjacent paths and a clear route back to the larger universe. A visitor can read or explore without JavaScript, account registration or forced playback. Build for curiosity, clarity, editorial substance, accessible navigation and accurate provenance, not artificially high page count or search engine manipulation.

## 2. Verified site baseline and protected systems

- Static GitHub Pages custom domain princejona.me, CNAME in repo, .nojekyll, robots.txt allows crawling and references /sitemap.xml. Current sitemap contains 21 existing public URLs; Google Search Console submission was user-reported, not proof of indexing.
- Existing Person JSON-LD with stable @id https://princejona.me/#prince-jona on homepage, music and about. Confirmed artist platform links currently include Spotify, Apple Music, SoundCloud, Instagram, YouTube and GitHub; PR #54 introduced Apple Music.
- music/index.html already holds browsing UI, release shelf, opt-in Spotify player and local-device audio. assets/music-catalog.json schema 1 currently has empty releases, tracks and videos, with rights approval requirements. assets/music-world.js enforces public-preview and metadata gates. Preserve all of it.
- Existing documents: docs/universe/S3-S4.md, original design brief in Notion, and tests/s3-s4.test.mjs, tests/seo-metadata.test.mjs, tests/universe-artist-connections.test.mjs.
- The staged music archive is NOT a verified published discography. Do not mistake drafts for released masters or owner-reported counts for exact inventory. Notion/Drive AI-generated experimental data may be provisional. An external release listing alone does not establish that a particular sample, image, contributor or lyrics are cleared for site reuse.
- No private Atlas documents, addresses, contacts, relationship assertions, credentials, unpublished music, unauthorized images or recordings may be published. Interpretations and biographical claims require creator approval. Never invent release dates, collaborators, lyrics, personal motives, metrics or rights.

## 3. EXACTLY TWO parallel agents and ownership boundaries

Agent A = Discography and Release Pages, tickets A01-A06. Own proposed data/public-discography.json, scripts/build-discography.mjs, templates/music-release.html, assets/release-pages.css, tests/discography-pages.test.mjs, generated music/<slug>/index.html, music/index.html and narrowly necessary music-catalog adapter changes. Read own ticket. Output independent branch + PR.

Agent B = Notes and Connection Pathways, tickets B01-B06. Own proposed data/public-notes.json, content/notes/, scripts/build-notes.mjs, templates/note.html, assets/notes.css, assets/notes.js (optional), tests/notes-pages.test.mjs and generated notes/ pages. Read own ticket. Output independent branch + PR.

STRICT PARALLEL FREEZE: neither agent edits index.html, sitemap.xml, robots.txt, global navigation, assets/universe.css, assets/discovery.css, assets/universe.js, existing shared SEO tests, CNAME, GitHub Actions workflows, package-lock, /atlas existing publication policy, Cloudflare, owner console or any other agent-owned file. No third agent, no shared branch, no one force-pushes another agent. Worktrees/branches isolated; opening PRs is allowed, but merges are sequenced.

INTEGRATION AFTER PARALLEL WORK: owner merges verified Agent A PR first. Agent B rebases on current main, then with explicit integration ownership updates central navigation, global discovery/search and sitemap exactly once (separate B integration PR if clearer). Run existing complete acceptance tests. If a conflict appears, stop and present a diff; do not silently overwrite. If A blocked by missing publication evidence, B can merge infrastructure independently but must not link to uncreated music URLs.

## 4. Page and content architecture

Existing URL anchors stay stable: /, /music/, /apps/, /atlas/, /work/, /services/, /about/, /updates/, /JonaAudio/, /rhythmcut/.
- One public release (single, EP, album, mixtape) = /music/<release-slug>/. Proposed examples: /music/what-winter-feels-like/, /music/heart-closed-off/, /music/manhattan/. These are target shapes, not permission to publish unverified release details.
- Track within album = later optional /music/<album-slug>/<track-slug>/ if independent substantive content exists. Never generate duplicate thin pages for standalone singles and album tracks; decide canonical identity and edition/version relations.
- Public notes archive = /notes/, author-approved article = /notes/<article-slug>/.
- Public people/connection directory = future /connections/ only after roster and public-source consent review; relationship cards may exist before a directory.
- Keep /updates/ for curated changelog, not personal essays; /notes/ is the creator's voice, thinking, practical tutorials and process.
- Entry-independent journeys: music search -> record -> reflection -> official stream -> tool or note; tutorial search -> creative app -> how it works -> artist; notes -> music/Atlas public concepts -> related writing; case study -> services -> creative process.

## 5. Shared content contract

Public pages are compiled to deterministic UTF-8 HTML checked into git (GitHub Pages static hosting). JSON data and templates are sources; no private Notion runtime required and no browser-only JS index content. Keep assets/music-catalog.json schema 1 backward-compatible; the new public discography registry is SEPARATE until an explicitly tested adapter is approved.

Stable IDs independent of mutable slugs: person:prince-jona, release:<id>, track:<id>, note:<id>, project:<id>, tool:<id>, concept:<id>. Use an immutable id and unique slug. Status = draft / review / public / withdrawn. Only public and explicit rights-cleared content can be indexable. Review does not equal approved. Record provenance and who/what approved each public factual assertion; unknown fields absent or null, never guessed.

Discography record fields:
- identity: id, kind (single|ep|album|mixtape|other), slug, title, primaryArtistIds, status, language, version/edition relationships;
- verified metadata: release date with precision, verified link(s) to platform release, track ids and positions, optional duration/ISRC/UPC/BPM/key;
- creative people: credited contributor IDs plus explicit roles and sources (producer, featured performer, mixer etc.) and permissions for public reuse;
- media: owner-cleared cover asset with alt text, thumbnail/streaming links, consent-gated optional embeds. Do NOT make a public full-track audio URL from private source masters;
- editorial: artistStatement, themes, originStory, process, lyricAnnotations, approved quotes/rights, revisions, connections to tools, published notes and public Atlas articles. Distinguish an artist's interpretation from verifiable credits and dates;
- governance: publicMetadataApproved, publicArtworkApproved, publicTextApproved, approvedAt, reviewed evidence links, revision history. Keep private evidence out of public files.

Notes record fields:
- id, slug, title, summary, authorId, status, authoredAt, publishedAt, updatedAt, categories, evidence/source references, contentFile, public heroAsset optional, typed relationships, revision note and editorialApproval.
- Notes types: personal reflection, behind-the-song, lyric interpretation, creation diary, software/tutorial, research, story, collaboration/process. Each is editorial voice and must be authored or approved by owner; tutorials can cite verified existing code with no personal-story invention.
- Markdown-to-HTML must prevent script injection, arbitrary iframe or unsafe external URL. Content is text-first, optional moderated embed.

Relationship edges: from entity ID; type in partOf, appearsOn, createdWith, explains, references, builtWith, about, collaboratedWith, followUpTo; to a public entity ID or verified external URL; source/provenance; approval state and privacy visibility. No public dangling IDs, false credit claims or graph edges inferred from proximity. Typed human editorial relations can be marked interpretations without pretending they're historic facts.

Cross-agent compatibility: A exposes public release IDs/URLs; B exposes public note IDs/URLs. References to non-public counterpart pages remain hidden/disabled until published. During parallel phase, tests can use explicitly synthetic fixture records, but fixtures must never enter production sitemap or published gallery.

## 6. User experience, accessibility and discoverability

A release landing: title, artwork only when cleared, type/verified date, listening links, tracklist when confirmed, owner's story, authored lyric excerpt breakdown where authorized, credits, relationships, adjacent work and route to /music/. Avoid fake counters or statistics. A note landing: readable headline/author/date, accessible text and sources where relevant, tagged lens, related content, route to /notes/ and other worlds. Both: no forced sign-up, autoplay or popup; keyboard/touch friendly and reduced motion; textual fallback to any graph/window UI.

Structured data: pages must advertise self canonical HTTPS, unique descriptive title, meta description, visible H1, OpenGraph/Twitter when appropriate, BreadcrumbList, Person with stable @id, schema MusicAlbum or MusicRecording for accurate release type, BlogPosting/Article for eligible note. Do not promise rich results; never place more claims in JSON-LD than a reader can see. Render real static HTML; don't depend on hydration to expose text to bots.

Index rules: only truly public, substantive pages; noindex placeholders, drafts, local state and non-public files. Add to sitemap from validated content, preserve all 21 existing URLs, do not fabricate lastmod or change robots.txt to target AI crawlers. Internal links explicit and checked. Search engine and AI indexing are external processes outside this build. Actual click/impression data only through Search Console, no made-up metrics.

Preferred visuals honor the site's existing editorial/constellation system and the selected Open Windows design brief, but do not redesign the complete live site in this milestone. Native photography and cleared covers rather than stock photos, respect mobile and accessibility.

## 7. Milestones and acceptance gates

P0 plan only: this document, A and B docs, two GitHub issues, crosslinked Notion planning references. No feature implementation declared.

P1 parallel:
A01 audit & source manifest; A02 schema/validator + no-leak rights gate; A03 deterministic static release template/generator; A04 index + cross-links + prospective full-discography import; A05 structured data, SEO, accessibility and rights tests; A06 scoped PR/handoff.
B01 audit & content hierarchy; B02 note/editorial schema + validated typed relations; B03 static notes index/article generator; B04 public-only contextual links/fallbacks; B05 SEO/keyboard/mobile/escape tests + authentic tutorial source gate; B06 scoped PR/handoff.

P2 sequential integration:
1. A merge only after tests, review and source boundaries confirmed; A may ship architecture without publishing releases when proof incomplete.
2. Rebase B. Merge B after tests and links resolve.
3. B in second, strictly sequential integration PR updates shared nav/home/index/sitemap/global discovery to surface ONLY published URLs. Check 21-URL legacy set preserved.
4. Validate final main SHA GitHub Actions, GitHub Pages deployment, public HTTP bytes (if available), and sitemap. Report CI and live deployment separately.

P3 controlled scale:
Independently verify all official albums/singles, normalize editions/features, get owner permission for art/lyrics and optional artist reflections, publish incrementally. Partner/collective releases link contextually, never implied solo ownership. Add notes and videos at editorial cadence; optional RSS and advanced annotation when substantive.

P4 deferred:
Bring over already-implemented ISMS player only with scope/rights/test review, contextual graph and creation timeline, public connections directory, owner CMS export approval workflow, privacy-respecting analytics, Search Console query/CTR review, gallery performance improvements.

Acceptance all PRs: changed files match allowlist, validators pass, unique IDs/slugs/canonicals, no unsourced/public private info, no blank indexable content, no broken local links, all existing app S3/S4 playback and private-storage tests retain passing status, no accessibility regressions, meaningful no-JS HTML, no unapproved commercial previews, and clean PR evidence. If a content record is incomplete, skip publishing that route; tests show the skip; document missing evidence, do not fill it speculatively.

## 8. Context-length defense and handoff protocol

Each agent reads ONLY master + own ticket + enumerated repo files and latest main SHA. Avoid full chat dumps and bulk Notion reads. One active micro-ticket per agent, branch-scoped, no self-assigned out-of-scope work. Each closes a micro-ticket by posting a <=400-word compact handoff containing:
Agent | Ticket & status READY/IN_PROGRESS/BLOCKED/DONE | main SHA and branch | changed file list | relevant decisions | evidence/unknowns | checks command, pass/fail/deferred | PR/commit URL | exactly ONE next action with expected observable result.
When blocked by data/permission, complete safe infrastructure or fixtures without publicly asserting fake information. Defer only explicitly recorded tests, no unverified PASS claims.
No autonomous publishing from private owner console, no Cloudflare/database changes, no third agent, no cross-branch force pushes, no unnecessary coordination meetings.

## 9. Decisions adopted and open

Adopted: exactly 2 agents, music and notes split, static HTML and source JSON, release pages/individual URLs, owner-authorial voice, provenance/rights gating, later reusable ISMS player, connections as optional paths not a manufactured network, group projects remain subordinate context.
Open: complete verified public discography and platform release URLs, rights/credits/cover reuse, owner-written interpretations, whether a tutorial video exists, permissioned collaborator roster, optional owner publishing UI and analytics. Nothing open is license to invent.

## 10. Reliable reference entrypoints

GitHub repo: https://github.com/PrinceJonaa/PrinceJonaa.github.io
Music rights and player: https://github.com/PrinceJonaa/PrinceJonaa.github.io/blob/main/docs/universe/S3-S4.md
Catalog: https://github.com/PrinceJonaa/PrinceJonaa.github.io/blob/main/assets/music-catalog.json
Artist identity PR: https://github.com/PrinceJonaa/PrinceJonaa.github.io/pull/54
Universe Notion log: https://app.notion.com/p/3f6adfe90e708153b03bf5ae84405821
Selected design brief: https://app.notion.com/p/3dfadfe90e7081649480f9b3e2fe1bd6
Private staged music inventory: https://app.notion.com/p/3f7adfe90e7081dc9760eb9c470ec68c (NOT a public-release authorization)
