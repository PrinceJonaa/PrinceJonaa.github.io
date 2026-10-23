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
var seedThreads=[
{id:'containment',title:'SCP-JONA containment language',posts:[
{author:'Researcher T. Vale',date:'22 Oct 2026, 09:16',body:'Provisional classification is still Euclid. Please stop replacing “unknown” with “hostile” in the procedure section. The distinction has been reviewed three times.'},
{author:'Dr. A. Renn / Ethics Committee',date:'22 Oct 2026, 10:41',body:'Agreed. A model of a person does not confer jurisdiction over that person. The intervention memo remains unsigned.'},
{author:'Director Havel',date:'22 Oct 2026, 13:07',body:'The budget proposal was not an intervention memo. The budget proposal was attached to an intervention memo. This does not improve its standing.'}]},
{id:'site99',title:'Why is this file hosted outside the main database?',posts:[
{author:'RAISA-99',date:'21 Oct 2026, 22:04',body:'The central Foundation index returned a valid deletion instruction for this entry while claiming the entry had never been submitted. The offsite mirror is preserved under Site-99 directive 52/B.'},
{author:'O5-11',date:'22 Oct 2026, 00:12',body:'Do not migrate these records back into the public index. Duplication of the revision history triggered the original incident. This is a custody order, not an explanation.'},
{author:'Archivist K. Morrow',date:'22 Oct 2026, 01:32',body:'We retain an intact chain of custody for the server and none for the authorization that created the server.'}]},
{id:'0222',title:'02:22 / authorship field',posts:[
{author:'Archivist K. Morrow',date:'20 Oct 2026, 02:31',body:'At 02:22, revision metadata briefly listed the active editor as READER. Seven terminals reproduced the entry. The name did not correspond to a Foundation account.'},
{author:'Researcher T. Vale',date:'20 Oct 2026, 09:09',body:'The log identifies a field value, not an entity. Please stop asking Security to detain a database column.'}]}
];
var fileEntries=[
{name:'J52-INITIAL-REPORT.txt',level:0,kind:'Field report',body:'RAISA / SITE-99\nINTAKE: JONA-52\nSOURCE: municipal records; civilian technical and music publications.\nInitial review: no confirmed nonstandard properties. Continued observation pending.'},
{name:'CHAIN52-SIMULATION.LOG',level:3,kind:'Simulation transcript',body:'CYCLE 51: ALL ROUTES CLOSING\nCYCLE 52: SUBJECT REMOVES EXCEPTIONAL PERMISSIONS\nCYCLE 53: MODEL NO LONGER PREDICTS A UNIQUE ENDPOINT\nNOTE: DO NOT RECONSTRUCT A MISSING CYCLE.'},
{name:'OFFSITE-ORDER-52B.txt',level:5,kind:'O5 archive directive',body:'DIRECTIVE 52/B\nAUTHOR: O5-11\nSUBJECT: OFFSITE RETENTION OF SCP-JONA\nCentral-index publication suspended. Site-99 retains the sole operative revision ledger.\nThis is a custody measure. It is not authorization to approach JONA.'},
{name:'READER-FIELD.txt',level:6,kind:'Recovered metadata',body:'FIELD: last_edited_by\nVALUE: READER\nAUTHORITY: UNRESOLVED\nSOURCE: UNKNOWN\n\nIf the field changes while you are looking at it, record what changed. Do not record what you wanted it to mean.'}
];
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var cap=function(t){return t.replace(/(^|-)\w/g,function(x){return x.toUpperCase()}).replace(/-/g,' ')};
function audit(message){logs.unshift(message); if(logs.length>28)logs.length=28;var el=$('audit-lines');if(el)el.textContent=logs.map(function(l,i){return '['+String(logs.length-i).padStart(3,'0')+'] '+l}).join('\n')}
function setHash(hash){if(location.hash!=='#'+hash)location.hash=hash;else render()}
function href(r){return '#'+r}
function anchor(label,to,cl){return '<a'+(cl?' class="'+cl+'"':'')+' href="'+href(to)+'">'+esc(label)+'</a>'}
function gatedHtml(req,label){return '<div class="access-denied" role="status"><strong class="denied-caption">ACCESS DENIED / LEVEL '+req+' REQUIRED</strong><h2>'+esc(label)+'</h2><p>Your current credentials do not authorize access to this record.</p><p>RAISA-99 has logged this retrieval attempt. Contact your site security liaison to request the appropriate clearance.</p><button type="button" class="site-btn" data-action="request" data-level="'+req+'">Submit clearance request</button></div>'}
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
function renderRevision(i){
 setTitle('SCP-JONA');
 setMeta('REVISION J/'+i+'  ·  '+classes[i].toUpperCase()+'  ·  SITE-99 / OFFSITE');
 var body=$('main-content'),locked=clearance<requirements[i];
 $('rating-box').hidden=false;
 if(locked){body.innerHTML=gatedHtml(requirements[i],'SCP-JONA / Revision J/'+i)+tagbar(['scp','site-99','restricted']);audit('RETRIEVAL REFUSED // J/'+i+' // LEVEL '+requirements[i]);return}
 var html=data.versions[String(i)]||'<p>FILE MISSING</p>';
 html=html.replace(/^<h1>.*?<\/h1>\s*/s,'');
 // The index page is intentionally the first readable record, not a level-2 briefing.
 body.innerHTML='<div class="revision-notice"><span>ARCHIVE REVISION J/'+i+'</span><span>CLASS: '+esc(classes[i])+'</span></div>'+
 '<div class="record-body">'+html+'</div>'+appendicesHtml()+tagbar(tagsForRevision(i));
}
function renderHome(){
 setTitle('Site-99 Archive');setMeta('RAISA NODE 99-C / OFFSITE MIRROR');$('rating-box').hidden=true;
 $('main-content').innerHTML='<div class="classified-warning"><strong>WARNING: THE FOUNDATION DATABASE IS</strong><span>CLASSIFIED</span><p>UNAUTHORIZED ACCESS IS SUBJECT TO INTERNAL SECURITY REVIEW</p></div>'+
 '<div class="content-columns"><section><h2>Archived Case Files</h2><p>'+anchor('SCP-JONA — The Reference Tone','revision-0')+' <span class="minor">[9 surviving revisions]</span></p><p>'+anchor('The Chain 52 Review','revision-3')+' <span class="minor">[Level 3]</span></p><p>'+anchor('O5 Offsite Directive 52/B','directives')+' <span class="minor">[Level 5]</span></p><h2>Record Integrity</h2><p>Site-99 was established following a conflicting set of deletion orders issued by the Foundation central index. RAISA has retained this isolated copy for comparison.</p><p>No open network synchronization is authorized. Local edits are retained as terminal annotations.</p></section><aside class="info-panel"><h3>Site Bulletin</h3><p><strong>22 Oct 2026</strong><br>Revision ledger preserved.</p><p><strong>21 Oct 2026</strong><br>Central-index synchronization suspended.</p><p><strong>20 Oct 2026</strong><br>Authorship field audit unresolved.</p><p>'+anchor('View discussion board','discussion')+'</p></aside></div>'+
 tagbar(['site-99','archival-integrity','information']);
}
function renderTags(filter){
 setTitle(filter?'Pages tagged "'+filter+'"':'Page Tags');setMeta('LOCAL INDEX / SITE-99');$('rating-box').hidden=true;
 var chosen=filter?[filter]:tags;
 var chips='<div class="tag-cloud">'+chosen.map(function(t){return anchor(t,'tag-'+t,'tag-chip')}).join(' ')+'</div>';
 var docs=[];
 titles.forEach(function(title,i){var rtags=tagsForRevision(i);if(!filter||rtags.indexOf(filter)!==-1)docs.push('<li>'+anchor('SCP-JONA / J/'+i+' — '+title,'revision-'+i)+' <small>('+rtags.join(', ')+')</small></li>')});
 appendixInfo.forEach(function(a){if(!filter||a.tags.indexOf(filter)!==-1){docs.push('<li>'+anchor('Addendum J-52/'+a.key+' — '+(clearance>=a.level?a.name:'[LEVEL '+a.level+']'),'revision-'+(a.key==='A'?2:a.key==='B'?4:a.key==='C'?3:8))+' <small>('+a.tags.join(', ')+')</small></li>')}});
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
 var list='<div class="thread-directory"><h2>Threads</h2>'+seedThreads.map(function(thread){return '<p>'+anchor(thread.title,'thread-'+thread.id)+' <small>('+thread.posts.length+' archived posts)</small></p>'}).join('')+'</div>';
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
function renderSearch(query){
 setTitle('Search results');setMeta('SITE-99 / LOCAL SEARCH');$('rating-box').hidden=true;
 var q=(query||'').toLowerCase(),found=[];
 titles.forEach(function(t,i){var txt=data.versions[String(i)].replace(/<[^>]+>/g,' ');if((t+' '+txt).toLowerCase().includes(q))found.push('<li>'+anchor('SCP-JONA / J/'+i+' — '+t,'revision-'+i)+' · Level '+requirements[i]+'</li>')});
 seedThreads.forEach(function(t){if((t.title+' '+t.posts.map(function(p){return p.body}).join(' ')).toLowerCase().includes(q))found.push('<li>'+anchor('Discussion / '+t.title,'thread-'+t.id)+'</li>')});
 $('main-content').innerHTML='<p>Query: <strong>'+esc(query)+'</strong></p><ul class="archive-index">'+(found.join('')||'<li>No local records found.</li>')+'</ul>';
}
function render(){
 route=decodeURIComponent(location.hash.slice(1)||'revision-0');revNav();
 var index=Number((route.match(/^revision-(\d)$/)||[])[1]); if(/^revision-\d$/.test(route)&&index<9)renderRevision(index);
 else if(route==='site-99')renderHome();
 else if(route==='tags'||route.startsWith('tag-'))renderTags(route.startsWith('tag-')?route.slice(4):null);
 else if(route==='history')renderHistory();
 else if(route==='files'||route.startsWith('files-'))renderFiles(route.startsWith('files-')?Number(route.slice(6)):undefined);
 else if(route==='personnel')renderPersonnel();
 else if(route==='directives')renderDirectives();
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
 if(location.hash){window.scrollTo({top:0,behavior:'instant'})}
}
document.addEventListener('click',function(e){
 var btn=e.target.closest('[data-action]');if(!btn)return;
 var action=btn.dataset.action;
 if(action==='request'){e.preventDefault();audit('CLEARANCE REQUEST FILED // LEVEL '+btn.dataset.level+' // STATUS: PENDING');showNotice('Access request entered into the Site-99 security queue. No approval has been issued.')}
 if(action==='edit'){e.preventDefault();showNotice('Editing is disabled by O5 Directive 52/B. Submit proposed corrections to RAISA custody personnel.')}
 if(action==='print'){window.print()}
 if(action==='vote'){var dir=Number(btn.dataset.dir);localRating=Math.max(-1,Math.min(1,localRating+dir));$('rating-count').textContent=(52+localRating>=0?'+':'')+(52+localRating);audit('LOCAL RATING REGISTER UPDATED');}
 if(action==='notice-close'){$('notice-dialog').close()}
});
function showNotice(message){$('notice-message').textContent=message;$('notice-dialog').showModal()}
$('clear').value='0';
$('clear').addEventListener('change',function(e){var old=clearance;clearance=Math.max(0,Math.min(6,Number(e.target.value)||0));audit('ACCESS PROFILE CHANGED // '+old+' → '+clearance);render()});
$('site-search').addEventListener('submit',function(e){e.preventDefault();var term=$('search-field').value.trim();if(term)setHash('search-'+encodeURIComponent(term))});
$('rating-count').textContent='+52';
window.addEventListener('hashchange',render);
render();
})();
