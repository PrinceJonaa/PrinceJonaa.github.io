# JonaAudio accuracy benchmark — P0/P2 pilot

## What exists

- **compare.mjs**: deterministic, synthetic-only benchmark of the legacy FFT chroma estimator vs the experimental spectral-peak profile, plus legacy tempo on known clicks. This does not measure accuracy on real songs.
- **measure-labeled.mjs**: local-only, owner-supplied PCM16 or float32 WAV evaluator using the same bounded windows and analysis functions as the browser. Sources stay on your Mac; no network, model upload or hidden provider API. Handles mono/stereo WAV up to 125 MiB.
- **harmonic-key.js**: spectral-peak interpolation, normalized pitch-class profile, elementary overtone attenuation and tuning-offset evidence. Experimental. Not Essentia HPCP. Shares FFT and key templates with baseline.
- **Quick vs Verify**: Quick keeps existing key result; Verify computes a secondary profile, mismatch warning and section traces. No automatic Antares Auto-Tune configuration.

## Run synthetic diagnostics (Node 22+)

~~~bash
node JonaAudio/bench/compare.mjs /tmp/jonaaudio-synthetic-results.json
~~~

The exact-key metric here is only over artificial cases and must NEVER be quoted as accuracy on actual beats or songs. There is no hard accuracy target without independent real labels.

## Build your own private annotated corpus

Create a file outside this public repository, for example ~/Music/JonaAudio-Benchmark/corpus.json:

~~~json
{
  "schema": 1,
  "tracks": [
    {
      "id": "owned-beat-001",
      "path": "owned-beat-001.wav",
      "key": "G minor",
      "bpm": 150,
      "genre": "drill",
      "split": "development",
      "annotation": "Original Logic MIDI chord progression and tempo, independently checked by ear"
    },
    {
      "id": "owned-beat-002",
      "path": "owned-beat-002.wav",
      "key": "D major",
      "bpm": 94,
      "genre": "emo-rap",
      "split": "held-out",
      "annotation": "Original project stems, MIDI, tonic resolution and tempo grid"
    }
  ]
}
~~~

Those are format examples, not verified files or keys. Point paths to actual, locally owned recordings; relative paths resolve beside the manifest. Keep annotations, filenames and audio out of the public repository.

~~~bash
node JonaAudio/bench/measure-labeled.mjs \
  ~/Music/JonaAudio-Benchmark/corpus.json \
  ~/Music/JonaAudio-Benchmark/results.json
~~~

The runner requires an annotation, but cannot establish if it is musically true. Confirm tonic resolution, original DAW key and scale, bass movement, borrowed notes, modulations, variable tempo and alt interpretations before making claims. Keep the held-out split untouched until release evaluation. This first format accepts a single major/minor key per track; ambiguous or modulating songs should remain unscored until the annotation schema supports passages.

## Accuracy definitions and guardrails

- **Exact:** top key and mode string match the verified annotation.
- **Top 3:** true key appears in first three ranked candidates.
- **Scale-compatible:** same seven pitch classes regardless of tonic; much weaker than exact key.
- **Unavailable:** engine abstained; never count as correct.
- **BPM ±1:** tempo estimate within one BPM; half/double-time metrics are separate.
- Report denominator, split, genre, instrument vs full mix, version, section coverage and known failures.
- Scores are NOT calibrated confidence probabilities. Two variants sharing FFT and templates are correlated.
- No audio files, source locations, secret licenses or private songs in GitHub commits, PR comments, Actions artifacts or cloud telemetry.
- Essentia.js is an AGPL-3.0 external candidate after licensing/packaging review, not bundled in this pilot.

## Finish line

1. CI Node/browser pass while ordinary Quick output is unchanged.
2. Synthetic diagnostic runs and its numeric report is preserved without audio.
3. Independently annotate a diverse, consented real-beat corpus (target at least 100; separate development and held-out).
4. Publish exact vs scale-compatible error tables, relative minor/major confusion, per-genre errors, BPM mistakes, abstention and measured CPU/memory.
5. Promote/replace a detector only if held-out evidence supports it. Otherwise keep Verify comparison-only or roll back.

Atlas plan: https://app.notion.com/p/403adfe90e7081f4ad2ec69fc1e02440
