const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  user: null,
  view: "home",
  tracks: [],
  playlists: [],
  favorites: new Set(),
  current: null,
  queue: [],
  queueIndex: -1,
  accessToken: null,
  driveFolderId: null,
  libraryFileId: null,
  eq: { bass: 0, mid: 0, treble: 0 },
  audioCtx: null, source: null, filters: null
};

const audio = $("#audio");
let tokenClient = null;

function getClientId() {
  return (localStorage.getItem("wavecloud_google_client_id") || GOOGLE_CLIENT_ID || "").trim();
}
function saveClientId(id) {
  localStorage.setItem("wavecloud_google_client_id", id.trim());
  tokenClient = null;
}
function clearClientId() {
  localStorage.removeItem("wavecloud_google_client_id");
  tokenClient = null;
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg; document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function fmt(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  return `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,"0")}`;
}
function escapeHtml(s="") {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function trackFromFile(file, id=null) {
  const base = file.name.replace(/\.[^/.]+$/, "");
  const parts = base.split(" - ");
  return {
    id: id || crypto.randomUUID(),
    name: base,
    title: parts.length > 1 ? parts.slice(1).join(" - ") : base,
    artist: parts.length > 1 ? parts[0] : "Artiste inconnu",
    album: "Ma bibliothèque",
    mimeType: file.type || "audio/mpeg",
    size: file.size || 0,
    driveFileId: id,
    localFile: file
  };
}

function render() {
  const c = $("#content");
  if (!state.user) return renderLogin(c);
  if (state.view === "home") return renderHome(c);
  if (state.view === "library") return renderLibrary(c, state.tracks);
  if (state.view === "favorites") return renderLibrary(c, state.tracks.filter(t=>state.favorites.has(t.id)), "Favoris");
  if (state.view === "playlists") return renderPlaylists(c);
  if (state.view === "equalizer") return renderEqualizer(c);
}
function renderLogin(c) {
  c.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">W</div>
        <div class="eyebrow">WaveCloud</div>
        <h1>Ta musique, partout.</h1>
        <p>Connecte-toi avec ton compte Google pour retrouver ta bibliothèque sur ton ordinateur, ton téléphone et ta tablette.</p>
        <button class="google-login" id="googleLogin"><span class="google-g">G</span> Continuer avec Google</button>
        <div class="login-foot">Tes fichiers restent dans ton propre Google Drive.</div>
      </div>
    </div>`;
  $("#googleLogin").onclick = connectAccount;
}

function renderAccountModal() {
  $("#modalBody").innerHTML = `
    <h2>Mon compte</h2>
    <p><b>${escapeHtml(state.user?.name || "Utilisateur")}</b><br>${escapeHtml(state.user?.email || "")}</p>
    <div class="modal-actions">
      <button class="mini-btn" id="logoutBtn">Se déconnecter</button>
      <button class="primary" id="accountClose">Fermer</button>
    </div>`;
  $("#modal").classList.remove("hidden");
  $("#accountClose").onclick=()=>$("#modal").classList.add("hidden");
  $("#logoutBtn").onclick=logoutAccount;
}

function renderHome(c) {
  const total = state.tracks.reduce((n,t)=>n+(t.size||0),0);
  c.innerHTML = `
    <div class="hero">
      <div class="eyebrow">Ta bibliothèque personnelle</div>
      <h1>Ta musique. Ton cloud. Ton espace.</h1>
      <p>Importe tes MP3, crée tes playlists et écoute-les avec ton égaliseur.</p>
    </div>
    <div class="stats">
      <div class="stat"><strong>${state.tracks.length}</strong><span>Morceaux</span></div>
      <div class="stat"><strong>${state.favorites.size}</strong><span>Favoris</span></div>
      <div class="stat"><strong>${state.playlists.length}</strong><span>Playlists</span></div>
    </div>
    <div class="upload-zone" id="dropZone">
      <div class="big-plus">＋</div><h3>Importer de la musique</h3>
      <p>Glisse tes fichiers MP3 ici ou sélectionne-les depuis ton ordinateur.</p>
      <button class="primary" id="homeUpload">Choisir des fichiers</button>
    </div>
    <div class="section-head"><h2>Ajouts récents</h2><button class="ghost" data-view="library">Voir tout</button></div>
    ${trackList(state.tracks.slice(-6).reverse())}
  `;
  $("#homeUpload").onclick=()=>$("#fileInput").click();
  const dz=$("#dropZone");
  dz.ondragover=e=>{e.preventDefault();dz.style.borderColor="var(--accent)"};
  dz.ondragleave=()=>dz.style.borderColor="";
  dz.ondrop=e=>{e.preventDefault();dz.style.borderColor=""; handleFiles(e.dataTransfer.files)};
  $$(".ghost").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});
}
function renderLibrary(c, tracks, title="Ma musique") {
  c.innerHTML=`<div class="hero"><div class="eyebrow">Bibliothèque</div><h1>${escapeHtml(title)}</h1><p>${tracks.length} morceau${tracks.length>1?"x":""}</p></div>${trackList(tracks)}`;
}
function trackList(tracks) {
  if (!tracks.length) return `<div class="empty"><strong>Aucun morceau ici</strong>Importe des MP3 pour commencer.</div>`;
  return `<div class="track-list">${tracks.map((t,i)=>`
    <div class="track">
      <button class="track-cover" data-play="${t.id}">♪</button>
      <div data-play="${t.id}" style="min-width:0"><div class="track-title">${escapeHtml(t.title)}</div><div class="track-artist">${escapeHtml(t.artist)}</div></div>
      <div class="track-album">${escapeHtml(t.album||"")}</div>
      <div class="track-duration">${t.duration?fmt(t.duration):"—"}</div>
      <div class="row-actions">
        <button class="small-action fav ${state.favorites.has(t.id)?"on":""}" data-fav="${t.id}">${state.favorites.has(t.id)?"♥":"♡"}</button>
        <button class="small-action" data-download="${t.id}" title="Télécharger">↓</button>
      </div>
    </div>`).join("")}</div>`;
}
function renderPlaylists(c) {
  c.innerHTML=`<div class="hero"><div class="eyebrow">Organisation</div><h1>Playlists</h1><p>Crée des collections à ton goût.</p></div>
  <button class="primary" id="newPlaylist">＋ Nouvelle playlist</button>
  <div class="playlist-grid" style="margin-top:16px">${state.playlists.map(p=>`
    <button class="playlist-card" data-pl="${p.id}"><div class="playlist-art">♫</div><strong>${escapeHtml(p.name)}</strong><span>${p.trackIds.length} morceau${p.trackIds.length>1?"x":""}</span></button>`).join("")}</div>`;
  $("#newPlaylist").onclick=()=>createPlaylist();
}
function renderEqualizer(c) {
  c.innerHTML=`<div class="hero"><div class="eyebrow">Audio</div><h1>Égaliseur</h1><p>Ajuste les basses, médiums et aigus pendant la lecture.</p></div>
  <div class="eq-panel">
    <div class="slider-group"><label><span>Préréglage</span></label>
      <select id="preset" style="width:100%;background:#0b0c10;color:white;border:1px solid var(--line);border-radius:9px;padding:10px">
        <option value="custom">Personnalisé</option><option value="flat">Flat</option><option value="bass">Bass Boost</option><option value="vocal">Voix</option>
      </select>
    </div>
    <div class="eq-grid">
      ${["bass","mid","treble"].map(k=>`<div class="slider-group"><label><span>${k==="bass"?"Basses":k==="mid"?"Médiums":"Aigus"}</span><output id="${k}Val">${state.eq[k]} dB</output></label><input id="${k}Slider" type="range" min="-12" max="12" value="${state.eq[k]}"></div>`).join("")}
    </div>
  </div>`;
  ["bass","mid","treble"].forEach(k=>$("#"+k+"Slider").oninput=e=>{state.eq[k]=+e.target.value;$("#"+k+"Val").textContent=`${state.eq[k]} dB`;applyEq()});
  $("#preset").onchange=e=>{
    const p=e.target.value, vals=p==="bass"?[7,2,0]:p==="vocal"?[-2,5,3]:[0,0,0];
    if(p!=="custom"){["bass","mid","treble"].forEach((k,i)=>{state.eq[k]=vals[i];$("#"+k+"Slider").value=vals[i];$("#"+k+"Val").textContent=`${vals[i]} dB`});applyEq()}
  };
}
function setupAudioGraph() {
  if (state.audioCtx) return;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx) return;
  state.audioCtx=new Ctx();
  state.source=state.audioCtx.createMediaElementSource(audio);
  const bass=state.audioCtx.createBiquadFilter();bass.type="lowshelf";bass.frequency.value=180;
  const mid=state.audioCtx.createBiquadFilter();mid.type="peaking";mid.frequency.value=1000;mid.Q.value=0.8;
  const treble=state.audioCtx.createBiquadFilter();treble.type="highshelf";treble.frequency.value=5000;
  state.filters={bass,mid,treble};
  state.source.connect(bass).connect(mid).connect(treble).connect(state.audioCtx.destination);
  applyEq();
}
function applyEq(){
  if(!state.filters)return;
  state.filters.bass.gain.value=state.eq.bass;state.filters.mid.gain.value=state.eq.mid;state.filters.treble.gain.value=state.eq.treble;
}

function playTrack(id) {
  const t=state.tracks.find(x=>x.id===id); if(!t)return;
  state.current=t; state.queue=state.queue.length?state.queue:state.tracks; state.queueIndex=Math.max(0,state.queue.findIndex(x=>x.id===id));
  if(t.localFile){ audio.src=URL.createObjectURL(t.localFile); audio.dataset.objectUrl="1"; }
  else if(t.driveFileId && state.accessToken){ audio.src=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(t.driveFileId)}?alt=media`; audio.removeAttribute("data-object-url"); }
  else { toast("Connecte Google Drive ou importe un fichier local."); return; }
  audio.load(); audio.play().catch(()=>{});
  $("#playerTitle").textContent=t.title;$("#playerArtist").textContent=t.artist;$("#playerFav").textContent=state.favorites.has(t.id)?"♥":"♡";
  setupAudioGraph(); if(state.audioCtx?.state==="suspended")state.audioCtx.resume(); render();
}
function nextTrack(dir=1){
  if(!state.queue.length)return;
  let i=state.queueIndex+dir;
  if(i<0)i=state.queue.length-1;if(i>=state.queue.length)i=0;
  playTrack(state.queue[i].id);
}
audio.addEventListener("loadedmetadata",()=>{$("#duration").textContent=fmt(audio.duration); const t=state.tracks.find(x=>x.id===state.current?.id);if(t)t.duration=audio.duration});
audio.addEventListener("timeupdate",()=>{if(audio.duration){$("#progress").value=(audio.currentTime/audio.duration)*100;$("#currentTime").textContent=fmt(audio.currentTime)}});
audio.addEventListener("ended",()=>nextTrack(1));
$("#playBtn").onclick=()=>{if(!state.current){if(state.tracks[0])playTrack(state.tracks[0].id);return} if(audio.paused){setupAudioGraph();audio.play();}else audio.pause()};
audio.addEventListener("play",()=>$("#playBtn").textContent="Ⅱ");
audio.addEventListener("pause",()=>$("#playBtn").textContent="▶");
$("#prevBtn").onclick=()=>nextTrack(-1);$("#nextBtn").onclick=()=>nextTrack(1);
$("#progress").oninput=e=>{if(audio.duration)audio.currentTime=(+e.target.value/100)*audio.duration};
$("#volume").oninput=e=>audio.volume=+e.target.value;
$("#eqQuickBtn").onclick=()=>{state.view="equalizer";render()};
$("#playerFav").onclick=()=>{if(state.current)toggleFav(state.current.id)};
function toggleFav(id){state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);saveMeta();render();if(state.current?.id===id)$("#playerFav").textContent=state.favorites.has(id)?"♥":"♡"}

function createPlaylist(){
  const name=prompt("Nom de la playlist :"); if(!name?.trim())return;
  state.playlists.push({id:crypto.randomUUID(),name:name.trim(),trackIds:[]});saveMeta();render();
}
function saveMeta(){
  localStorage.setItem("wavecloud_meta",JSON.stringify({favorites:[...state.favorites],playlists:state.playlists}));
  if(state.accessToken) uploadLibraryMeta().catch(()=>{});
}
function loadMeta(){
  try{const x=JSON.parse(localStorage.getItem("wavecloud_meta")||"{}");state.favorites=new Set(x.favorites||[]);state.playlists=x.playlists||[]}catch{}
}

async function driveFetch(url,opts={}) {
  if(!state.accessToken)throw new Error("Google Drive non connecté");
  const headers=new Headers(opts.headers||{});headers.set("Authorization","Bearer "+state.accessToken);
  return fetch(url,{...opts,headers});
}
async function ensureDriveFolder(){
  if(state.driveFolderId)return state.driveFolderId;
  const q=encodeURIComponent("name = 'WaveCloud' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const r=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`);
  const d=await r.json(); if(d.files?.length){state.driveFolderId=d.files[0].id;return state.driveFolderId}
  const r2=await driveFetch("https://www.googleapis.com/drive/v3/files",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"WaveCloud",mimeType:"application/vnd.google-apps.folder"})});
  const d2=await r2.json();state.driveFolderId=d2.id;return state.driveFolderId;
}
async function uploadToDrive(file){
  const folder=await ensureDriveFolder();
  const metadata={name:file.name,mimeType:file.type||"audio/mpeg",parents:[folder]};
  const boundary="wavecloud_"+Date.now();
  const body=new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: ${file.type||"audio/mpeg"}\r\n\r\n`,
    file,`\r\n--${boundary}--`
  ]);
  const r=await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size",{method:"POST",headers:{"Content-Type":`multipart/related; boundary=${boundary}`},body});
  if(!r.ok)throw new Error(await r.text());
  return r.json();
}
async function uploadLibraryMeta(){
  if(!state.accessToken)return;
  const folder=await ensureDriveFolder();
  const metadata={name:"wavecloud-library.json",mimeType:"application/json",parents:[folder]};
  const content=JSON.stringify({favorites:[...state.favorites],playlists:state.playlists});
  let id=state.libraryFileId;
  if(id){
    const r=await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:content});
    if(r.ok)return;
  }
  const boundary="meta_"+Date.now();
  const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,content,`\r\n--${boundary}--`]);
  const r=await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",{method:"POST",headers:{"Content-Type":`multipart/related; boundary=${boundary}`},body});
  if(r.ok)state.libraryFileId=(await r.json()).id;
}
async function loadDriveLibrary(){
  const folder=await ensureDriveFolder();
  const q=encodeURIComponent(`'${folder}' in parents and trashed = false`);
  const r=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size)&orderBy=name`);
  const d=await r.json();
  const meta=d.files?.find(x=>x.name==="wavecloud-library.json");
  if(meta){
    state.libraryFileId=meta.id;
    const mr=await driveFetch(`https://www.googleapis.com/drive/v3/files/${meta.id}?alt=media`);
    if(mr.ok){const x=await mr.json();state.favorites=new Set(x.favorites||[]);state.playlists=x.playlists||[]}
  }
  state.tracks=(d.files||[]).filter(x=>x.mimeType?.startsWith("audio/")).map(x=>({id:x.id,driveFileId:x.id,name:x.name,title:x.name.replace(/\.[^/.]+$/,""),artist:"Artiste inconnu",album:"Google Drive",size:+x.size||0,mimeType:x.mimeType}));
  localStorage.setItem("wavecloud_meta",JSON.stringify({favorites:[...state.favorites],playlists:state.playlists}));
}

function connectAccount(){
  const clientId = getClientId();
  if(!clientId){openConfigModal();return}
  if(!tokenClient){
    tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:clientId,
      scope:"https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
      callback: async resp=>{
        if(resp.error){toast("Connexion Google refusée.");return}
        state.accessToken=resp.access_token;
        try{
          const r=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+state.accessToken}});
          if(!r.ok)throw new Error("userinfo");
          state.user=await r.json();
          localStorage.setItem("wavecloud_user",JSON.stringify({sub:state.user.sub,name:state.user.name,email:state.user.email,picture:state.user.picture||""}));
          updateAccountUI();
          await loadDriveLibrary();
          toast("Bienvenue sur WaveCloud.");
          render();
        }catch(e){console.error(e);toast("Impossible de charger ton compte.");}
      }
    });
  }
  tokenClient.requestAccessToken({prompt:"consent"});
}
function logoutAccount(){
  state.accessToken=null; state.user=null; state.tracks=[]; state.current=null;
  $("#modal").classList.add("hidden");
  localStorage.removeItem("wavecloud_user");
  updateAccountUI(); render(); toast("Tu es déconnecté.");
}
function updateAccountUI(){
  const p=$("#profileBtn");
  if(!p)return;
  p.textContent=state.user ? (state.user.name||state.user.email||"W").slice(0,1).toUpperCase() : "W";
  p.title=state.user ? state.user.email : "Connexion";
}

async function connectDrive(){
  const clientId = getClientId();
  if(!clientId){openConfigModal();return}
  if(!tokenClient){
    tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:clientId,
      scope:"https://www.googleapis.com/auth/drive.file",
      callback: async resp=>{
        if(resp.error){toast("Connexion Google refusée.");return}
        state.accessToken=resp.access_token;
        $("#driveStatus").textContent="Connecté";
        $("#driveBtn").textContent="Drive OK";
        try{await loadDriveLibrary();toast("Google Drive connecté.");render()}catch(e){console.error(e);toast("Impossible de lire WaveCloud sur Drive.")}
      }
    });
  }
  tokenClient.requestAccessToken({prompt:""});
}
function openConfigModal(){
  const current = getClientId();
  $("#modalBody").innerHTML=`
    <h2>Configurer Google Drive</h2>
    <p>Il manque le <b>Client ID OAuth</b> de ton application Google. Ce n'est <b>pas</b> ton mot de passe et tu ne dois jamais mettre de mot de passe ou de Client Secret ici.</p>
    <p>Crée un Client ID de type <b>Application Web</b> dans Google Cloud, puis colle-le ci-dessous. Il peut être enregistré dans ce navigateur.</p>
    <input id="clientIdInput" type="text" autocomplete="off" spellcheck="false" placeholder="1234567890-xxxx.apps.googleusercontent.com" value="${escapeHtml(current)}">
    <div class="modal-actions">
      <button class="mini-btn" id="removeClientId">Effacer</button>
      <button class="primary" id="saveClientId">Enregistrer et continuer</button>
    </div>`;
  $("#modal").classList.remove("hidden");
  $("#clientIdInput").focus();
  $("#saveClientId").onclick=()=>{
    const id=$("#clientIdInput").value.trim();
    if(!/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id)){
      toast("Le Client ID Google semble incorrect."); return;
    }
    saveClientId(id);
    $("#modal").classList.add("hidden");
    toast("Client ID enregistré.");
    connectAccount();
  };
  $("#removeClientId").onclick=()=>{
    clearClientId();
    $("#clientIdInput").value="";
    toast("Client ID effacé de ce navigateur.");
  };
}
async function handleFiles(files){
  const list=[...files].filter(f=>f.type.startsWith("audio/")||/\.mp3$/i.test(f.name));
  if(!list.length){toast("Aucun fichier audio compatible.");return}
  if(!state.accessToken){
    list.forEach(f=>state.tracks.push(trackFromFile(f)));
    saveMeta();render();toast(`${list.length} morceau${list.length>1?"x":""} ajouté${list.length>1?"s":""} localement.`);
    return;
  }
  toast("Import en cours…");
  for(const f of list){
    try{
      const d=await uploadToDrive(f);
      state.tracks.push(trackFromFile(f,d.id)); state.tracks[state.tracks.length-1].driveFileId=d.id;
    }catch(e){console.error(e);toast(`Échec de l'import de ${f.name}`)}
  }
  await uploadLibraryMeta();render();toast("Import terminé.");
}

$("#driveBtn").onclick=()=>state.user ? (state.accessToken ? openConfigModal() : connectAccount()) : connectAccount();
$("#profileBtn").onclick=()=>state.user ? renderAccountModal() : connectAccount();
$("#uploadBtn").onclick=()=>{ if(!state.user){connectAccount();return} $("#fileInput").click(); };
$("#fileInput").onchange=e=>handleFiles(e.target.files);
$("#searchInput").oninput=e=>{
  const q=e.target.value.toLowerCase().trim();
  if(!q){render();return}
  const filtered=state.tracks.filter(t=>(t.title+" "+t.artist+" "+t.album).toLowerCase().includes(q));
  $("#content").innerHTML=`<div class="hero"><div class="eyebrow">Recherche</div><h1>Résultats</h1><p>${filtered.length} résultat${filtered.length>1?"s":""}</p></div>${trackList(filtered)}`;
};
async function downloadTrack(id){
  const t=state.tracks.find(x=>x.id===id); if(!t)return;
  if(t.localFile){ const a=document.createElement("a");a.href=URL.createObjectURL(t.localFile);a.download=t.name||t.title+".mp3";a.click();return; }
  if(!state.accessToken){toast("Connecte Google Drive pour télécharger ce morceau.");return}
  try{
    const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(t.driveFileId)}?alt=media`);
    if(!r.ok)throw new Error("download failed");
    const blob=await r.blob();const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=t.name||t.title+".mp3";a.click();
  }catch(e){toast("Téléchargement impossible pour le moment.")}
}
document.addEventListener("click",e=>{
  const dl=e.target.closest("[data-download]");if(dl){downloadTrack(dl.dataset.download);return}
  const play=e.target.closest("[data-play]");if(play){playTrack(play.dataset.play);return}
  const fav=e.target.closest("[data-fav]");if(fav){toggleFav(fav.dataset.fav);return}
  const nav=e.target.closest(".nav-item");if(nav){if(!state.user){connectAccount();return}state.view=nav.dataset.view;render();return}
});
$("#modalClose").onclick=()=>$("#modal").classList.add("hidden");

try {
  const savedUser = JSON.parse(localStorage.getItem("wavecloud_user") || "null");
  if(savedUser) state.user = savedUser;
} catch {}

updateAccountUI();

if(state.user && getClientId()){
  $("#driveStatus").textContent = "Connexion à Drive…";
  $("#driveBtn").textContent = "Connexion…";

  setTimeout(() => {
    connectAccount();
  }, 500);
}

render();
