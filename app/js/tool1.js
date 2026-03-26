// ============================================================
// DocuOps v3.0.0 — Tool 1 — Document Renamer
// OCR Document Renamer — all t1* functions
// ============================================================

// ════════════════════════════════════════════════════
// TOOL 1
// ════════════════════════════════════════════════════
let t1Files=[],t1Idx=0,t1Renamed=0,t1Skipped=0,t1Log=[],t1OcrMode='whole';
let t1PendingFiles = []; // Store files selected before starting

function t1Mode(m){
  t1OcrMode=m;
  document.getElementById('t1ModeWhole').classList.toggle('selected',m==='whole');
  document.getElementById('t1ModeSel').classList.toggle('selected',m==='select');
}

document.getElementById('t1FileIn').addEventListener('change',e=>{
  const f=Array.from(e.target.files).filter(f=>ACCEPT.test(f.name));
  if(!f.length){alert('No supported files.');return;}
  
  // Store the selected files but don't start yet
  t1PendingFiles = f;
  
  // Show the Start button
  const startBtn = document.getElementById('t1StartBtn');
  if(startBtn) {
    startBtn.style.display = 'inline-block';
    startBtn.textContent = `▶ Start Renaming (${f.length} files)`;
  }
});
const t1da=document.getElementById('t1DropArea');
t1da.addEventListener('dragover',e=>{e.preventDefault();t1da.classList.add('drag');});
t1da.addEventListener('dragleave',()=>t1da.classList.remove('drag'));
t1da.addEventListener('drop',e=>{
  e.preventDefault();
  t1da.classList.remove('drag');
  const f=Array.from(e.dataTransfer.files).filter(f=>ACCEPT.test(f.name));
  if(f.length){
    t1PendingFiles = f;
    const startBtn = document.getElementById('t1StartBtn');
    if(startBtn) {
      startBtn.style.display = 'inline-block';
      startBtn.textContent = `▶ Start Renaming (${f.length} files)`;
    }
  }
});

// New: Start session when user clicks Start button
async function t1StartSession(){
  if(!t1PendingFiles || t1PendingFiles.length === 0){
    alert('Please select files first.');
    return;
  }
  
  // Hide the Start button
  const startBtn = document.getElementById('t1StartBtn');
  if(startBtn) startBtn.style.display = 'none';
  
  // Start the actual renaming process
  await t1Start(t1PendingFiles);
}

async function t1Start(files){
  t1Files=files;t1Idx=0;t1Renamed=0;t1Skipped=0;t1Log=[];
  document.getElementById('t1Drop').style.display='none';
  document.getElementById('t1Work').style.display='grid';
  document.getElementById('t1ZBar').style.display='flex';
  document.getElementById('progressWrap').style.display='flex';
  document.getElementById('statTotal').textContent=files.length;
  document.getElementById('statDone').textContent='0';
  document.getElementById('statSkip').textContent='0';
  const mb=document.getElementById('modeBadge');
  mb.textContent=t1OcrMode==='whole'?'📄 Whole':'✂️ Select';
  mb.className='mode-badge '+(t1OcrMode==='whole'?'whole':'sel');mb.style.display='inline';
  document.getElementById('t1SelHint').style.display=t1OcrMode==='select'?'inline':'none';
  document.getElementById('t1OcrSelBtn').style.display=t1OcrMode==='select'?'block':'none';
  document.getElementById('t1Tip').innerHTML=t1OcrMode==='whole'
    ?'💡 <b>Whole Image:</b> OCR auto-runs. Edit number if needed → <b>Enter</b> to save.'
    :'💡 <b>Select Area:</b> Zoom in, drag box → OCR fires automatically.';

  v1.s.onOCR=(text)=>{
    const clean=text.trim(),guess=guessNo(clean);
    document.getElementById('t1OcrBox').textContent=clean||'(no text)';
    document.getElementById('t1Inp').value=guess||clean.split('\n')[0].trim();
    document.getElementById('t1Auto').textContent=guess||'first line';
    document.getElementById('t1SaveBtn').disabled=false;
    document.getElementById('t1SkipBtn').disabled=false;
    document.getElementById('t1FnameRow').style.display='flex';
    document.getElementById('t1FnameVal').textContent=(sanitize(document.getElementById('t1Inp').value)||'—')+'.jpg';
    document.getElementById('t1Inp').focus();document.getElementById('t1Inp').select();
  };
  // Update filename preview on input
  document.getElementById('t1Inp').oninput=()=>{
    const v=document.getElementById('t1Inp').value.trim();
    document.getElementById('t1FnameVal').textContent=(sanitize(v)||'—')+'.jpg';
  };

  v1.attachEvents(t1OcrMode);
  await ensureWorker();
  await t1Load();
}

async function t1Load(){
  if(t1Idx>=t1Files.length){t1ConfirmDone();return;}
  const file=t1Files[t1Idx];
  const ft=getFileType(file.name);const tb=getTypeBadge(ft);
  document.getElementById('progressFill').style.width=(t1Idx/t1Files.length*100)+'%';
  document.getElementById('progressText').textContent=`${t1Idx+1} / ${t1Files.length}`;
  document.getElementById('t1FName').textContent=file.name;
  const ftb=document.getElementById('t1FType');ftb.textContent=tb.label;ftb.className='file-type-badge '+tb.cls;
  document.getElementById('t1Inp').value='';document.getElementById('t1Auto').textContent='—';
  document.getElementById('t1OcrBox').textContent='Loading…';
  document.getElementById('t1SaveBtn').disabled=true;document.getElementById('t1SkipBtn').disabled=true;
  document.getElementById('t1FnameRow').style.display='none';
  const bb=document.getElementById('t1BackBtn');bb.classList.toggle('hidden',t1Idx===0);
  document.getElementById('t1OcrSelBtn').classList.remove('ready');
  document.getElementById('t1Overlay').style.display='flex';
  v1.reset();

  if(ft==='pdf'){
    await v1.loadPDF(file);
    if(t1OcrMode==='whole'){
      const w=await ensureWorker();
      const{data:{text}}=await w.recognize(v1.s.blob||file);
      v1.s.onOCR(text);
    } else {document.getElementById('t1Overlay').style.display='none';document.getElementById('t1SkipBtn').disabled=false;document.getElementById('t1OcrBox').textContent='Drag a box over the invoice number.';}
  } else if(ft==='mp4'){
    await v1.loadVideo(file);
    document.getElementById('t1SkipBtn').disabled=false;
    document.getElementById('t1OcrBox').textContent='Adjust frame then 📸 Capture, or drag a box.';
    if(t1OcrMode==='whole'){setTimeout(async()=>{if(v1.s.blob){const w=await ensureWorker();const{data:{text}}=await w.recognize(v1.s.blob);v1.s.onOCR(text);}},900);}
  } else {
    await v1.loadImg(file);
    if(t1OcrMode==='whole'){
      const w=await ensureWorker();
      const{data:{text}}=await w.recognize(file);
      v1.s.onOCR(text);
    } else {document.getElementById('t1Overlay').style.display='none';document.getElementById('t1SkipBtn').disabled=false;document.getElementById('t1OcrBox').textContent='Drag a box over the invoice number.';}
  }
}

async function t1SaveNext(){
  const val=document.getElementById('t1Inp').value.trim();
  if(!val){document.getElementById('t1Inp').style.borderColor='var(--danger)';setTimeout(()=>document.getElementById('t1Inp').style.borderColor='',900);return;}
  const file=t1Files[t1Idx];
  const newName=sanitize(val)+'.jpg';
  const blob=await v1.buildRotBlob();
  await saveBlob(blob,newName);
  const ft=getFileType(file.name);
  t1Log.push({o:file.name,n:newName,s:'OK',ft});
  t1AddRow(file.name,newName,'ok',ft);
  t1Renamed++;t1Idx++;
  document.getElementById('statDone').textContent=t1Renamed;
  await t1Load();
}

function t1Skip(){
  const file=t1Files[t1Idx];const ft=getFileType(file.name);
  t1Log.push({o:file.name,n:'(skipped)',s:'SKIPPED',ft});
  t1AddRow(file.name,'(skipped)','skip',ft);
  t1Skipped++;t1Idx++;document.getElementById('statSkip').textContent=t1Skipped;t1Load();
}

function t1GoBack(){
  if(t1Idx<=0)return;t1Idx--;
  if(t1Log.length&&t1Log[t1Log.length-1].o===t1Files[t1Idx].name){
    t1Log.pop();
    const ls=document.getElementById('t1LogSection');if(ls.firstChild)ls.removeChild(ls.firstChild);
    if(t1Renamed>0){t1Renamed--;document.getElementById('statDone').textContent=t1Renamed;}
  }
  t1Load();
}

function t1AddRow(o,n,t,ft){
  const tb=getTypeBadge(ft||'jpg');
  const r=document.createElement('div');r.className='log-row';
  r.innerHTML=`<span class="log-badge ${t==='ok'?'badge-ok':'badge-skip'}">${t==='ok'?'OK':'SKIP'}</span><span class="log-type">${tb.label.split(' ')[0]}</span><span class="log-old" title="${o}">${o}</span><span class="log-arr">→</span><span class="log-new" title="${n}">${n}</span>`;
  document.getElementById('t1LogSection').prepend(r);
}

function t1ConfirmDone(){
  if(confirm(`All ${t1Files.length} files processed!\n✔ Renamed: ${t1Renamed}\n⏭ Skipped: ${t1Skipped}\n\nFinish?`))t1ShowDone();
  else if(t1Idx>0){t1Idx--;t1Load();}
}

function t1ShowDone(){
  document.getElementById('t1Work').style.display='none';
  document.getElementById('t1LogSection').style.display='none';
  document.getElementById('progressWrap').style.display='none';
  document.getElementById('t1Done').style.display='flex';
  document.getElementById('t1DR').textContent=t1Renamed;
  document.getElementById('t1DS').textContent=t1Skipped;
  document.getElementById('t1DSub').innerHTML=sharedFolder
    ?`Saved to <strong style="color:var(--accent2)">${sharedFolder.name}</strong>`
    :`Downloaded to <strong style="color:var(--accent2)">Downloads</strong>`;
}

function t1DownloadCSV(){
  const rows=['Original,New Name,Type,Status'];
  t1Log.forEach(r=>rows.push(`"${r.o}","${r.n}","${r.ft}","${r.s}"`));
  const blob=new Blob([rows.join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rename_log.csv';a.click();
}

// T1 keyboard
document.addEventListener('keydown',e=>{
  if(document.getElementById('t1Work').style.display==='none')return;
  const inp=document.getElementById('t1Inp');
  if(document.activeElement===inp){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();t1SaveNext();}
    if(e.key==='Enter'&&e.shiftKey){e.preventDefault();t1Skip();}
    return;
  }
  if(e.key==='Enter'&&!e.shiftKey)t1SaveNext();
  if(e.key==='Enter'&&e.shiftKey)t1Skip();
  if(e.key==='ArrowLeft'&&t1Idx>0)t1GoBack();
  if(e.key==='['||e.key==='{')v1.rotate(-90);
  if(e.key===']'||e.key==='}')v1.rotate(90);
});

