# Selective tempo research: release boundary

This branch adds a **research-stage**, deterministic tempo suggestion from BeatRoot, original onsets, and spectral-flux evidence. It is not a calibrated automatic BPM detector.

## Current behavior
- Verify-mode results may include `tempoDecision` metadata and a clearly marked **Experimental / unverified** option that requires an explicit creator action to apply.
- No source BPM, beat grid, or manual correction is silently replaced.
- Even when an experimental suggestion exists, the ordinary analysis result remains **unavailable** if the baseline BPM detector found no BPM.
- The separate benchmark/metadata tools do not become production inference training inputs.

## What remains unverified
- Independent, creator-separated FSLD audio evaluation of the fixed selector, including per-source licensing and duplicate/uploader isolation.
- Report exact-BPM precision, within-tolerance precision, abstention/coverage, and normal-vs-half-time error rates on frozen independent evaluation splits. Show numerator and denominator for each; do not silently treat abstention as success.
- Check real complete tracks beyond short rhythm loops before making production claims about song tempo.
- Compare the current default BPM behavior against the experimental manual option without contaminating the independent set.

## Promotion gate
Do not change `safeToAutoApply: false`, the **Experimental** labeling, or require/auto-apply a recommended tempo until independent scores are available, a concrete precision-versus-coverage acceptance policy has been agreed, and both existing regressions and independent validation meet that policy.

Research outputs are not claims of accuracy, and a green unit/CI suite does not certify real-audio accuracy.
