import { readFile, writeFile, mkdir, readdir, unlink, rmdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://princejona.me';
const GENERATED = '<!-- generated:build-notes v1; edit source files, not this HTML -->';
const TYPES = new Set(['personal-reflection', 'behind-the-song', 'lyric-interpretation', 'creation-diary', 'software-tutorial', 'research', 'story', 'collaboration-process']);
const STATUSES = new Set(['draft', 'review', 'public', 'withdrawn']);
const EDGE_TYPES = new Set(['explains', 'references', 'about', 'builtWith', 'followUpTo', 'collaboratedWith']);
const TARGETS = Object.freeze({
  'world:music': ['/music/', 'Music'],
  'world:apps': ['/apps/', 'Apps'],
  'world:atlas': ['/atlas/', 'Public Atlas'],
  'world:work': ['/work/', 'Work'],
  'world:services': ['/services/', 'Services'],
  'tool:jonaaudio': ['/JonaAudio/', 'JonaAudio'],
  'tool:rhythmcut': ['/rhythmcut/', 'RhythmCut'],
  'person:prince-jona': ['/about/', 'About Prince Jona'],
});
const labelByType = { explains: 'Explains', references: 'References', about: 'About', builtWith: 'Built with', followUpTo: 'Follow-up to', collaboratedWith: 'Created with' };

function fail(message) { throw new Error(`Notes build: ${message}`); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c])); }
function assertString(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label} must be a nonempty string (max ${max})`);
  return value.trim();
}
function iso(value, label, required = false) {
  if (!required && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value) || Number.isNaN(Date.parse(value))) fail(`invalid ${label}`);
  return value;
}
function safeUrl(raw, label, { internal = true } = {}) {
  assertString(raw, label, 2048);
  if (/\s|\\|[\u0000-\u001f\u007f]/.test(raw) || raw.startsWith('//')) fail(`unsafe ${label}`);
  if (internal && /^\/(?!\/)[A-Za-z0-9/_-]+\/?(?:#[A-Za-z0-9_-]+)?$/.test(raw) && !raw.includes('..')) return raw;
  let url;
  try { url = new URL(raw); } catch { fail(`invalid ${label}`); }
  if (url.protocol !== 'https:' || url.username || url.password) fail(`unsafe ${label}`);
  return url.href;
}
function verifyLocalHref(root, href, label) {
  if (!href.startsWith('/')) return;
  const pathname = href.split('#')[0];
  if (!pathname.endsWith('/')) fail(`${label}: local link must target a directory URL`);
  const relative = pathname.slice(1);
  const full = path.resolve(root, relative, 'index.html');
  if (!full.startsWith(path.resolve(root) + path.sep) || !existsSync(full)) fail(`${label}: missing public route ${pathname}`);
}
function formatDate(date) { return date ? new Intl.DateTimeFormat('en-US', { year:'numeric', month:'long', day:'numeric', timeZone:'UTC' }).format(new Date(date)) : ''; }
function jsonLd(value) { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'); }
function inline(text, root) {
  const rx = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let out = '', pos = 0, match;
  const decorate = (s) => escapeHtml(s).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  while ((match = rx.exec(text))) {
    out += decorate(text.slice(pos, match.index));
    const href = safeUrl(match[2], 'Markdown link');
    verifyLocalHref(root, href, 'Markdown link');
    out += `<a href="${escapeHtml(href)}"${href.startsWith('https:') ? ' rel="noopener noreferrer"' : ''}>${decorate(match[1])}</a>`;
    pos = match.index + match[0].length;
  }
  return out + decorate(text.slice(pos));
}
export function markdownToHtml(source, root = DEFAULT_ROOT) {
  if (typeof source !== 'string' || source.length > 200_000) fail('Markdown too large');
  if (/!\[[^\]]*\]\([^)]+\)/.test(source)) fail('images require separate rights-approved asset review');
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [], list = null;
  const flushParagraph = () => { if (paragraph.length) { blocks.push(`<p>${inline(paragraph.join(' '), root)}</p>`); paragraph = []; } };
  const flushList = () => { if (list) { blocks.push(`<${list.kind}>${list.items.map(x => `<li>${inline(x, root)}</li>`).join('')}</${list.kind}>`); list = null; } };
  for (const line of lines) {
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^\s*([-*]|\d+\.)\s+(.+)$/.exec(line);
    const quote = /^>\s?(.+)$/.exec(line);
    if (heading) { flushParagraph(); flushList(); const level = Math.max(2, heading[1].length + 1); blocks.push(`<h${level}>${inline(heading[2], root)}</h${level}>`); }
    else if (bullet) { flushParagraph(); const kind = /^\d/.test(bullet[1]) ? 'ol' : 'ul'; if (list && list.kind !== kind) flushList(); if (!list) list = {kind, items:[]}; list.items.push(bullet[2]); }
    else if (quote) { flushParagraph(); flushList(); blocks.push(`<blockquote><p>${inline(quote[1], root)}</p></blockquote>`); }
    else { flushList(); paragraph.push(line.trim()); }
  }
  flushParagraph(); flushList();
  return blocks.join('\n');
}
function renderHead(title, description, canonical, type, record, hasPosts) {
  const article = type === 'article';
  const breadcrumbs = [
    {'@type':'ListItem', position:1, name:'Universe', item:`${SITE}/`},
    {'@type':'ListItem', position:2, name:'Notes', item:`${SITE}/notes/`},
  ];
  if (article) breadcrumbs.push({'@type':'ListItem', position:3, name:record.title, item:canonical});
  const graphs = [
    {'@type':'BreadcrumbList','itemListElement':breadcrumbs},
    article ? {'@type':'BlogPosting', '@id':`${canonical}#article`, 'headline':record.title, 'description':record.summary, 'mainEntityOfPage':canonical, 'author':{'@type':'Person','@id':`${SITE}/#prince-jona`,'name':'Prince Jona'}, 'inLanguage':'en', 'datePublished':record.publishedAt, ...(record.updatedAt ? {dateModified:record.updatedAt} : {})} : {'@type':'CollectionPage','name':'Notes | Prince Jona Universe','url':canonical,'description':description},
  ];
  const rss = hasPosts ? `<link rel="alternate" type="application/rss+xml" title="Prince Jona Notes" href="${SITE}/notes/feed.xml">` : '';
  const robots = !article && !hasPosts ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow">';
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#050711"><meta name="color-scheme" content="dark">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">${robots}<link rel="canonical" href="${escapeHtml(canonical)}"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/assets/notes.css">
<meta property="og:type" content="${article?'article':'website'}"><meta property="og:site_name" content="Prince Jona Universe"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta name="twitter:card" content="summary">${rss}
<script type="application/ld+json">${jsonLd({'@context':'https://schema.org','@graph':graphs})}</script>`;
}
function relatedHtml(record, root) {
  const links = [];
  for (const edge of record.relatedEdges ?? []) {
    if (edge.visibility !== 'public' || edge.approval?.approved !== true) continue;
    if (!EDGE_TYPES.has(edge.type) || edge.from !== record.id) fail(`bad public relation on ${record.id}`);
    if (!edge.sourceUrl) fail(`public relation on ${record.id} lacks source`);
    safeUrl(edge.sourceUrl, 'relation source', {internal:false});
    let href, targetLabel;
    if (edge.to) {
      const entry = TARGETS[edge.to];
      if (!entry) fail(`unresolved public relation ${edge.to}`);
      [href, targetLabel] = entry;
      verifyLocalHref(root, href, 'relation target');
    } else if (edge.externalUrl) {
      href = safeUrl(edge.externalUrl, 'external relation', {internal:false});
      targetLabel = assertString(edge.label, 'external relation label', 120);
    } else fail('public relation lacks target');
    links.push(`<li><span class="relation-type">${escapeHtml(labelByType[edge.type])}</span><a href="${escapeHtml(href)}"${href.startsWith('https:')?' rel="noopener noreferrer"':''}>${escapeHtml(targetLabel)}</a></li>`);
  }
  return links.length ? `<section aria-labelledby="connections-title" class="note-connections"><h2 id="connections-title">Explore connections</h2><p>These links are reviewed pathways, not automatic claims of collaboration or causation.</p><ul>${links.join('')}</ul></section>` : '';
}
function validateEntry(entry, ids, slugs) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('invalid entry');
  const id = assertString(entry.id, 'id');
  if (!/^note:[a-z0-9][a-z0-9-]*$/.test(id) || ids.has(id)) fail(`bad or duplicate note id ${id}`);
  ids.add(id);
  const slug = assertString(entry.slug, 'slug', 100);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) fail(`bad or duplicate slug ${slug}`);
  slugs.add(slug);
  if (!STATUSES.has(entry.status)) fail(`bad status ${id}`);
  if (entry.status !== 'public') return false;
  assertString(entry.title, 'title', 120); assertString(entry.summary, 'summary', 300);
  if (entry.authorId !== 'person:prince-jona' || !TYPES.has(entry.articleType)) fail(`unreviewed author or article type ${id}`);
  if (!Array.isArray(entry.categories) || !entry.categories.length || entry.categories.some(x=>typeof x!=='string'||!x.trim()||x.length>60)) fail(`bad categories ${id}`);
  if (entry.contentFile !== `content/notes/${slug}.md`) fail(`bad content path ${id}`);
  iso(entry.authoredAt, 'authoredAt'); iso(entry.publishedAt, 'publishedAt', true); iso(entry.updatedAt, 'updatedAt');
  if (!entry.editorialApproval || entry.editorialApproval.approvedBy !== 'person:prince-jona' || entry.editorialApproval.publicationApproved !== true || !entry.editorialApproval.revision || !entry.editorialApproval.evidenceUrl) fail(`unapproved content ${id}`);
  iso(entry.editorialApproval.approvedAt, 'approval date', true);
  safeUrl(entry.editorialApproval.evidenceUrl, 'approval evidence', {internal:false});
  if (!entry.rights || entry.rights.textApproved !== true || entry.rights.thirdPartyMediaApproved !== true) fail(`rights not cleared ${id}`);
  if (!Array.isArray(entry.sources) || entry.sources.some(source=>{try { safeUrl(source, 'source', {internal:false}); return false; } catch { return true; }})) fail(`bad source ${id}`);
  if (!Array.isArray(entry.relatedEdges)) fail(`bad relations ${id}`);
  if (entry.heroAsset !== null && entry.heroAsset !== undefined) fail(`hero media deferred for ${id}`);
  return true;
}
async function renderPage(template, head, main) {
  if (!template.includes('{{HEAD}}') || !template.includes('{{MAIN}}')) fail('template missing slots');
  return template.replace('{{HEAD}}', head).replace('{{MAIN}}', main);
}
export async function buildNotes({ root = DEFAULT_ROOT } = {}) {
  const registry = JSON.parse(await readFile(path.join(root, 'data/public-notes.json'), 'utf8'));
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.entries)) fail('unsupported notes manifest');
  iso(registry.updatedAt, 'manifest updatedAt');
  const template = await readFile(path.join(root, 'templates/note.html'), 'utf8');
  const ids = new Set(), slugs = new Set(), articles = [];
  for (const entry of registry.entries) {
    if (!validateEntry(entry, ids, slugs)) continue;
    const content = await readFile(path.join(root, entry.contentFile), 'utf8');
    if (!content.trim()) fail(`blank article ${entry.id}`);
    const body = markdownToHtml(content, root);
    if (body.replace(/<[^>]+>/g, '').trim().length < 160) fail(`thin article ${entry.id}`);
    articles.push({ ...entry, body, relations:relatedHtml(entry, root) });
  }
  articles.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.slug.localeCompare(b.slug));
  const outRoot = path.join(root, 'notes');
  await mkdir(outRoot, {recursive:true});
  for (const item of await readdir(outRoot, {withFileTypes:true})) {
    if (!item.isDirectory() || articles.some(article=>article.slug===item.name)) continue;
    const file = path.join(outRoot, item.name, 'index.html');
    if (!existsSync(file)) continue;
    if (!(await readFile(file,'utf8')).startsWith(GENERATED)) continue;
    await unlink(file);
    if ((await readdir(path.dirname(file))).length===0) await rmdir(path.dirname(file));
  }
  const indexMain = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Universe</a><span aria-hidden="true">/</span><span aria-current="page">Notes</span></nav><header class="notes-intro"><div class="notes-title"><span class="kicker">The written world / Field notes</span><h1>Ideas deserve<br><em>room to move.</em></h1><p class="lead">The thoughts, the work, the questions in between. Writing connects music, making, research and everything that does not fit neatly into one category.</p></div><aside class="notes-aside" aria-label="About this collection"><span class="folio-index">Collected paths / 01</span><div class="folio-number" aria-hidden="true">PJ.</div><div class="rule" aria-hidden="true"></div><p>A personal creative universe, not a single lane. Read freely. Follow what connects.</p></aside></header><section aria-labelledby="archive-title"><div class="notes-toolbar"><div><span class="section-kicker">01 / The archive</span><h2 id="archive-title">Writing, when it's ready.</h2></div><span class="count">${articles.length} published ${articles.length === 1 ? 'piece' : 'pieces'}</span></div>${articles.length ? `<ol class="notes-grid">${articles.map(x=>`<li><article class="note-card"><span class="kicker">${escapeHtml(x.categories.join(' / '))}</span><h3><a href="/notes/${escapeHtml(x.slug)}/">${escapeHtml(x.title)}</a></h3><p>${escapeHtml(x.summary)}</p><time datetime="${escapeHtml(x.publishedAt)}">${escapeHtml(formatDate(x.publishedAt))}</time></article></li>`).join('')}</ol>` : `<div class="empty-notes"><div><span class="kicker">The opening page</span><h2>No borrowed voice.<br>No filler.</h2><p>No articles have been approved for publication here yet. Until then, there are real places in the universe to explore.</p></div></div>`}</section><section class="world-paths" aria-labelledby="paths-title"><span class="section-kicker">02 / Other entrances</span><h2 id="paths-title">Every path leads somewhere.</h2><ul><li><a href="/music/">Music <span>Listen and explore releases</span></a></li><li><a href="/apps/">Creative tools <span>Try what is being built</span></a></li><li><a href="/atlas/">Public Atlas <span>Explore published relational ideas</span></a></li><li><a href="/work/">Work <span>Projects and processes</span></a></li></ul></section>`;
  const indexHtml = await renderPage(template, renderHead('Notes | Prince Jona Universe','Writing, creative process, research and tools from Prince Jona, published after editorial review.',`${SITE}/notes/`,'index',null,articles.length>0),indexMain);
  await writeFile(path.join(outRoot,'index.html'), GENERATED+'\n'+indexHtml, 'utf8');
  for (const article of articles) {
    const url = `${SITE}/notes/${article.slug}/`;
    const main = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Universe</a><span aria-hidden="true">/</span><a href="/notes/">Notes</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(article.title)}</span></nav><article class="article"><header class="article-header"><span class="kicker">${escapeHtml(article.categories.join(' / '))}</span><h1>${escapeHtml(article.title)}</h1><p class="lede">${escapeHtml(article.summary)}</p><p class="byline">By <a href="/about/">Prince Jona</a> · <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatDate(article.publishedAt))}</time> · <span>${Math.max(1, Math.ceil(article.body.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length / 225))} min read</span></p><div class="reading-tools"><button type="button" data-copy-link hidden>Copy article link</button><span role="status" data-copy-status aria-live="polite"></span></div></header><div class="article-body">${article.body}</div>${article.revisionNote ? `<p class="revision-note">Revision note: ${escapeHtml(article.revisionNote)}</p>`:''}${article.sources.length ? `<section aria-labelledby="sources-title"><h2 id="sources-title">Sources</h2><ul>${article.sources.map((source)=>`<li><a href="${escapeHtml(source)}" rel="noopener noreferrer">${escapeHtml(source)}</a></li>`).join('')}</ul></section>`:''}${article.relations}</article><nav class="back-link" aria-label="Explore more"><a href="/notes/">Back to all notes</a><a href="/">Explore the Universe</a></nav>`;
    const html = await renderPage(template, renderHead(`${article.title} | Prince Jona Notes`,article.summary,url,'article',article,true),main);
    const directory = path.join(outRoot,article.slug);
    await mkdir(directory,{recursive:true});
    await writeFile(path.join(directory,'index.html'), GENERATED+'\n'+html, 'utf8');
  }
  // Free Search Console-compatible Notes sitemap & RSS. Only actually approved posts.
  // Root sitemap, robots and shared site navigation remain untouched until B07.
  const sitemapPath = path.join(outRoot,'sitemap.xml');
  const feedPath = path.join(outRoot,'feed.xml');
  const marker = '<!-- generated:build-notes v1 -->';
  if (articles.length) {
    const xmlEsc = (value) => escapeHtml(value);
    const urls = [SITE + '/notes/', ...articles.map(a=>SITE+'/notes/'+a.slug+'/')];
    const sitemap = '<?xml version="1.0"?>\n' + marker + '\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(url=>'  <url><loc>'+xmlEsc(url)+'</loc></url>').join('\n') + '\n</urlset>\n';
    const feed = '<?xml version="1.0"?>\n' + marker + '\n' +
      '<rss version="2.0"><channel><title>Prince Jona Notes</title><link>'+SITE+'/notes/</link><description>Approved writing and creative process from Prince Jona.</description><language>en-us</language>' +
      articles.map(a=>'<item><title>'+xmlEsc(a.title)+'</title><link>'+SITE+'/notes/'+a.slug+'/</link><guid isPermaLink="true">'+SITE+'/notes/'+a.slug+'/</guid><description>'+xmlEsc(a.summary)+'</description><pubDate>'+new Date(a.publishedAt).toUTCString()+'</pubDate></item>').join('') +
      '</channel></rss>\n';
    await writeFile(sitemapPath,sitemap,'utf8');
    await writeFile(feedPath,feed,'utf8');
  } else {
    for (const file of [sitemapPath,feedPath]) {
      if (existsSync(file) && (await readFile(file,'utf8')).includes(marker)) await unlink(file);
    }
  }
  return { pages:1+articles.length, published:articles.length, slugs:articles.map(x=>x.slug), sitemap:articles.length ? '/notes/sitemap.xml' : null };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildNotes().then(v=>console.log(`Notes: ${v.published} approved articles, ${v.pages} static pages`)).catch(e=>{console.error(e.message); process.exitCode=1;});
}
