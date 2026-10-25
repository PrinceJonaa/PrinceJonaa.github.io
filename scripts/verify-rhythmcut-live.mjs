import {readFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const PUBLIC_BASE='https://princejona.me/rhythmcut/';
export const ARTIFACT_BASE='https://rhythmcut.vercel.app/rhythmcut/';
const sha40=/^[0-9a-f]{40}$/;
export function checkManifest(release,info){
 if(!sha40.test(release?.commit||'')||release.sourceRef!=='main'||release.path!=='/rhythmcut/')
  throw Error('Invalid approved main source identity');
 if(info?.commit!==release.commit||info.version!==release.version||info.sourceRef!=='main'||info.manifest!=='release.json')
  throw Error('Release metadata does not agree');
 return {sha:release.commit,version:release.version};
}
export function entryAssets(html){
 const found=[...html.matchAll(/\/rhythmcut\/assets\/[A-Za-z0-9._/-]+\.(?:js|css)/g)].map(m=>m[0]);
 const assets=[...new Set(found)].filter(p=>!p.includes('..'));
 if(!assets.some(p=>p.endsWith('.js'))||!assets.some(p=>p.endsWith('.css')))
  throw Error('Public HTML lacks versioned JS/CSS runtime');
 if(!html.includes('/assets/app-return.js'))throw Error('Universe app-return navigation missing');
 return assets;
}
export async function inspectLive({fetcher=fetch,reader=readFile,publicBase=PUBLIC_BASE,artifactBase=ARTIFACT_BASE}={}){
 const local=async file=>Buffer.from(await reader(resolve('rhythmcut',file)));
 const readJSON=async file=>JSON.parse((await local(file)).toString('utf8'));
 const release=await readJSON('release.json');
 const info=await readJSON('release-info.json');
 const identity=checkManifest(release,info);
 const html=(await local('index.html')).toString('utf8');
 const assets=entryAssets(html);
 const paths=['release.json','release-info.json','index.html',...assets];
 for(const file of paths){
  const pathname=file.startsWith('/')?file.slice('/rhythmcut/'.length):file;
  const expected=await local(pathname);
  const url=new URL(pathname,publicBase);
  url.searchParams.set('ci_verify',identity.sha);
  const response=await fetcher(url.toString(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
  if(!response.ok)throw Error('Public '+pathname+' returned HTTP '+response.status);
  const served=Buffer.from(await response.arrayBuffer());
  if(!served.equals(expected))throw Error('Public '+pathname+' bytes differ from staged release');
 }
 const upstream=await fetcher(new URL('release-info.json?ci_verify='+identity.sha,artifactBase),{cache:'no-store'});
 if(!upstream.ok)throw Error('Vercel production release-info unavailable: HTTP '+upstream.status);
 const upstreamInfo=await upstream.json();
 if(upstreamInfo.commit!==identity.sha||upstreamInfo.version!==identity.version||upstreamInfo.sourceRef!=='main')
  throw Error('Public Pages release is no longer equal to the latest Vercel production artifact');
 return {...identity,checked:paths.length,assets:assets.length};
}
async function main(){
 const budget=Number(process.env.LIVE_VERIFY_MAX_WAIT_MS||480000);
 if(!Number.isSafeInteger(budget)||budget<0||budget>900000)throw Error('Invalid verification budget');
 const started=Date.now();let last;
 do{
  try{
   const result=await inspectLive();
   console.log('LIVE RHYTHMCUT VERIFIED',JSON.stringify(result));
   if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,
    '\n### Live RhythmCut release verified\n- SHA: '+result.sha+'\n- Version: '+result.version+
    '\n- Byte-identical files: '+result.checked+'\n- Validated JS/CSS assets: '+result.assets+
    '\n- Compared against current Vercel production release\n');
   return;
  }catch(error){last=error;console.warn('Public release not verified yet:',error.message)}
  if(Date.now()-started>=budget)break;
  await new Promise(resolve=>setTimeout(resolve,Math.min(10000,budget-(Date.now()-started))));
 }while(true);
 throw Error('Live Pages verification failed after retry window: '+last?.message);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error(e);process.exitCode=1});
