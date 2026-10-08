# Craft Studio — Prince Jona

**Site:** https://princejona.me/craft/

## Tools

| Browser app | Version | Launch URL | Upstream |
| --- | --- | --- | --- |
| LightCraft | 0.2.1 | [/craft/light/](https://princejona.me/craft/light/) | [storytold/lightcraft](https://github.com/storytold/lightcraft) |
| FilmCraft | 0.2.1 | [/craft/film/](https://princejona.me/craft/film/) | [storytold/filmcraft](https://github.com/storytold/filmcraft) |
| EffectCraft | 0.4.0 | [/craft/effect/](https://princejona.me/craft/effect/) | [storytold/effectcraft](https://github.com/storytold/effectcraft) |

The landing page lives at craft/index.html. It offers an in-page editor
via an iframe and a direct full-screen link for each app.

The upstream release builds, including required license notices, are
committed in craft/light/, craft/film/, and craft/effect/.

## Updating the apps

The GitHub Actions workflow at .github/workflows/craft-sync.yml downloads
verified upstream ZIP releases and publishes the necessary static assets
to this GitHub Pages repository. To upgrade a tool, update its pinned
release URL, versioned directory and expected SHA-256 ZIP checksum.

LightCraft's release archive includes unrelated compiler build output;
the workflow deliberately copies only files used at runtime.

## Data and compatibility

- These WebAssembly apps run in the browser. Support for codecs, effects, rendering
  and export depends on the upstream build and browser.
- Keep backups of original media and project/library data. LightCraft stores
  its photo library in browser storage, which can be deleted with site data.
- GitHub Pages is static hosting; no server-side processing is installed.
- Source code and licenses belong to the respective upstream projects,
  which are distributed under MIT OR Apache-2.0.
