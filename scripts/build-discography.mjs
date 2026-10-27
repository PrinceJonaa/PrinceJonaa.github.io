import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,rmSync,rmdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// Static archive, deliberately separate from assets/music-catalog.json (S3 player).
const SITE='https://princejona.me', PERSON=SITE+'/#prince-jona';
const START='<!-- PUBLIC_DISCOGRAPHY_START -->', END='<!-- PUBLIC_DISCOGRAPHY_END -->';
const GENERATED='<!-- GENERATED_RELEASE_PAGE: prince-jona-public-discography-v1 -->';
const slugRe=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const assert=(test,why)=>{if(!test)throw new Error('Discography: '+why);};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const safeUrl=v=>{
  assert(typeof v==='string','expected a URL');
  const u=new URL(v);
  assert(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&!/[\s<>"'\x60]/.test(v),'unsafe URL');
  return u;
};
const providerPatterns={
  spotify:u=>u.hostname==='open.spotify.com'&&/^\/(album|track)\/[a-zA-Z0-9]+\/?$/.test(u.pathname),
  'apple-music':u=>u.hostname==='music.apple.com'&&/^\/[a-z]{2}\/album\/[^/?]+\/[0-9]+\/?$/.test(u.pathname),
  soundcloud:u=>u.hostname==='soundcloud.com'&&u.pathname.split('/').filter(Boolean).length>=2,
  youtube:u=>['youtube.com','www.youtube.com'].includes(u.hostname)&&((u.pathname==='/watch'&&!!u.searchParams.get('v'))||(u.pathname==='/playlist'&&!!u.searchParams.get('list')))
};
function validate(data,root){
  assert(obj(data)&&data.schemaVersion===1,'schemaVersion must be 1');
  assert(date(data.reviewedAt),'reviewedAt must be ISO date');
  for(const k of ['releases','tracks','sources'])assert(Array.isArray(data[k]),k+' must be array');
  const sources=new Map(),tracks=new Map(),ids=new Set(),slugs=new Set();
  for(const s of data.sources){
    assert(obj(s)&&/^source:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id)&&!sources.has(s.id),'source ID invalid/duplicate');
    assert(['owner-confirmed','official-release'].includes(s.kind)&&date(s.verifiedAt),'invalid source');
    if(s.kind==='owner-confirmed')assert(s.approvedBy==='person:prince-jona','source lacks owner confirmation');
    else safeUrl(s.url);
    sources.set(s.id,s);
  }
  for(const t of data.tracks){
    assert(obj(t)&&/^track:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.id)&&!tracks.has(t.id),'track ID invalid/duplicate');
    assert(typeof t.title==='string'&&!!t.title.trim()&&t.title.length<=160,'track title invalid');
    assert(Array.isArray(t.releaseIds)&&new Set(t.releaseIds).size===t.releaseIds.length,'track release links invalid');
    assert(Number.isInteger(t.position)&&t.position>0,'track position invalid');
    tracks.set(t.id,t);
  }
  const declaredPublicSlugs=new Set(data.releases.filter(r=>r?.status==='public').map(r=>r.slug));
  const published=[];
  for(const r of data.releases){
    assert(obj(r)&&/^release:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.id)&&!ids.has(r.id),'release ID invalid/duplicate');
    assert(typeof r.slug==='string'&&slugRe.test(r.slug)&&!slugs.has(r.slug),'slug invalid/duplicate');
    ids.add(r.id);slugs.add(r.slug);
    assert(typeof r.title==='string'&&!!r.title.trim()&&r.title.length<=160,'release title invalid');
    assert(['single','ep','album','mixtape','other'].includes(r.kind),'invalid release kind');
    assert(['draft','review','public','withdrawn'].includes(r.status),'invalid status');
    assert(Array.isArray(r.primaryArtistIds)&&r.primaryArtistIds.length===1&&r.primaryArtistIds[0]==='person:prince-jona','unconfirmed primary artist');
    assert(Array.isArray(r.trackIds)&&new Set(r.trackIds).size===r.trackIds.length,'duplicate track IDs');
    if(r.releaseDate)assert((r.datePrecision==='day'&&date(r.releaseDate))||(r.datePrecision==='month'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(r.releaseDate))||(r.datePrecision==='year'&&/^\d{4}$/.test(r.releaseDate)),'invalid release date precision');
    assert(r.links===undefined||Array.isArray(r.links),'links must be array');
    for(const link of r.links||[]){
      assert(obj(link)&&Object.hasOwn(providerPatterns,link.platform),'unknown provider');
      assert(providerPatterns[link.platform](safeUrl(link.url)),'link is not a release-specific official URL');
    }
    if(r.status!=='public')continue;
    const a=r.approvals||{}, evidence=r.evidenceSourceIds||[],fs=r.fieldSources||{};
    assert(a.publicMetadataApproved===true&&a.approvedBy==='person:prince-jona'&&date(a.approvedAt),'public metadata requires approval');
    assert(Array.isArray(evidence)&&evidence.length>0&&evidence.every(id=>sources.has(id)),'missing release evidence');
    for(const field of ['title','kind','primaryArtistIds'])assert(Array.isArray(fs[field])&&fs[field].length>0&&fs[field].every(id=>evidence.includes(id)),'missing source for '+field);
    if(r.releaseDate)assert(Array.isArray(fs.releaseDate)&&fs.releaseDate.length>0&&fs.releaseDate.every(id=>evidence.includes(id)),'date lacks source');
    assert((r.links||[]).every(l=>evidence.includes(l.sourceId)),'release link lacks source');
    for(const l of r.links||[])if(sources.get(l.sourceId)?.kind==='official-release')assert(sources.get(l.sourceId).url===l.url,'source and release URL mismatch');
    assert((r.links||[]).length>0||evidence.some(id=>sources.get(id).kind==='owner-confirmed'),'no verified release listing or direct approval');
    if(r.cover)assert(a.publicArtworkApproved===true&&typeof r.cover.alt==='string'&&!!r.cover.alt.trim()&&typeof r.cover.src==='string'&&/^\/assets\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp|avif)$/.test(r.cover.src)&&existsSync(join(root,r.cover.src.slice(1))),'cover not cleared or local file missing');
    const editor=r.editorial||{};
    assert(obj(editor),'editorial must be object');
    for(const field of ['introduction','whyIMadeIt','whatItRepresents','process']){
      if(editor[field]!==undefined)assert(typeof editor[field]==='string','invalid editorial '+field);
    }
    if(editor.intentionalLyricNotes!==undefined)assert(Array.isArray(editor.intentionalLyricNotes),'invalid lyric notes');
    if(editor.creativeTimeline!==undefined)assert(Array.isArray(editor.creativeTimeline)&&editor.creativeTimeline.every(x=>obj(x)&&typeof x.label==='string'&&!!x.label.trim()&&(x.date===undefined||date(x.date))&&(x.detail===undefined||typeof x.detail==='string')),'invalid creative timeline');
    const hasText=Object.values(editor).some(x=>typeof x==='string'&&!!x.trim()||Array.isArray(x)&&x.length>0);
    if(hasText)assert(a.publicTextApproved===true&&Array.isArray(fs.editorial)&&fs.editorial.length>0&&fs.editorial.every(id=>evidence.includes(id)),'text needs approval and source');
    if(editor.intentionalLyricNotes?.length){
      assert(a.lyricReuseApproved===true,'lyric quote rights required');
      assert(Array.isArray(editor.intentionalLyricNotes)&&editor.intentionalLyricNotes.every(n=>obj(n)&&typeof n.excerpt==='string'&&typeof n.meaning==='string'),'invalid lyric notes');
    }
    const attached=r.trackIds.map(id=>{
      const t=tracks.get(id);
      assert(t&&t.releaseIds.includes(r.id)&&t.approvals?.publicMetadataApproved===true&&Array.isArray(t.sourceIds)&&t.sourceIds.some(id=>evidence.includes(id)),'unverified track: '+id);
      return t;
    }).sort((a,b)=>a.position-b.position);
    assert(new Set(attached.map(t=>t.position)).size===attached.length,'duplicate track positions');
    assert((r.links||[]).length>0||attached.length>0,'blank release cannot be public');
    assert(r.credits===undefined||Array.isArray(r.credits),'credits must be array');
    if(r.credits?.length)assert(a.publicCreditsApproved===true,'contributor credits require separate approval');
    for(const c of r.credits||[])assert(obj(c)&&typeof c.name==='string'&&!!c.name.trim()&&typeof c.role==='string'&&!!c.role.trim()&&evidence.includes(c.sourceId),'credit lacks provenance');
    assert(r.related===undefined||Array.isArray(r.related),'related must be array');
    if(r.related?.length)assert(a.publicRelationsApproved===true,'public relationships require separate approval');
    for(const edge of r.related||[]){
      assert(obj(edge)&&typeof edge.title==='string'&&!!edge.title.trim()&&typeof edge.href==='string'&&evidence.includes(edge.sourceId)&&/^\/(?:apps|JonaAudio|rhythmcut|work|music|notes)\/[a-zA-Z0-9/_-]*\/?$/.test(edge.href),'unsafe or unsourced relationship');
      if(edge.href.startsWith('/music/')&&edge.href!=='/music/'){
        const match=edge.href.match(/^\/music\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/);
        assert(match&&match[1]!==r.slug&&declaredPublicSlugs.has(match[1]),'related release is not public');
      } else if(edge.href!=='/music/'){
        const linked=join(root,edge.href.slice(1),'index.html');
        assert(existsSync(linked)&&!/<meta\s+name=["']robots["'][^>]*noindex/i.test(readFileSync(linked,'utf8')),'related route not published');
      }
    }
    published.push({...r,publicTracks:attached});
  }
  return published.sort((a,b)=>String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||a.title.localeCompare(b.title));
}
const paragraph=v=>typeof v==='string'&&v.trim()?'<p>'+esc(v)+'</p>':'';
const section=(title,body)=>body?'<section class="release-section"><h2>'+esc(title)+'</h2>'+body+'</section>':'';
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
function page(r,template){
  const url=SITE+'/music/'+r.slug+'/',kind={single:'Single',ep:'EP',album:'Album',mixtape:'Mixtape',other:'Release'}[r.kind];
  const e=r.editorial||{},name=r.title+' | Prince Jona Music',desc=e.introduction?.trim().slice(0,155)||r.title+' — '+kind+' by Prince Jona. Explore confirmed tracks, credits and official listening links.';
  const recordings=r.publicTracks.map(t=>'<li>'+esc(t.title)+'</li>').join('');
  const credits=(r.credits||[]).map(c=>'<li class="release-credit"><strong>'+esc(c.name)+'</strong><span>'+esc(c.role)+'</span></li>').join('');
  const links=(r.links||[]).map(l=>'<li><a href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer">'+esc({'apple-music':'Apple Music',spotify:'Spotify',soundcloud:'SoundCloud',youtube:'YouTube'}[l.platform])+' ↗</a></li>').join('');
  const related=(r.related||[]).map(l=>'<li><a href="'+esc(l.href)+'">'+esc(l.title)+'</a></li>').join('');
  let editorial=section('About this release',paragraph(e.introduction))+section('Why I made it',paragraph(e.whyIMadeIt))+section('What it represents',paragraph(e.whatItRepresents))+section('The process',paragraph(e.process));
  if(e.intentionalLyricNotes?.length)editorial+=section('Lyric notes','<ul>'+e.intentionalLyricNotes.map(n=>'<li><blockquote>'+esc(n.excerpt)+'</blockquote>'+paragraph(n.meaning)+'</li>').join('')+'</ul>');
  if(e.creativeTimeline?.length)editorial+=section('Creative timeline','<ol class="release-timeline">'+e.creativeTimeline.map(n=>'<li>'+(n.date?'<time datetime="'+esc(n.date)+'">'+esc(n.date)+'</time> · ':'')+'<strong>'+esc(n.label)+'</strong>'+paragraph(n.detail)+'</li>').join('')+'</ol>');
  const record={'@type':r.kind==='single'?'MusicRecording':'MusicAlbum','@id':url+'#release',name:r.title,url,byArtist:{'@id':PERSON}};
  if(r.releaseDate)record.datePublished=r.releaseDate;
  if(r.links?.length)record.sameAs=r.links.map(l=>l.url);
  if(r.cover)record.image=SITE+r.cover.src;
  if(r.publicTracks.length&&r.kind!=='single')record.track=r.publicTracks.map(t=>({'@type':'MusicRecording',name:t.title,position:t.position}));
  const graph={'@context':'https://schema.org','@graph':[
    {'@type':'Person','@id':PERSON,name:'Prince Jona',url:SITE+'/'},
    {'@type':'WebPage','@id':url+'#webpage',url,name,description:desc,mainEntity:{'@id':url+'#release'}},
    {'@type':'BreadcrumbList','@id':url+'#breadcrumbs',itemListElement:[
      {'@type':'ListItem',position:1,name:'Universe',item:SITE+'/'},
      {'@type':'ListItem',position:2,name:'Music',item:SITE+'/music/'},
      {'@type':'ListItem',position:3,name:r.title,item:url}
    ]},record]};
  const vals={
    PAGE_TITLE:esc(name),DESCRIPTION:esc(desc),CANONICAL:esc(url),OG_TYPE:r.kind==='single'?'music.song':'music.album',
    TITLE:esc(r.title),KIND:esc(kind),RELEASE_META:r.releaseDate?'<p class="release-meta">Released '+esc(r.releaseDate)+' ('+esc(r.datePrecision)+' precision)</p>':'',
    OPEN_GRAPH_IMAGE:r.cover?'<meta property="og:image" content="'+esc(SITE+r.cover.src)+'"><meta property="og:image:alt" content="'+esc(r.cover.alt)+'">':'',
    TWITTER_CARD:r.cover?'summary_large_image':'summary',STRUCTURED_DATA:json(graph),
    COVER:r.cover?'<figure class="release-cover"><img src="'+esc(r.cover.src)+'" alt="'+esc(r.cover.alt)+'" loading="lazy"></figure>':'',
    EDITORIAL:editorial,TRACKLIST:section('Track listing',recordings?'<ol class="release-tracks">'+recordings+'</ol>':''),
    CREDITS:section('Confirmed credits',credits?'<ul>'+credits+'</ul>':''),
    LINKS:section('Listen on official platforms',links?'<ul class="release-links">'+links+'</ul>':''),
    RELATIONS:section('Related paths',related?'<ul>'+related+'</ul>':'')
  };
  return GENERATED+'\n'+template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{assert(Object.hasOwn(vals,key),'unknown template slot '+key);return vals[key];});
}
function indexBlock(releases){
  const cards=releases.map(r=>'<li><a href="/music/'+esc(r.slug)+'/">'+esc(r.title)+'</a><p>'+esc(r.kind==='ep'?'EP':r.kind)+(r.releaseDate?' · '+esc(r.releaseDate):'')+'</p></li>').join('\n');
  return '<section class="section music-discography" id="discography" aria-labelledby="discography-title">\n'+
    '<div class="section-head"><div><span class="eyebrow">Verified public archive</span><h2 id="discography-title">Records and the stories behind them.</h2><p>Each approved release has its own place in the universe, with credits, context and official listening paths.</p></div></div>\n'+
    (cards?'<ul class="release-archive-list">\n'+cards+'\n</ul>':'<p class="fineprint">Individual release pages will appear here as specific releases and public reuse rights are verified. Meanwhile, official listening profiles are available below.</p>')+
    '\n</section>';
}
export function buildDiscography(root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),opts={}){
  const data=JSON.parse(readFileSync(join(root,'data/public-discography.json'),'utf8'));
  const releases=validate(data,root);
  const template=readFileSync(join(root,'templates/music-release.html'),'utf8');
  const musicIndex=join(root,'music/index.html'),before=readFileSync(musicIndex,'utf8');
  const a=before.indexOf(START),b=before.indexOf(END);
  assert(a>=0&&b>a&&before.indexOf(START,a+START.length)<0&&before.indexOf(END,b+END.length)<0,'missing unique index region');
  const updated=before.slice(0,a+START.length)+'\n'+indexBlock(releases)+'\n'+before.slice(b);
  const desired=new Map([[musicIndex,updated]]),active=new Set();
  for(const r of releases){
    const path=join(root,'music',r.slug,'index.html');
    desired.set(path,page(r,template));active.add(path);
  }
  const musicDir=join(root,'music');
  for(const dir of readdirSync(musicDir,{withFileTypes:true})){
    if(!dir.isDirectory())continue;
    const file=join(musicDir,dir.name,'index.html');
    if(existsSync(file)&&readFileSync(file,'utf8').startsWith(GENERATED)&&!active.has(file)){
      if(opts.check)throw new Error('Stale generated release: '+file);
      rmSync(file);try{rmdirSync(join(musicDir,dir.name));}catch{}
    }
  }
  for(const [file,value] of desired){
    if(existsSync(file)&&readFileSync(file,'utf8')===value)continue;
    if(opts.check)throw new Error('Generated file out of date: '+file);
    mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value,'utf8');
  }
  return {published:releases.length,paths:[...active]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const check=process.argv.includes('--check');
  const result=buildDiscography(undefined,{check});
  console.log('Discography '+(check?'checked':'built')+': '+result.published+' approved releases');
}
