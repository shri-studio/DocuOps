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

  // Update version in footer
  const v = typeof DOCUOPS_VERSION !== 'undefined' ? DOCUOPS_VERSION : '?';
  const sf = document.getElementById('settingsFooter');
  if(sf) sf.textContent = `DocuOps v${v} · All processing local · No data uploaded`;

  // Populate account section — retry until _sb ready
  (function tryLoadAccount(attempts){
    const sb = window._sb;
    if(!sb){ if(attempts>0) setTimeout(()=>tryLoadAccount(attempts-1),400); return; }
    sb.auth.getSession().then(({data:{session}})=>{
      if(!session) return;
      const user = session.user;
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
      const email = user.email || '';
      const initial = name.charAt(0).toUpperCase();
      const avatar = document.getElementById('settingsAvatar');
      const uName = document.getElementById('settingsUserName');
      const uEmail = document.getElementById('settingsUserEmail');
      if(avatar){ avatar.textContent = initial; }
      if(uName) uName.textContent = name;
      if(uEmail) uEmail.textContent = email;
    }).catch(()=>{});
  })(10);

  // Render document layouts
  if(typeof renderProfileManager==='function') setTimeout(renderProfileManager, 50);
}
function closeSettings(){
  document.getElementById('settingsOverlay').style.display='none';
  document.getElementById('settingsPanel').classList.remove('open');
}
initTheme();

