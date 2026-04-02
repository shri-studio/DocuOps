// ============================================================
// DocuOps — Tool 4 — Bulk Link Downloader
// ============================================================

const T4_URL_RE = /https?:\/\/[^\s,;"'<>\[\]{}|\\^`\r\n]+/g;
let t4DirHandle = null;
let t4FileUrls  = [];
let t4AllUrls   = [];

function t4ExtractUrls(text){
  return [...new Set([...text.matchAll(T4_URL_RE)].map(m=>m[0].replace(/[.,;!?)]+$/,'')))];
}

function t4RefreshCount(){
  const textUrls = t4ExtractUrls(document.getElementById('t4LinkInput')?.value||'');
  t4AllUrls = [...new Set([...textUrls,...t4FileUrls])];
  const el = document.getElementById('t4UrlCount');
  if(el) el.innerHTML = `<span style="color:var(--green);font-weight:700;">${t4AllUrls.length}</span> link${t4AllUrls.length!==1?'s':''} detected`;
  const btn = document.getElementById('t4StartBtn');
  if(btn) btn.disabled = t4AllUrls.length===0;
}

function t4FilenameFromUrl(url, index){
  try{
    const path=decodeURIComponent(new URL(url).pathname);
    const parts=path.split('/');
    const name=parts[parts.length-1].split('?')[0];
    const clean=name.replace(/[\\/:*?"<>|]/g,'_');
    if(clean&&clean.length>0)return clean;
  }catch(e){}
  return `download_${String(index).padStart(4,'0')}`;
}

// File input
(function(){
  const finp=document.getElementById('t4FileInput');
  if(!finp)return;
  finp.addEventListener('change',async()=>{
    const file=finp.files[0];if(!file)return;
    document.getElementById('t4UploadLabel').textContent='✓ '+file.name;
    document.getElementById('t4UploadLabel').style.color='var(--green)';
    const ext=file.name.split('.').pop().toLowerCase();
    let text='';
    if(ext==='xlsx'||ext==='xls'){
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array'});
      wb.SheetNames.forEach(sn=>{text+=XLSX.utils.sheet_to_csv(wb.Sheets[sn])+'\n';});
    } else {
      text=await file.text();
    }
    t4FileUrls=t4ExtractUrls(text);
    t4RefreshCount();
  });

  // Drag & drop
  const zone=document.getElementById('t4UploadZone');
  if(zone){
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.style.borderColor='var(--green)';zone.style.background='rgba(45,212,160,.05)';});
    zone.addEventListener('dragleave',()=>{zone.style.borderColor='var(--border)';zone.style.background='none';});
    zone.addEventListener('drop',e=>{
      e.preventDefault();zone.style.borderColor='var(--border)';zone.style.background='none';
      const f=e.dataTransfer.files[0];
      if(f){finp.files=e.dataTransfer.files;finp.dispatchEvent(new Event('change'));}
    });
  }
})();

async function t4PickFolder(){
  if(!window.showDirectoryPicker){
    t4DirHandle='fallback';
    const el=document.getElementById('t4FolderPath');
    if(el){el.textContent='Downloads folder (browser fallback)';el.style.color='var(--warn)';}
    return;
  }
  try{
    t4DirHandle=await window.showDirectoryPicker({mode:'readwrite'});
    const el=document.getElementById('t4FolderPath');
    if(el){el.textContent='📁 '+t4DirHandle.name;el.style.color='var(--green)';}
  }catch(e){if(e.name!=='AbortError')alert('Folder error: '+e.message);}
}

// CORS proxy list — tried in order until one works
const T4_PROXIES=[
  u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u=>`https://corsproxy.io/?${encodeURIComponent(u)}`,
  u=>`https://proxy.cors.sh/${u}`,
  u=>`https://thingproxy.freeboard.io/fetch/${u}`,
];

async function t4TryFetch(url){
  // 1. Direct fetch first
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(r.ok)return r.blob();
  }catch(e){}
  // 2. Try each proxy in sequence
  for(const makeProxy of T4_PROXIES){
    try{
      const r=await fetch(makeProxy(url),{signal:AbortSignal.timeout(20000)});
      if(r.ok){
        const blob=await r.blob();
        // allorigins wraps in JSON sometimes — check content type
        if(blob.type&&!blob.type.includes('json'))return blob;
        // try reading as text to see if it's a JSON wrapper
        const text=await blob.text();
        try{
          const j=JSON.parse(text);
          if(j.contents)return new Blob([j.contents]);
        }catch(e2){}
        return blob;
      }
    }catch(e){}
  }
  throw new Error('All proxies failed for: '+url);
}

async function t4DownloadOne(url,filename){
  const blob=await t4TryFetch(url);
  if(t4DirHandle&&t4DirHandle!=='fallback'){
    const fh=await t4DirHandle.getFileHandle(filename,{create:true});
    const wr=await fh.createWritable();
    await wr.write(blob);await wr.close();
  } else {
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=filename;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(a.href),8000);
  }
}

async function t4Start(){
  if(!t4DirHandle){alert('Please select a target folder first (Step 03).');return;}
  t4RefreshCount();
  if(!t4AllUrls.length){alert('No links found!');return;}

  const btn=document.getElementById('t4StartBtn');
  const progress=document.getElementById('t4Progress');
  const logEl=document.getElementById('t4Log');
  const summaryEl=document.getElementById('t4Summary');
  const bar=document.getElementById('t4Bar');

  btn.disabled=true;
  progress.style.display='block';
  logEl.innerHTML='';
  summaryEl.innerHTML='';
  bar.style.width='0%';

  const total=t4AllUrls.length;
  let done=0,ok=0,err=0;

  const rows=t4AllUrls.map(url=>{
    const div=document.createElement('div');
    div.style.cssText='display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-family:var(--mono);font-size:11px;';
    div.innerHTML=`<span class="li-icon" style="flex-shrink:0;width:16px;text-align:center;">⬜</span><span style="flex:1;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${url}">${url}</span><span class="li-status" style="flex-shrink:0;font-size:10px;color:var(--muted);">queued</span>`;
    logEl.appendChild(div);return div;
  });

  function updateSummary(){
    summaryEl.innerHTML=
      `<span>Total: ${total}</span>`+
      `<span style="color:var(--green);">✓ Done: ${ok}</span>`+
      (err?`<span style="color:var(--danger);">✗ Failed: ${err}</span>`:'')+
      (done<total?`<span>Remaining: ${total-done}</span>`:`<span style="color:var(--green);">— All finished</span>`);
  }

  const CONCURRENCY=4;let idx=0;
  async function worker(){
    while(idx<total){
      const i=idx++;const url=t4AllUrls[i];const row=rows[i];
      const name=t4FilenameFromUrl(url,i+1);
      row.style.borderColor='var(--blue)';
      row.querySelector('.li-icon').textContent='⏳';
      row.querySelector('.li-status').textContent='downloading…';
      row.scrollIntoView({block:'nearest',behavior:'smooth'});
      try{
        await t4DownloadOne(url,name);
        row.style.borderColor='var(--border)';
        row.querySelector('.li-icon').textContent='✅';
        row.querySelector('.li-status').style.color='var(--green)';
        row.querySelector('.li-status').textContent=name;
        ok++;
      }catch(e){
        row.style.borderColor='var(--danger)';
        row.querySelector('.li-icon').textContent='❌';
        row.querySelector('.li-status').style.color='var(--danger)';
        row.querySelector('.li-status').textContent='failed: '+e.message;
        err++;
      }
      done++;
      bar.style.width=`${(done/total)*100}%`;
      updateSummary();
    }
  }

  await Promise.all(Array.from({length:Math.min(CONCURRENCY,total)},worker));
  btn.disabled=false;
}
