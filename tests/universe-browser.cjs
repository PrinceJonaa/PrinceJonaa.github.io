const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http'),path=require('node:path');
async function serve(){const root=process.cwd();const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};const server=http.createServer((req,res)=>{let filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!filename.startsWith(root+path.sep)&&filename!==root){res.writeHead(403).end();return;}if(fs.existsSync(filename)&&fs.statSync(filename).isDirectory())filename=path.join(filename,'index.html');if(!fs.existsSync(filename)){res.writeHead(404).end('Not found');return;}res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');fs.createReadStream(filename).pipe(res);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server;}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.UNIVERSE_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const server=process.env.UNIVERSE_TEST_URL?null:await serve();const base=process.env.UNIVERSE_TEST_URL||'http://127.0.0.1:'+server.address().port;
 // Network scope: shell never requests a media runtime.
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto(base+'/');await page.locator('[data-path]').first().waitFor();assert.equal(await page.locator('[data-path]').count(),4);
 await page.locator('[data-open-search]').first().click();await page.locator('[data-global-query]').fill('BPM');assert.ok(await page.locator('[data-public-id="app:jonaaudio"]').count());assert.ok(await page.locator('[data-public-id="case:jonaaudio"]').count());
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-search-dialog]').open);assert.equal(await page.locator('[data-search-dialog]').evaluate(d=>d.open),false);assert.equal(await page.locator('[data-open-search]').first().evaluate(b=>b===document.activeElement),true);
 await page.keyboard.press('Control+k');assert.equal(await page.locator('[data-search-dialog]').evaluate(d=>d.open),true);await page.locator('[data-global-query]').fill('BPM');await page.keyboard.press('Enter');await page.waitForURL('**/JonaAudio/#quick');
 await page.goto(base+'/apps/');await page.locator('.app-card').first().waitFor();assert.equal(await page.locator('.app-card').count(),8);
 await page.locator('[data-filter="music"]').click();assert.equal(await page.locator('.app-card').count(),3);
 await page.locator('[data-app-search]').fill('BPM');assert.equal(await page.locator('.app-card').count(),1);
 await page.locator('[data-app-search]').fill('missing');assert.match(await page.locator('[data-app-count]').innerText(),/^0/);await page.getByRole('button',{name:'Show all tools'}).click();assert.equal(await page.locator('.app-card').count(),8);
 await page.locator('[data-app-status]').selectOption('preview');assert.equal(await page.locator('.app-card').count(),1);assert.match(await page.locator('.app-card h3').innerText(),/RhythmCut/);await page.reload();await page.locator('.app-card').first().waitFor();assert.equal(await page.locator('.app-card').count(),1);await page.locator('[data-app-reset]').click();
 await page.locator('[data-open-search]').first().click();await page.locator('[data-global-query]').fill('no result');assert.equal(await page.locator('.search-result').count(),0);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-close-search')!==null),true);await page.keyboard.press('Tab');assert.equal(await page.locator('[data-global-query]').evaluate(el=>document.activeElement===el),true);await page.keyboard.press('Escape');
 for(const width of [320,390,430,768,1200,1440])for(const route of ['/','/apps/','/404.html','/work/','/services/','/work/cases/jonaaudio/','/work/cases/universe/','/work/cases/heartz4sale/','/work/cases/song-to-video/','/work/cases/resume/','/beatcut/','/continue/','/updates/','/music/']){
  await page.setViewportSize({width,height:900});await page.goto(base+route);if(route==='/apps/')await page.locator('.app-card').first().waitFor();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,route+' overflows at '+width);
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/apps/');await page.locator('.app-card').first().waitFor();await page.screenshot({path:'/tmp/universe-apps-mobile.png',fullPage:true});
 await page.goto(base+'/');await page.screenshot({path:'/tmp/universe-home-mobile.png',fullPage:false});assert.equal(await page.locator('[data-path="listen"]').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight),true,'first CTA in viewport');
 const shellRequests=requests.filter(u=>!u.includes('/JonaAudio/'));assert.ok(!shellRequests.some(u=>/\.wasm|onnx|\/rhythmcut\/assets\//.test(u)),'no media runtime in shell');
 // S2 discovery and inactive intake handoffs.
 await page.goto(base+'/');await page.locator('[data-path="hire"]').click();await page.waitForURL('**/services/');
 await page.locator('[data-open-search]').first().click();await page.locator('[data-global-query]').fill('master');assert.equal(await page.locator('[data-public-id="service:mix-master"]').count(),1);await page.keyboard.press('Enter');await page.waitForURL('**/services/#mix-master');await page.waitForFunction(()=>!document.querySelector('[data-search-dialog]').open);
 await page.locator('[data-open-search]').first().click();await page.locator('[data-global-query]').fill('resume');assert.equal(await page.locator('[data-public-id="resume:public"]').count(),1);await page.keyboard.press('Enter');await page.waitForURL('**/work/cases/resume/');
 await page.goto(base+'/work/?service=mix-master&replyEmail=private%40example.com#contact');await page.waitForFunction(()=>document.querySelector('[data-inquiry-status]').textContent.includes('unavailable'));
 assert.equal(await page.locator('[name="serviceId"]').inputValue(),'mix-master');assert.equal(await page.locator('[name="inquiryType"]').inputValue(),'music');assert.equal(await page.locator('[data-inquiry-submit]').isDisabled(),true);assert.ok(!page.url().includes('replyEmail'));
 await page.locator('[name="replyEmail"]').fill('client@example.com');await page.locator('[name="projectSummary"]').fill('Mix a song from approved stems for a planned independent release.');await page.locator('[name="consent"]').check();
 const draft=await page.locator('[data-email-brief]').evaluate(a=>{a.addEventListener('click',e=>e.preventDefault(),{once:true});a.click();return a.href;});assert.match(draft,/^mailto:contact@intervised.com/);assert.match(decodeURIComponent(draft),/Mix a song/);assert.match(await page.locator('[data-inquiry-status]').innerText(),/nothing has been submitted/);assert.equal(await page.locator('[name="projectSummary"]').inputValue(),'Mix a song from approved stems for a planned independent release.');
 await page.evaluate(()=>{window.__copiedBrief='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedBrief=text;}}});});await page.locator('[data-copy-brief]').click();await page.waitForFunction(()=>window.__copiedBrief.includes('Mix a song'));assert.match(await page.locator('[data-inquiry-status]').innerText(),/Nothing has been submitted/);
 await page.locator('[name="referencedUrl"]').fill('https://example.com/?%65mail=secret%40example.com');await page.locator('[data-copy-brief]').click();assert.equal(await page.locator('[data-inquiry-error]').isVisible(),true);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/universe-work-mobile.png',fullPage:true});await page.goto(base+'/services/');await page.screenshot({path:'/tmp/universe-services-mobile.png',fullPage:true});
 // Online form state tests use an explicit local transport fixture. These are
 // not evidence of production storage, SQL execution or email delivery.
 const online=await browser.newContext();const op=await online.newPage();op.on('pageerror',e=>errors.push(e.message));const attempts=[];let phase=0;const cors={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'Content-Type, Idempotency-Key','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
 await op.route('**/assets/inquiry-config.js',route=>route.fulfill({contentType:'text/javascript',body:"export const inquiryConfig={endpoint:'https://intake.example.test',email:'contact@intervised.com',consentVersion:'2026-10-12'};"}));
 await op.route('https://intake.example.test',async route=>{const r=route.request();if(r.method()==='GET')return route.fulfill({headers:cors,json:{ready:true}});if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'Content-Type, Idempotency-Key','Access-Control-Allow-Methods':'POST'}});attempts.push({key:r.headers()['idempotency-key'],body:r.postData()});phase++;if(phase===1)return route.abort('failed');if(phase===2)return route.fulfill({headers:cors,json:{ok:true}});return route.fulfill({status:201,headers:cors,json:{requestId:'123e4567-e89b-42d3-a456-426614174000',receivedAt:'2026-10-12T18:00:00.000Z',state:'received',emailState:'failed'}});});
 await op.goto(base+'/work/#contact');await op.waitForFunction(()=>!document.querySelector('[data-inquiry-submit]').disabled);await op.locator('[name="replyEmail"]').fill('client@example.com');await op.locator('[name="projectSummary"]').fill('A real brief with an accessible artist website requirement.');await op.locator('[name="consent"]').check();
 for(let i=0;i<2;i++){await op.locator('[data-inquiry-submit]').click();await op.waitForFunction(()=>document.querySelector('[data-inquiry-form]').getAttribute('aria-busy')===null);assert.equal(await op.locator('[data-inquiry-error]').isVisible(),true);assert.ok((await op.locator('[name="projectSummary"]').inputValue()).length>20);}
 await op.locator('[data-inquiry-submit]').click();await op.waitForFunction(()=>document.querySelector('[data-inquiry-status]').textContent.includes('Inquiry received.'));assert.equal(attempts.length,3);assert.ok(attempts.every(a=>a.key===attempts[0].key&&a.body===attempts[0].body));assert.match(await op.locator('[data-inquiry-status]').innerText(),/notification failed; the inquiry is stored/);assert.equal(await op.locator('[name="projectSummary"]').inputValue(),'');await online.close();
 const nojs=await browser.newContext({javaScriptEnabled:false});const np=await nojs.newPage();await np.goto(base+'/work/');assert.ok(await np.locator('noscript a[href^="mailto:contact@intervised.com"]').count());assert.equal(await np.locator('[data-inquiry-submit]').isDisabled(),true);await nojs.close();
 // Authoritative app writer: concurrent flush must wait; storage failure is false.
 await page.goto(base+'/JonaAudio/');await page.waitForFunction(()=>!!window.JonaAudioBridge);
 const result=await page.evaluate(async()=>{
  const {createSessionWriter,readSavedSession}=await import('/JonaAudio/session-persistence.js');
  const transaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);let handler;Object.defineProperty(tx,'oncomplete',{configurable:true,get:()=>handler,set:value=>{handler=value;tx.addEventListener('complete',e=>setTimeout(()=>value?.call(tx,e),80));}});return tx;};
  const writer=createSessionWriter(),state={tracks:[],selectedId:null,standaloneTuning:{key:'A'}};writer.schedule(state);const first=writer.flush();state.standaloneTuning={key:'B'};writer.schedule(state);let done=false;const second=writer.flush().then(v=>{done=true;return v;});await new Promise(r=>setTimeout(r,20));const prematurelyDone=done;await Promise.all([first,second]);IDBDatabase.prototype.transaction=transaction;
  const restored=await readSavedSession();const clean=!writer.isDirty();state.standaloneTuning={key:'D'};writer.schedule(state);const active=writer.flush();await new Promise(r=>setTimeout(r,10));state.standaloneTuning={key:'E'};writer.schedule(state);await active;await new Promise(r=>setTimeout(r,700));const timerClean=!writer.isDirty();state.standaloneTuning={key:'C'};writer.schedule(state);await writer.flush();const afterTimer=(await readSavedSession()).standaloneTuning.key;const open=indexedDB.open.bind(indexedDB);indexedDB.open=()=>{throw Error('storage denied')};writer.schedule(state);const failed=await writer.flush();indexedDB.open=open;
  return {prematurelyDone,key:restored.standaloneTuning.key,afterTimer,timerClean,clean,failed,dirty:writer.isDirty()};
 });assert.deepEqual(result,{prematurelyDone:false,key:'B',afterTimer:'C',timerClean:true,clean:true,failed:false,dirty:true});
 // App return navigation preserves the original editor browsing context.
 await page.goto(base+'/rhythmcut/');await page.locator('.universe-return').waitFor();await page.locator('.rc-app').waitFor();assert.equal(await page.locator('.rc-app').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),true,'RhythmCut fits below return row');await page.locator('.universe-return').click();const popupPromise=context.waitForEvent('page');await page.locator('#universe-return-dialog a[href="/apps/"]').click();const popup=await popupPromise;await popup.waitForLoadState();assert.ok(popup.url().endsWith('/apps/'));assert.ok(page.url().endsWith('/rhythmcut/'));await popup.close();await page.getByRole('button',{name:'Keep editing'}).click();
 await page.goto(base+'/craft/light/');await page.locator('.universe-return').waitFor();assert.equal(await page.locator('#lightcraft_canvas').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=60&&r.bottom<=innerHeight+1;}),true,'Craft canvas fits below return row');
 await page.goto(base+'/craft/');await page.locator('[data-tool="light"]').click();assert.equal(await page.locator('iframe[data-tool-frame]').count(),1);const src=await page.locator('#editor').getAttribute('src');await page.locator('#back').click();assert.equal(await page.locator('[data-tool=light]').evaluate(el=>document.activeElement===el),true);assert.equal(await page.locator('#editor').getAttribute('src'),src);await page.locator('[data-tool="film"]').click();assert.equal(await page.locator('iframe[data-tool-frame]').count(),2);await page.locator('#back').click();await page.locator('[data-tool="light"]').click();assert.equal(await page.locator('iframe[data-tool-frame]').count(),2);
 // S3 / S4 opt-in player and local persistence acceptance.
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/music/');
 assert.equal(await page.locator('[data-music-provider-host] iframe').count(),0,'no provider loaded before click');
 await page.locator('[data-music-tracks] .music-empty').waitFor();
 assert.match(await page.locator('[data-music-count]').innerText(),/0 approved preview tracks/);
 const sampleRate=22050,frames=sampleRate,buffer=Buffer.alloc(44+frames*2);
 buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);
 buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
 buffer.writeUInt32LE(sampleRate,24);buffer.writeUInt32LE(sampleRate*2,28);
 buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)buffer.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/sampleRate)*3000),44+i*2);
 await page.locator('[data-music-file]').setInputFiles({name:'private-test.wav',mimeType:'audio/wav',buffer});
 await page.locator('[data-music-current]').getByText('private-test.wav').waitFor();
 await page.locator('[data-music-play]').click();
 await page.waitForFunction(()=>document.querySelector('[data-music-audio]').currentTime>0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('pj-universe-music-v1')?.includes('private-test.wav')||false),false);
 await page.locator('[data-music-clear-queue]').click();
 assert.match(await page.locator('[data-music-queue]').innerText(),/Queue empty/);
 await page.goto(base+'/continue/');
 assert.equal(await page.locator('[data-memory-enable]').isChecked(),false);
 await page.locator('[data-memory-enable]').check();
 await page.goto(base+'/music/');
 await page.locator('[data-favorite-current]').click();
 await page.goto(base+'/continue/');
 assert.match(await page.locator('[data-memory-favorites]').innerText(),/Music/);
 assert.match(await page.locator('[data-memory-recents]').innerText(),/Music/);
 await page.reload();
 assert.equal(await page.locator('[data-memory-enable]').isChecked(),true);
 await page.locator('[data-memory-clear-all]').click();
 assert.match(await page.locator('[data-memory-favorites]').innerText(),/Nothing saved/);
 assert.match(await page.locator('[data-memory-recents]').innerText(),/History is off/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('pj-universe-return-v1')),null);
 await page.goto(base+'/updates/');
 assert.equal(await page.locator('[data-updates-list] article').count(),3);
 await page.locator('[data-updates-filter]').selectOption('apps');
 assert.equal(await page.locator('[data-updates-list] article').count(),1);
 // Scope errors: upstream WASM on this desktop is not a verified compatibility claim.
 const shellErrors=errors.filter(e=>!e.includes('WebAssembly')&&!e.includes('SharedArrayBuffer')&&!e.includes('GPU')&&!e.includes('fetch')&&!e.includes('memory'));
 console.log(JSON.stringify({result:'PASS',viewports:[320,390,430,768,1200,1440],writer:result,observedErrors:errors,shellErrors}));assert.equal(shellErrors.length,0);
 await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
})().catch(e=>{console.error(e);process.exit(1)});
