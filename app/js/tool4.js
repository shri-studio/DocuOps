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

async function t4TryFetch(url){
  // 0. Custom proxy (user-supplied or our own Vercel proxy — most reliable)
  const customProxy=document.getElementById('t4CustomProxy')?.value.trim()
    ||'https://docu-ops.vercel.app/api/proxy?url=';
  if(customProxy){
    try{
      const proxyUrl=customProxy+(customProxy.includes('?url=')?'':encodeURIComponent(url))+
        (customProxy.includes('?url=')?encodeURIComponent(url):'');
      const r=await fetch(proxyUrl,{signal:AbortSignal.timeout(25000)});
      if(r.ok)return r.blob();
    }catch(e){}
  }

  // 1. Direct fetch
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(r.ok)return r.blob();
  }catch(e){}

  // 2. allorigins /get endpoint — returns JSON with base64 for binary files
  try{
    const r=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      {signal:AbortSignal.timeout(20000)});
    if(r.ok){
      const json=await r.json();
      if(json.contents){
        try{
          const binary=atob(json.contents);
          const bytes=new Uint8Array(binary.length);
          for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
          return new Blob([bytes],{type:json.status?.content_type||'application/octet-stream'});
        }catch(e2){
          return new Blob([json.contents]);
        }
      }
    }
  }catch(e){}

  // 3. cors-anywhere
  try{
    const r=await fetch(`https://cors-anywhere.herokuapp.com/${url}`,
      {signal:AbortSignal.timeout(20000)});
    if(r.ok)return r.blob();
  }catch(e){}

  // 4. corsproxy.io
  try{
    const r=await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`,
      {signal:AbortSignal.timeout(20000)});
    if(r.ok)return r.blob();
  }catch(e){}

  // 5. cors.sh (with delay hint built-in)
  try{
    const r=await fetch(`https://proxy.cors.sh/${url}`,
      {signal:AbortSignal.timeout(20000)});
    if(r.ok)return r.blob();
  }catch(e){}

  throw new Error('All proxies failed');
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

  const CONCURRENCY=1;let idx=0;  // single stream to avoid proxy rate limits
  async function worker(){
    while(idx<total){
      const i=idx++;const url=t4AllUrls[i];const row=rows[i];
      const name=t4FilenameFromUrl(url,i+1);
      // Small delay between requests to respect proxy rate limits
      if(i>0)await new Promise(r=>setTimeout(r,600));
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
