// ============================================================
// DocuOps v3.0.0 — Learning & Profile Engine
// FSM, profile keys, learning engine, suggestion engine, profile manager
// ============================================================

// ════════════════════════════════════════════════════
// v2.2 — FSM (FILE SYSTEM MANAGER)
// ════════════════════════════════════════════════════
const FSM = {
  root: null,
  STORE_KEY: 'ocrSuite_dataFolder',

  async init() {
    // Try to restore previously picked folder
    try {
      const stored = localStorage.getItem(this.STORE_KEY);
      if (stored) {
        // Can't restore FileSystemDirectoryHandle from localStorage directly
        // User must re-pick on each session (browser security requirement)
        // But we show them the name so they know which to pick
        const name = localStorage.getItem(this.STORE_KEY + '_name');
        if (name) this._showDataFolderName(name);
      }
    } catch(e) {}
  },

  async pickDataFolder() {
    if (!('showDirectoryPicker' in window)) {
      alert('File System Access requires Chrome or Edge.\nProfiles will be saved to browser storage instead.');
      return false;
    }
    try {
      this.root = await window.showDirectoryPicker({ mode: 'readwrite' });
      localStorage.setItem(this.STORE_KEY + '_name', this.root.name);
      this._showDataFolderName(this.root.name);
      // Create subdirectories
      await this._ensureDir('profiles');
      await this._ensureDir('templates');
      await this._ensureDir('entries');
      return true;
    } catch(e) {
      if (e.name !== 'AbortError') console.error(e);
      return false;
    }
  },

  async _ensureDir(name) {
    if (!this.root) return null;
    try {
      return await this.root.getDirectoryHandle(name, { create: true });
    } catch(e) { return null; }
  },

  async writeJSON(subfolder, filename, data) {
    if (!this.root) {
      // Fallback: localStorage
      try {
        localStorage.setItem(`ocr_${subfolder}_${filename}`, JSON.stringify(data));
        return true;
      } catch(e) { return false; }
    }
    try {
      const dir = await this.root.getDirectoryHandle(subfolder, { create: true });
      const fh = await dir.getFileHandle(filename + '.json', { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(data, null, 2));
      await w.close();
      return true;
    } catch(e) { console.error('FSM write:', e); return false; }
  },

  async readJSON(subfolder, filename) {
    if (!this.root) {
      // Fallback: localStorage
      const raw = localStorage.getItem(`ocr_${subfolder}_${filename}`);
      return raw ? JSON.parse(raw) : null;
    }
    try {
      const dir = await this.root.getDirectoryHandle(subfolder);
      const fh = await dir.getFileHandle(filename + '.json');
      const file = await fh.getFile();
      return JSON.parse(await file.text());
    } catch(e) { return null; }
  },

  async listFiles(subfolder) {
    const names = [];
    if (!this.root) {
      // Fallback: scan localStorage
      const prefix = `ocr_${subfolder}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) names.push(k.slice(prefix.length));
      }
      return names;
    }
    try {
      const dir = await this.root.getDirectoryHandle(subfolder);
      for await (const entry of dir.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          names.push(entry.name.replace('.json', ''));
        }
      }
    } catch(e) {}
    return names;
  },

  async deleteFile(subfolder, filename) {
    if (!this.root) {
      localStorage.removeItem(`ocr_${subfolder}_${filename}`);
      return;
    }
    try {
      const dir = await this.root.getDirectoryHandle(subfolder);
      await dir.removeEntry(filename + '.json');
    } catch(e) {}
  },

  _showDataFolderName(name) {
    const el = document.getElementById('fsmFolderName');
    if (el) { el.textContent = '📁 Data: ' + name; el.style.display = 'inline'; }
  }
};

// Init FSM on load
FSM.init();

// ════════════════════════════════════════════════════
// v2.2 — PROFILE KEY SYSTEM
// ════════════════════════════════════════════════════
// Profile key is a field marked as isProfileKey:true in t2Fields
// Multiple keys combine: "Al Maha Trading||Tax Invoice"

function t2GetProfileId() {
  const keyFields = t2Fields.filter(f => f.isProfileKey);
  if (!keyFields.length) return null;
  const parts = keyFields.map(f => {
    const val = t2GetFieldVal(f.id) || '';
    return val.trim();
  }).filter(Boolean);
  if (!parts.length) return null;
  return parts.join('||');
}

function t2GetProfileLabel() {
  const keyFields = t2Fields.filter(f => f.isProfileKey);
  const parts = keyFields.map(f => t2GetFieldVal(f.id) || '').filter(Boolean);
  return parts.join(' / ') || null;
}

// ════════════════════════════════════════════════════
// v2.2 — LEARNING ENGINE
// ════════════════════════════════════════════════════
const PROFILES_KEY = 'ocrSuite_profiles';

function loadAllProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}');
  } catch(e) { return {}; }
}

function saveAllProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  // Also write to FSM if available
  FSM.writeJSON('profiles', 'all_profiles', profiles);
}

function learnFromEntry(profileId, fieldId, canvasSel, viewer) {
  if (!profileId || !fieldId || !canvasSel) return;
  if (canvasSel.sw < 6 || canvasSel.sh < 6) return;

  // Convert canvas selection to % of image (resolution-independent)
  const cw = viewer.s.canvas?.width || 1;
  const ch = viewer.s.canvas?.height || 1;
  const rot90 = (viewer.s.rot === 90 || viewer.s.rot === 270);
  const dW = rot90 ? viewer.s.natH : viewer.s.natW;
  const dH = rot90 ? viewer.s.natW : viewer.s.natH;
  const sc = Math.min(cw / dW, ch / dH);
  const fitW = dW * sc, fitH = dH * sc;
  const fitX = (cw - fitW) / 2, fitY = (ch - fitH) / 2;

  // Normalize to 0-1 range relative to image
  const nx = (canvasSel.sx - fitX - viewer.s.panX) / (fitW * viewer.s.zoom);
  const ny = (canvasSel.sy - fitY - viewer.s.panY) / (fitH * viewer.s.zoom);
  const nw = canvasSel.sw / (fitW * viewer.s.zoom);
  const nh = canvasSel.sh / (fitH * viewer.s.zoom);

  const profiles = loadAllProfiles();
  if (!profiles[profileId]) {
    profiles[profileId] = {
      id: profileId,
      label: t2GetProfileLabel() || profileId,
      fields: {},
      totalEntries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  const prof = profiles[profileId];
  if (!prof.fields[fieldId]) {
    prof.fields[fieldId] = { selections: [], avgX: 0, avgY: 0, avgW: 0, avgH: 0, confidence: 0, timesUsed: 0 };
  }

  const fd = prof.fields[fieldId];
  fd.selections.push({ x: nx, y: ny, w: nw, h: nh });

  // Keep last 20 selections for averaging
  if (fd.selections.length > 20) fd.selections.shift();

  // Calculate averages
  fd.avgX = fd.selections.reduce((s, r) => s + r.x, 0) / fd.selections.length;
  fd.avgY = fd.selections.reduce((s, r) => s + r.y, 0) / fd.selections.length;
  fd.avgW = fd.selections.reduce((s, r) => s + r.w, 0) / fd.selections.length;
  fd.avgH = fd.selections.reduce((s, r) => s + r.h, 0) / fd.selections.length;
  fd.timesUsed++;

  // Confidence: how consistent are the selections? (variance-based)
  if (fd.selections.length >= 2) {
    const varX = fd.selections.reduce((s, r) => s + Math.pow(r.x - fd.avgX, 2), 0) / fd.selections.length;
    const varY = fd.selections.reduce((s, r) => s + Math.pow(r.y - fd.avgY, 2), 0) / fd.selections.length;
    const totalVar = Math.sqrt(varX + varY);
    fd.confidence = Math.max(0, Math.min(1, 1 - totalVar * 10));
  } else {
    fd.confidence = 0.5; // 1 sample = 50% confidence
  }

  prof.totalEntries++;
  prof.updatedAt = new Date().toISOString();
  saveAllProfiles(profiles);
}

// Record learning when entry is saved in T2
const _origT2SaveEntry = t2SaveEntry;
async function t2SaveEntry() {
  // Record coordinates for all filled fields before saving
  const profileId = t2GetProfileId();
  if (profileId && v2.s.hasSel) {
    // Record the last selection for the active field
    if (t2ActiveFieldId && !t2ActiveFieldId.startsWith('rei_')) {
      learnFromEntry(profileId, t2ActiveFieldId, {
        sx: v2.s.sx, sy: v2.s.sy, sw: v2.s.sw, sh: v2.s.sh
      }, v2);
    }
  }
  await _origT2SaveEntry();
}

// ════════════════════════════════════════════════════
// v2.2 — SUGGESTION ENGINE
// ════════════════════════════════════════════════════
let t2CurrentSuggestions = {}; // fieldId -> {x,y,w,h,confidence}
let t2SuggestionMode = false;

function t2CheckForSuggestions() {
  const profileId = t2GetProfileId();
  if (!profileId) { t2ClearSuggestions(); return; }

  const profiles = loadAllProfiles();
  const prof = profiles[profileId];
  if (!prof) { t2ClearSuggestions(); return; }

  t2CurrentSuggestions = {};
  let hasSuggestions = false;

  t2Fields.forEach(f => {
    if (f.type === 'formula' || f.type === 'repeat') return;
    const fd = prof.fields[f.id];
    if (fd && fd.timesUsed >= 1) {
      t2CurrentSuggestions[f.id] = {
        x: fd.avgX, y: fd.avgY, w: fd.avgW, h: fd.avgH,
        confidence: fd.confidence, timesUsed: fd.timesUsed
      };
      hasSuggestions = true;
    }
  });

  if (hasSuggestions) {
    t2SuggestionMode = true;
    t2DrawSuggestions();
    t2ShowSuggestionBanner(profileId, prof.label);
  }
}

function t2DrawSuggestions() {
  if (!v2.s.canvas || !v2.s.img) return;
  const canvas = v2.s.canvas;
  const ctx = v2.s.ctx;
  const cw = canvas.width, ch = canvas.height;

  // Re-render base image first
  v2.render();

  // Draw suggestion boxes on top
  Object.entries(t2CurrentSuggestions).forEach(([fieldId, sug]) => {
    const f = t2Fields.find(f => f.id === fieldId);
    if (!f) return;

    // Convert normalized coords back to canvas coords
    const rot90 = (v2.s.rot === 90 || v2.s.rot === 270);
    const dW = rot90 ? v2.s.natH : v2.s.natW;
    const dH = rot90 ? v2.s.natW : v2.s.natH;
    const sc = Math.min(cw / dW, ch / dH);
    const fitW = dW * sc, fitH = dH * sc;
    const fitX = (cw - fitW) / 2, fitY = (ch - fitH) / 2;

    const sx = fitX + v2.s.panX + sug.x * fitW * v2.s.zoom;
    const sy = fitY + v2.s.panY + sug.y * fitH * v2.s.zoom;
    const sw = sug.w * fitW * v2.s.zoom;
    const sh = sug.h * fitH * v2.s.zoom;

    // Color by confidence
    let color, bg;
    if (sug.confidence >= 0.85) { color = '#38d9a9'; bg = 'rgba(56,217,169,0.08)'; }
    else if (sug.confidence >= 0.60) { color = '#f7a94f'; bg = 'rgba(247,169,79,0.08)'; }
    else { color = '#f76f6f'; bg = 'rgba(247,107,111,0.08)'; }

    // Draw suggestion box
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);

    // Field label + confidence
    const col = codeColor(f.code || 'A');
    ctx.fillStyle = col;
    ctx.font = 'bold 10px monospace';
    const pct = Math.round(sug.confidence * 100) + '%';
    const label = `[${f.code}] ${pct}`;
    const lw = ctx.measureText(label).width + 8;
    ctx.fillStyle = col;
    ctx.fillRect(sx, sy - 16, lw, 14);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, sx + 4, sy - 5);

    // Store canvas coords for click detection
    sug._canvasSx = sx; sug._canvasSy = sy; sug._canvasSw = sw; sug._canvasSh = sh;
    ctx.restore();
  });
}

function t2ShowSuggestionBanner(profileId, label) {
  const hint = document.getElementById('t2Hint');
  const count = Object.keys(t2CurrentSuggestions).length;
  const highConf = Object.values(t2CurrentSuggestions).filter(s => s.confidence >= 0.85).length;
  hint.innerHTML = `🧠 <b>Profile recognized:</b> ${label || profileId} · ${count} suggestions · <span style="color:var(--accent2)">${highConf} high confidence</span> · <button onclick="t2AcceptAllSuggestions()" style="background:var(--accent2);color:#0f1117;border:none;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;font-weight:700;">✓ Accept All</button>`;
}

function t2ClearSuggestions() {
  t2CurrentSuggestions = {};
  t2SuggestionMode = false;
  if (v2.s.img) v2.render();
}

async function t2AcceptAllSuggestions() {
  if (!Object.keys(t2CurrentSuggestions).length) return;

  for (const [fieldId, sug] of Object.entries(t2CurrentSuggestions)) {
    const f = t2Fields.find(f => f.id === fieldId);
    if (!f || f.type === 'formula') continue;

    // Set selection in viewer
    v2.s.sx = sug._canvasSx || 0;
    v2.s.sy = sug._canvasSy || 0;
    v2.s.sw = sug._canvasSw || 0;
    v2.s.sh = sug._canvasSh || 0;
    v2.s.hasSel = true;
    t2ActiveFieldId = fieldId;

    // OCR that region
    await v2.ocrSelection();
    // Small delay between fields
    await new Promise(r => setTimeout(r, 300));
  }

  document.getElementById('t2Hint').textContent = '✅ All suggested fields OCR\'d — review and save entry';
}

// Hook into t2LoadInViewer to check for suggestions after image loads
const _origT2LoadInViewer = t2LoadInViewer;
async function t2LoadInViewer(i) {
  await _origT2LoadInViewer(i);
  // After image loads, check for profile suggestions
  setTimeout(() => {
    const profileId = t2GetProfileId();
    if (profileId) t2CheckForSuggestions();
  }, 500);
}

// Also check when a profile key field is filled
const _origT2FillField = t2FillField;
function t2FillField(id, text) {
  _origT2FillField(id, text);
  // Check if a profile key was just filled
  const f = t2Fields.find(f => f.id === id);
  if (f && f.isProfileKey) {
    setTimeout(t2CheckForSuggestions, 100);
  }
}

// ════════════════════════════════════════════════════
// v2.2 — PROFILE KEY TOGGLE IN BUILDER
// ════════════════════════════════════════════════════
// Patch t2RenderBuilder to add profile key star toggle
// ════════════════════════════════════════════════════
// v2.2 — PROFILE KEY TOGGLE IN BUILDER
// ════════════════════════════════════════════════════
// Patch t2RenderBuilder to add profile key star toggle
const _origT2RenderBuilder = t2RenderBuilder;

// ════════════════════════════════════════════════════
// v2.2 — PROFILE MANAGER (in Settings panel)
// ════════════════════════════════════════════════════
function renderProfileManager() {
  const container = document.getElementById('profileManagerContent');
  if (!container) return;
  const profiles = loadAllProfiles();
  const keys = Object.keys(profiles);

  if (!keys.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--muted);">No document layouts learned yet. Use the Data Entry tool to start building layouts automatically.</div>';
    return;
  }

  container.innerHTML = '';
  keys.forEach(id => {
    const p = profiles[id];
    const fieldCount = Object.keys(p.fields || {}).length;
    const avgConf = fieldCount ? Math.round(Object.values(p.fields).reduce((s, f) => s + f.confidence, 0) / fieldCount * 100) : 0;

    const row = document.createElement('div');
    row.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;';
    row.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div style="font-size:11px;font-weight:700;color:var(--text);">${p.label || id}</div>
        <div style="display:flex;gap:5px;">
          <button onclick="exportProfile('${id}')" style="background:none;border:1px solid var(--border);color:var(--muted);font-size:11px;padding:2px 7px;border-radius:4px;cursor:pointer;">Export</button>
          <button onclick="resetProfile('${id}')" style="background:none;border:1px solid var(--border);color:var(--warn);font-size:11px;padding:2px 7px;border-radius:4px;cursor:pointer;">Reset</button>
          <button onclick="deleteProfile('${id}')" style="background:none;border:1px solid var(--danger);color:var(--danger);font-size:11px;padding:2px 7px;border-radius:4px;cursor:pointer;">Delete</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);font-family:var(--mono);">
        ${p.totalEntries} entries · ${fieldCount} fields learned · avg ${avgConf}% confidence
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">
        ${Object.entries(p.fields || {}).map(([fid, fd]) => {
          const f = t2Fields.find(f => f.id === fid);
          const fname = f ? f.name : fid;
          const col = fd.confidence >= 0.85 ? 'var(--accent2)' : fd.confidence >= 0.6 ? 'var(--warn)' : 'var(--danger)';
          return `<span style="font-size:11px;background:var(--surface);border:1px solid ${col};color:${col};padding:1px 6px;border-radius:99px;font-family:var(--mono);">${fname} ${Math.round(fd.confidence*100)}%</span>`;
        }).join('')}
      </div>
    `;
    container.appendChild(row);
  });

  // Import button
  const imp = document.createElement('button');
  imp.className = 'tmpl-btn';
  imp.style.cssText = 'width:100%;margin-top:4px;';
  imp.textContent = '📥 Import Profile JSON';
  imp.onclick = importProfile;
  container.appendChild(imp);
}

function exportProfile(id) {
  const profiles = loadAllProfiles();
  if (!profiles[id]) return;
  const blob = new Blob([JSON.stringify({ [id]: profiles[id] }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `profile_${id.replace(/[^a-z0-9]/gi, '_')}.json`; a.click();
}

function resetProfile(id) {
  if (!confirm(`Reset all learned data for:\n"${id}"?\n\nThis cannot be undone.`)) return;
  const profiles = loadAllProfiles();
  if (profiles[id]) {
    profiles[id].fields = {};
    profiles[id].totalEntries = 0;
    saveAllProfiles(profiles);
    renderProfileManager();
  }
}

function deleteProfile(id) {
  if (!confirm(`Delete profile:\n"${id}"?\n\nThis cannot be undone.`)) return;
  const profiles = loadAllProfiles();
  delete profiles[id];
  saveAllProfiles(profiles);
  renderProfileManager();
}

function importProfile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
  inp.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const profiles = loadAllProfiles();
      Object.assign(profiles, data);
      saveAllProfiles(profiles);
      renderProfileManager();
      alert('Profile imported successfully!');
    } catch(ex) { alert('Error: ' + ex.message); }
  };
  inp.click();
}

// ════════════════════════════════════════════════════
// v2.2 — PATCH SETTINGS PANEL with Profile Manager
// ════════════════════════════════════════════════════
// Patch openSettings to refresh profile manager
// openSettings patched inline — renderProfileManager called inside openSettings body below


