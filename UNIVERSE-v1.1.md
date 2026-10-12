# Universe v1.1 — Portrait-led world

Confirmed direction: **black-background portrait is the homepage lead**; the two red/blue neon photographs become a cinematic secondary section. Current constellation nodes and app registry remain functional and separately clickable.

## Shipped surface
- Home: integrated real black-background portrait in starfield, with original world navigation preserved.
- Home: neon two-frame editorial section and music CTA.
- About: portrait and personal philosophy.
- Music: candid mirror photo and official Instagram link.
- Added responsive photo typography, reduced-motion handling, and visual image-error fallback.
- Photos committed as compact WebP previews into assets/portraits/. Source images remain separate.
- Instagram uses a confirmed profile link; **no posts or feed have been copied or fabricated**.

## Photo source attribution and higher resolution
- portrait.webp: IMG_0078.jpeg
- neon-one.webp: IMG_9758.jpeg
- neon-two.webp: IMG_9759.jpeg
- street.webp: IMG_0022.jpeg

These 240–320px WebP previews were used for the first GitHub-contained implementation. A higher-resolution replacement bundle has been prepared in the chat but is **not yet embedded in GitHub**. Replace these files with their optimized high-resolution versions when uploading assets through a binary-capable client; retain their names, dimensions proportions, and alt text. Low-resolution previews are intentionally not represented as finished 2x retina assets.

## Scope and operations
No changes to /craft/, /craft/storage/, /rhythmcut/, authentication, subscriptions, or live agent operations. The rest of the Universe v1 remains unchanged.

## S0/S1 responsive asset delivery (October 12, 2026)

The four exact original selections above were recovered and visually matched. Public portrait/neon/street WebP files now use optimized 960px outputs, with 480px variants and responsive `srcset`/`sizes` on Home, About and Music. Original files and EXIF are not committed. `assets/asset-manifest.json` records dimensions, file sizes, rights continuity and variants. This supersedes the preview-only asset limitation above.
