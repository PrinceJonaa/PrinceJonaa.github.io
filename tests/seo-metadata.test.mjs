import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const core = [
  ['index.html', 'https://princejona.me/'],
  ['music/index.html', 'https://princejona.me/music/'],
  ['about/index.html', 'https://princejona.me/about/'],
];
test('core public pages advertise their own canonical and a stable artist identity', () => {
  for (const [path, url] of core) {
    const html = read(path);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), path);
    const marker = '<script type="application/ld+json">';
    const start = html.indexOf(marker);
    assert.ok(start >= 0, `Missing JSON-LD in ${path}`);
    const end = html.indexOf('</script>', start + marker.length);
    assert.ok(end > start, `Unclosed JSON-LD in ${path}`);
    const data = JSON.parse(html.slice(start + marker.length, end));
    assert.equal(data['@context'], 'https://schema.org');
    const person = data['@graph'].find(node => node['@type'] === 'Person');
    assert.equal(person?.['@id'], 'https://princejona.me/#prince-jona');
    assert.ok(person.sameAs.some(link => link.startsWith('https://open.spotify.com/artist/')));
    assert.ok(person.sameAs.some(link => link.includes('instagram.com/princejonaa')));
  }
});
const publicRoutes = [
  "/",
  "/music/",
  "/about/",
  "/apps/",
  "/rhythmcut/",
  "/craft/",
  "/craft/light/",
  "/craft/film/",
  "/craft/effect/",
  "/atlas/",
  "/work/",
  "/operations/",
  "/JonaAudio/",
  "/services/",
  "/beatcut/",
  "/work/cases/jonaaudio/",
  "/work/cases/universe/",
  "/work/cases/heartz4sale/",
  "/work/cases/song-to-video/",
  "/work/cases/resume/",
  "/updates/"
];
test('the XML sitemap includes exactly the indexable public pages with valid on-page signals', () => {
  const sitemap = read('sitemap.xml');
  assert.ok(sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  const found = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const expected = publicRoutes.map(route => 'https://princejona.me' + route);
  assert.deepEqual([...found].sort(), [...expected].sort(), 'Sitemap must match public route allowlist');
  assert.equal(new Set(found).size, found.length, 'No duplicate sitemap URLs');
  for (const route of publicRoutes) {
    const path = (route === '/' ? '' : route.slice(1)) + 'index.html';
    const html = read(path);
    const canonical = 'https://princejona.me' + route;
    assert.ok(html.includes('<link rel="canonical" href="' + canonical + '"'), path + ' missing self-canonical');
    assert.match(html, /<meta name="description" content=/i, path + ' missing description');
    assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/i, path + ' must not be noindex');
  }
  assert.ok(read('robots.txt').includes('Sitemap: https://princejona.me/sitemap.xml'));
});
test('private state pages and not-found page do not appear in the sitemap', () => {
  for (const path of ['continue/index.html', 'craft/storage/index.html', '404.html']) {
    const html = read(path);
    assert.match(html, /<meta name="robots" content="[^"]*noindex/i, path);
    const route = path === '404.html' ? '/404.html' : '/' + path.slice(0, -'index.html'.length);
    assert.ok(!read('sitemap.xml').includes('<loc>https://princejona.me' + route + '</loc>'), route);
  }
});
