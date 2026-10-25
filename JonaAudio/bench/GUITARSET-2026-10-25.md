# JonaAudio — real recorded key/BPM regression, October 25 2026

## Dataset and method

Source: GuitarSet v1.1.0, CC BY 4.0, DOI [10.5281/zenodo.3371780](https://doi.org/10.5281/zenodo.3371780). The eight source-recorded excerpt files, canonical JAMS labels, conversion notes and source hashes are in [fixtures/GuitarSet](./fixtures/GuitarSet/). They are human acoustic-guitar recordings, not synthesized fixtures or modern drill beats. The sample is seven solo and one chord-comp recording and should NOT be treated as a representative held-out genre benchmark.

Repeat with `node JonaAudio/bench/run-guitarset.mjs JonaAudio/bench/fixtures/GuitarSet` after installing `ffmpeg`; the decoder does not transmit audio. The GitHub read-only [real-audio regression workflow](../../.github/workflows/jonaaudio-guitarset-regression.yml) reruns the same evaluator on PRs and uploads numeric results only.

## Observed top-choice results (N=8)

| Source method | Exact key | Matching seven-note scale mask | BPM within ±1 |
| --- | ---: | ---: | ---: |
| Original Quick | 4/8 | 4/8 | 1/8 |
| Original Verify | 3/8 | 3/8 | 0/8 |
| Experimental spectral-peak profile | 4/8 | 4/8 | N/A |
| Experimental spectral-flux onsets | N/A | N/A | 1/8 |
| **Offline-only** 50/50 tonal-profile fusion | 3/8 | 3/8 | N/A |
| **Offline-only** fractional-hop ACF tempo | N/A | N/A | 0/8 |

These counts do **not** support replacing the legacy default key or BPM. The two newly tested experimental algorithms are retained exclusively in the comparative benchmarking script and do not run in the product Verify loop.

## Better actionable evidence, not a claim of higher automatic accuracy

- The canonical session key occurs in the **top three Verify key candidates for 7/8 examples**, rather than only 3/8 top-ranked. The UI now exposes up to four alternatives as manually selectable candidates, and labels every one *estimated*.
- For BPM, the original single-number outputs are poor. The spectral-flux alternatives plus half-, double-, third- and triple-time interpretations include a tempo within ±1 of the canonical label for **8/8**. **Crucially this is broad candidate-set recall, not a trustworthy chosen BPM:** the proposed set can contain up to approximately 25 possibilities. It cannot replace musician tapping, beat-grid alignment or session metadata. The user chooses any alternative explicitly.
- Changing the candidate-set size changes recall; do not advertise "100% BPM accuracy". A production accuracy win requires first-choice precision, tight top-k recall, false-guess/abstention rate, calibration and held-out genres.
- Copy tuning reference includes alternatives and provenance; no code drives Auto-Tune AU, Logic or saved manually accepted overrides by itself.
- Bench harness now preserves negative algorithm experiments instead of quietly promoting them.

## Specific persistent problems

1. On `00_SS3-98-C_comp`, Quick C major / 99 is right, Verify G major / 66 is wrong. Longer analysis must not be trusted automatically.
2. On `00_Jazz1-200-B_solo`, the key changes B major → B minor and BPM can pick ~99 (half time). Main/relative/minor classification and meter each need independently verified evidence.
3. On `03_SS1-68-E_solo`, the guitar's 3:1 rhythmic subdivision produces spurious ~192–204 BPM suggestions while canonical session tempo is 68.
4. On `04_Funk2-119-G_solo`, main 208 BPM disagrees with spectral-flux suggestions around 115–119; a direct candidate can be useful even when the highest-scored BPM is wrong.

## Next science and engineering gate

Freeze these eight as regression fixtures. Obtain new, independent artist-licensed beat/songs and test a beat-grid/phase-alignment candidate selector, with observed ±1 BPM accuracy and correct major/minor note masks on held-out tracks. Do not optimize thresholds against the eight GuitarSet test songs. Test iPhone Safari and Logic MIDI exports separately. Never infer "confirmed" from two correlated algorithms agreeing.

This document distinguishes better **manual selection affordances** from actual detection-accuracy improvements and preserves exact reproducibility and license provenance.
