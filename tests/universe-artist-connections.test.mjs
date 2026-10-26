import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const f=p=>readFileSync(p,'utf8');
const pages=['index.html','music/index.html','apps/index.html','atlas/index.html','about/index.html','work/index.html'];
test('each public world links to another without JS',()=>{
 for(const page of pages){const html=f(page);assert.match(html,/<section class="section universe-thread"/,page);assert.match(html,/<nav class="thread-grid"/,page);assert.match(html,/<h2 id="[^"]+-thread-title"/,page);}
 assert.match(f('assets/universe.css'),/\.thread-link:focus-visible/);
 assert.match(f('assets/universe.css'),/max-width:760px/);
});
test('artist links are explicit, with no guessed Patreon or other SoundCloud profile',()=>{
 const music=f('music/index.html');
 assert.match(music,/Prince Jonah.*Sadboy Jona/);
 for(const href of ['https://soundcloud.com/princejona','https://www.ismsofficial.com/','https://music.apple.com/us/artist/prince-jona/1654646579','/JonaAudio/','/rhythmcut/','/jonavideo/'])assert.ok(music.includes('href="'+href+'"'),href);
 for(const page of pages){
  const h=f(page),section=h.match(/<section class="section universe-thread"[\s\S]*?<\/section>/)?.[0]||'';
  assert.doesNotMatch(section,/patreon\.com|\/records\/jona-52\/|soundcloud\.com\/sadboy/i,page);
  for(const match of section.matchAll(/<a[^>]*href="https:\/\/[^"]+"[^>]*>/g))assert.match(match[0],/rel="noopener noreferrer"/);
 }
 const catalog=JSON.parse(f('assets/music-catalog.json'));
 assert.ok(catalog.platforms.some(p=>p.id==='soundcloud'&&p.url==='https://soundcloud.com/princejona'));
});
test('cross-site routes reconnect music, apps and public Atlas',()=>{
 for(const [p,hrefs] of Object.entries({'index.html':['/music/','/apps/'],'apps/index.html':['/music/','/JonaAudio/','/rhythmcut/'],'atlas/index.html':['/music/','/JonaAudio/','/work/'],'work/index.html':['/music/','/apps/']}))for(const href of hrefs)assert.ok(f(p).includes('href="'+href+'"'),p+': '+href);
});
