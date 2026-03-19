// ============================================================
// DocuOps v3.0.0 — Theme & Settings
// Theme system, settings panel, openSettings/closeSettings
// ============================================================

// ════════════════════════════════════════════════════
// THEME
// ════════════════════════════════════════════════════
function setTheme(t){
  localStorage.setItem('ocrTheme',t);
  const root=document.documentElement;
  if(t==='light')root.setAttribute('data-theme','light');
  else if(t==='dark')root.removeAttribute('data-theme');
  else{
    const sys=window.matchMedia('(prefers-color-scheme: light)').matches;
    if(sys)root.setAttribute('data-theme','light');
    else root.removeAttribute('data-theme');
  }
  ['Light','Dark','System'].forEach(n=>{
    document.getElementById('theme'+n).classList.toggle('active',n.toLowerCase()===t);
  });
}
function initTheme(){
  const t=localStorage.getItem('ocrTheme')||'dark';
  setTheme(t);
}
function openSettings(){
  document.getElementById('settingsOverlay').style.display='block';
  document.getElementById('settingsPanel').classList.add('open');
  // v2.2: render profile manager each time settings opens
  if(typeof renderProfileManager==='function') setTimeout(renderProfileManager, 50);
}
function closeSettings(){
  document.getElementById('settingsOverlay').style.display='none';
  document.getElementById('settingsPanel').classList.remove('open');
}
initTheme();

