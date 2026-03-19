// ============================================================
// DocuOps v3.0.0 — Defensive UX & Confirmations
// Session protection, confirmations, image loading controls
// ============================================================

// ════════════════════════════════════════════════════
// v2.2.2 — DEFENSIVE UX & CONFIRMATIONS
// ════════════════════════════════════════════════════

// ── 1. BROWSER CLOSE/REFRESH PROTECTION ─────────────
let _sessionActive = false;
window.addEventListener('beforeunload', e => {
  if (_sessionActive) {
    e.preventDefault();
    e.returnValue = 'You have unsaved work. Are you sure you want to leave?';
    return e.returnValue;
  }
});

// Activate session protection when work starts
function _setSessionActive(v) { _sessionActive = v; }

// ── 2. PATCH t1Start to activate session ─────────────
const _orig_t1Start = t1Start;
async function t1Start(files) {
  _setSessionActive(true);
  await _orig_t1Start(files);
}

// Deactivate when done
const _orig_t1ShowDone = t1ShowDone;
function t1ShowDone() {
  _setSessionActive(false);
  _orig_t1ShowDone();
}

// ── 3. PATCH showHome to protect both tools ───────────
function showHome() {
  // Already on home — do nothing silently
  if (document.getElementById('homePage').style.display !== 'none') return;

  // Only confirm if user has actually started working
  if (_sessionActive) {
    const t1Active = document.getElementById('t1Work').style.display !== 'none';
    const t2Active = document.getElementById('t2Work').style.display !== 'none';
    const t2BuilderActive = document.getElementById('t2Builder').style.display !== 'none';

    if (t1Active) {
      if (!confirm(`⚠️ Go back to Home?\n\nTool 1 session in progress:\n✔ Renamed: ${t1Renamed}  ⏭ Skipped: ${t1Skipped}  📄 Remaining: ${t1Files.length - t1Idx}\n\nFiles already saved are safe.\nUnsaved progress will be lost.`)) return;
    } else if (t2Active) {
      if (!confirm(`⚠️ Go back to Home?\n\nData Entry session in progress:\n✔ Saved entries: ${t2Entries.length}\n\nExport your data first if needed.\nUnsaved form data will be lost.`)) return;
    } else if (t2BuilderActive) {
      if (!confirm('⚠️ Go back to Home?\n\nYour template builder has unsaved changes.\nMake sure to Save Template before leaving.')) return;
    }
  }

  _setSessionActive(false);

  // Reset all panels
  ['tool1','tool2','tool3'].forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('homePage').style.display = 'flex';
  document.getElementById('toolBadge').style.display = 'none';
  document.getElementById('modeBadge').style.display = 'none';
  document.getElementById('statsBar').style.display = 'none';
  document.getElementById('progressWrap').style.display = 'none';
}

// ── 4. T1 — DROP NEW FILES ON ACTIVE SESSION ─────────
const _orig_t1da_drop = null; // handled by patching the event listener below
document.getElementById('t1DropArea').addEventListener('dragover', e => e.preventDefault());
document.getElementById('t1DropArea').addEventListener('drop', e => {
  e.preventDefault();
  if (document.getElementById('t1Work').style.display !== 'none') {
    if (!confirm('⚠️ A rename session is already active.\n\nLoading new files will reset the current session.\n\nContinue?')) return;
  }
  const f = Array.from(e.dataTransfer.files).filter(f => ACCEPT.test(f.name));
  if (f.length) t1Start(f);
});

// ── 5. T2 — CLEAR FORM CONFIRMATION ──────────────────
const _orig_t2ClearForm = t2ClearForm;
function t2ClearForm() {
  // Check if any field has data
  const hasData = t2Fields.some(f => {
    const el = document.getElementById('dei_' + f.id);
    if (!el) return false;
    return el.tagName === 'SELECT' ? el.selectedIndex > 0 : el.value !== '';
  });
  if (hasData && !confirm('↺ Clear all form fields?\n\nAll unsaved data in the current form will be lost.')) return;
  _orig_t2ClearForm();
}

// ── 6. T2 — SWITCHING IMAGE WITH UNSAVED FORM DATA ───
const _orig_t2LoadInViewer = t2LoadInViewer;
async function t2LoadInViewer(i) {
  if (i === t2ActiveFile) { await _orig_t2LoadInViewer(i); return; }
  const hasData = t2Fields.some(f => {
    const el = document.getElementById('dei_' + f.id);
    if (!el) return false;
    return el.tagName === 'SELECT' ? el.selectedIndex > 0 : el.value !== '';
  });
  if (hasData) {
    if (!confirm('Switch to a different document?\n\nYou have unsaved data in the current form.\nClick "Save Entry" first to keep it, or switch anyway to discard.')) return;
  }
  await _orig_t2LoadInViewer(i);
}

// ── 7. T2 — EXPORT WITH PARTIALLY FILLED FORM ────────
const _orig_t2Finish = t2Finish;
function t2Finish() {
  const hasData = t2Fields.some(f => {
    const el = document.getElementById('dei_' + f.id);
    if (!el) return false;
    return el.tagName === 'SELECT' ? el.selectedIndex > 0 : el.value !== '';
  });
  if (hasData && !confirm('⬇ Export now?\n\nYou have unsaved data in the current form that has NOT been saved as an entry.\n\nClick "Save Entry" first to include it, or export now without it.')) return;
  _orig_t2Finish();
}

// ── 8. T2 — LOAD NEW TEMPLATE OVER EXISTING ──────────
const _orig_t2TmplIn_change = null;
document.getElementById('t2TmplIn').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  if (t2Fields.length > 0) {
    if (!confirm(`📋 Load new Excel template?\n\nThis will replace your current ${t2Fields.length} field(s).\n\nSave your current template first if needed.`)) {
      e.target.value = ''; return;
    }
  }
  t2TemplateFile = file;
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const headers = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({r: range.s.r, c: col})];
    if (cell && cell.v) headers.push(String(cell.v));
  }
  t2Fields = headers.map((h, i) => ({id:'f'+i, name:h, type:'text', options:'', formula:'', required:false, subFields:[], customCode:false}));
  assignCodes(t2Fields);
  t2ShowBuilder();
}, true); // use capture to override original listener

// ── 9. T2 — BACK TO SETUP FROM BUILDER ───────────────
function t2BackToSetup() {
  if (t2Fields.length > 0) {
    if (!confirm('↩ Back to Setup?\n\nYour current field configuration will be kept but unsaved changes to field names/types may be lost.\n\nTemplate is auto-saved to browser.')) return;
  }
  t2AutoSave();
  t2ShowSetup();
}

// ── 10. T2 — DELETE FIELD WITH SAVED ENTRIES ─────────
const _orig_t2DelField = t2DelField;
function t2DelField(i) {
  const f = t2Fields[i];
  if (t2Entries.length > 0) {
    if (!confirm(`Delete field "${f.name}" [${f.code}]?\n\n⚠️ You have ${t2Entries.length} saved entries that reference this field.\nDeleting it won't remove data from already-saved entries, but future exports may have missing columns.`)) return;
  }
  _orig_t2DelField(i);
}

// ── 11. T2 — CHANGE FIELD TYPE WITH SAVED ENTRIES ────
const _orig_t2FieldSet = t2FieldSet;
function t2FieldSet(i, k, v) {
  if (k === 'type' && t2Entries.length > 0 && t2Fields[i].type !== v) {
    if (!confirm(`Change "${t2Fields[i].name}" from ${t2Fields[i].type} to ${v}?\n\n⚠️ You have ${t2Entries.length} saved entries. Changing field type may affect data consistency.`)) return;
  }
  _orig_t2FieldSet(i, k, v);
}

// ── 12. T2 — LOAD JSON TEMPLATE OVER EXISTING ────────
const _orig_t2LoadTemplateFile = t2LoadTemplateFile;
function t2LoadTemplateFile() {
  if (t2Fields.length > 0) {
    if (!confirm(`📂 Load template from JSON?\n\nThis will replace your current ${t2Fields.length} field(s).\n\nContinue?`)) return;
  }
  _orig_t2LoadTemplateFile();
}

// ── 13. T2 — NEW DATA FOLDER WHEN ONE EXISTS ─────────
const _orig_FSM_pickDataFolder = FSM.pickDataFolder.bind(FSM);
FSM.pickDataFolder = async function() {
  if (FSM.root) {
    if (!confirm(`📁 Change data folder?\n\nCurrently using: ${FSM.root.name}\n\nPicking a new folder will switch all saves to the new location. Existing data in the old folder stays there.`)) return false;
  }
  return _orig_FSM_pickDataFolder();
};

// ── 14. T2 — IMAGE LOADING CONTROL BAR ───────────────
// Replace auto-prompt with explicit load bar in t2StripWrap
function t2SetupStripControls() {
  const wrap = document.getElementById('t2StripWrap');
  if (!wrap || wrap.querySelector('.strip-controls')) return;

  // Insert controls bar above strip
  const bar = document.createElement('div');
  bar.className = 'strip-controls';
  bar.style.cssText = 'display:flex;align-items:center;gap:7px;padding:5px 10px;border-bottom:1px solid var(--border);flex-shrink:0;';
  bar.innerHTML = `
    <button onclick="t2LoadDocuments(false)" style="background:var(--accent);color:#fff;border:none;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans);">📂 Load Documents</button>
    <button onclick="t2LoadDocuments(true)" style="background:none;border:1px solid var(--border);color:var(--muted);padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-family:var(--sans);">+ Add More</button>
    <button onclick="t2ClearStrip()" style="background:none;border:1px solid var(--border);color:var(--danger);padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-family:var(--sans);">🗑 Clear All</button>
    <span id="stripCount" style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-left:auto;"></span>
  `;
  wrap.insertBefore(bar, wrap.firstChild);
  wrap.style.height = '120px';
}

function t2LoadDocuments(addMore) {
  if (!addMore && t2Files.length > 0) {
    if (!confirm(`Load new documents?\n\nThis will replace the current ${t2Files.length} document(s) in the strip.\n\nUse "Add More" to keep existing and add new files.`)) return;
  }
  const inp = document.createElement('input');
  inp.type = 'file'; inp.multiple = true;
  inp.accept = '.jpg,.jpeg,.png,.webp,.bmp,.gif,.pdf,.mp4';
  inp.onchange = async e => {
    const files = Array.from(e.target.files).filter(f => ACCEPT.test(f.name));
    if (!files.length) return;
    if (addMore) {
      t2Files = [...t2Files, ...files];
    } else {
      t2Files = files;
      t2ActiveFile = 0;
    }
    await t2BuildStrip();
    await t2LoadInViewer(addMore ? t2ActiveFile : 0);
    t2UpdateStripCount();
    _setSessionActive(true);
  };
  inp.click();
}

function t2ClearStrip() {
  if (t2Files.length === 0) return;
  if (!confirm(`🗑 Clear all ${t2Files.length} document(s) from the strip?\n\nSaved entries are NOT affected — only the image strip is cleared.`)) return;
  t2Files = [];
  t2ActiveFile = 0;
  document.getElementById('t2Strip').innerHTML = '';
  t2UpdateStripCount();
  // Clear viewer
  v2.reset();
  document.getElementById('t2FName').textContent = '—';
}

function t2UpdateStripCount() {
  const el = document.getElementById('stripCount');
  if (!el) return;
  const done = document.querySelectorAll('.s-thumb.done').length;
  el.textContent = t2Files.length > 0 ? `${done}/${t2Files.length} done` : 'No documents loaded';
}

// ── 15. T2 — EDIT TEMPLATE FROM WORK AREA ────────────
function t2EditTemplate() {
  const msg = t2Entries.length > 0
    ? `✏️ Edit Template?\n\nYou have ${t2Entries.length} saved entries.\n\nChanging field structure may affect future exports.\nYour saved entries are safe.\n\nContinue?`
    : '✏️ Edit Template?\n\nReturn to the Form Builder to modify fields.';
  if (!confirm(msg)) return;
  t2ShowBuilder();
}

// ── 16. PATCH t2StartEntry to use strip controls ──────
const _orig_t2StartEntry = t2StartEntry;
async function t2StartEntry() {
  if (t2Fields.length === 0) { alert('Add at least one field.'); return; }
  ['t2Setup','t2Builder','t2Work','t2Done'].forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('t2Work').style.display = 'flex';
  document.getElementById('t2StripWrap').style.display = 'block';
  t2AutoSave();
  t2RenderForm();
  t2SetupStripControls();
  t2UpdateStripCount();
  _setSessionActive(true);

  v2.s.onOCR = (text) => {
    if (!t2ActiveFieldId) return;
    t2FillField(t2ActiveFieldId, text.trim());
  };
  v2.attachEvents('de');
  // No auto-prompt — user clicks "Load Documents" when ready
}

// ── 17. UPDATE VERSION EVERYWHERE ────────────────────
(function updateVersion() {
  const ver = 'v2.2.4';
  const footer = document.querySelector('.settings-footer');
  if (footer) footer.textContent = `OCR Suite ${ver} · All processing local · No data uploaded`;
  const homeFooter = document.querySelector('.home-footer');
  if (homeFooter) homeFooter.textContent = `All tools run locally · No data uploaded anywhere · DocuOps ${ver}`;
})();

// ── 18. ADD "EDIT TEMPLATE" + "BACK" BUTTONS TO T2 WORK HEADER ──
(function addT2WorkButtons() {
  const actionsBar = document.querySelector('.t2w-actions');
  if (!actionsBar || actionsBar.querySelector('.edit-tmpl-btn')) return;
  const editBtn = document.createElement('button');
  editBtn.className = 'btn edit-tmpl-btn';
  editBtn.style.cssText = 'flex:0.6;background:var(--surface2);border:1px solid var(--border);font-size:11px;color:var(--muted);';
  editBtn.textContent = '✏️ Edit Template';
  editBtn.onclick = t2EditTemplate;
  actionsBar.appendChild(editBtn);
})();

// Add "Back to Setup" button in builder header
(function addBuilderBackBtn() {
  const bh = document.querySelector('.builder-hdr');
  if (!bh || bh.querySelector('.back-setup-btn')) return;
  const backBtn = document.createElement('button');
  backBtn.className = 'btn back-setup-btn';
  backBtn.style.cssText = 'padding:6px 12px;font-size:11px;background:none;border:1px solid var(--border);color:var(--muted);';
  backBtn.textContent = '↩ Setup';
  backBtn.onclick = t2BackToSetup;
  bh.insertBefore(backBtn, bh.querySelector('.builder-actions'));
})();



