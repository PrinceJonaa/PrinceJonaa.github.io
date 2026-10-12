import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const file=p=>readFileSync(p,'utf8');
test('S3 media requires individual rights and cannot silently publish private work',()=>{
 const m=JSON.parse(file('assets/music-catalog.json'));
 assert.equal(m.schema,1);
 assert.ok(Array.isArray(m.tracks)&&Array.isArray(m.releases)&&Array.isArray(m.videos));
 assert.equal(m.tracks.length,0);
 assert.equal(m.videos.length,0);
 assert.ok(m.platforms.every(p=>p.url.startsWith('https://')));
 const js=file('assets/music-world.js');
 assert.match(js,/sitePreviewApproved===true/);
 assert.match(js,/publicMetadataApproved===true/);
 assert.match(js,/publicVideoApproved===true/);
 assert.match(js,/URL.createObjectURL/);
 assert.match(js,/URL.revokeObjectURL/);
 assert.ok(!/fetch\([^)]*objectURL/.test(js));
});
test('S3 player is consent-based and browser-local',()=>{
 const page=file('music/index.html');
 for(const key of ['data-music-provider','data-music-file','data-music-play','data-music-seek','data-music-volume','data-music-queue'])assert.ok(page.includes(key));
 assert.doesNotMatch(page,/<iframe[^>]*src=/i);
});
test('S4 only public IDs and local storage, projects stay app-owned',()=>{
 const js=file('assets/return.js');
 for(const token of ['historyEnabled:false','memory.recents=[]','localStorage.removeItem(MUSIC_KEY)',"r.id==='jonaaudio'","r.id==='rhythmcut'"])assert.ok(js.includes(token));
 assert.ok(!/indexedDB|OPFS|localStorage\.clear\(/.test(js));
 assert.ok(existsSync('continue/index.html'));
 assert.ok(existsSync('updates/index.html'));
 assert.match(file('assets/site-updates.js'),/36b9ee150c1468de6dfc6036bb3e5c4b01dab4a8/);
});
