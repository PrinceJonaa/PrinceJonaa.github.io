# S0 evidence and compatibility register

All eight app records are in the existing `assets/registry.js`; search derives from it through `assets/catalog.js`.

| Surface | Source/build evidence | Browser or device evidence | Boundary |
| --- | --- | --- | --- |
| Universe | Pages baseline 1ec398be7a29 | Home HTTP 200 before changes | S0/S1 acceptance recorded separately |
| JonaAudio | M1–M6 source in Pages repo; M6 docs | Prior Node 39/39; Chromium synthetic WAV import/export/relink | Physical iPhone and real MP3/M4A app import pending |
| LightCraft / FilmCraft / EffectCraft | Pinned upstream ZIP versions and SHA256 in craft-sync.yml | Runtime artifacts committed; current workflow not tested on physical device | Preserve OPFS/IndexedDB fallback and upstream licenses |
| Craft Storage | OPFS allowlist and manual Drive snapshots | Public client ID not configured | Tokens are memory-only; IndexedDB fallback is not backed up |
| RhythmCut | Source 6d188fc87b46; Pages build/served manifest 7cd6cb38cdff | Served manifest HTTP 200; quality statement is upstream manifest evidence | Newest source changes are not represented as deployed |
| BeatCut | Public source repository entry | Deployment not established by this release | Launch action explicitly opens source |

## JonaAudio feature ledger — U67

- M1–M6 implemented: local audio library/decode, tempo/key estimates, waveform/spectrum, scope/correction, sampling regions/candidates, tuning setup/reference notes, Engineer level scan, reference Compare, job cancellation, session metadata export/relink, layout/navigation.
- M7 remains a separate roadmap: stems/separation, actual pitch correction, semantic song structure and versioned cross-app interchange are not advertised as shipped.
- Estimates are not ground-truth accuracy. Offline FFmpeg analysis of the user's original recordings is not browser import evidence.

## Isolation and jobs

Homepage/directory import only small registry, catalog, discovery, constellation and photo modules. No editor WASM, ONNX runtime, media files or decoder imports belong on those pages. Editor processing is loaded only at its route. No service worker added at `/`.

Source-app jobs own progress: queued, decoding/working, cancellation request, error/unavailable and result-ready. The shell does not fabricate percentages or inspect private jobs. The directory provides capability/recovery descriptions, not a cross-app progress monitor.

## Outstanding physical acceptance — U50/U69/U71

Physical iPhone/Safari import of owner-cleared long MP3/M4A, actual native Share receiver, memory behavior, 20 cold/warm video switches with p50/p95, black frames and final export comparisons are pending. No physical-device badge may be set from emulated viewport checks.

## Asset and public-data rules

`assets/asset-manifest.json` records existing approved preview photos; 480/960px derivatives now replace the tiny previews. Original photos were recovered by exact filename and visually matched; public outputs omit EXIF. New social images contain only public page titles. No uploaded user audio/video, original private Notion text, relational profiles, contact lists, home addresses or client media is added. Public graph stays the established preview until S5 approvals.

CNAME, case-sensitive `/JonaAudio/`, Craft storage allowlists, editor DB names and original service workers are preserved. Craft hosting links keep the editor tab/frame mounted. RhythmCut hosting navigation opens another tab, including from final/export UI. JonaAudio site navigation awaits its own session writer and refuses a failed save.
