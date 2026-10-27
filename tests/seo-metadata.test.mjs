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
test('the sitemap includes main public pages but not personalized local state', () => {
  const sitemap = read('sitemap.xml');
  for (const [, url] of core) assert.ok(sitemap.includes(`<loc>${url}</loc>`), url);
  assert.ok(!sitemap.includes('<loc>https://princejona.me/continue/</loc>'));
  assert.ok(read('continue/index.html').includes('<meta name="robots" content="noindex,follow">'));
  assert.ok(read('robots.txt').includes('Sitemap: https://princejona.me/sitemap.xml'));
});
