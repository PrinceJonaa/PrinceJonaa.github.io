# Agent B — Notes, Authored Stories and Public Connection Pathways
Role: ONE of TWO parallel implementation agents. Ticket set B01–B06.
Read first: docs/universe/public-archive-two-agent-master.md. Do not read Agent A's entire build history.
Objective: a usable public home for authored writing, creation notes, research connections, behind-the-song material and technical tutorials. Notes make existing universes more navigable, without manufacturing biographical stories, credits or speculative links. Agent B stays independent during parallel execution.

## Start state / inspect only these paths

- git rev-parse HEAD; git status --short; record baseline main SHA. Create own branch feature/notes-relations-<date>.
- index.html (READ ONLY to study nav/shell, no edits during parallel work).
- music/index.html and apps/index.html (READ ONLY to understand current crosslinks).
- atlas/index.html or assets/atlas-public.js as needed (READ ONLY, public material only).
- assets/universe.css, assets/discovery.css (READ ONLY); appropriate existing page CSS for reusable patterns.
- docs/universe/public-archive-two-agent-master.md and current design brief reference, selective reading.
- tests/universe-artist-connections.test.mjs, tests/seo-metadata.test.mjs (READ ONLY).
- Relevant existing work tool pages and docs/universe/S3-S4.md (READ ONLY).
- Do not ingest private relational dossiers or archival creator transcripts to fabricate published articles.

## Exclusive write allowlist DURING P1

- data/public-notes.json (new public manifest of only approved notes)
- content/notes/** (author-approved Markdown or documentation-backed technical content, nonpublic synthetic fixtures separate)
- scripts/build-notes.mjs (new deterministic static renderer)
- templates/note.html (new; or per-notes templates/)
- assets/notes.css and assets/notes.js (new; no intrusive scripts)
- tests/notes-pages.test.mjs (new)
- notes/index.html and notes/<approved-article-slug>/index.html (generated public only)
- docs/universe/notes-content-guide.md (new editorial/sources workflow)

DO NOT edit shared /index.html, sitemap.xml, robots.txt, site search, existing CSS/global JS, /music/, releases registry, Atlas existing published records, project records, GitHub workflows or Agent A files DURING P1. After Agent A PR merge, a SECOND sequential integration pass may explicitly grant Agent B ownership of shared nav/sitemap and global discovery; separate PR preferred.

## Editorial vision and categories

This is NOT a mass-produced SEO blog. /notes/ is the owner's distinctive voice and a durable trail across music, tools, life, thinking, process, creative experiments, software and public Atlas concepts. Keep it readable and personal, with option of a structured relation view later. Existing /updates/ remains curated changes/releases, not articles.

Lenses / filters: Behind the Music, Making / Engineering, Thoughts / Research, Stories / Process, Creative Tools, Collaborations. Do not claim these categories imply formally verified credentials or achievements. Owner can write in first person. AI should not invent a first-person life narrative or publish "how I made X" without owner-authored notes/confirmation.

Start with /notes/ editorial landing featuring only published entries. An empty state should be a purposeful introduction and crosslinks to existing Music/Apps/Atlas/Work, not fake article cards and not a mass-indexed archive of empty pages. A single useful practical tutorial on JonaAudio or RhythmCut MAY ship only when facts can be verified from repository behaviors and a real demo exists; optional video stays optional, with external link only if actual verified upload. Avoid duplicating product documentation or claiming features not in code.

## Notes data contract

SchemaVersion: 1, updatedAt, entries[]. Each entry:
- id stable note:<id>; slug; title; summary; authorId (person:prince-jona unless genuinely coauthored and approved), articleType, status draft/review/public/withdrawn.
- authoredAt, publishedAt, updatedAt only when known; category/tags; content path for reviewed safe Markdown; hero image public-cleared or null; sources and editorial evidence/approval.
- relatedEdges: typed from note ID to public entities (release, track, tool, project, topic, approved collaborator); edge kind explains/references/about/builtWith/followUpTo/collaboratedWith; support reviewed public external URL where appropriate, with evidence. Unknown references fail closed.
- interpretation blocks can say "what this means to me", with explicit author; do not assert that subjective lens is independently proven fact.
- rights for lyric quotations, third-party artwork, links, screenshots, and personal photos; no raw copyrighted lyrics import, no scraped social captions or screenshots without permission.

Markdown rendering must sanitize/exclude unsafe HTML and URL schemes, avoid script/iframe injection, encode text entities and preserve paragraph/heading/list links. A dependency-free constrained Markdown subset is acceptable; if library introduced, justify dependency and perform package management ONLY in later integration since package-lock is frozen in parallel phase.

## Page renderer and interaction model

Deterministic command: node scripts/build-notes.mjs. Static HTML committed for GitHub Pages; no JS-only article body. /notes/ index lists published notes with readable title, excerpt, category, real date when known, and safe internal links. Optional client-side filter is progressive enhancement and preserves readable fallback.

Published /notes/<slug>/ page:
- unique SEO title and description reflecting authentic text; canonical HTTPS; OG (image only when approved), BreadcrumbList and schema.org Article or BlogPosting + Person author reference id #prince-jona; prevent schema claims absent in UI.
- semantic readable article, headings, byline, optional version/correction note, sources context, visual rhythm, typography, mobile width and reduced motion.
- "Explore connections" section based on reviewed typed edges, clearly distinguishes credited factual relationships from author interpretation. Links may go to /music/, a verified future release, a public app, a project case, /atlas/ public concept, /services/ where relevant; never every section universally.
- For missing/unpublished relation target, OMIT link or display nonlinked descriptive context if permissioned. No dead buttons or public URLs guessed from labels. Existing privacy-public boundary remains.
- No popups, autoplay, invasive tracking, subscription provider, comments/contact collection, AI chatbot, or dynamic server requirement in P1.
- Alternative presentation: connection graph/open editorial window as later progressive enhancement, but list representation must be available and preferred for SEO/a11y.

Cross-stream contract: Agent B may see stable release ID conventions in master but must not assume Agent A's fixtures are live content. Approved notes can reference a published album only after checking current public catalog/real generated URL; do not publish a connection to an unapproved track. Agent A must likewise avoid future non-existent Notes link. In parallel tests, synthetic IDs live only in a clearly non-public fixtures subdirectory.

## Ticket order

B01 REPO AND AUDIENCE AUDIT: map actual public pages, current navigation and voice/tone, identify existing published tutorial evidence from code; read current design brief selectively; propose initial Notes categories & article paths. No web-scraped private artist narrative.
B02 SCHEMA / EDITORIAL GATES: versioned notes data, slug unique validation, permission statuses, evidence and public edge checks, safe public-only projection, source/author revision guide. PASS draft never publishes and bad URL fails closed.
B03 STATIC PAGES: /notes/ archive + article renderer/template with no-JS visibility, semantic content, device-friendly CSS and accessible breadcrumbs. PASS reproducible generator; one usable index.
B04 PUBLIC RELATIONSHIPS: typed edges resolver, published target check, single-step routes into music/apps/Atlas/services, optional back/next behavior (not forced funnels), hide dangling references. PASS no false links or claim inflation.
B05 TESTS: invalid Markdown XSS attempts, broken links, draft leak, canonical/JSON-LD alignment, one H1, content/SEO, mobile and keyboard readability, reduced motion, no external analytics; relevant full repository unit/browser acceptance. Optional first tutorial only with verified code and owner-approved stance.
B06 PR / HANDOFF: open scoped PR with README/content editing instructions, coverage/results, constraints/unknowns, one concrete next move. DO NOT merge Agent A branch or shared sitemap.

## Integration only after Agent A completes (B07, strictly sequential)

- Rebasing against main after Agent A merge is mandatory. If A is blocked, B can proceed with independently valid notes pages and /notes/ index while keeping unreleased music edges hidden.
- Owner authorizes shared nav/index/search/sitemap edits in a NEW integration PR with explicit changed file list. Add /notes/ index if useful, add individual article URLs only when public and substantial, add /music/<slug>/ from validated A registry, retain the entire preexisting 21-page sitemap; no duplicate URLs. Update shared SEO tests for new inventory and human/robot status as appropriate.
- Validate all prior routes, CNAME, .nojekyll, robots, Player S3/S4, static anchor paths, and copy the prior UX behavior. Run existing GitHub Actions acceptance checks and check Pages deployment separately; live-site fetch if possible, no silent assumptions.
- Cross-site navigation: insert Notes among destinations without presenting it as subordinate to engineering or above Music. Add meaningful per-page next-step sections; avoid uniform CTA spam.
- Final handoff to owner states implemented vs blocked, URL inventory, publication count and remaining owner's editorial approvals.

## Verification and blocking examples

- No approved notes yet -> ship /notes/ landing and a generator tested with synthetic unpublished fixture; do not write invented reflective essays, pretend a blog catalog exists, or index fixture articles.
- No confirmed tutorial video -> link only to existing working tool and provide honest documentation, defer video.
- A song in a private archive -> do not publish reference; owner can confirm public version later.
- A collaborator in a private relation map -> omit. Public appearance or explicit owner reviewed source needed.
- Broken destination edge -> fail CI on explicitly public record, silently omit withheld relation.
- A new article with author quotation requires literal approval of the text; explain editorial gate instead of filling in first person.

## Copy-and-start prompt for Agent B

Work only on Agent B of the Prince Jona Universe two-agent plan. Read docs/universe/public-archive-two-agent-master.md and docs/universe/agent-b-notes-connections.md, then the exact initial files listed. Work on your own independent branch. Edit ONLY Agent B allowlist while Agent A is active. Build B01–B06 with a deterministic public Notes archive, authored/editor-approved articles only, typed evidence-backed connections, source/rights gates and static accessible HTML. No invented first-person writing or relationships. Do not edit /music/, global nav/sitemap, existing CSS or private Atlas during parallel work. Run targeted and existing relevant checks, open one scoped PR and provide a <=400-word handoff with ONE precise next action. Wait for Agent A merge before any shared integration (B07) and only after owner authorizes it.

## Compact handoff format

AGENT B — B0x — READY / IN_PROGRESS / BLOCKED / DONE
Base main SHA:
Branch / commit / PR:
File allowlist changes:
Sources and editorial approval status:
Checks passed/failed/deferred:
Blocking question (only if necessary):
NEXT ACTION: exactly one specific file/function/test and observable result.
