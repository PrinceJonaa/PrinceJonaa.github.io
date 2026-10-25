#!/usr/bin/env python3
"""Fetch a tiny, attributable CC BY 4.0 GuitarSet 1.1.0 benchmark slice.

Run in GitHub Actions or locally. Source annotations are the canonical JAMS,
NOT predicted labels or guessed keys from filenames.
"""
import argparse
import hashlib
import io
import json
import re
import statistics
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ZENODO = "https://zenodo.org/records/3371780/files/"
HF_MIRROR = "https://huggingface.co/datasets/Emulated-Inc/guitar-tablature-transcription/resolve/main/"
DOI = "10.5281/zenodo.3371780"
MD5_ANNOTATIONS = "b39b78e63d3446f2e54ddb7a54df9b10"
MD5_AUDIO = "275966d6610ac34999b58426beb119c3"
ROOTS = {"C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"}

def download(name, target, expected_md5):
    if target.exists() and hashlib.md5(target.read_bytes()).hexdigest() == expected_md5:
        return
    for origin in [ZENODO + name + "?download=1", HF_MIRROR + name + "?download=true"]:
        try:
            with urllib.request.urlopen(urllib.request.Request(origin, headers={"User-Agent": "JonaAudio-CC-BY-benchmark/1.0"}), timeout=70) as response:
                with target.open("wb") as out:
                    while True:
                        block = response.read(2 * 1024 * 1024)
                        if not block: break
                        out.write(block)
            actual = hashlib.md5(target.read_bytes()).hexdigest()
            if actual != expected_md5:
                raise ValueError(f"Archive checksum mismatch: {actual}")
            return
        except Exception as exc:
            print("Source attempt failed:", origin.split("?")[0], str(exc)[:250], flush=True)
            target.unlink(missing_ok=True)
    raise RuntimeError(f"Could not download and verify {name}")

def key_mode(data):
    observations = []
    for anno in data.get("annotations", []):
        if anno.get("namespace") not in ("key_mode", "key"): continue
        for obs in anno.get("data", []):
            value = obs.get("value")
            if isinstance(value, dict):
                value = str(value.get("key", "")) + ":" + str(value.get("mode", ""))
            if isinstance(value, str): observations.append(value.strip())
    parsed = []
    for value in observations:
        match = re.match(r"^([A-G](?:[#b♯♭])?)[:\s]+(major|minor|maj|min)$", value, re.I)
        if match:
            root = match[1].replace("♯", "#").replace("♭", "b")
            mode = "major" if match[2].lower().startswith("maj") else "minor"
            if root in ROOTS: parsed.append((root, mode))
    if not parsed or len(set(parsed)) > 1:
        return None
    return parsed[0]

def annotation_rows(archive):
    entries = []
    with zipfile.ZipFile(archive) as z:
        for path in z.namelist():
            if not path.endswith(".jams"): continue
            track_id = Path(path).stem
            meta = re.match(r"^(\d{2})_.+?-(\d+)-([A-G][b#]?|[A-G])_(comp|solo)$", track_id)
            if not meta: continue
            doc = json.loads(z.read(path))
            detected = key_mode(doc)
            if not detected: continue
            root, mode = detected
            # Label comes from the official JAMS file; filename supplies tempo.
            beats = []
            for a in doc.get("annotations", []):
                if a.get("namespace") in ("beat", "beat_position"):
                    beats.extend(float(x["time"]) for x in a.get("data", []) if isinstance(x.get("time"), (int,float)))
            beat_bpm = None
            if len(beats) >= 5:
                diffs = [b-a for a,b in zip(sorted(beats),sorted(beats)[1:]) if .2 < b-a < 1.5]
                if diffs: beat_bpm = round(60/statistics.median(diffs), 1)
            entries.append({"id": track_id, "player": int(meta[1]), "bpm": int(meta[2]),
                            "beat_bpm_from_jams": beat_bpm, "key": root+" "+mode, "mode": mode,
                            "style": meta[4], "jams_path": path})
    return entries

def pick_diverse(rows, count):
    pool = [r for r in rows if r["player"] <= 4]
    selected = []
    while pool and len(selected) < count:
        def rank(r):
            if not selected: return (1 if r["style"]=="comp" else 0, -r["player"], r["id"])
            return (6 * (r["mode"] not in {x["mode"] for x in selected}) +
                    6 * (r["style"] not in {x["style"] for x in selected}) +
                    5 * (r["key"] not in {x["key"] for x in selected}) +
                    3 * (r["player"] not in {x["player"] for x in selected}) +
                    min(2, min(abs(r["bpm"]-x["bpm"]) for x in selected)/40),
                    -r["player"], r["id"])
        choice = max(pool, key=rank)
        selected.append(choice)
        pool = [x for x in pool if x["id"] != choice["id"]]
    return selected

def audio_archive(path, work):
    try:
        from remotezip import RemoteZip
        for source in [ZENODO+"audio_mono-mic.zip?download=1", HF_MIRROR+"audio_mono-mic.zip?download=true"]:
            try:
                zipreader=RemoteZip(source, timeout=90)
                if any(n.endswith("_mic.wav") for n in zipreader.namelist()):
                    print("HTTP Range audio extraction:", source.split("?")[0],flush=True)
                    return zipreader
                zipreader.close()
            except Exception as exc:
                print("Range extraction unavailable:", str(exc)[:180],flush=True)
    except ImportError:
        print("remotezip package not available: using full verified source archive",flush=True)
    full=work/"audio_mono-mic.zip"
    download("audio_mono-mic.zip", full, MD5_AUDIO)
    return zipfile.ZipFile(full)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--output", default="JonaAudio/bench/fixtures/GuitarSet")
    p.add_argument("--count", type=int, default=8)
    args = p.parse_args()
    if not 4<=args.count<=12: p.error("Count must be between 4 and 12")
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="jona-guitarset-") as temp:
        work=Path(temp)
        annotations=work/"annotation.zip"
        download("annotation.zip",annotations,MD5_ANNOTATIONS)
        rows=annotation_rows(annotations)
        if len(rows)<40:
            raise RuntimeError(f"Could not parse enough official JAMS key annotations: {len(rows)}")
        print("Official annotated tracks parsed:",len(rows),flush=True)
        chosen=pick_diverse(rows,args.count)
        audio=audio_archive(work,work)
        names=audio.namelist()
        for row in chosen:
            possibilities=[x for x in names if Path(x).name==row["id"]+"_mic.wav"]
            if not possibilities:
                possibilities=[x for x in names if Path(x).stem==row["id"]+"_mic"]
            if len(possibilities)!=1:
                raise RuntimeError(f"Expected one original microphone recording for {row['id']}, found {len(possibilities)}")
            original=audio.read(possibilities[0])
            with tempfile.TemporaryDirectory(prefix="jona-track-") as td:
                wav=Path(td)/"source.wav"; wav.write_bytes(original)
                dest=out/(row["id"]+".m4a")
                subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(wav),
                                "-vn","-t","24","-ac","1","-ar","22050","-c:a","aac","-b:a","144k",
                                "-movflags","+faststart",str(dest)],check=True,timeout=50)
            row["source_wav_sha256"]=hashlib.sha256(original).hexdigest()
            row["fixture_sha256"]=hashlib.sha256(dest.read_bytes()).hexdigest()
            row["file"]=dest.name
            row["clip_limit_seconds"]=24
            print("Saved CC BY recording:",row["id"],row["key"],row["bpm"],"BPM",flush=True)
        audio.close()
    manifest={"schema":1,"dataset":"GuitarSet","version":"1.1.0","doi":DOI,
              "license":"CC BY 4.0","annotations_source":"Original GuitarSet JAMS key_mode; tempo encoded by original session ID and accompanied by JAMS beats",
              "audio_transform":"Source mono microphone WAV converted to 22.05kHz mono 144kbps AAC, first up to 24s; no pitch or time stretching",
              "no_model_training":"Evaluation samples, not an accuracy-optimized training collection",
              "tracks":chosen}
    (out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    credit = """# GuitarSet real-audio evaluation fixtures

GuitarSet v1.1.0 by Qingyang Xi, Rachel M. Bittner, Johan Pauwels, Xuzhou Ye and Juan P. Bello.
Source DOI: https://doi.org/10.5281/zenodo.3371780 (2019)
Paper: "GuitarSet: A Dataset for Guitar Transcription," ISMIR 2018.

License: **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
https://creativecommons.org/licenses/by/4.0/

**Changes from source:** Selected microphone recordings only; truncated at 24 seconds,
downmixed to mono, converted from WAV to AAC at 22,050 Hz and 144 kb/s.
The JAMS song-level key annotations and encoded session BPM are unaltered.
Each original WAV and derived AAC SHA-256 is recorded in manifest.json.

These are genuine human guitar performances, not synthesized sine/chord test signals.
The dataset concentrates on acoustic jazz guitar; performance on it cannot establish
accuracy for hip-hop, sampled drill productions, or full commercial mixes.

Attribution and license must travel with any redistributed clips.
For complete original WAV and annotation use the source DOI.
"""
    (out/"CREDITS.md").write_text(credit)
    print("Saved",len(chosen),"labeled recordings with CC BY 4.0 attribution.",flush=True)
if __name__=="__main__":main()
