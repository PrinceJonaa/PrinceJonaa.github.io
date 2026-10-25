# JonaAudio — Second independent accuracy pass (October 25, 2026)

**Scope:** real CC BY 4.0 trap/drill and boom-bap loops for **BPM**; separate licensed complete FMAK/FMA songs with expert annotations for **musical key**. These are distinct tasks; no keys are inferred from drum-only samples. Measurements are reproducible with the checked-in scripts and CI output. Audio and labels are never sent to an outside inference API.

## Production BPM improvement: MIT BeatRoot (Deep review only)

Upstream: [music-tempo](https://github.com/killercrush/music-tempo) by killercrush, copyright 2017, **MIT**, with its full license at `JonaAudio/third-party/MUSIC-TEMPO-LICENSE.txt`. Local bundled source: `JonaAudio/vendor/music-tempo.esm.js`, a browser-compatible transformation of the UMD bundle which changes module wrapper scope and exports `MusicTempo`; it introduces **no runtime CDN**.

The added `beatroot-evidence.js` uses bounded, ~10ms-hop audio windows at JonaAudio's 11.025kHz processing rate (512 FFT). It runs only on **user-requested Deep or Improve BPM**, after the normal resampling step. Up to three windows are examined. Evidence is shown as a **manual selectable alternative**, with half/double-time interpretations and section consistency. No audio upload, automatic DAW session BPM change, automatic tuner change, or overwrite of an accepted manual value. The older original BPM estimate remains available.

### Real WaivOps source-labelled evaluation

Official published audio: [WaivOps HH-TRP](https://github.com/patchbanks/WaivOps-HH-TRP), DOI [10.5281/zenodo.15734094](https://doi.org/10.5281/zenodo.15734094), and [WaivOps HH-LFBB](https://github.com/patchbanks/WaivOps-HH-LFBB), DOI [10.5281/zenodo.7523435](https://doi.org/10.5281/zenodo.7523435). **Both CC BY 4.0**. The source authors encode session BPM in filenames; 21 unchanged original MP3 example files, SHA-256 checksums and credits are included at `JonaAudio/bench/fixtures/WaivOps`.

| Published session BPM within ±1 | JonaAudio Quick | Legacy Verify | MIT BeatRoot Deep | BeatRoot or ½-time (top two) |
|---|---:|---:|---:|---:|
| **21 combined** | **3/21** | **4/21** | **15/21** | **19/21** |
| 15 trap/drill | 0/15 | 1/15 | 14/15 | 14/15 |
| 6 boom-bap | 3/6 | 3/6 | 1/6 | 5/6 |
| 11 development split | 2/11 | 2/11 | 7/11 | 9/11 |
| 10 originally held-out | 1/10 | 2/10 | 8/10 | 10/10 |

**Important**: the initially held-out labels became visible during this development cycle. These 10 examples are now a **fixed regression set**, *not an untouched final test*. No detector weights were optimized on their answers, but iteration may bias future design. A fresh independent, preferably artist- or producer-separated external corpus is required before claiming robust accuracy.

### Cross-genre tempo regression

Eight GuitarSet v1.1.0 actual acoustic recordings (CC BY 4.0, DOI [10.5281/zenodo.3371780](https://doi.org/10.5281/zenodo.3371780)): BeatRoot **5/8** within ±1 BPM vs **0/8** for old Verify, **1/8** Quick. The originals remain frozen. This does not imply all production genres or mixed song recordings are covered.

### Why half-time must not be chosen blindly

The licensed boom-bap loops around 79–81 source BPM often produce ~158–162 BPM BeatRoot readings. Conversely many trap loops have misleading ~55–108 BPM autocorrelation alternatives when true source BPM is ~110–165. A naive rule that always chooses whichever of 1×/½× agrees with the legacy method will regress one genre. JonaAudio exposes the **two explicit rhythmic readings** for human decision. 19/21 *top-two recall* is not 19/21 automatically selected precision.

## Full-song key baseline and external reference

FMAK expert key labels: DOI [10.5281/zenodo.10719860](https://doi.org/10.5281/zenodo.10719860), matched to the Free Music Archive's **original per-song licenses** in `bench/audit-fmak-licenses.py`. The 13 available complete CC BY-licensed songs were decoded in temporary GitHub Actions workspaces and *were not committed or uploaded as audio artifacts*. Artist coverage is narrow: eight hip-hop songs are all by BrokeMC.

| Exact expert key | All 13 | Hip-hop eight |
|---|---:|---:|
| JonaAudio Quick | 7/13 | 4/8 |
| JonaAudio Verify | 6/13 | 4/8 |
| JonaAudio experimental peaks | 7/13 | 5/8 |
| Essentia `KeyExtractor` HPCP `bgate` reference | **9/13** | **6/8** |

The last row is an **offline AGPL scientific comparator**, not an installed or integrated web plugin. Key extraction still needs stronger independent cross-artist samples and an appropriately licensed browser implementation. Do not promote this 13-song accuracy as population-level.

## Implementation and QA gates

- Local worker calculates BeatRoot only in Verify; original key rankings / primary BPM / user correction stay unchanged.
- `Improve BPM` re-runs **tempo only**, not key, and exposes the candidate first; a click is required to accept it. Full Deep still analyses both.
- Silences and short audio return *unavailable*, not a fabricated tempo; no calibrated confidence percentages.
- The fixed WaivOps and GuitarSet real-audio CI regressions plus JonaAudio unit/Chromium and full-universe acceptance must pass before merge.
- Broken Essentia.js v0.1.3 UMD/WASM parity research remains unmerged and its repeatedly failing automated research workflow was retired. Python Essentia is NOT added as a runtime dependency.
- Remaining gates: new artist-separated drum and full-song datasets, optional iPhone Safari memory and long-file performance, false-positive abstention, user-comprehensible meter and beat-grid validation. Existing held-out recordings cannot substitute for a fresh independent evaluation.
