# S1+ / S2 implementation plan

Source: the approved Universe master task log, reviewed 2026-10-12. Keep the GitHub Pages origin, CNAME and editor storage unchanged.

1. Publish reviewed service records and proof pages; add them to the existing search. Quote-only offers state scope, inputs, deliverables and revision boundaries. Preserve source/build/device distinctions in JonaAudio evidence.
2. Publish a redacted public résumé from owner-authored career sources. Omit personal contact/address, disputed dates, unfinished degree claims and expired certifications.
3. Connect service and booking actions to an inquiry brief. Keep email-draft and clipboard handoffs separate from server receipts. Never report receipt before durable acceptance or delivery before transport evidence.
4. Prepare a private Supabase intake migration and server function for the existing Intervised project. Activate only after database access, server configuration and actual acceptance tests are available. No browser service key, no direct anonymous table insert.
5. Run one consolidated package gate: Node contracts/audio regressions, Chromium search/navigation/form states, responsive pages, résumé inspection and live deployed-byte checks. Publish through a reviewed GitHub PR and record delivered versus blocked acceptance in Notion.

## Dependencies discovered

- Intervised Vercel project access returned 403. Supabase management is not connected (an earlier connection suggestion already exists). No change to these access controls is authorized or attempted.
- `contact@intervised.com` is the verified published business contact and the user selected the Intervised inbox.
- BeatCut and ISMs repositories currently report private visibility. Do not publish their source contents or advertise them as public source evidence.
- U79 needs an owner-cleared song, analysis section and actual video/export artifact. Synthetic acceptance fixtures do not satisfy that commercial proof.

## Acceptance ledger

| Item | Required result | Current state |
| --- | --- | --- |
| U14 | Public proof with context, contribution, artifact, outcome and attribution | Implemented; package gate passed |
| U15 | Three scoped quote-only services | Implemented; package gate passed |
| U16 / U56 | Durable private intake, retry safety, truthful receipt and transport states | Prepared and locally checked; activation blocked by backend access |
| U17 | Accurate redacted public résumé | Implemented; package gate passed |
| U18 | Release/fan/income/show action routes | Implemented; package gate passed |
| U63 | JonaAudio M6 case with evidence and explicit physical-device limits | Implemented; package gate passed |
| U79 | Cleared song-to-analysis-to-export story | Pending owner-cleared artifacts and S7 |

## Package verification — 2026-10-12

- Node: **58/58 passed**, including the existing **39 JonaAudio regressions** and new service/proof/inquiry contracts.
- Chromium: 11 public routes at 320, 390, 430, 768, 1200 and 1440px; no horizontal overflow or page errors. Existing app-return, save-writer and retained Craft-frame checks passed.
- Search: services, cases and public résumé searchable; keyboard selection, dismissal and focus return passed. Same-route result navigation now closes the dialog without restoring focus over the destination.
- Inquiry: scoped prefill, safe URL choices, disabled unconfigured submission, email draft, clipboard and no-JavaScript fallback passed. An explicit **local transport fixture** tested failed/invalid receipt, unchanged retry key, preserved draft and persisted-receipt/failed-notification display. Those tests do not establish production persistence or delivery.
- Disposable PostgreSQL executed the actual migration and RPC: denied anonymous/authenticated access, allowed service role, stable replay receipt, changed-body conflict, IP/email rate boundaries, failed-insert rollback, and expiry purge. Hosted database permissions/gateway behavior are still activation gates.
- Eight new/updated pages have valid local links/assets and unique IDs. The public PDF renders as one clean Letter page; PDF text/TXT/HTML contain the redacted public résumé. CNAME remains `princejona.me`.
- Independent review found one sensitive-query encoding bypass; decoded query validation, fragment rejection and regression cases resolve it. No production inquiry endpoint was activated.

## Delivery state

Public S1+ / S2 pages are ready for the reviewed GitHub release. U16/U56 are not complete until the existing Supabase project is connected, configured and live-tested. U79 remains pending cleared media and S7. Physical-device acceptance stays pending as in the S0/S1 ledger.
