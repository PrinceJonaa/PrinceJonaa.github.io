/* Site-99 RAISA mirror. Deliberately styled as a traditional Wikidot-era archive. */
(function(){
'use strict';
var titles=['The City Record','A Harmless Pattern','The Reference Tone','The Tower That Wasn\'t Built','Instrument Request','The Floor','The Observation Problem','The Last Revision','The Reader\'s Copy'];
var classes=['Explained','Safe','Euclid','Keter','Thaumiel (denied)','Archon','Pending','Neutralized (denied)','Unclassified'];
var requirements=[0,1,2,3,4,4,5,5,6];
var articleTags=['scp','site-99','jona-52','archival-integrity','pataphysics','information','uncontained'];
var appendixInfo=[{key:'A',name:'Experiment Register J-52',level:2,tags:['experiment','ethics','jona-52']},{key:'B',name:'Pataphysics Cross-Reference Register',level:4,tags:['pataphysics','cross-reference','level-4']},{key:'C',name:'Groups of Interest Correspondence',level:3,tags:['groups-of-interest','site-99','intelligence']},{key:'D',name:'Recovered Margin Annotations',level:6,tags:['level-6','information','archival-integrity']}];
var tags=['archival-integrity','cross-reference','ethics','experiment','groups-of-interest','information','intelligence','jona-52','level-4','level-6','pataphysics','personnel','scp','site-99','uncontained'];
var clearance=0,route='',logs=['SESSION OPEN // RAISA node 99-C'],localRating=0;
var maxClearance=0,credentialMessage='',hintRevealed=0;
var puzzle=window.Site99Puzzles;
function readProgress(){try{var n=Number(localStorage.getItem('site99:clearance:v1'));return Number.isInteger(n)&&n>=0&&n<=6?n:0}catch(e){return 0}}
function saveProgress(){try{localStorage.setItem('site99:clearance:v1',String(maxClearance))}catch(e){}}
maxClearance=readProgress();clearance=maxClearance;
function syncClearance(){var select=$('clear');if(select){select.value=String(clearance);Array.from(select.options).forEach(function(opt){var permitted=Number(opt.value)<=maxClearance;opt.textContent=opt.textContent.replace(/ \[SEALED\]$/,'')+(permitted?'':' [SEALED]')})}var status=$('clearance-status');if(status)status.textContent='Verified: Level '+maxClearance+' / Active: Level '+clearance}

var incidents=window.Site99Incidents;
var seedThreads=[
{id:'containment',title:'SCP-JONA containment language',posts:[
{author:'Researcher T. Vale',date:'22 Oct 2026, 09:16',body:'The room has been cleared. There is nothing in it. Stop attaching the body-camera still to every update. Orr sees it every time you forward the file.'},
{author:'Dr. A. Renn / Ethics Committee',date:'22 Oct 2026, 10:41',body:'The contact request is denied. Please stop putting the civilian name in the destination field. It will not become a signed order through repetition.'},
{author:'Director Havel',date:'22 Oct 2026, 13:07',body:'I did not authorize a seventh member of the recovery team. There are six beds in the medical unit. Someone has slept in all seven.'}]},
{id:'site99',title:'Why is this file hosted outside the main database?',posts:[
{author:'RAISA-99',date:'21 Oct 2026, 22:04',body:'The central Foundation index returned a valid deletion instruction for this entry while claiming the entry had never been submitted. The offsite mirror is preserved under Site-99 directive 52/B.'},
{author:'O5-11',date:'22 Oct 2026, 00:12',body:'Do not migrate these records back into the public index. Duplication of the revision history triggered the original incident. This is a custody order, not an explanation.'},
{author:'Archivist K. Morrow',date:'22 Oct 2026, 01:32',body:'I carried the paper original down to Storage C myself. The courier who signed for it is the man standing beside me in the security footage. I was alone.'}]},
{id:'0222',title:'02:22 / authorship field',level:5,posts:[
{author:'Archivist K. Morrow',date:'20 Oct 2026, 02:31',body:'At 02:22, revision metadata briefly listed the active editor as READER. Seven terminals reproduced the entry. The name did not correspond to a Foundation account.'},
{author:'Researcher T. Vale',date:'20 Oct 2026, 09:09',body:'Do not tell him about the third camera. He knows there were two. Whatever you do, do not make him sit through the recording again.'}]}
].concat(incidents.threads,window.Site99Horror.threads);
var fileEntries=[
{name:'J52-INITIAL-REPORT.txt',level:0,kind:'Field report',body:'RAISA / SITE-99\nINTAKE: JONA-52\nSOURCE: municipal records; civilian technical and music publications.\nRECEIVING CLERK: T. Vale\nSTATION: Desk 4\nInitial review: no confirmed nonstandard properties. Continued observation pending.'},
{name:'MODEL-TRACE-52.LOG',level:2,kind:'Technical appendix',body:'CHAIN-52 / EVACUATION ANALYTICS\nCYCLE 51: ALL PERSONNEL ACCOUNTED FOR\nCYCLE 52: 1106 PERSONNEL / TWO EXIT PATHS\nCYCLE 53: NO UNIQUE EXIT PATH / INDETERMINATE\nEXIT LABEL: THE ONE YOU DID NOT USE\nDo not restart the process from the final save.'},
{name:'ETHICS-DISPOSITION-9.txt',level:3,kind:'Committee register',body:'ETHICS COMMITTEE / DISPOSITION T-52\nVOTE: 9-0 AGAINST DEPLOYMENT\nCHAIR: Dr. A. Renn\nSTATUS: CLOSED\nThe Committee declined to endorse an instrument designation.'},
{name:'CHAIN52-SIMULATION.LOG',level:3,kind:'Simulation transcript',body:'CHAIN-52 / SECOND RUN\nINITIAL CONDITIONS: NEW\nREFERENCES TO CIVILIAN: NONE\nCYCLE 52: TWO EXITS\nCYCLE 53: NO UNIQUE ROUTE\nOFFLINE PRINT QUEUE: ACTIVE\nWALL SCRATCH OBSERVED / PHOTO: 02:22'},
{name:'OFFSITE-ORDER-52B.txt',level:5,kind:'O5 archive directive',body:'DIRECTIVE 52/B\nAUTHOR: O5-11\nSUBJECT: OFFSITE RETENTION OF SCP-JONA\nCentral-index publication suspended. Site-99 retains the sole operative revision ledger.\nThis is a custody measure. It is not authorization to approach JONA.'},
{name:'READER-FIELD.txt',level:6,kind:'Recovered metadata',body:'FIELD: last_edited_by\nVALUE: READER\nAUTHORITY: UNRESOLVED\nSOURCE: UNKNOWN\n\nIf the field changes while you are looking at it, record what changed. Do not record what you wanted it to mean.'}
].concat(incidents.attachments,window.Site99Horror.attachments);
incidents.cases.forEach(function(c){c.tags.forEach(function(t){if(tags.indexOf(t)<0)tags.push(t)})});
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var cap=function(t){return t.replace(/(^|-)\w/g,function(x){return x.toUpperCase()}).replace(/-/g,' ')};
function audit(message){logs.unshift(message); if(logs.length>28)logs.length=28;var el=$('audit-lines');if(el)el.textContent=logs.map(function(l,i){return '['+String(logs.length-i).padStart(3,'0')+'] '+l}).join('\n')}
function setHash(hash){if(location.hash!=='#'+hash)location.hash=hash;else render()}
function href(r){return '#'+r}
function anchor(label,to,cl){return '<a'+(cl?' class="'+cl+'"':'')+' href="'+href(to)+'">'+esc(label)+'</a>'}
function gatedHtml(req,label){return '<div class="access-denied" role="status"><strong class="denied-caption">ACCESS DENIED / LEVEL '+req+' REQUIRED</strong><h2>'+esc(label)+'</h2><p>Your credential record is not sufficient to view this document.</p><p>Site-99 issues higher clearance through the RAISA verification terminal. Only the next level may be requested.</p><button type="button" class="site-btn" data-action="request" data-level="'+req+'">Open verification terminal</button></div>'}
function appendicesHtml(){
 var items=appendixInfo.map(function(a,i){
 var permitted=clearance>=a.level;
 return '<details class="addendum-item" '+(!permitted?'data-restricted="true"':'')+'><summary><strong>ADDENDUM J-52/'+a.key+'</strong> '+esc(permitted?a.name:'[RESTRICTED FILE]')+' <small>LEVEL '+a.level+'</small></summary>'+
 (permitted?'<div class="addendum-content">'+data.appendices[i].html+'</div>':'<div class="addendum-content">'+gatedHtml(a.level,'Addendum J-52/'+a.key)+'</div>')+
 '</details>';
 }).join('');
 return '<section class="addenda" id="addenda"><h2>Attached Documents</h2><p class="archive-note">Portions of this file are subject to access restrictions. Record identifiers are preserved where content is withheld.</p>'+items+'</section>'
}
function revNav(){
 var holder=$('revision-list');holder.replaceChildren();
 titles.forEach(function(t,i){var a=document.createElement('a');a.href='#revision-'+i;a.className='revision-item'+(route==='revision-'+i?' selected':'')+(clearance<requirements[i]?' restricted':'');
 a.textContent='J/'+i+' — '+(clearance<requirements[i]?'[LEVEL '+requirements[i]+']':t);
 a.setAttribute('aria-current',route==='revision-'+i?'page':'false');holder.appendChild(a)});
}
function tagsForRevision(i){var t=articleTags.slice();if(i===0)t=['scp','site-99','jona-52','explained'];if(i>=3)t.push('archival-integrity');if(i>=6)t.push('pataphysics');if(i===8)t.push('level-6');return t}
function tagbar(current){var tagsToShow=current||articleTags;return '<div class="tagbar"><span>tags:</span> '+tagsToShow.map(function(t){return anchor(t,'tag-'+t)}).join(' ')+'</div>'}
function setTitle(t){$('page-title').textContent=t;document.title=t+' - Site-99 Foundation Archive'}
function setMeta(str){$('page-meta').textContent=str}

/* Read/receipt/echo form the unindexed receiver path. No browser identity is collected. */
var veilFile=window.Site99Veil,veilWitnessKey='site99:veil:v1',veilChoiceKey='site99:veil:judgment:v1';
function veilMarks(){try{var raw=JSON.parse(sessionStorage.getItem(veilWitnessKey)||'[]');return Array.isArray(raw)?raw:[]}catch(e){return []}}
function markVeilWitness(id){if(maxClearance<6)return;var marks=veilMarks();if(marks.indexOf(id)>=0)return;marks.push(id);try{sessionStorage.setItem(veilWitnessKey,JSON.stringify(marks))}catch(e){}}
function veilEligible(){var marks=veilMarks();return maxClearance>=6&&['copy','return','echo'].every(function(k){return marks.indexOf(k)>=0})}
function veilChoice(){try{return localStorage.getItem(veilChoiceKey)||''}catch(e){return ''}}
function saveVeilChoice(v){try{localStorage.setItem(veilChoiceKey,v)}catch(e){}}
function veilOutcome(v){
 var options={
  intact:{label:'INTACT / report 99-C/NIL-A',content:'Your assessment assigns the event to an explanation the public can carry without changing its world. This may be the intended function of the Veil. No record establishes whether the explanation preceded the event.'},
  broken:{label:'BREACHED / report 99-C/NIL-B',content:'Your assessment treats reception of the record as exposure. The Foundation cannot establish whether the recipient believed it, or whether such belief was required for a breach to occur.'},
  unknown:{label:'UNDETERMINED / report 99-C/NIL-C',content:'No binary status was entered. The Veil has not thereby been restored or destroyed. A receiving position exists; its relation to normalcy remains unclassified.'}
 };
 var entry=options[v];var lastOriginal=worldBeforeEligible()?'<p class="archive-note final-original-slip">A physical enclosure has been released from records custody: '+anchor('Inspect the unreturned original','world-before')+'. The return docket contains no date.</p>':'';return entry?'<div class="veil-assessment" role="status"><strong>RAISA ENTRY RECORDED: '+entry.label+'</strong><p>'+entry.content+'</p><p>All three original reports remain on file. No Overseer ruling selects one over another.</p></div>'+lastOriginal:'';
}
function renderVeil(){
 setTitle('99-C/NIL');setMeta('RAISA / NORMALCY CONTINUITY / UNINDEXED');$('rating-box').hidden=true;
 if(!veilEligible()){
  $('main-content').innerHTML='<p class="archive-note">RAISA-99 / Index reply</p><p>No entry corresponding to this address exists in the current revision ledger.</p><p>'+anchor('Return to JONA-52','revision-0')+'</p>';
  return
 }
 var decision=veilChoice();
 var field='<form id="veil-form" class="veil-form"><label for="veil-judgment">Receiving position — enter an assessment</label>'+
 '<div class="veil-controls"><select id="veil-judgment" required><option value="">— No assessment entered —</option><option value="intact">Veil intact</option><option value="broken">Veil breached</option><option value="unknown">Unable to determine</option></select>'+
 '<button type="submit" class="site-btn">File assessment</button></div></form>'+
 '<div id="veil-result" aria-live="polite">'+veilOutcome(decision)+'</div>';
 $('main-content').innerHTML=veilFile.html.replace('<div id="veil-interaction"></div>','<div id="veil-interaction">'+field+'</div>');
 $('veil-judgment').value=decision||'';
 $('veil-form').addEventListener('submit',function(e){
  e.preventDefault();
  var v=$('veil-judgment').value;if(['intact','broken','unknown'].indexOf(v)<0)return;
  saveVeilChoice(v);$('veil-result').innerHTML=veilOutcome(v);audit('99-C/NIL RECEIVER ASSESSMENT FILED');
 });
}

function markRevisionSeven(){try{sessionStorage.setItem('site99:sealed-last-revision','1')}catch(e){}}
function hadRevisionSeven(){try{return sessionStorage.getItem('site99:sealed-last-revision')==='1'}catch(e){return false}}

/* The surviving continuity packet is staged by actual reads, not by URL alone. */
var restoration=window.Site99Restoration,restorationLeaves=window.Site99RestorationLeaves;
var restorationStages=['ledger','relay','overseers','flash','second','palimpsest'];
var restorePrefix='site99:52r:';
function seenRestoration(k){try{return localStorage.getItem(restorePrefix+k)==='1'}catch(e){return false}}
function markRestoration(k){try{localStorage.setItem(restorePrefix+k,'1')}catch(e){}}
function permittedRestoration(id){
 if(clearance<5||!hadRevisionSeven())return false;
 if(id==='ledger')return true;
 if(id==='relay')return seenRestoration('ledger');
 if(id==='overseers')return clearance>=6&&seenRestoration('relay');
 if(id==='flash')return clearance>=6&&seenRestoration('overseers');
 if(id==='second')return clearance>=6&&seenRestoration('flash');
 if(id==='palimpsest')return clearance>=6&&seenRestoration('second');
 return false;
}
function restorationLeaf(container,id){
 var value=container[id];return value&&seenRestoration(value.requires)?value.html:'';
}
function renderRestoration(id){
 setTitle('Site-99 / File 52-R');setMeta('O5 / RAISA / UNRECONCILED TRANSFER');$('rating-box').hidden=true;
 if(clearance<5){$('main-content').innerHTML=gatedHtml(5,'Special Archives / Transfer 52-R');return}
 if(!hadRevisionSeven()){
  $('main-content').innerHTML='<p class="archive-note">No retained transfer slip is attached to this revision.</p><p>'+anchor('Return to revision register','revision-0')+'</p>';return
 }
 var pages=restoration.pages;
 if(id){
  var page=pages.find(function(p){return p.id===id});
  if(!page||!permittedRestoration(id)){
   $('main-content').innerHTML='<p class="archive-note">RAISA reply / RECORD NOT RETAINED IN THIS COPY</p><p>The selected transfer identifier has no readable entry in the current registry.</p><p>'+anchor('Return to transfer register','continuity')+'</p>';return
  }
  markRestoration(id);audit('52-R TRANSFER READ // '+id.toUpperCase());
  var following=restorationStages[restorationStages.indexOf(id)+1];
  var next=following&&permittedRestoration(following)?'<p class="archive-note">An additional original has been located: '+anchor('Inspect attached custody copy','continuity-'+following)+'</p>':'';
  var back='<p class="archive-note">'+anchor('Transfer register 52-R','continuity')+' · '+anchor('SCP-JONA / J/7','revision-7')+'</p>';
  $('main-content').innerHTML='<div class="revision-notice"><span>OVERSEAS ARCHIVE 52-R / '+esc(id.toUpperCase())+'</span><span>LEVEL '+page.level+'</span></div><article class="record-body restoration-body">'+page.body+'</article>'+next+back;
  return
 }
 var rows=pages.map(function(p){
   var permitted=permittedRestoration(p.id);
   var visible=permitted||seenRestoration(p.id);
   return '<tr><td>'+esc(p.id==='ledger'?'52-R/0':p.id==='relay'?'52-R/1':'52-R/'+(restorationStages.indexOf(p.id)+1))+'</td><td>'+(visible?anchor(p.title,'continuity-'+p.id):'[ORIGINAL NOT RETAINED]')+'</td><td>Level '+p.level+'</td><td>'+(seenRestoration(p.id)?'READ':permitted?'RECEIVED':'PENDING')+'</td></tr>';
 }).join('');
 $('main-content').innerHTML='<p>These records were recovered after the JONA-52 archive disposal. The central index maintains that no earlier case sequence was destroyed.</p>'+
 '<table class="history-table restoration-table"><thead><tr><th>File</th><th>Document</th><th>Access</th><th>Retention</th></tr></thead><tbody>'+rows+'</tbody></table>'+
 '<p class="archive-note">The register reflects documents physically received by RAISA. It does not establish the order in which the events described occurred.</p>'+
 '<p>'+anchor('Return to the last revision','revision-7')+'</p>';
}


/* Last custodied original: never public-indexed, only discoverable after every
   52-R original and the separate 99-C/NIL receiving judgment. */
var worldBefore=window.Site99WorldBefore;
var worldBeforeKey='site99:world-before:v1';
function worldBeforeEligible(){
 return maxClearance>=6&&clearance>=6&&restorationStages.every(function(k){return seenRestoration(k)})&&veilEligible()&&!!veilChoice();
}
function seenWorldBefore(){try{return localStorage.getItem(worldBeforeKey)==='1'}catch(e){return false}}
function markWorldBefore(){try{localStorage.setItem(worldBeforeKey,'1')}catch(e){}}
function renderWorldBefore(){
 setTitle('O5/52-NULL');setMeta('SITE-99 / UNRETURNED ORIGINAL / LEVEL 6');$('rating-box').hidden=true;
 if(!worldBeforeEligible()){
  $('main-content').innerHTML='<p class="archive-note">RAISA DISPOSITION: no custody item bearing this number is present in the active index.</p><p>'+anchor('Return to RAISA records','revision-0')+'</p>';
  return
 }
 markWorldBefore();audit('UNRETURNED ORIGINAL OPENED // CHAIN-52 / O5-NULL');
 $('main-content').innerHTML=worldBefore.html+
 '<div class="world-before-return"><p class="archive-note">Custody seal intact. One earlier record now identifies a separate original.</p><p>'+
 anchor('Review the first case again','revision-0')+' · '+anchor('Return to the Veil inquiry','veil-nil')+' · '+anchor('Overseas recovered register','continuity')+'</p></div>';
}

function renderRevision(i){
 setTitle('SCP-JONA');
 setMeta('REVISION J/'+i+'  ·  '+classes[i].toUpperCase()+'  ·  SITE-99 / OFFSITE');
 var body=$('main-content'),locked=clearance<requirements[i];
 $('rating-box').hidden=false;
 if(locked){body.innerHTML=gatedHtml(requirements[i],'SCP-JONA / Revision J/'+i)+tagbar(['scp','site-99','restricted']);audit('RETRIEVAL REFUSED // J/'+i+' // LEVEL '+requirements[i]);return}
 var html=data.versions[String(i)]||'<p>FILE MISSING</p>';
 html=html.replace(/^<h1>.*?<\/h1>\s*/s,'');
 if(i===7){markRevisionSeven();if(clearance>=5)html+='<p class="archive-note">UNRECONCILED TRANSFER: '+anchor('52-R/0 / duplicate custody receipt','continuity')+'. Entered without original reference.</p>'}
 if(i===0&&hadRevisionSeven()){html+='<p class="archive-note"><strong>RAISA AMENDMENT / 02:22:</strong> The original document was closed before this amendment was entered. This remains the original document.</p>'}
 html+=restorationLeaf(restorationLeaves.versions,String(i));
 if(i===0&&seenWorldBefore())html+=worldBefore.revisionAfter;
 if(i===8){markVeilWitness('copy');if(veilEligible()){html=html.replace('<strong>END OF FILE?</strong>','<strong><a href="#veil-nil" class="veil-last-door">END OF FILE?</a></strong>')}}
 // The index page is intentionally the first readable record, not a level-2 briefing.
 var match=['position','witness','witness','door','authority','feedback','receiver','feedback','receiver'][i];
 var evidence='<section class="linked-cases"><h2>Related Incident Files</h2><p>'+anchor('RAISA 99-C / '+(i<3?'field observations':i<6?'investigation': 'restricted custody'),'case-'+match)+' · '+anchor('Incident register','cases')+'</p></section>';
 body.innerHTML='<div class="revision-notice"><span>ARCHIVE REVISION J/'+i+'</span><span>CLASS: '+esc(classes[i])+'</span></div>'+
 '<div class="record-body">'+html+'</div>'+evidence+appendicesHtml()+tagbar(tagsForRevision(i));
}
function renderHome(){
 setTitle('Site-99 Archive');setMeta('RAISA NODE 99-C / OFFSITE MIRROR');$('rating-box').hidden=true;
 $('main-content').innerHTML='<div class="classified-warning"><strong>WARNING: THE FOUNDATION DATABASE IS</strong><span>CLASSIFIED</span><p>UNAUTHORIZED ACCESS IS SUBJECT TO INTERNAL SECURITY REVIEW</p></div>'+
 '<div class="content-columns"><section><h2>Archived Case Files</h2><p>'+anchor('SCP-JONA — The Reference Tone','revision-0')+' <span class="minor">[9 surviving revisions]</span></p><p>'+anchor('The Chain 52 Review','revision-3')+' <span class="minor">[Level 3]</span></p><p>'+anchor('O5 Offsite Directive 52/B','directives')+' <span class="minor">[Level 5]</span></p><h2>Record Integrity</h2><p>Site-99 was established following a conflicting set of deletion orders issued by the Foundation central index. RAISA has retained this isolated copy for comparison.</p><p>No open network synchronization is authorized. Local edits are retained as terminal annotations.</p></section><aside class="info-panel"><h3>Site Bulletin</h3><p><strong>22 Oct 2026</strong><br>Revision ledger preserved.</p><p><strong>21 Oct 2026</strong><br>Central-index synchronization suspended.</p><p><strong>20 Oct 2026</strong><br>Authorship field audit unresolved.</p><p>'+anchor('View discussion board','discussion')+'</p><p>'+anchor('Unresolved incidents','cases')+'</p></aside></div>'+
 tagbar(['site-99','archival-integrity','information']);
}
function renderTags(filter){
 setTitle(filter?'Pages tagged "'+filter+'"':'Page Tags');setMeta('LOCAL INDEX / SITE-99');$('rating-box').hidden=true;
 var chosen=filter?[filter]:tags;
 var chips='<div class="tag-cloud">'+chosen.map(function(t){return anchor(t,'tag-'+t,'tag-chip')}).join(' ')+'</div>';
 var docs=[];
 titles.forEach(function(title,i){var rtags=tagsForRevision(i);if(!filter||rtags.indexOf(filter)!==-1)docs.push('<li>'+anchor('SCP-JONA / J/'+i+' — '+title,'revision-'+i)+' <small>('+rtags.join(', ')+')</small></li>')});
 appendixInfo.forEach(function(a){if(!filter||a.tags.indexOf(filter)!==-1){docs.push('<li>'+anchor('Addendum J-52/'+a.key+' — '+(clearance>=a.level?a.name:'[LEVEL '+a.level+']'),'revision-'+(a.key==='A'?2:a.key==='B'?4:a.key==='C'?3:8))+' <small>('+a.tags.join(', ')+')</small></li>')}});
 incidents.cases.forEach(function(c){if(!filter||c.tags.indexOf(filter)>=0)docs.push('<li>'+anchor('RAISA '+c.num+' — '+(clearance>=c.level?c.title:'[RESTRICTED]'),'case-'+c.id)+' <small>(Level '+c.level+')</small></li>')});
 $('main-content').innerHTML='<p>Index of tags assigned to retained Site-99 documents.</p>'+chips+'<h2>Matching Pages</h2>'+(docs.length?'<ul class="archive-index">'+docs.join('')+'</ul>':'<p>No indexed records found.</p>')+(filter?'<p>'+anchor('All tags','tags')+'</p>':'');
}
function renderHistory(){
 setTitle('SCP-JONA - Page History');setMeta('RAISA REVISION LEDGER');$('rating-box').hidden=true;
 $('main-content').innerHTML='<p>Revision identifiers are ordered by retention sequence. Changes to access requirements are recorded separately from document integrity.</p><table class="history-table"><thead><tr><th>Revision</th><th>Title</th><th>Class</th><th>Clearance</th><th>Record</th></tr></thead><tbody>'+
 titles.map(function(t,i){return '<tr><td>'+anchor('J/'+i,'revision-'+i)+'</td><td>'+esc(clearance>=requirements[i]?t:'[RESTRICTED]')+'</td><td>'+esc(classes[i])+'</td><td>Level '+requirements[i]+'</td><td>'+ (clearance>=requirements[i]?'Retained':'Sealed')+'</td></tr>'}).join('')+
 '</tbody></table><p class="archive-note">Automated restoration attempts are logged separately in Site-99 technical records.</p>';
}
function renderFiles(selected){
 setTitle('SCP-JONA - Files');setMeta('ATTACHMENT MANIFEST / 4 FILES');$('rating-box').hidden=true;
 $('main-content').innerHTML='<p>Attachments recovered from the isolated RAISA storage node.</p><table class="history-table"><thead><tr><th>File</th><th>Type</th><th>Access</th></tr></thead><tbody>'+
 fileEntries.map(function(f,i){return '<tr><td>'+anchor(f.name,'files-'+i)+'</td><td>'+esc(f.kind)+'</td><td>Level '+f.level+'</td></tr>'}).join('')+'</tbody></table>'+
 (selected!==undefined&&fileEntries[selected]?'<section class="attachment-preview"><h2>'+esc(fileEntries[selected].name)+'</h2>'+(clearance>=fileEntries[selected].level?'<pre>'+esc(fileEntries[selected].body)+'</pre>':gatedHtml(fileEntries[selected].level,'Attachment withheld'))+'</section>':'');
}
function renderPersonnel(){
 setTitle('Site-99 Personnel Registry');setMeta('INTERNAL DIRECTORY');$('rating-box').hidden=true;
 $('main-content').innerHTML='<table class="history-table"><thead><tr><th>Personnel</th><th>Assignment</th><th>Note</th></tr></thead><tbody><tr><td>Researcher T. Vale</td><td>Case JONA-52</td><td>Active</td></tr><tr><td>Archivist K. Morrow</td><td>Revision custody</td><td>Active</td></tr><tr><td>Dr. A. Renn</td><td>Ethics review</td><td>Consulting</td></tr><tr><td>O5-11</td><td>Offsite directive</td><td>Level 5</td></tr></tbody></table><p>'+anchor('Open discussion archive','discussion')+'</p>';
}
function renderDirectives(){
 setTitle('O5 Directive 52/B');setMeta('OVERSEER COMMAND / LEVEL 5');$('rating-box').hidden=true;
 $('main-content').innerHTML=clearance<5?gatedHtml(5,'O5 Directive 52/B'):'<p><strong>TO:</strong> RAISA Site-99 Custodians<br><strong>FROM:</strong> O5-11<br><strong>SUBJECT:</strong> SCP-JONA Offsite Archive</p><hr><p>Do not republish the central-index entry. Do not construe the existence of the file as a grant of operational authority. Preserve every revision, including the ones marked obsolete.</p><p>Site-99 is not a containment facility for the person designated JONA. It is a containment facility for the Foundation\'s incompatible descriptions of him.</p><p><strong>STATUS:</strong> IN EFFECT</p>'+tagbar(['site-99','archival-integrity','level-4']);
}
function storedReplies(id){try{return JSON.parse(localStorage.getItem('jona52-board-'+id)||'[]')}catch(e){return []}}
function saveReply(id,reply){var replies=storedReplies(id);replies.push(reply);try{localStorage.setItem('jona52-board-'+id,JSON.stringify(replies))}catch(e){}}
function renderDiscussion(id){
 var t=seedThreads.find(function(x){return x.id===id})||seedThreads[0];
 setTitle(id?'Discussion: '+t.title:'SCP-JONA - Discussion');setMeta('SITE-99 / FORUM ARCHIVE');$('rating-box').hidden=true;
 var list='<div class="thread-directory"><h2>Threads</h2>'+seedThreads.map(function(thread){return '<p>'+anchor(thread.title,'thread-'+thread.id)+' <small>('+((thread.level||0)>clearance?'LEVEL '+thread.level+' / restricted':thread.posts.length+' archived posts')+')</small></p>'}).join('')+'</div>';
 if(t.level&&clearance<t.level){$('main-content').innerHTML=list+gatedHtml(t.level,t.title);return}
 var posts=t.posts.concat(storedReplies(t.id));
 var html='<section class="forum-thread"><h2>'+esc(t.title)+'</h2><p class="archive-note">Thread '+esc(t.id.toUpperCase())+' / Local archive / '+t.posts.length+' retained posts</p>'+
 posts.map(function(p,i){return '<article class="forum-post"><div class="post-author"><strong>'+esc(p.author)+'</strong><span>Post '+(i+1)+'</span></div><div class="post-body"><div class="post-date">'+esc(p.date)+'</div><p>'+esc(p.body).replace(/\n/g,'<br>')+'</p></div></article>'}).join('')+'</section>'+
 '<form id="reply-form" class="reply-form"><h3>Reply to this thread</h3><label for="reply-name">Identity</label><input id="reply-name" type="text" maxlength="35" value="Unverified Terminal"><label for="reply-body">Message</label><textarea id="reply-body" required maxlength="1800" rows="5"></textarea><button type="submit" class="site-btn">Attach local reply</button><p class="archive-note">Local terminal annotation. External transmission is disabled by RAISA-99.</p></form>';
 $('main-content').innerHTML=list+html;
 $('reply-form').addEventListener('submit',function(e){e.preventDefault();var name=$('reply-name').value.trim()||'Unverified Terminal';var message=$('reply-body').value.trim();if(!message)return;saveReply(t.id,{author:name,date:'Local terminal entry',body:message});audit('LOCAL FORUM ANNOTATION // '+t.id);renderDiscussion(t.id)});
}
function renderSource(){
 setTitle('SCP-JONA - Source');setMeta('RAISA / DOCUMENT TRANSCRIPTION');$('rating-box').hidden=true;
 var i=Number((location.hash.match(/source-(\d+)/)||[])[1]||0);
 $('main-content').innerHTML=clearance<requirements[i]?gatedHtml(requirements[i],'Source J/'+i):'<p>Read-only source view: <strong>Revision J/'+i+'</strong>. Original markup preserved in the archive.</p><pre class="source-pre">'+esc(data.versions[String(i)]||'')+'</pre>';
}

function renderAccess(){
 setTitle('RAISA Credential Verification');setMeta('SITE-99 / PERSONNEL CLEARANCE TERMINAL');$('rating-box').hidden=true;
 var next=maxClearance+1;
 var progress='<ol class="clearance-ledger">'+[1,2,3,4,5,6].map(function(n){return '<li class="'+(n<=maxClearance?'verified':n===next?'current':'sealed')+'"><span>LEVEL '+n+'</span><span>'+(n<=maxClearance?'VERIFIED':n===next?'AWAITING CREDENTIAL':'SEALED')+'</span></li>'}).join('')+'</ol>';
 var msg=credentialMessage?'<p class="credential-status" id="credential-status" role="status">'+esc(credentialMessage)+'</p>':'<p id="credential-status" class="archive-note" role="status"></p>';
 var html='<p>RAISA-99 retains six credential challenges. The current intake identity is Level '+maxClearance+'. Records may be opened only after their corresponding verification entries are completed.</p>'+progress;
 if(next>6){
  html+='<div class="clearance-success"><h2>ALL SIX CREDENTIALS VERIFIED</h2><p>Node 99-C reports that an eighth revision has been restored. No operator appears in the access log.</p><p>'+anchor('Open the reader copy','revision-8')+' · '+anchor('Open recovered thread','terminal-echo')+'</p></div>';
 }else{
  var stage=puzzle.stages[next];
  html+='<section class="credential-case"><div class="credential-eyebrow">CHALLENGE '+next+' / 6 — '+esc(stage.record)+'</div><h2>Level '+next+' verification</h2><p>'+esc(stage.prompt)+'</p><p class="archive-note">Available leads: '+stage.leads.map(function(a){return anchor(a[0],a[1])}).join(' · ')+'</p>'+
   '<form id="credential-form" class="credential-form"><label for="credential-input">Response / access phrase</label><div class="credential-entry"><input id="credential-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" required aria-describedby="credential-status"><button class="site-btn" type="submit">Verify</button></div></form>'+
   msg+'<div class="hint-area"><button class="site-btn hint-button" type="button" data-action="hint">'+(hintRevealed<2?'Request analyst hint '+(hintRevealed+1):'All hints reviewed')+'</button>'+
   (hintRevealed?'<div class="hint-text"><p>'+esc(stage.hints[0])+'</p>'+(hintRevealed===2?'<p>'+esc(stage.hints[1])+'</p>':'')+'</div>':'')+'</div></section>';
  if(credentialMessage.indexOf('VERIFIED')===0){
   html+='<p class="archive-note">The revision index and related attachments have been updated for this personnel level.</p>';
  }
 }
 html+='<p class="archive-note">This terminal records progress on the current device. <button type="button" class="link-action" data-action="reset-clearance">Clear local credential record</button></p>';
 $('main-content').innerHTML=html;
 var form=$('credential-form');
 if(form){form.addEventListener('submit',function(e){
   e.preventDefault();
   var entry=$('credential-input').value;
   if(puzzle.matches(next,entry)){
     maxClearance=next;clearance=next;saveProgress();hintRevealed=0;
     credentialMessage='VERIFIED // LEVEL '+next+' ACCESS RECORDED';
     audit('AUTHORIZATION TOKEN ACCEPTED // LEVEL '+next);
     revNav();syncClearance();renderAccess();
   }else{
     credentialMessage='ENTRY REJECTED // NO MATCH IN CREDENTIAL REGISTER';
     audit('INVALID CREDENTIAL // LEVEL '+next);
     var status=$('credential-status');if(status)status.textContent=credentialMessage;
     $('credential-input').setAttribute('aria-invalid','true');
   }
 })};
}
function renderTerminalEcho(){
 if(clearance>=6)markVeilWitness('echo');
 setTitle('Site-99 / Recovered Thread');setMeta('RAISA / UNINDEXED CORRESPONDENCE');$('rating-box').hidden=true;
 if(clearance<6){$('main-content').innerHTML=gatedHtml(6,'Unindexed correspondence');return}
 $('main-content').innerHTML='<p class="archive-note">RAISA document recovered after personnel verification. No associated account has been identified.</p>'+
 '<article class="forum-post"><div class="post-author"><strong>O5-11</strong><span>Thread closed</span></div><div class="post-body"><div class="post-date">02:23 / internal transmission</div><p>Six credentials. Six perfectly valid authorizations. None of them explains who requested the seventh.</p></div></article>'+
 '<article class="forum-post"><div class="post-author"><strong>READER</strong><span>Account not found</span></div><div class="post-body"><div class="post-date">02:24 / origin unrecorded</div><p>You keep calling this a file about him. Why was the first door a file about you?</p></div></article>'+
 (seenRestoration('overseers')?'<article class="forum-post"><div class="post-author"><strong>O5-11</strong><span>Unsent memorandum / recovered</span></div><div class="post-body"><div class="post-date">02:19 / prior entry</div><p>There is a meeting in the record that none of us attended. In that meeting I voted to start the operation. In this one I am voting to prevent it. My signatures are genuine. I no longer know which was the first vote.</p></div></article>':'')+
 (seenRestoration('second')?'<article class="forum-post"><div class="post-author"><strong>O5-13</strong><span>Destination undeliverable</span></div><div class="post-body"><div class="post-date">02:22 / retained copy of unsent reply</div><p>It was not destroyed when we closed it. It was already gone. Please do not build another door to find out where it went. Someone opened the last one and we are still standing here.</p></div></article>':'')+

 '<p class="archive-note">RAISA correction: The final punctuation in the reader copy has not been authenticated. The original ends where a decision was expected.</p>'+ 
 (veilEligible()&&veilChoice()?'<article class="forum-post"><div class="post-author"><strong>RAISA-99</strong><span>Return receipt</span></div><div class="post-body"><div class="post-date">99-C/NIL / receipt filed after closure</div><p>The Veil assessment has been entered. The receiving system stored it under OBSERVER, not NORMALCY. The archive cannot identify the rule that moved it.</p></div></article>':'')+
 '<p>'+anchor('Return to J/0','revision-0')+' · '+anchor('View J/8','revision-8')+'</p>'; 
}


function hasSeenDoor(){try{return sessionStorage.getItem('site99:third-door')==='1'}catch(e){return false}}
function markDoor(){try{sessionStorage.setItem('site99:third-door','1')}catch(e){}}
function renderCaseIndex(){
 setTitle('Site-99 / Unresolved Incidents');setMeta('RAISA / 99-C DISCREPANCY REGISTER');$('rating-box').hidden=true;
 var rows=incidents.cases.map(function(c){return '<tr><td>'+esc(c.num)+'</td><td>'+anchor(clearance>=c.level?c.title:'[RESTRICTED ENTRY]','case-'+c.id)+'</td><td>Level '+c.level+'</td><td>'+esc(clearance>=c.level?'RETAINED':'SEALED')+'</td></tr>'}).join('');
 if(hasSeenDoor())rows+='<tr><td>99-C/03.1</td><td>'+anchor('Corridor Copy / no index entry','case-unlisted')+'</td><td>Level 2</td><td>NOT ENTERED</td></tr>';
 $('main-content').innerHTML='<p>These incidents were recovered during the JONA-52 custody review. Their physical evidence is retained at Site-99. They are not included in the central Foundation index.</p>'+
 '<table class="history-table"><thead><tr><th>Case</th><th>Subject</th><th>Access</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>'+
 '<p class="archive-note">The register is not complete. Numbers are reserved only after their corresponding records are received.</p>'+tagbar(['site-99','archival-integrity','pataphysics']);
}
function renderCase(id){
 if(id==='unlisted'){
  setTitle('Case 99-C/03.1');setMeta('EAST ANNEX / FILE NOT ENTERED');$('rating-box').hidden=true;
  if(clearance<2){$('main-content').innerHTML=gatedHtml(2,'Corridor Copy');return}
  $('main-content').innerHTML='<p><strong>Facilities Copy / Corridors 2–4</strong></p><p>Door count: 2. Corridor count: 3. Witness count: 2.</p><p>The third corridor is drawn behind the eastern wall, where the original building plan places the exterior of the site. No adjoining building occupies the space.</p><p>The file was not produced by the revision office. It is stamped <code>RECEIVED / DESK 4</code>.</p><p>'+anchor('Previous incident','case-door')+' · '+anchor('Return to index','cases')+'</p>';return
 }
 var c=incidents.cases.find(function(x){return x.id===id});if(!c){renderCaseIndex();return}
 setTitle('RAISA '+c.num+' — '+(clearance>=c.level?c.title:'RESTRICTED'));
 setMeta('SITE-99 / UNRESOLVED FIELD INCIDENT / LEVEL '+c.level);$('rating-box').hidden=true;
 if(clearance<c.level){$('main-content').innerHTML=gatedHtml(c.level,c.num);return}
 if(id==='door')markDoor();
 if(id==='receiver')markVeilWitness('return');
 var links='<div class="incident-references"><h3>Retained Correspondence / Related Records</h3><ul>'+c.bridges.map(function(b){return '<li>'+anchor(b[0],b[1])+'</li>'}).join('')+'</ul></div>';
 $('main-content').innerHTML='<div class="revision-notice"><span>RAISA FIELD INCIDENT '+esc(c.num)+'</span><span>STATUS: UNRESOLVED</span></div>'+
 '<div class="record-body incident-body">'+c.body+restorationLeaf(restorationLeaves.cases,id)+'</div>'+links+tagbar(c.tags);
}

function renderSearch(query){
 setTitle('Search results');setMeta('SITE-99 / LOCAL SEARCH');$('rating-box').hidden=true;
 var q=(query||'').toLowerCase(),found=[];
 titles.forEach(function(t,i){if(requirements[i]>clearance)return;var txt=data.versions[String(i)].replace(/<[^>]+>/g,' ');if((t+' '+txt).toLowerCase().includes(q))found.push('<li>'+anchor('SCP-JONA / J/'+i+' — '+t,'revision-'+i)+' · Level '+requirements[i]+'</li>')});
 seedThreads.forEach(function(t){if(t.level&&t.level>clearance)return;if((t.title+' '+t.posts.map(function(p){return p.body}).join(' ')).toLowerCase().includes(q))found.push('<li>'+anchor('Discussion / '+t.title,'thread-'+t.id)+'</li>')});
 fileEntries.forEach(function(f,i){if(f.level>clearance)return;if((f.name+' '+f.kind+' '+f.body).toLowerCase().includes(q))found.push('<li>'+anchor('Attachment / '+f.name,'files-'+i)+' · Level '+f.level+'</li>')});
 incidents.cases.forEach(function(c){if(c.level>clearance)return;if((c.num+' '+c.title+' '+c.body.replace(/<[^>]+>/g,' ')).toLowerCase().includes(q))found.push('<li>'+anchor('RAISA '+c.num+' — '+c.title,'case-'+c.id)+' · Level '+c.level+'</li>')});
 $('main-content').innerHTML='<p>Query: <strong>'+esc(query)+'</strong></p><ul class="archive-index">'+(found.join('')||'<li>No local records found.</li>')+'</ul>';
}
function render(){
 route=decodeURIComponent(location.hash.slice(1)||'revision-0');revNav();
 var index=Number((route.match(/^revision-(\d)$/)||[])[1]); if(/^revision-\d$/.test(route)&&index<9)renderRevision(index);
 else if(route==='site-99')renderHome();
 else if(route==='cases')renderCaseIndex();
 else if(route.startsWith('case-'))renderCase(route.slice(5));
 else if(route==='tags'||route.startsWith('tag-'))renderTags(route.startsWith('tag-')?route.slice(4):null);
 else if(route==='history')renderHistory();
 else if(route==='files'||route.startsWith('files-'))renderFiles(route.startsWith('files-')?Number(route.slice(6)):undefined);
 else if(route==='personnel')renderPersonnel();
 else if(route==='directives')renderDirectives();
 else if(route==='access')renderAccess();
 else if(route==='terminal-echo')renderTerminalEcho();
 else if(route==='veil-nil')renderVeil();
 else if(route==='world-before'||/^world-(sealed|internet|cabinet|noosphere|foundation|terminal|firstcentury|ages|finalyear|reversal|secondapproach|receipt)$/.test(route))renderWorldBefore();
 else if(route==='continuity'||route.startsWith('continuity-'))renderRestoration(route.startsWith('continuity-')?route.slice(11):null);
 else if(route==='discussion'||route.startsWith('thread-'))renderDiscussion(route.startsWith('thread-')?route.slice(7):null);
 else if(route.startsWith('source'))renderSource();
 else if(route.startsWith('search-'))renderSearch(route.slice(7));
 else renderRevision(0);
 $('bottom-tools').hidden=false;
 var isRev=/^revision-\d$/.test(route),ri=isRev?Number(route.slice(9)):0;
 $('source-link').href='#source-'+ri;
 $('discuss-link').href='#discussion';
 $('history-link').href='#history';
 $('files-link').href='#files';
 $('tag-link').href='#tags';
 $('page-identity').textContent=isRev?'SCP-JONA / J/'+ri:'SITE-99 / '+route.toUpperCase();
 syncClearance();
 if(/^world-(sealed|internet|cabinet|noosphere|foundation|terminal|firstcentury|ages|finalyear|reversal|secondapproach|receipt)$/.test(route)){var target=document.getElementById(route);if(target&&typeof target.scrollIntoView==='function')target.scrollIntoView({block:'start'})}
 else if(location.hash){window.scrollTo({top:0,behavior:'instant'})}
}
document.addEventListener('click',function(e){
 var btn=e.target.closest('[data-action]');if(!btn)return;
 var action=btn.dataset.action;
 if(action==='request'){e.preventDefault();hintRevealed=0;credentialMessage='';audit('VERIFICATION TERMINAL REQUESTED // TARGET LEVEL '+btn.dataset.level);setHash('access')}
 if(action==='edit'){e.preventDefault();showNotice('Editing is disabled by O5 Directive 52/B. Submit proposed corrections to RAISA custody personnel.')}
 if(action==='print'){window.print()}
 if(action==='vote'){var dir=Number(btn.dataset.dir);localRating=Math.max(-1,Math.min(1,localRating+dir));$('rating-count').textContent=(52+localRating>=0?'+':'')+(52+localRating);audit('LOCAL RATING REGISTER UPDATED');}
 if(action==='notice-close'){$('notice-dialog').close()}
 if(action==='hint'){e.preventDefault();hintRevealed=Math.min(2,hintRevealed+1);renderAccess();}
 if(action==='reset-clearance'){e.preventDefault();maxClearance=0;clearance=0;hintRevealed=0;credentialMessage='';saveProgress();try{sessionStorage.removeItem(veilWitnessKey);sessionStorage.removeItem('site99:sealed-last-revision');restorationStages.forEach(function(k){localStorage.removeItem(restorePrefix+k)});localStorage.removeItem(veilChoiceKey);localStorage.removeItem(worldBeforeKey)}catch(e){}audit('LOCAL CREDENTIAL PROFILE ERASED');revNav();syncClearance();renderAccess();}
});
function showNotice(message){$('notice-message').textContent=message;$('notice-dialog').showModal()}
syncClearance();
$('clear').addEventListener('change',function(e){var target=Number(e.target.value)||0;if(target>maxClearance){audit('SEALED LEVEL REQUESTED // '+target);hintRevealed=0;credentialMessage='';syncClearance();setHash('access');return}var old=clearance;clearance=target;audit('VERIFIED PROFILE SELECTED // '+old+' → '+clearance);render()});
$('site-search').addEventListener('submit',function(e){e.preventDefault();var term=$('search-field').value.trim();if(term)setHash('search-'+encodeURIComponent(term))});
$('rating-count').textContent='+52';
window.addEventListener('hashchange',render);
render();
})();
