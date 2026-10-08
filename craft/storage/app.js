"use strict";
/*
 * Craft Storage Manager v1: explicit OPFS snapshots to Google Drive.
 * No access token or client secret is persisted. OAuth Web Client IDs are public.
 * Deliberately does NOT claim to back up IndexedDB fallback or other origin apps.
 */
(() => {
  const ROOT_NAME = "Craft Studio Backups";
  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const API = "https://www.googleapis.com/drive/v3/files";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
  const CLIENT_KEY = "pj.craft.storage.oauthClientId.v1";
  const DIRS = Object.freeze({
    light: ["library", "originals", "thumbs"],
    film: ["recovery", "media"],
    effect: ["config", "files"]
  });
  const NAMES = Object.freeze({light:"LightCraft",film:"FilmCraft",effect:"EffectCraft"});
  const CHUNK = 8 * 1024 * 1024; // Multiple of Drive's 256 KiB requirement
  const MAX_FILES = 20000;
  const $ = (id) => document.getElementById(id);
  const state = {token:null, expires:0, clientId:"", rootId:null, files:[], busy:false, snapshots:[]};

  function bytes(n) {
    if (!Number.isFinite(n)) return "—";
    let unit = 0; const units = ["B","KB","MB","GB","TB"];
    while (n >= 1024 && unit < units.length - 1) {n /= 1024; unit++;}
    return (unit ? n.toFixed(n < 10 ? 1 : 0) : Math.round(n)) + " " + units[unit];
  }
  function say(message, kind = "info") {
    const box = $("drive-status");
    box.textContent = message;
    box.className = "status " + (kind === "error" ? "error" : kind === "success" ? "success" : "");
    box.setAttribute("aria-busy", state.busy ? "true" : "false");
  }
  function busy(on) {
    state.busy = on;
    for (const id of ["scan","persist","backup","connect","refresh","disconnect","save-config"]) $(id).disabled = on;
    if (!on) {
      $("backup").disabled = !state.token || !state.files.some(f => $( "pick-" + f.tool).checked);
      $("refresh").disabled = !state.token;
    }
    $("drive-status").setAttribute("aria-busy", on ? "true" : "false");
  }
  function note(id, text) {
    $(id).hidden = !text;
    $(id).textContent = text || "";
  }
  async function guarded(action) {
    if (state.busy) return;
    busy(true);
    try { await action(); }
    catch (e) { console.error("Craft Storage Manager:", e); say(e.message || String(e), "error"); }
    finally { busy(false); }
  }
  function clientId() {
    return ($("client-id").value || "").trim();
  }
  function selectedTools() {
    return Object.keys(DIRS).filter(tool => $("pick-" + tool).checked);
  }
  function safePath(path, tool) {
    if (typeof path !== "string" || path.length > 1000 || path.includes("\\") || path.startsWith("/")) return false;
    const parts = path.split("/");
    return parts.length > 1 && parts.every(p => p && p !== "." && p !== ".." && p !== ".DS_Store") && DIRS[tool]?.includes(parts[0]);
  }
  async function getRoot() {
    if (typeof navigator.storage?.getDirectory !== "function") throw Error("This browser does not support the Origin Private File System. Use a supported browser and an editor's own backup/export.");
    return navigator.storage.getDirectory();
  }
  async function inventory() {
    const root = await getRoot();
    const out = [];
    async function walk(dir, prefix, tool) {
      for await (const [name, handle] of dir.entries()) {
        const path = prefix + "/" + name;
        if (!safePath(path, tool)) continue;
        if (handle.kind === "directory") await walk(handle, path, tool);
        else if (handle.kind === "file") {
          const file = await handle.getFile();
          out.push({tool,path,size:file.size,file});
          if (out.length > MAX_FILES) throw Error("More than 20,000 Craft files detected. Split your project library before backing up.");
        }
      }
    }
    for (const [tool, paths] of Object.entries(DIRS)) for (const top of paths) {
      try {
        const dir = await root.getDirectoryHandle(top);
        await walk(dir, top, tool);
      } catch(e) {
        if (e.name !== "NotFoundError") throw e;
      }
    }
    return out.sort((a,b) => a.path.localeCompare(b.path));
  }
  async function scan() {
    say("Checking browser storage…");
    const estimate = await navigator.storage?.estimate?.();
    $("used").textContent = bytes(estimate?.usage);
    $("quota").textContent = bytes(estimate?.quota);
    state.files = [];
    try {
      state.files = await inventory();
      note("browser-note", "");
    } catch (e) {
      note("browser-note", e.message + " No browser files have been uploaded.");
    }
    for (const tool of Object.keys(DIRS)) {
      const list = state.files.filter(f => f.tool === tool);
      const total = list.reduce((n,f) => n + f.size, 0);
      $(tool + "-count").textContent = list.length + " files · " + bytes(total);
    }
    if (state.files.length) say("Local files discovered. You can select editors to back up.");
    else say("No supported OPFS files found yet. Edit or import in a Craft app first. IndexedDB fallbacks require the editor's own export.");
  }
  async function persistStorage() {
    if (!navigator.storage?.persist) throw Error("Persistent-storage permission is unavailable in this browser.");
    const granted = await navigator.storage.persist();
    say(granted ? "Browser persistent-storage protection was granted. This does not protect against clearing site data." :
      "Browser did not grant persistent-storage protection. Google Drive backups are still recommended.", granted ? "success" : "info");
  }
  function setClientId(raw) {
    const id = raw.trim();
    if (id && !/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(id))
      throw Error("Enter a valid Google OAuth Web client ID ending in .apps.googleusercontent.com.");
    if (id !== state.clientId) {
      state.token = null;
      state.rootId = null;
    }
    state.clientId = id;
    localStorage.setItem(CLIENT_KEY, id);
    note("connect-note", id ? "" : "An OAuth Web client ID hasn't been configured yet. Expand Google configuration on the right to set one.");
    $("disconnect").hidden = !state.token;
    say(id ? "Google client ID saved in this browser. Connect Google Drive to grant access." :
      "Google sign-in is not yet configured. Add an OAuth Web client ID.");
  }
  function googleReady() {
    if (!window.google?.accounts?.oauth2?.initTokenClient)
      throw Error("Google's Identity Services script is not available. Check content blockers, your connection, then retry.");
    if (!state.clientId) throw Error("Add an OAuth Web client ID under Google configuration first.");
  }
  async function connect() {
    googleReady();
    const response = await new Promise((resolve,reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: state.clientId,
        scope: SCOPE,
        callback: (r) => {
          if (r?.error || !r?.access_token) reject(Error(r?.error_description || r?.error || "Google authorization did not return a token."));
          else resolve(r);
        },
        error_callback: (e) => reject(Error(e?.type === "popup_closed" ? "Google sign-in was closed." : "Google sign-in popup could not open. Allow popups for this site."))
      });
      // Must be called from the user's click event; connect() does not await first.
      tokenClient.requestAccessToken({prompt: "consent"});
    });
    state.token = response.access_token;
    state.expires = Date.now() + ((Number(response.expires_in) || 3500) * 1000);
    state.rootId = null;
    $("disconnect").hidden = false;
    say("Google Drive connected for this browser session. Access is limited to files this app creates.", "success");
    await refresh();
  }
  function disconnect() {
    const old = state.token;
    state.token = null; state.rootId = null; state.expires = 0;
    state.snapshots = []; $("disconnect").hidden = true;
    $("backups").textContent = "Connect Google Drive to view backups.";
    $("backups").className = "placeholder";
    if (old && window.google?.accounts?.oauth2?.revoke) google.accounts.oauth2.revoke(old, () => {});
    say("Disconnected. No cloud files were deleted.", "success");
  }
  function ensureToken() {
    if (!state.token) throw Error("Connect Google Drive first.");
    if (Date.now() > state.expires - 15000) {
      state.token = null; $("disconnect").hidden = true;
      throw Error("Google authorization expired. Click Connect Google Drive again to continue. Partially uploaded snapshots are not listed as backups.");
    }
  }
  async function request(url, init={}) {
    ensureToken();
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", "Bearer " + state.token);
    const response = await fetch(url, {...init,headers});
    if (response.status === 401) {state.token=null; throw Error("Google session expired. Reconnect and retry.");}
    if (!response.ok) {
      const body = (await response.text()).slice(0,600);
      let message=body;
      try {message=JSON.parse(body).error?.message || body;} catch {}
      throw Error("Google Drive (" + response.status + "): " + message);
    }
    return response;
  }
  const query = (params) => new URLSearchParams(params).toString();
  const quote = (value) => value.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
  async function listFiles(q, fields="nextPageToken,files(id,name,mimeType,size,createdTime)",limit=1000) {
    let next = null; const result = [];
    do {
      const params = {q,fields,pageSize:String(Math.min(1000,limit))};
      if (next) params.pageToken = next;
      const response=await request(API + "?" + query(params));
      const payload=await response.json();
      result.push(...(payload.files || []));
      next=payload.nextPageToken;
      if (result.length >= limit) break;
    } while(next);
    return result.slice(0,limit);
  }
  async function createFolder(name,parentId) {
    const metadata={name,mimeType:"application/vnd.google-apps.folder"};
    if (parentId) metadata.parents=[parentId];
    const res=await request(API + "?fields=id,name",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(metadata)
    });
    return (await res.json()).id;
  }
  async function findRoot(create=false) {
    if (state.rootId) return state.rootId;
    const dirs=await listFiles("name='" + quote(ROOT_NAME) + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    if (dirs.length) return state.rootId=dirs[0].id;
    if (create) return state.rootId=await createFolder(ROOT_NAME);
    return null;
  }
  async function uploadBlob(name, blob, parent) {
    ensureToken();
    const url=UPLOAD + "?" + query({uploadType:"resumable",fields:"id,name,size"});
    const metadata={name,parents:[parent],mimeType:"application/octet-stream"};
    const start=await request(url,{
      method:"POST",
      headers:{"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":"application/octet-stream",
        "X-Upload-Content-Length":String(blob.size)},
      body:JSON.stringify(metadata)
    });
    const location=start.headers.get("Location");
    if (!location || !location.startsWith("https://www.googleapis.com/"))
      throw Error("Drive did not return a readable resumable-upload URL. Check the browser's cross-origin settings.");
    let offset=0, result=null;
    // Empty files are represented in the manifest; don't create a zero-length remote payload.
    if (!blob.size) throw Error("Unexpected empty blob uploaded: " + name);
    while (offset < blob.size) {
      ensureToken();
      const end=Math.min(offset+CHUNK,blob.size);
      const response=await fetch(location,{
        method:"PUT",
        headers:{"Content-Type":"application/octet-stream",
          "Content-Range":"bytes " + offset + "-" + (end-1) + "/" + blob.size,
          "Authorization":"Bearer "+state.token},
        body:blob.slice(offset,end)
      });
      if (response.status === 401) throw Error("Google authorization expired while uploading a file. Reconnect and create a new snapshot.");
      if (response.status===308) {offset=end;continue;}
      if (!response.ok) throw Error("Drive upload failed ("+response.status+"): "+(await response.text()).slice(0,350));
      result=await response.json();
      offset=end;
      if (offset !== blob.size) throw Error("Drive finalized an upload before all parts were sent.");
    }
    if (!result?.id) throw Error("Drive did not confirm the uploaded file " + name);
    if (result.size != null && Number(result.size)!==blob.size) throw Error("Drive reported an unexpected file size for " + name);
    return result.id;
  }
  function nameForEntry(i, item) {
    return String(i+1).padStart(6,"0")+"-"+item.tool+"-"+item.path.replaceAll("/","_").slice(-115);
  }
  function allLocalPreferences(tools) {
    const prefs=[];
    for(let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      const tool=tools.find(t => key?.match(new RegExp("^"+t+"(?:[.:_-]|$)","i")));
      if (tool) {
        const value=localStorage.getItem(key);
        if (value && value.length<=1000000) prefs.push({tool,key,value});
      }
    }
    return prefs;
  }
  async function backup() {
    const tools=selectedTools();
    if (!tools.length) throw Error("Select at least one editor.");
    say("Re-scanning your selected files before upload…");
    const found=(await inventory()).filter(f => tools.includes(f.tool));
    if (!found.length) throw Error("No OPFS files found for your selection. Save or import in the editor first.");
    const total=found.reduce((n,f)=>n+f.size,0);
    if (!confirm("Back up "+found.length+" files ("+bytes(total)+") from "+tools.map(t=>NAMES[t]).join(", ")+" to your Google Drive?\n\nFor a consistent snapshot, close every Craft editor tab first. Uploaded data uses your own Google Drive storage quota.")) {
      say("Backup canceled.");return;
    }
    const root=await findRoot(true);
    const now=new Date().toISOString();
    const folder=await createFolder("Craft Snapshot "+now.replace(/[.:]/g,"-"),root);
    const manifest={format:"princejona-craft-opfs-backup",version:1,origin:location.origin,createdAt:now,tools,files:[],preferences:allLocalPreferences(tools)};
    $("progress").hidden=false;$("progress").max=found.length+1;$("progress").value=0;
    let idx=0;
    for (const item of found) {
      say("Uploading "+NAMES[item.tool]+" · "+(idx+1)+"/"+found.length+" · "+bytes(item.size)+" · "+item.path);
      const fileId=item.size
        ? await uploadBlob(nameForEntry(idx,item),item.file,folder)
        : null; // Zero-length OPFS files are preserved by manifest and re-created on restore.
      manifest.files.push({tool:item.tool,path:item.path,size:item.size,driveFileId:fileId});
      idx++;$("progress").value=idx;
    }
    const manifestBlob=new Blob([JSON.stringify(manifest)],{type:"application/json"});
    await uploadBlob("manifest.json",manifestBlob,folder);
    $("progress").value=found.length+1;
    say("Backup complete: "+found.length+" files ("+bytes(total)+"). The restore manifest is published.", "success");
    await refresh();
  }
  async function readManifest(folderId) {
    const files=await listFiles("'"+quote(folderId)+"' in parents and name='manifest.json' and trashed=false",undefined,3);
    if (!files.length) return null; // Incomplete snapshot (no commit marker)
    const id=files[0].id;
    const response=await request(API+"/"+encodeURIComponent(id)+"?alt=media");
    const text=await response.text();
    if (text.length>3_000_000) throw Error("Backup manifest exceeds the supported size.");
    const data=JSON.parse(text);
    if (!data || data.format!=="princejona-craft-opfs-backup" || data.version!==1 || !Array.isArray(data.files) || !Array.isArray(data.tools))
      throw Error("Unsupported or malformed Craft backup manifest.");
    if (data.files.length>MAX_FILES || data.tools.some(t=>!DIRS[t])) throw Error("Backup has invalid editor or file count.");
    if (data.files.some(f=>!DIRS[f.tool] || !safePath(f.path,f.tool) ||
          !Number.isSafeInteger(f.size) || f.size<0 ||
          (f.size>0 && !/^[a-zA-Z0-9_-]+$/.test(f.driveFileId))))
      throw Error("Backup contains an invalid file path, ID or size.");
    return data;
  }
  async function refresh() {
    say("Checking Google Drive backup history…");
    const root=await findRoot(false);
    if (!root) {
      state.snapshots=[];
      $("backups").className="placeholder";$("backups").textContent="No backups yet. Select your tools and create the first snapshot.";
      say("Google Drive connected. No Craft backups yet.", "success");return;
    }
    const folders=await listFiles("'"+quote(root)+"' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",undefined,60);
    const valid=[];
    for (const folder of folders) {
      try {
        const manifest=await readManifest(folder.id);
        if (manifest) valid.push({folder,manifest});
      } catch(e) {console.warn("Skipping invalid/incomplete Craft snapshot",folder.name,e);}
    }
    valid.sort((a,b)=>(b.manifest.createdAt||"").localeCompare(a.manifest.createdAt||""));
    state.snapshots=valid;
    const box=$("backups"); box.replaceChildren();box.className="";
    if (!valid.length) {
      box.className="placeholder";box.textContent="No completed Craft backups found.";
    } else {
      for (const {folder,manifest} of valid) {
        const card=document.createElement("div");card.className="snapshot";
        const info=document.createElement("div");
        const head=document.createElement("strong");
        head.textContent=new Date(manifest.createdAt).toLocaleString();
        const sub=document.createElement("small");
        sub.textContent=manifest.tools.map(t=>NAMES[t]).join(" + ")+" · "+manifest.files.length+" files · "+
          bytes(manifest.files.reduce((n,f)=>n+f.size,0));
        const btn=document.createElement("button");
        btn.className="btn secondary";btn.type="button";btn.textContent="Restore";
        btn.addEventListener("click",()=>guarded(()=>restore(folder,manifest)));
        info.append(head,sub);card.append(info,btn);box.append(card);
      }
    }
    say("Google Drive connected · "+valid.length+" completed snapshots available.", "success");
  }
  async function restore(folder,manifest) {
    const count=manifest.files.length;
    const total=manifest.files.reduce((n,f)=>n+f.size,0);
    const confirmed=confirm(
      "RESTORE SNAPSHOT\n\n"+manifest.tools.map(t=>NAMES[t]).join(", ")+"\n"+count+" files · "+bytes(total)+
      "\n\nClose all Craft editor tabs before continuing. This overwrites local files with matching names, but does not erase unmatched files. Create a current backup first if you want to preserve existing work.\n\nRestore this snapshot?"
    );
    if (!confirmed) {say("Restore canceled.");return;}
    const root=await getRoot();
    $("progress").hidden=false;$("progress").max=count;$("progress").value=0;
    let idx=0;
    for (const f of manifest.files) {
      if (!safePath(f.path,f.tool)) throw Error("Unsafe file path in backup.");
      say("Restoring "+NAMES[f.tool]+" · "+(idx+1)+"/"+count+" · "+f.path);
      const parts=f.path.split("/");
      let dir=root;
      for (const part of parts.slice(0,-1)) dir=await dir.getDirectoryHandle(part,{create:true});
      const handle=await dir.getFileHandle(parts[parts.length-1],{create:true});
      const writer=await handle.createWritable();
      let received=0;
      try {
        if (f.size) {
          const response=await request(API+"/"+encodeURIComponent(f.driveFileId)+"?alt=media");
          if (!response.body) throw Error("Browser cannot stream Drive download.");
          const reader=response.body.getReader();
          for (;;) {
            const {done,value}=await reader.read();
            if (done) break;
            received+=value.byteLength;
            if (received>f.size) throw Error("Drive backup file exceeds declared size: "+f.path);
            await writer.write(value);
          }
        }
        if (received!==f.size) throw Error("Incomplete download for "+f.path+" ("+received+"/"+f.size+")");
        await writer.close();
      } catch(e) {await writer.abort().catch(()=>{});throw e;}
      $("progress").value=++idx;
    }
    // Only namespaced app keys, never arbitrary localStorage from Drive.
    for (const pref of manifest.preferences || []) {
      if (pref && manifest.tools.includes(pref.tool) && typeof pref.key==="string" &&
          new RegExp("^"+pref.tool+"(?:[.:_-]|$)","i").test(pref.key) &&
          typeof pref.value==="string" && pref.value.length<=1000000) localStorage.setItem(pref.key,pref.value);
    }
    say("Restore complete: "+count+" files recovered. Close this page, then reopen the relevant editor to load the restored project.", "success");
    await scan();
  }

  function loadConfig() {
    const builtIn=(window.CRAFT_STORAGE_CONFIG?.googleOAuthClientId || "").trim();
    const stored=(localStorage.getItem(CLIENT_KEY)||"").trim();
    state.clientId=stored || builtIn;
    $("client-id").value=state.clientId;
    note("connect-note", state.clientId ? "" :
      "Google Drive requires a public OAuth Web client ID for princejona.me. Configure one below to activate connection.");
  }
  loadConfig();
  $("save-config").addEventListener("click",()=>guarded(async()=>{
    setClientId(clientId());
    await scan();
  }));
  $("scan").addEventListener("click",()=>guarded(scan));
  $("persist").addEventListener("click",()=>guarded(persistStorage));
  $("connect").addEventListener("click",()=>guarded(connect));
  $("disconnect").addEventListener("click",disconnect);
  $("refresh").addEventListener("click",()=>guarded(refresh));
  $("backup").addEventListener("click",()=>guarded(backup));
  for (const tool of Object.keys(DIRS)) $("pick-"+tool).addEventListener("change",()=>{
    $("backup").disabled=state.busy || !state.token || !state.files.some(f=>$("pick-"+f.tool).checked);
  });
  guarded(scan);
})();