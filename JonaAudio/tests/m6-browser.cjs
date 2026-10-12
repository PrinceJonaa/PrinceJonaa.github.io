const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {writeFileSync}=require('node:fs');
function wav(seconds=5,rate=44100,tempo=120){
 const frames=seconds*rate, data=Buffer.alloc(44+frames*4);
 data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);
 data.writeUInt16LE(1,20);data.writeUInt16LE(2,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*4,28);
 data.writeUInt16LE(4,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(frames*4,40);
 for(let i=0;i<frames;i++){
   const t=i/rate,click=(t*tempo/60)%1<.012?.6:0;
   const sample=Math.max(-1,Math.min(1,click+.12*Math.sin(2*Math.PI*261.63*t)+.1*Math.sin(2*Math.PI*329.63*t)+.09*Math.sin(2*Math.PI*392*t)));
   const v=Math.round(sample*32767);data.writeInt16LE(v,44+i*4);data.writeInt16LE(v,46+i*4);
 }return data;
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/JonaAudio/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.JonaAudioBridge&&document.querySelector('.new-layout'),null,{timeout:12000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No 390px overflow');
  const a=wav(),b=wav(6,44100,90);
  await page.locator('#files').setInputFiles([{name:'M6 Artist.wav',mimeType:'audio/wav',buffer:a},{name:'M6 Reference.wav',mimeType:'audio/wav',buffer:b}]);
  await page.waitForFunction(()=>window.JonaAudioBridge.list().length===2,null,{timeout:15000});
  await page.waitForFunction(()=>window.JonaAudioBridge.list().every(t=>t.analysis?.['track:key']?.status==='ready'||t.analysis?.['track:key']?.status==='unavailable'),null,{timeout:60000});
  await page.locator('[data-route=studio]').click();await page.locator('[data-tool=engineer]').click();
  await page.getByRole('button',{name:'Analyze levels'}).click();
  await page.waitForFunction(()=>!!window.JonaAudioBridge.list()[0].result?.quality,null,{timeout:30000});
  assert.ok((await page.locator('.quality-panel').textContent()).length>0);
  await page.locator('[data-tool=compare]').click();await page.getByRole('button',{name:'Measure both levels'}).click();
  await page.waitForFunction(()=>window.JonaAudioBridge.list().every(t=>!!t.result?.quality),null,{timeout:30000});
  await page.locator('.compare-widget button', {hasText:'Listen A'}).click();
  await page.locator('[data-route=settings]').click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export session JSON'}).click()]);
  assert.match(download.suggestedFilename(),/session.json/);
  await page.reload();await page.waitForFunction(()=>window.JonaAudioBridge?.list().length===2,null,{timeout:15000});
  const saved=await page.evaluate(()=>window.JonaAudioBridge.list());assert.ok(saved.every(t=>!t.sourceAvailable&&t.state==='source-missing'));
  await page.locator('[data-route=library]').click();
  const picker=page.waitForEvent('filechooser');await page.locator('.job-action').first().click();
  (await picker).setFiles({name:'M6 Artist.wav',mimeType:'audio/wav',buffer:a});
  await page.waitForFunction(()=>window.JonaAudioBridge.list()[0].sourceAvailable===true,null,{timeout:20000});
  for(const width of [320,390,430,1200]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width);}
  assert.deepEqual(errors,[]);
  console.log('M6 browser: import x2, progressive result, engineer, A/B, session download, restore, relink, responsive x4 PASS');
 }catch(e){
  await page.screenshot({path:'JonaAudio/tests/m6-browser-failure.png',fullPage:true}).catch(()=>{});
  console.log('M6 browser errors:',errors);console.log('M6 browser state:',JSON.stringify(await page.evaluate(()=>({hash:location.hash,trackList:window.JonaAudioBridge?.list(),selectedId:window.JonaAudioBridge?.selectedId(),diagnostics:window.JonaAudioBridge?.diagnostics(),status:document.querySelector('#status')?.textContent,toast:document.querySelector('.global-status')?.textContent}))).catch(e=>({error:String(e)}))).slice(0,10000));
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
