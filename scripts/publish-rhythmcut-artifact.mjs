import { mkdtemp, readFile, writeFile, stat, rm, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';

const origin = 'https://rhythmcut.vercel.app/rhythmcut/';
const root = resolve('.');
const temp = await mkdtemp(join(tmpdir(), 'rhythmcut-pages-'));
const expectedSha = /^[a-f0-9]{40}$/;
const request = async name => {
  const response = await fetch(origin + name, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) throw new Error(name + ': upstream HTTP ' + response.status);
  return response;
};

const extractPython = [
  'import pathlib, shutil, sys, tarfile',
  'archive, destination = sys.argv[1:]',
  'root=pathlib.Path(destination).resolve()',
  'seen=set()',
  'total=0',
  'with tarfile.open(archive, "r:gz") as tar:',
  '  members=tar.getmembers()',
  '  if not 10 <= len(members) <= 20000: raise RuntimeError("Unexpected release member count")',
  '  for member in members:',
  '    parts=pathlib.PurePosixPath(member.name).parts',
  '    if member.name.startswith("/") or ".." in parts or not (member.isfile() or member.isdir()): raise RuntimeError("Unsafe release member")',
  '    if any(part in {".git", ".env", "node_modules"} or part.startswith(".env.") for part in parts): raise RuntimeError("Private build material is forbidden")',
  '    target=(root / member.name).resolve()',
  '    if not target.is_relative_to(root): raise RuntimeError("Archive path escapes staging")',
  '    if member.isfile():',
  '      if member.name in seen: raise RuntimeError("Duplicate path in release")',
  '      seen.add(member.name)',
  '      total+=member.size',
  '      if total > 900000000: raise RuntimeError("Expanded archive too large")',
  '  for member in members:',
  '    target=(root / member.name).resolve()',
  '    if member.isdir(): target.mkdir(parents=True,exist_ok=True)',
  '    else:',
  '      target.parent.mkdir(parents=True,exist_ok=True)',
  '      with tar.extractfile(member) as src, target.open("wb") as out: shutil.copyfileobj(src,out)',
  'print("Safe release archive extracted:", len(seen), "files", total, "bytes")'
].join('\n');

const jsonResponse = async name => (await request(name)).json();
try {
  const [release, info] = await Promise.all([jsonResponse('release.json'), jsonResponse('release-info.json')]);
  if (!expectedSha.test(release.commit || '') || release.sourceRef !== 'main' || release.path !== '/rhythmcut/') {
    throw new Error('Production release is not pinned to an approved main source SHA');
  }
  if (info.commit !== release.commit || info.version !== release.version || info.sourceRef !== 'main' || info.manifest !== 'release.json') {
    throw new Error('Published artifact identity disagrees with the production release');
  }
  const archive = join(temp, 'release.tar.gz');
  const response = await request('rhythmcut-release.tar.gz');
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 120000000) throw new Error('Public release archive too large');
  if (!response.body) throw new Error('Release archive has no response body');
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
  const bytes = (await stat(archive)).size;
  if (bytes < 50000 || bytes > 120000000) throw new Error('Unexpected archive size: ' + bytes);
  const stage = join(temp, 'dist');
  await mkdir(stage);
  const extracted = spawnSync('python3', ['-c', extractPython, archive, stage], { encoding: 'utf8' });
  if (extracted.status !== 0) throw new Error('Unsafe/invalid release archive: ' + extracted.stderr);
  console.log(extracted.stdout.trim());
  const built = JSON.parse(await readFile(join(stage, 'release.json'), 'utf8'));
  const packaged = JSON.parse(await readFile(join(stage, 'release-info.json'), 'utf8'));
  if (built.commit !== release.commit || built.version !== release.version || built.sourceRef !== 'main' ||
      packaged.commit !== built.commit || packaged.version !== built.version) {
    throw new Error('Downloaded archive does not match verified public release manifest');
  }
  for (const asset of ['index.html', 'coi-serviceworker.js', 'site.webmanifest',
    'fonts/BarlowCondensed-SemiBold.ttf', 'vision/wasm/vision_wasm_module_internal.wasm',
    'onnx/ort-wasm-simd-threaded.wasm', 'rust/rhythmcut_audio.wasm']) {
    if ((await stat(join(stage, asset))).size === 0) throw new Error('Missing release asset: ' + asset);
  }
  const shell = '<script type="module" src="/assets/app-return.js"></script>';
  let html = await readFile(join(stage, 'index.html'), 'utf8');
  if (!html.includes(shell)) {
    if (!html.includes('</body>')) throw new Error('Upstream app HTML is missing body close');
    html = html.replace('</body>', shell + '</body>');
    await writeFile(join(stage, 'index.html'), html);
  }
  if (!html.includes('/rhythmcut/assets/')) throw new Error('Incorrect public asset prefix');
  if ((await stat('assets/app-return.js')).size === 0) throw new Error('Website return shell missing');
  const copy = spawnSync('rsync', ['-a', '--delete', '--exclude=rhythmcut-release.tar.gz', stage + '/', 'rhythmcut/'], { stdio: 'inherit' });
  if (copy.status !== 0) throw new Error('Refusing to publish after failed staged copy');

  const file = 'assets/registry.js';
  const registry = await readFile(file, 'utf8');
  const match = /rhythmcut:\{[^}]*\}/.exec(registry);
  if (!match) throw new Error('RhythmCut public evidence record was not found');
  let entry = match[0];
  const patchField = (key, value) => {
    const pattern = new RegExp('\\b' + key + ":'[^']*'");
    if (!pattern.test(entry)) throw new Error('Missing registry field: ' + key);
    entry = entry.replace(pattern, key + ":'" + String(value).replaceAll("'", '') + "'");
  };
  patchField('sourceCommit', release.commit);
  patchField('builtArtifactCommit', release.commit);
  patchField('servedDeploymentId', release.commit);
  patchField('releaseVersion', release.version);
  patchField('builtAt', built.builtAt || '');
  patchField('lastKnownIssue', 'Pages publication awaiting independent live acceptance; physical iPhone performance is not certified.');
  entry = entry.replace('deploymentVerifiedAt:reviewedAt', 'deploymentVerifiedAt:null');
  await writeFile(file, registry.replace(match[0], entry));
  console.log('Staged verified production RhythmCut', release.version, release.commit, bytes + '-byte public archive');
} finally {
  await rm(temp, { recursive: true, force: true });
}
