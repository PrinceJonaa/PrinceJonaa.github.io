const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=process.cwd();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 try {
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end('Denied');
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file))return res.writeHead(404).end('Missing');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
 } catch(e){res.writeHead(400).end('Invalid request')}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/records/jona-52/';
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const width of [320,390,430,768,1200]){
   await page.setViewportSize({width,height:844});
   for(const hash of ['#site-99','#xdept','#notebook','#hr-sloane','#security-badge','#evidence-appointment-0418']){
    await page.goto(base+hash,{waitUntil:'load'});
    await page.locator('#main-content').waitFor();
    assert.ok((await page.locator('#main-content').innerText()).length>80,hash+' empty');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,hash+' overflow '+width);
   }
  }
  await page.goto(base+'#evidence-appointment-0418');
  await page.locator('.ev-record').waitFor();
  await page.locator('[data-ev-action="bookmark"]').click();
  await page.goto(base+'#notebook');
  await page.locator('.ev-notebook').waitFor();
  assert.match(await page.locator('#main-content').innerText(),/My Investigation/);
  assert.match(await page.evaluate(()=>localStorage.getItem('site99:investigation:v1')||''),/appointment-0418/);
  assert.deepEqual(errors,[]);
  console.log('Site-99 six routes x five sizes, notebook persistence PASS');
 }catch(error){
  await page.screenshot({path:'/tmp/site99-failure.png',fullPage:true}).catch(()=>{});
  console.log('Site-99 JS errors:',errors);throw error;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
