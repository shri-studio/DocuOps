const DOCUOPS_VERSION = '3.2.6';

// ============================================================
// DocuOps v3.0.0 — Shared Utilities & Viewer Engine
// FSM utilities, makeViewer factory, navigation, shared helpers
// ============================================================

// ════════════════════════════════════════════════════
// SHARED
// ════════════════════════════════════════════════════
let sharedWorker=null, sharedFolder=null;
const ACCEPT=/\.(jpg|jpeg|png|webp|bmp|gif|pdf|mp4)$/i;

function getFileType(n){
  const e=n.split('.').pop().toLowerCase();
  if(['jpg','jpeg'].includes(e))return 'jpg';
  if(['png','webp','bmp'].includes(e))return 'img';
  if(e==='gif')return 'gif';
  if(e==='pdf')return 'pdf';
  if(e==='mp4')return 'mp4';
  return 'img';
}
function getTypeBadge(ft){
  const m={jpg:'📷 JPG',img:'🖼 IMG',gif:'🎞 GIF',pdf:'📄 PDF',mp4:'🎬 MP4'};
  const c={jpg:'ftb-jpg',img:'ftb-img',gif:'ftb-gif',pdf:'ftb-pdf',mp4:'ftb-mp4'};
  return{label:m[ft]||ft,cls:c[ft]||'ftb-img'};
}
function sanitize(n){return n.replace(/[<>:"/\\|?*\x00-\x1f]/g,'').replace(/\s+/g,'-').replace(/^\.+|\.+$/g,'');}

async function ensureWorker(){
  if(sharedWorker)return sharedWorker;
  sharedWorker=await Tesseract.createWorker('eng',1,{
    logger:m=>{
      if(m.status==='recognizing text'){
        document.querySelectorAll('.ocr-status-txt').forEach(e=>e.textContent=`OCR ${Math.round(m.progress*100)}%`);
      }
    }
  });
  return sharedWorker;
}

async function pickFolder(tool){
  if(!('showDirectoryPicker' in window)){alert('Folder picker needs Chrome/Edge.');return;}
  try{
    sharedFolder=await window.showDirectoryPicker({mode:'readwrite'});
    const id=tool==='t1'?'t1FolderName':'t2FolderName';
    const el=document.getElementById(id);
    if(el){el.textContent='📁 '+sharedFolder.name;el.classList.remove('none');}
  }catch(e){if(e.name!=='AbortError')console.error(e);}
}

async function saveBlob(blob,name){
  if(sharedFolder){
    try{
      const fh=await sharedFolder.getFileHandle(name,{create:true});
      const w=await fh.createWritable();
      await w.write(blob);await w.close();return;
    }catch(e){console.warn(e);}
  }
  const u=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=u;a.download=name;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(u),1000);
}

async function loadPDFjs(){
  return new Promise((res,rej)=>{
    if(window.pdfjsLib){res();return;}
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/legacy/build/pdf.min.js';
    s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/legacy/build/pdf.worker.min.js';res();};
    s.onerror=rej;document.head.appendChild(s);
  });
}

function guessNo(t){
  const ps=[
    /(?:Invoice\s*(?:No|Number|#|No\.)?[\s:]*)([\w\-\/]+)/i,
    /(?:INV|SI|PO|ORD|BILL|REC|REF|TXN|TAX|GST|VAT)[\-\/\s]?(\w[\w\-\/]{2,})/i,
    /#\s*(\d{4,})/,/\b(\d{5,10})\b/
  ];
  for(const p of ps){const m=t.match(p);if(m)return m[1].trim().replace(/\s+/g,'-');}
  return '';
}

// Navigation
function showHome(){
  const confirm_needed = typeof _sessionActive !== 'undefined' && _sessionActive;
  if(confirm_needed){
    if(!confirm('Go back to home?\n\nAny unsaved work will be lost.')) return;
  }
  document.getElementById('homePage').style.display='flex';
  document.getElementById('tool1').style.display='none';
  document.getElementById('tool2').style.display='none';
  const t3 = document.getElementById('tool3');
  if(t3) t3.style.display='none';
  const b=document.getElementById('toolBadge');
  if(b){b.style.display='none';b.textContent='';}
  const mb=document.getElementById('modeBadge');
  if(mb) mb.style.display='none';
  const sb=document.getElementById('statsBar');
  if(sb) sb.style.display='none';
  if(typeof _setSessionActive==='function') _setSessionActive(false);
}


function launchT1(){
  document.getElementById('homePage').style.display='none';
  document.getElementById('tool1').style.display='flex';
  document.getElementById('tool2').style.display='none';
  // homeBtn removed v2.2.4
  const b=document.getElementById('toolBadge');
  b.textContent='📄 Renamer';b.className='tool-badge t1';b.style.display='inline';
  document.getElementById('statsBar').style.display='flex';
}

function launchT2(){
  document.getElementById('homePage').style.display='none';
  document.getElementById('tool1').style.display='none';
  document.getElementById('tool2').style.display='flex';
  // homeBtn removed v2.2.4
  const b=document.getElementById('toolBadge');
  b.textContent='📊 Data Entry';b.className='tool-badge t2';b.style.display='inline';
  t2ShowSetup();
}

// ════════════════════════════════════════════════════
// VIEWER ENGINE
// ════════════════════════════════════════════════════
function makeViewer(px){
  const s={
    canvas:null,ctx:null,wrap:null,videoEl:null,
    img:null,natW:0,natH:0,blob:null,
    zoom:1,panX:0,panY:0,rot:0,
    isPan:false,pSX:0,pSY:0,pOX:0,pOY:0,
    drag:false,ox:0,oy:0,sx:0,sy:0,sw:0,sh:0,hasSel:false,
    pdfDoc:null,pdfPage:1,pdfTotal:1,vidDur:0,
    onOCR:null
  };
  const g=id=>document.getElementById(px+id);
  const showOvl=v=>{ const e=g('Overlay');if(e)e.style.display=v?'flex':'none'; };
  const setTxt=t=>{ const e=g('Status');if(e)e.textContent=t; };

  function render(){
    if(!s.img||!s.canvas)return;
    const cw=s.canvas.width,ch=s.canvas.height,ctx=s.ctx;
    ctx.clearRect(0,0,cw,ch);
    const rot90=(s.rot===90||s.rot===270);
    const dW=rot90?s.natH:s.natW,dH=rot90?s.natW:s.natH;
    const sc=Math.min(cw/dW,ch/dH);
    const fW=dW*sc,fH=dH*sc,fX=(cw-fW)/2,fY=(ch-fH)/2;
    ctx.save();
    ctx.translate(fX+s.panX+fW/2,fY+s.panY+fH/2);
    ctx.rotate(s.rot*Math.PI/180);
    ctx.scale(s.zoom,s.zoom);
    ctx.drawImage(s.img,-fW/2,-fH/2,fW,fH);
    ctx.restore();
    if(s.hasSel||(s.drag&&s.sw>1))drawSel(cw,ch,fX,fY,fW,fH);
  }

  function drawSel(cw,ch,fX,fY,fW,fH){
    const ctx=s.ctx;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(0,0,cw,ch);
    ctx.clearRect(s.sx,s.sy,s.sw,s.sh);
    ctx.save();ctx.beginPath();ctx.rect(s.sx,s.sy,s.sw,s.sh);ctx.clip();
    ctx.translate(fX+s.panX+fW/2,fY+s.panY+fH/2);
    ctx.rotate(s.rot*Math.PI/180);ctx.scale(s.zoom,s.zoom);
    ctx.drawImage(s.img,-fW/2,-fH/2,fW,fH);
    ctx.restore();
    ctx.strokeStyle='#38d9a9';ctx.lineWidth=2;ctx.strokeRect(s.sx,s.sy,s.sw,s.sh);
    const hs=6;ctx.fillStyle='#38d9a9';
    [[s.sx,s.sy],[s.sx+s.sw-hs,s.sy],[s.sx,s.sy+s.sh-hs],[s.sx+s.sw-hs,s.sy+s.sh-hs]].forEach(([x,y])=>ctx.fillRect(x,y,hs,hs));
    ctx.fillStyle='rgba(56,217,169,.9)';ctx.font='bold 10px monospace';
    ctx.fillText(`${Math.round(s.sw)}×${Math.round(s.sh)}`,s.sx+3,s.sy>13?s.sy-3:s.sy+s.sh+11);
    ctx.restore();
  }

  function fit(){
    s.canvas=g('Canvas');s.ctx=s.canvas.getContext('2d');s.wrap=g('CWrap');
    const cw=s.wrap.clientWidth,ch=s.wrap.clientHeight;
    s.canvas.width=cw;s.canvas.height=ch;s.canvas.style.display='block';
    render();
  }

  function c2i(cx,cy){
    const cw=s.canvas.width,ch=s.canvas.height;
    const rot90=(s.rot===90||s.rot===270);
    const dW=rot90?s.natH:s.natW,dH=rot90?s.natW:s.natH;
    const sc=Math.min(cw/dW,ch/dH);
    const fW=dW*sc,fH=dH*sc,fX=(cw-fW)/2,fY=(ch-fH)/2;
    return[(cx-fX-s.panX)/s.zoom*(s.natW/fW),(cy-fY-s.panY)/s.zoom*(s.natH/fH)];
  }

  function clamp(){
    const cw=s.canvas.width,ch=s.canvas.height;
    const rot90=(s.rot===90||s.rot===270);
    const dW=rot90?s.natH:s.natW,dH=rot90?s.natW:s.natH;
    const sc=Math.min(cw/dW,ch/dH);
    const fW=dW*sc*s.zoom,fH=dH*sc*s.zoom,fX=(cw-dW*sc)/2,fY=(ch-dH*sc)/2;
    s.panX=Math.min(Math.max(0,-fX),Math.max(Math.min(0,cw-fX-fW),s.panX));
    s.panY=Math.min(Math.max(0,-fY),Math.max(Math.min(0,ch-fY-fH),s.panY));
  }

  async function runOCR(src){
    showOvl(true);setTxt('OCR…');
    const w=await ensureWorker();
    try{
      const{data:{text}}=await w.recognize(src);
      showOvl(false);
      if(s.onOCR)s.onOCR(text.trim());
    }catch(e){showOvl(false);console.error(e);}
  }

  async function ocrSelection(){
    if(!s.hasSel||s.sw<6||s.sh<6)return;
    const[ix1,iy1]=c2i(s.sx,s.sy),[ix2,iy2]=c2i(s.sx+s.sw,s.sy+s.sh);
    const rx=Math.round(Math.max(0,ix1)),ry=Math.round(Math.max(0,iy1));
    const rw=Math.round(Math.min(s.natW-rx,ix2-ix1)),rh=Math.round(Math.min(s.natH-ry,iy2-iy1));
    if(rw<2||rh<2)return;
    const cr=document.createElement('canvas');cr.width=rw;cr.height=rh;
    const url=URL.createObjectURL(s.blob||new Blob());
    const img=new Image();
    img.onload=async()=>{
      cr.getContext('2d').drawImage(img,rx,ry,rw,rh,0,0,rw,rh);
      URL.revokeObjectURL(url);
      await runOCR(await new Promise(r=>cr.toBlob(r,'image/jpeg',.97)));
    };
    img.src=url;
  }

  function attachEvents(mode){
    const cv=g('Canvas');
    cv.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=cv.getBoundingClientRect();
      setZoom(s.zoom+(e.deltaY>0?-.2:.2),e.clientX-r.left,e.clientY-r.top);
    },{passive:false});

    if(mode==='select'||mode==='de'){
      cv.addEventListener('mousedown',e=>{
        e.preventDefault();
        const r=cv.getBoundingClientRect();
        s.ox=e.clientX-r.left;s.oy=e.clientY-r.top;
        s.drag=true;s.hasSel=false;s.sw=0;s.sh=0;render();
        const rb=g('RedrawBtn');if(rb)rb.classList.add('hidden');
        const ob=g('OcrSelBtn');if(ob)ob.classList.remove('ready');
      });
      window.addEventListener('mousemove',e=>{
        if(!s.drag)return;
        const r=cv.getBoundingClientRect();
        const cx=e.clientX-r.left,cy=e.clientY-r.top;
        s.sx=Math.min(s.ox,cx);s.sy=Math.min(s.oy,cy);
        s.sw=Math.abs(cx-s.ox);s.sh=Math.abs(cy-s.oy);render();
      });
      window.addEventListener('mouseup',async()=>{
        if(!s.drag)return;s.drag=false;
        if(s.sw>6&&s.sh>6){
          s.hasSel=true;render();
          const rb=g('RedrawBtn');if(rb)rb.classList.remove('hidden');
          const ob=g('OcrSelBtn');if(ob)ob.classList.add('ready');
          await ocrSelection();
        }else render();
      });
    } else {
      cv.addEventListener('mousedown',e=>{
        if(s.zoom<=1)return;
        s.isPan=true;s.pSX=e.clientX;s.pSY=e.clientY;s.pOX=s.panX;s.pOY=s.panY;
        cv.style.cursor='grabbing';
      });
      window.addEventListener('mousemove',e=>{
        if(!s.isPan)return;
        s.panX=s.pOX+(e.clientX-s.pSX);s.panY=s.pOY+(e.clientY-s.pSY);clamp();render();
      });
      window.addEventListener('mouseup',()=>{if(s.isPan){s.isPan=false;cv.style.cursor=s.zoom>1?'grab':'default';}});
    }
  }

  function setZoom(z,px,py){
    const cv=g('Canvas');if(!cv)return;
    const cw=cv.width,ch=cv.height;
    if(px===undefined){px=cw/2;py=ch/2;}
    const prev=s.zoom;s.zoom=Math.min(8,Math.max(1,z));
    s.panX=px-(px-s.panX)*(s.zoom/prev);s.panY=py-(py-s.panY)*(s.zoom/prev);
    clamp();render();
    const zp=g('ZPct');if(zp)zp.textContent=Math.round(s.zoom*100)+'%';
    const zs=g('ZSlider');if(zs)zs.value=s.zoom;
    if(cv)cv.style.cursor=s.zoom>1?'grab':'default';
  }

  async function loadImg(file){
    return new Promise(res=>{
      const url=URL.createObjectURL(file);
      const img=new Image();
      img.onload=()=>{s.img=img;s.natW=img.naturalWidth;s.natH=img.naturalHeight;s.blob=file;fit();URL.revokeObjectURL(url);res();};
      img.src=url;
    });
  }

  async function loadPDF(file){
    showOvl(true);setTxt('Loading PDF…');
    await loadPDFjs();
    const ab=await file.arrayBuffer();
    s.pdfDoc=await window.pdfjsLib.getDocument({data:ab}).promise;
    s.pdfTotal=s.pdfDoc.numPages;s.pdfPage=1;
    const pi=g('PdfInfo');if(pi)pi.textContent=`Page 1/${s.pdfTotal}`;
    const pb=g('PdfBar');if(pb)pb.style.display='flex';
    await renderPDF();
  }

  async function renderPDF(){
    showOvl(true);setTxt(`Page ${s.pdfPage}…`);
    const pg=await s.pdfDoc.getPage(s.pdfPage);
    const vp=pg.getViewport({scale:2.5});
    const oc=document.createElement('canvas');oc.width=vp.width;oc.height=vp.height;
    await pg.render({canvasContext:oc.getContext('2d'),viewport:vp}).promise;
    return new Promise(res=>{
      const img=new Image();
      img.onload=()=>{
        s.img=img;s.natW=img.naturalWidth;s.natH=img.naturalHeight;
        oc.toBlob(b=>{s.blob=b;},'image/jpeg',.95);
        fit();showOvl(false);res();
      };
      img.src=oc.toDataURL();
    });
  }

  async function loadVideo(file){
    showOvl(true);setTxt('Loading video…');
    s.videoEl=g('Video');
    const url=URL.createObjectURL(file);
    s.videoEl.src=url;
    s.videoEl.onloadedmetadata=()=>{s.vidDur=s.videoEl.duration;s.videoEl.currentTime=s.vidDur/2;};
    s.videoEl.onseeked=()=>{
      const sl=g('VidSlider');if(sl){sl.max=Math.floor(s.vidDur*10);sl.value=Math.floor(s.vidDur/2*10);}
      const vt=g('VidTime');if(vt)vt.textContent=s.videoEl.currentTime.toFixed(1)+'s';
      const vs=g('VidScrub');if(vs)vs.style.display='flex';
      captureFrame(false);showOvl(false);
    };
  }

  function captureFrame(doOCR=true){
    if(!s.videoEl)return;
    const vc=document.createElement('canvas');
    vc.width=s.videoEl.videoWidth;vc.height=s.videoEl.videoHeight;
    vc.getContext('2d').drawImage(s.videoEl,0,0);
    const img=new Image();
    img.onload=()=>{s.img=img;s.natW=img.naturalWidth;s.natH=img.naturalHeight;vc.toBlob(b=>{s.blob=b;},'image/jpeg',.95);fit();};
    img.src=vc.toDataURL('image/jpeg',.95);
    if(doOCR)vc.toBlob(async b=>await runOCR(b),'image/jpeg',.95);
  }

  async function buildRotBlob(){
    if(s.rot===0)return s.blob;
    const rot90=(s.rot===90||s.rot===270);
    const w=rot90?s.natH:s.natW,h=rot90?s.natW:s.natH;
    const rc=document.createElement('canvas');rc.width=w;rc.height=h;
    const ctx=rc.getContext('2d');
    ctx.translate(w/2,h/2);ctx.rotate(s.rot*Math.PI/180);ctx.drawImage(s.img,-s.natW/2,-s.natH/2);
    return new Promise(r=>rc.toBlob(r,'image/jpeg',.95));
  }

  function reset(){
    s.img=null;s.blob=null;s.zoom=1;s.panX=0;s.panY=0;s.rot=0;
    s.hasSel=false;s.sw=0;s.sh=0;s.pdfDoc=null;s.pdfPage=1;
    const zp=g('ZPct');if(zp)zp.textContent='100%';
    const zs=g('ZSlider');if(zs)zs.value=1;
    const pb=g('PdfBar');if(pb)pb.style.display='none';
    const vs=g('VidScrub');if(vs)vs.style.display='none';
  }

  return{
    s,loadImg,loadPDF,loadVideo,captureFrame,ocrSelection,
    attachEvents,render,fit,setZoom,buildRotBlob,reset,
    rotate(d){s.rot=(s.rot+d+360)%360;s.hasSel=false;s.sw=0;s.sh=0;s.zoom=1;s.panX=0;s.panY=0;render();const zp=g('ZPct');if(zp)zp.textContent='100%';const zs=g('ZSlider');if(zs)zs.value=1;},
    zoomBy(d){setZoom(s.zoom+d);},
    resetZoom(){s.zoom=1;s.panX=0;s.panY=0;render();const zp=g('ZPct');if(zp)zp.textContent='100%';const zs=g('ZSlider');if(zs)zs.value=1;},
    resetSel(){s.hasSel=false;s.sw=0;s.sh=0;render();const rb=g('RedrawBtn');if(rb)rb.classList.add('hidden');const ob=g('OcrSelBtn');if(ob)ob.classList.remove('ready');},
    changePdfPage:async(d)=>{const np=s.pdfPage+d;if(np<1||np>s.pdfTotal)return;s.pdfPage=np;s.zoom=1;s.panX=0;s.panY=0;s.hasSel=false;s.sw=0;s.sh=0;const pi=g('PdfInfo');if(pi)pi.textContent=`Page ${np}/${s.pdfTotal}`;await renderPDF();},
    scrubVideo(v){if(!s.videoEl)return;s.videoEl.currentTime=v/10;const vt=g('VidTime');if(vt)vt.textContent=(v/10).toFixed(1)+'s';s.videoEl.onseeked=()=>captureFrame(false);}
  };
}

const v1=makeViewer('t1'), v2=makeViewer('t2');

