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


## Optional professional reference engines — no cloud audio transfer

The comparison driver `reference-engines.py` runs **locally**. It uses existing FFmpeg
for decoding, plus user-installed libre Python libraries; it never uploads music.
No third-party key prediction is automatically promoted to "truth". Supported
references:

- `--librosa`: STFT chroma, CQT chroma, CENS; `--hpss` adds harmonic-only CQT.
- `--essentia`: if local `essentia` Python bindings are available, runs
  KeyExtractor with the electronic-music `edma` and general `bgate` profiles
  and RhythmExtractor2013. The required 44.1 kHz signal is decoded separately.
  If missing, the JSON explicitly says unavailable; it **never invents results**.
- Installing libraries is a user-controlled step; confirm Python package support
  and relevant licenses. Essentia is AGPL-3.0, so the web app does not embed its
  compiled library in this pilot. Browser sources are not pushed to a server.

Create a *private* file at `~/Music/JonaAudio-Benchmark/reference-manifest.json`:

~~~json
{
  "schema": 1,
  "tracks": [
    {
      "id": "anonymized-track-01",
      "path": "/absolute/path/to/your/source.wav"
    }
  ]
}
~~~

For example, after installing the chosen tools on your Mac:

~~~bash
python3 JonaAudio/bench/reference-engines.py \
  ~/Music/JonaAudio-Benchmark/reference-manifest.json \
  ~/Music/JonaAudio-Benchmark/independent-estimates.json \
  --librosa --hpss --essentia
~~~

The resulting JSON contains anonymous IDs, section positions, estimated keys,
tempo results and explicit unavailability/errors, not raw audio or source paths.
We have run librosa/CQT/CENS/HPSS locally on the five owner-provided tracks;
**Essentia was not installed in the analysis runtime** and is not claimed tested.

## Keep *working settings* separate from true key labels

A key chosen in a reliable vocal pitch-correction workflow is a useful reference,
but may be a relative major/minor label rather than the original musical tonic.
Use `working-setting` for that kind of annotation; use `session-confirmed` only
when original score/MIDI or a separately verified original session establishes it.

The **offline** comparison evaluator accepts this minimal private file:

~~~json
{
  "schema": 1,
  "annotations": [
    {
      "id": "anonymized-track-01",
      "basis": "working-setting",
      "key": "F major",
      "bpm": null
    }
  ],
  "predictions": [
    {
      "id": "anonymized-track-01",
      "method": "experimental-peak",
      "key": "D minor",
      "bpm": null
    }
  ]
}
~~~

Run:

~~~bash
node JonaAudio/bench/run-labeled-score.mjs \
  ~/Music/JonaAudio-Benchmark/evaluation.json \
  ~/Music/JonaAudio-Benchmark/scored.json
~~~

This scores **exact root+mode**, **same allowed scale notes**, **relative-key
confusions**, **BPM within ±1**, and independent half/double/3:2 metrical relations.
An F major / D minor pair is *not* an exact match but *is* the same seven-note
pitch collection for basic major/natural-minor Auto-Tune restrictions. Keep all
private labeled files out of the public GitHub repository.

## P3 experimental DAW handoff

JonaAudio Quick includes a user-triggered **Export tempo MIDI for Logic** action.
The file contains a standards-compliant tempo event and 4/4 meter, with no notes
or any instruction to change a currently open Logic project. An unconfirmed BPM
requires acknowledgement. The file format is unit-tested; **actual Logic import
behavior still needs on-device verification**. Nothing controls the Antares AU
automatically.
