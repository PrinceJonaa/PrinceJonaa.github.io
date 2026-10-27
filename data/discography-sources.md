# Public discography: source and rights ledger

Baseline main: bb974ee059cecd60c2baf1197d241d7028bf94f7 (2026-10-27). Scope: issue #56; docs/universe/agent-a-release-archive.md.

| Public reference | Established | Not established |
|---|---|---|
| [Existing music catalog](../assets/music-catalog.json) | Schema 1; no approved release, preview-track or video entries | No individual media may be mirrored |
| [Spotify artist](https://open.spotify.com/artist/4oLxy1WTGaWi2D5bCwRkzP) | Artist profile URL currently linked on the website | Not a specific verified release |
| [Apple Music artist](https://music.apple.com/us/artist/prince-jona/1654646579) | Artist profile URL currently linked | No exact edition/date or site reuse rights |
| [SoundCloud artist](https://soundcloud.com/princejona) | Artist profile URL currently linked | No individual track approval |
| [YouTube artist](https://www.youtube.com/@princejona) | Artist channel URL currently linked | No particular video, lyrics or artwork approval |

Result: **zero release-specific entries with both verified provenance and site-publication approval.** Public archive entries remain empty. Owner-staged drafts, unverified song names, contributor speculation, image/lyric copying and client source media are not introduced into the repository.

For each future approved release, require a public-safe source object in data/public-discography.json, field-level source references for title, category, artist and dates, a matching verified exact release link or direct public owner confirmation, and separate metadata/text/artwork/lyrics permissions. Conflicts remain unpublished. Do not copy sensitive private approval correspondence here.

Node commands: node scripts/build-discography.mjs; node scripts/build-discography.mjs --check; node --test tests/discography-pages.test.mjs. Synthetic test data is not production inventory. Only the later sequential integration may update sitemap.xml or global navigation.
