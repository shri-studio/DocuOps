// ============================================================
// DocuOps v3.0.0 — Tool 3 — Batch Data Extractor
// AI-powered document extraction — all t3* functions
// ============================================================

// ════════════════════════════════════════════════════
// TOOL 3 — DOCUMENT DATA EXTRACTOR v3.0.0
// ════════════════════════════════════════════════════

// ── CONSTANTS ────────────────────────────────────────
const T3_KEYS_KEY = 'ocrSuite_t3Keys';
const T3_FIELDS_KEY = 'ocrSuite_t3Fields';

// ── STATE ─────────────────────────────────────────────
let t3Fields = [];
let t3Docs = [];           // {file, name, type, text, status, results}
let t3Results = [];        // extraction results per doc
let t3ActiveDoc = null;
let t3Paused = false;
let t3Stopped = false;
let t3TemplateFile = null;
let t3CurrentTemplate = null;

// ── PRESET TEMPLATES ─────────────────────────────────
const T3_PRESETS = [
  {
    id:'resume', name:'Resume / CV', icon:'👤', fieldCount:9,
    fields:[
      {code:'A',name:'Full Name',type:'text',required:true,isKey:true},
      {code:'B',name:'Email',type:'text',required:true,isKey:true},
      {code:'C',name:'Phone',type:'text'},
      {code:'D',name:'Current Title',type:'text'},
      {code:'E',name:'Years Experience',type:'text'},
      {code:'F',name:'Skills',type:'text'},
      {code:'G',name:'Last Employer',type:'text'},
      {code:'H',name:'Education',type:'text'},
      {code:'I',name:'Location',type:'text'}
    ],
    prompt:`You are an expert HR data analyst. Extract ONLY the following fields from this resume/CV.
Return ONLY a valid JSON object. For missing fields use null. Never guess or infer.
Include a confidence score 0-100 for each field.
Format: {"fieldCode":{"value":"extracted text","confidence":95}}`
  },
  {
    id:'contract', name:'Contract', icon:'📑', fieldCount:8,
    fields:[
      {code:'A',name:'Party A',type:'text',required:true,isKey:true},
      {code:'B',name:'Party B',type:'text',required:true},
      {code:'C',name:'Contract Date',type:'text',isKey:true},
      {code:'D',name:'Contract Value',type:'text'},
      {code:'E',name:'Duration',type:'text'},
      {code:'F',name:'Key Terms',type:'text'},
      {code:'G',name:'Governing Law',type:'text'},
      {code:'H',name:'Signatory',type:'text'}
    ],
    prompt:`You are an expert legal analyst. Extract ONLY the following fields from this contract.
Return ONLY a valid JSON object. For missing fields use null. Never guess or infer.
Include a confidence score 0-100 for each field.
Format: {"fieldCode":{"value":"extracted text","confidence":95}}`
  },
  {
    id:'invoice', name:'Invoice', icon:'🧾', fieldCount:8,
    fields:[
      {code:'A',name:'Invoice No',type:'text',required:true,isKey:true},
      {code:'B',name:'Invoice Date',type:'text',isKey:true},
      {code:'C',name:'Vendor Name',type:'text'},
      {code:'D',name:'Total Amount',type:'text'},
      {code:'E',name:'VAT Amount',type:'text'},
      {code:'F',name:'Due Date',type:'text'},
      {code:'G',name:'Payment Terms',type:'text'},
      {code:'H',name:'Line Items',type:'text'}
    ],
    prompt:`You are an expert accounts analyst. Extract ONLY the following fields from this invoice.
Return ONLY a valid JSON object. For missing fields use null. Never guess or infer.
Include a confidence score 0-100 for each field.
Format: {"fieldCode":{"value":"extracted text","confidence":95}}`
  },
  {
    id:'medical', name:'Medical Record', icon:'🏥', fieldCount:7,
    fields:[
      {code:'A',name:'Patient Name',type:'text',required:true,isKey:true},
      {code:'B',name:'Date of Birth',type:'text'},
      {code:'C',name:'Record Date',type:'text',isKey:true},
      {code:'D',name:'Diagnosis',type:'text'},
      {code:'E',name:'Treatment',type:'text'},
      {code:'F',name:'Doctor Name',type:'text'},
      {code:'G',name:'Notes',type:'text'}
    ],
    prompt:`You are an expert medical records analyst. Extract ONLY the following fields from this medical document.
Return ONLY a valid JSON object. For missing fields use null. Never guess or infer.
Include a confidence score 0-100 for each field.
Format: {"fieldCode":{"value":"extracted text","confidence":95}}`
  },
  {
    id:'financial', name:'Financial Report', icon:'📊', fieldCount:7,
    fields:[
      {code:'A',name:'Company Name',type:'text',required:true,isKey:true},
      {code:'B',name:'Report Period',type:'text',isKey:true},
      {code:'C',name:'Revenue',type:'text'},
      {code:'D',name:'Net Profit',type:'text'},
      {code:'E',name:'Total Assets',type:'text'},
      {code:'F',name:'Total Liabilities',type:'text'},
      {code:'G',name:'Key Metrics',type:'text'}
    ],
    prompt:`You are an expert financial analyst. Extract ONLY the following fields from this financial report.
Return ONLY a valid JSON object. For missing fields use null. Never guess or infer.
Include a confidence score 0-100 for each field.
Format: {"fieldCode":{"value":"extracted text","confidence":95}}`
  },
  {
    id:'job_app', name:'Job Application', icon:'📄', fieldCount:7,
    fields:[
      {code:'A',name:'Applicant Name',type:'text',required:true,isKey:true},
      {code:'B',name:'Email',type:'text',isKey:true},
      {code:'C',name:'Position Applied',type:'text'},
      {code:'D',name:'Application Date',type:'text'},
      {code:'E',name:'Cover Letter Summary',type:'text'},
      {code:'F',name:'Availability',type:'text'},
      {code:'G',name:'References',type:'text'}
    ],
    prompt:`You are an expert HR analyst. Extract ONLY the following fields from this job application.
Return ONLY a valid JSON object. For missing fields use null. Never guess or infer.
Include a confidence score 0-100 for each field.
Format: {"fieldCode":{"value":"extracted text","confidence":95}}`
  }
];

// ── NAVIGATION ────────────────────────────────────────
function launchT3() {
  document.getElementById('homePage').style.display = 'none';
  document.getElementById('tool1').style.display = 'none';
  document.getElementById('tool2').style.display = 'none';
  document.getElementById('tool3').style.display = 'flex';
  // homeBtn removed v2.2.4
  const b = document.getElementById('toolBadge');
  b.textContent = '📑 Extractor'; b.className = 'tool-badge t2'; b.style.display = 'inline';

  // Check AI provider first
  const keys = t3LoadKeys();
  const hasKey = keys.gemini || keys.hf || keys.claude || keys.openai;
  t3CheckOllama().then(ollamaOk => {
    if (!hasKey && !ollamaOk) {
      t3ShowStep('t3AISetup');
    } else {
      t3ShowStep('t3TemplateSelect');
      t3RenderPresets();
      t3UpdateActiveProvider();
    }
  });
}

function t3ShowStep(id) {
  ['t3AISetup','t3TemplateSelect','t3FieldBuilder','t3DocLoader','t3Extracting','t3Review','t3Export'].forEach(s => {
    document.getElementById(s).style.display = 'none';
  });
  document.getElementById(id).style.display = 'flex';
  document.getElementById(id).style.flexDirection = 'column';
}

// ── AI PROVIDER MANAGEMENT ────────────────────────────
function t3LoadKeys() {
  try { return JSON.parse(localStorage.getItem(T3_KEYS_KEY) || '{}'); } catch(e) { return {}; }
}

function t3SaveAIKeys() {
  const keys = {
    gemini: document.getElementById('t3GeminiKey').value.trim(),
    hf: document.getElementById('t3HFKey').value.trim(),
    claude: document.getElementById('t3ClaudeKey').value.trim(),
    openai: document.getElementById('t3OpenAIKey').value.trim()
  };
  const hasAny = Object.values(keys).some(Boolean);
  localStorage.setItem(T3_KEYS_KEY, JSON.stringify(keys));

  t3CheckOllama().then(ollamaOk => {
    if (!hasAny && !ollamaOk) {
      alert('Please add at least one API key, or install Ollama locally.');
      return;
    }
    t3ShowStep('t3TemplateSelect');
    t3RenderPresets();
    t3UpdateActiveProvider();
  });
}

async function t3CheckOllama() {
  try {
    const r = await fetch('http://localhost:11434/api/tags', {signal: AbortSignal.timeout(2000)});
    if (r.ok) {
      document.getElementById('t3OllamaStatus').textContent = '✅ Running';
      document.getElementById('t3OllamaStatus').style.color = 'var(--accent2)';
      document.getElementById('t3OllamaCard').style.borderColor = 'var(--accent2)';
      return true;
    }
  } catch(e) {
    document.getElementById('t3OllamaStatus').textContent = 'Not detected';
  }
  return false;
}

async function t3GetActiveProvider() {
  // Priority: Ollama → Gemini → HuggingFace → Claude → OpenAI
  const ollamaOk = await t3CheckOllama().catch(() => false);
  if (ollamaOk) return 'ollama';
  const keys = t3LoadKeys();
  if (keys.gemini) return 'gemini';
  if (keys.hf) return 'hf';
  if (keys.claude) return 'claude';
  if (keys.openai) return 'openai';
  return null;
}

async function t3UpdateActiveProvider() {
  const p = await t3GetActiveProvider();
  const labels = {ollama:'🦙 Ollama (local)', gemini:'♊ Gemini', hf:'🤗 HuggingFace', claude:'⚡ Claude', openai:'🔮 OpenAI', null:'❌ No provider'};
  const el = document.getElementById('t3ActiveProvider');
  if (el) el.textContent = labels[p] || '❌ None';
}

// ── PRESET TEMPLATES ─────────────────────────────────
function t3RenderPresets() {
  const grid = document.getElementById('t3PresetGrid');
  if (!grid) return;
  grid.innerHTML = '';
  T3_PRESETS.forEach(p => {
    const card = document.createElement('div');
    card.className = 't3-preset-card';
    card.innerHTML = `<div class="t3-preset-icon">${p.icon}</div><div class="t3-preset-name">${p.name}</div><div class="t3-preset-count">${p.fieldCount} fields</div>`;
    card.onclick = () => t3LoadPreset(p.id);
    grid.appendChild(card);
  });
}

function t3LoadPreset(id) {
  const preset = T3_PRESETS.find(p => p.id === id);
  if (!preset) return;
  t3CurrentTemplate = preset;
  t3Fields = preset.fields.map(f => ({...f, id: 'f3_'+f.code}));
  document.getElementById('t3BuilderTitle').textContent = preset.icon + ' ' + preset.name;
  t3ShowStep('t3FieldBuilder');
  t3RenderFieldBuilder();
}

function t3BuildCustom() {
  t3CurrentTemplate = null;
  t3Fields = [{id:'f3_A',code:'A',name:'Field 1',type:'text',required:false,isKey:false}];
  document.getElementById('t3BuilderTitle').textContent = '✏️ Custom Fields';
  t3ShowStep('t3FieldBuilder');
  t3RenderFieldBuilder();
}

function t3BackToTemplates() {
  if (t3Fields.length > 0) {
    if (!confirm('Go back to template selection?\n\nYour current field configuration will be lost.')) return;
  }
  t3ShowStep('t3TemplateSelect');
}

// ── EXCEL TEMPLATE UPLOAD ─────────────────────────────
document.getElementById('t3ExcelTmplIn').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  t3TemplateFile = file;
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const headers = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({r: range.s.r, c: col})];
    if (cell && cell.v) headers.push(String(cell.v));
  }
  t3Fields = headers.map((h, i) => ({id:'f3_'+genCode(i), code:genCode(i), name:h, type:'text', required:false, isKey:i===0}));
  document.getElementById('t3BuilderTitle').textContent = '📋 ' + file.name;
  t3ShowStep('t3FieldBuilder');
  t3RenderFieldBuilder();
});

// ── FIELD BUILDER ─────────────────────────────────────
function t3RenderFieldBuilder() {
  const list = document.getElementById('t3FieldList');
  const prev = document.getElementById('t3FieldPreview');
  if (!list) return;
  list.innerHTML = '';
  prev.innerHTML = '';

  t3Fields.forEach((f, i) => {
    const col = codeColor(f.code || 'A');
    const card = document.createElement('div');
    card.className = 't3-field-card';
    card.innerHTML = `
      <div style="background:${col};color:#fff;font-family:var(--mono);font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;flex-shrink:0;">${f.code}</div>
      <input value="${f.name}" onchange="t3Fields[${i}].name=this.value;t3UpdatePromptPreview();" style="background:transparent;border:none;color:var(--text);font-size:12px;font-weight:600;font-family:var(--sans);outline:none;flex:1;">
      <select onchange="t3Fields[${i}].type=this.value;" style="background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-size:10px;font-family:var(--mono);border-radius:4px;padding:2px 5px;">
        <option value="text" ${f.type==='text'?'selected':''}>Text</option>
        <option value="number" ${f.type==='number'?'selected':''}>Number</option>
        <option value="date" ${f.type==='date'?'selected':''}>Date</option>
      </select>
      <button title="${f.isKey?'Key field':'Set as key'}" onclick="t3Fields[${i}].isKey=!t3Fields[${i}].isKey;t3RenderFieldBuilder();" style="background:none;border:none;font-size:14px;cursor:pointer;color:${f.isKey?'#f7a94f':'var(--border)'};">${f.isKey?'★':'☆'}</button>
      <button onclick="t3Fields.splice(${i},1);t3RenderFieldBuilder();" style="background:none;border:none;color:var(--border);cursor:pointer;font-size:14px;">×</button>
    `;
    list.appendChild(card);

    // Preview
    const pf = document.createElement('div');
    pf.style.cssText = 'margin-bottom:8px;';
    pf.innerHTML = `<div style="font-size:10px;color:var(--muted);margin-bottom:3px;display:flex;align-items:center;gap:4px;"><span style="background:${col};color:#fff;font-family:var(--mono);font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;">${f.code}</span>${f.name}</div><div style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:6px 8px;font-size:11px;color:var(--muted);">extracted value…</div>`;
    prev.appendChild(pf);
  });

  // Add field button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-field-btn';
  addBtn.textContent = '+ Add Field';
  addBtn.onclick = () => {
    const nextCode = genCode(t3Fields.length);
    t3Fields.push({id:'f3_'+nextCode, code:nextCode, name:'New Field', type:'text', required:false, isKey:false});
    t3RenderFieldBuilder();
  };
  list.appendChild(addBtn);

  t3UpdatePromptPreview();
}

function t3UpdatePromptPreview() {
  const el = document.getElementById('t3PromptPreview');
  if (!el) return;
  const fieldList = t3Fields.map(f => `"${f.code}": {"value": "${f.name}", "confidence": 0-100}`).join(',\n  ');
  const base = t3CurrentTemplate?.prompt || 'Extract the following fields from the document.';
  el.textContent = base + `\n\nFields to extract:\n{\n  ${fieldList}\n}`;
}

// ── AUTO-DETECT FIELDS FROM SAMPLE ───────────────────
async function t3SampleDetect() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.pdf,.docx,.txt';
  inp.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const provider = await t3GetActiveProvider();
    if (!provider) { alert('No AI provider configured. Please set up an API key first.'); return; }

    document.getElementById('t3BuilderTitle').textContent = '🔍 Analyzing sample…';
    try {
      const text = await t3ExtractText(file);
      const prompt = `Analyze this document and suggest the most useful data fields to extract from it.
Return ONLY a JSON array of field names, nothing else. Maximum 12 fields.
Example: ["Full Name","Email","Phone","Job Title","Skills","Experience"]

Document:
${text.slice(0, 3000)}`;

      const result = await t3CallAI(provider, prompt);
      const suggestions = JSON.parse(result.replace(/```json|```/g, '').trim());

      // Show suggestion UI
      const confirmed = await t3ShowFieldSuggestions(suggestions);
      if (confirmed && confirmed.length) {
        const existing = t3Fields.map(f => f.name.toLowerCase());
        confirmed.forEach(name => {
          if (!existing.includes(name.toLowerCase())) {
            const nextCode = genCode(t3Fields.length);
            t3Fields.push({id:'f3_'+nextCode, code:nextCode, name, type:'text', required:false, isKey:false});
          }
        });
        t3RenderFieldBuilder();
      }
    } catch(ex) {
      alert('Auto-detect failed: ' + ex.message);
    }
    document.getElementById('t3BuilderTitle').textContent = t3CurrentTemplate ? t3CurrentTemplate.icon + ' ' + t3CurrentTemplate.name : '✏️ Custom Fields';
  };
  inp.click();
}

function t3ShowFieldSuggestions(suggestions) {
  return new Promise(resolve => {
    const existing = t3Fields.map(f => f.name.toLowerCase());
    const newOnes = suggestions.filter(s => !existing.includes(s.toLowerCase()));

    if (!newOnes.length) { alert('No new fields detected beyond what you already have.'); resolve([]); return; }

    const msg = `📄 AI detected these additional fields:\n\n${newOnes.map((s,i) => `${i+1}. ${s}`).join('\n')}\n\nAdd all of these fields?`;
    if (confirm(msg)) resolve(newOnes);
    else resolve([]);
  });
}

// ── DOCUMENT LOADING ──────────────────────────────────
function t3ShowDocLoader() {
  if (t3Fields.length === 0) { alert('Add at least one field first.'); return; }
  t3ShowStep('t3DocLoader');
}

function t3BackToBuilder() {
  t3ShowStep('t3FieldBuilder');
}

document.getElementById('t3DocInput').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  // Add to existing
  const newDocs = files.map(f => ({file:f, name:f.name, type:f.name.split('.').pop().toLowerCase(), text:'', status:'pending', results:null}));
  t3Docs = [...t3Docs, ...newDocs];
  t3BuildDocStrip();
  document.getElementById('t3ExtractBtn').disabled = false;
  _setSessionActive(true);
});

// Drag and drop on loader
const t3dz = document.getElementById('t3DropZone');
if (t3dz) {
  t3dz.addEventListener('dragover', e => { e.preventDefault(); t3dz.style.borderColor = 'var(--accent)'; });
  t3dz.addEventListener('dragleave', () => { t3dz.style.borderColor = ''; });
  t3dz.addEventListener('drop', e => {
    e.preventDefault(); t3dz.style.borderColor = '';
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|docx|doc|txt)$/i.test(f.name));
    if (!files.length) return;
    const newDocs = files.map(f => ({file:f, name:f.name, type:f.name.split('.').pop().toLowerCase(), text:'', status:'pending', results:null}));
    t3Docs = [...t3Docs, ...newDocs];
    t3BuildDocStrip();
    document.getElementById('t3ExtractBtn').disabled = false;
    _setSessionActive(true);
  });
}

function t3BuildDocStrip() {
  const strip = document.getElementById('t3Strip');
  const wrap = document.getElementById('t3StripWrap');
  const dropZone = document.getElementById('t3DropZone');
  if (!strip) return;

  strip.innerHTML = '';
  t3Docs.forEach((doc, i) => {
    const th = document.createElement('div');
    th.style.cssText = 'width:68px;height:68px;border-radius:6px;border:2px solid var(--border);cursor:pointer;flex-shrink:0;position:relative;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;transition:border-color .15s;';
    th.id = 't3st_' + i;
    const icons = {pdf:'📄', docx:'📝', doc:'📝', txt:'📃'};
    th.innerHTML = `<div style="font-size:20px;">${icons[doc.type]||'📄'}</div><div style="font-size:8px;font-family:var(--mono);color:var(--muted);text-align:center;padding:0 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:64px;">${doc.name}</div>`;
    strip.appendChild(th);
  });

  wrap.style.display = 'flex';
  dropZone.style.display = t3Docs.length > 0 ? 'none' : 'flex';
  document.getElementById('t3DocCount').textContent = t3Docs.length + ' document' + (t3Docs.length !== 1 ? 's' : '');
  document.getElementById('t3StripCount').textContent = t3Docs.length + ' loaded';
}

function t3ClearDocs() {
  if (!confirm(`Clear all ${t3Docs.length} documents?\n\nExtracted data will be lost.`)) return;
  t3Docs = [];
  t3BuildDocStrip();
  document.getElementById('t3ExtractBtn').disabled = true;
  document.getElementById('t3DropZone').style.display = 'flex';
  document.getElementById('t3StripWrap').style.display = 'none';
}

// ── TEXT EXTRACTION ───────────────────────────────────
async function t3ExtractText(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'txt') {
    return await file.text();
  }
  if (ext === 'pdf') {
    return await t3ExtractPDFText(file);
  }
  if (ext === 'docx' || ext === 'doc') {
    return await t3ExtractDOCXText(file);
  }
  return await file.text().catch(() => '');
}

async function t3ExtractPDFText(file) {
  await loadPDFjs();
  const ab = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({data: ab}).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(s => s.str).join(' ') + '\n';
  }
  return text.trim();
}

async function t3ExtractDOCXText(file) {
  // Load mammoth.js for DOCX
  await t3LoadMammoth();
  const ab = await file.arrayBuffer();
  const result = await mammoth.extractRawText({arrayBuffer: ab});
  return result.value || '';
}

async function t3LoadMammoth() {
  return new Promise((res, rej) => {
    if (window.mammoth) { res(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── AI PROVIDER CALLS ─────────────────────────────────
async function t3CallAI(provider, prompt) {
  const keys = t3LoadKeys();
  switch(provider) {
    case 'ollama':   return await t3CallOllama(prompt);
    case 'gemini':   return await t3CallGemini(prompt, keys.gemini);
    case 'hf':       return await t3CallHuggingFace(prompt, keys.hf);
    case 'claude':   return await t3CallClaude(prompt, keys.claude);
    case 'openai':   return await t3CallOpenAI(prompt, keys.openai);
    default: throw new Error('No AI provider available');
  }
}

async function t3CallOllama(prompt) {
  const r = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({model: 'llama3.1', prompt, stream: false})
  });
  const d = await r.json();
  return d.response || '';
}

async function t3CallGemini(prompt, key) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({contents: [{parts: [{text: prompt}]}]})
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function t3CallHuggingFace(prompt, token) {
  const r = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-xxl', {
    method: 'POST',
    headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({inputs: prompt.slice(0, 2000), parameters: {max_new_tokens: 500}})
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return Array.isArray(d) ? d[0]?.generated_text || '' : d.generated_text || '';
}

async function t3CallClaude(prompt, key) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01'},
    body: JSON.stringify({model: 'claude-haiku-4-5-20251001', max_tokens: 1000, messages: [{role: 'user', content: prompt}]})
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.content?.[0]?.text || '';
}

async function t3CallOpenAI(prompt, key) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`},
    body: JSON.stringify({model: 'gpt-3.5-turbo', messages: [{role: 'user', content: prompt}], max_tokens: 1000})
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.choices?.[0]?.message?.content || '';
}

// ── EXTRACTION ENGINE ─────────────────────────────────
async function t3StartExtraction() {
  if (t3Docs.length === 0) { alert('Load documents first.'); return; }
  if (t3Fields.length === 0) { alert('Define fields first.'); return; }

  const provider = await t3GetActiveProvider();
  if (!provider) { alert('No AI provider available. Please configure one in settings.'); return; }

  t3Paused = false; t3Stopped = false;
  t3Results = [];
  t3ShowStep('t3Extracting');

  const log = document.getElementById('t3ExtractLog');
  log.innerHTML = '';
  let ok = 0, warn = 0, fail = 0;

  for (let i = 0; i < t3Docs.length; i++) {
    if (t3Stopped) break;
    while (t3Paused) await new Promise(r => setTimeout(r, 500));

    const doc = t3Docs[i];
    const pct = Math.round((i / t3Docs.length) * 100);
    document.getElementById('t3ExtractProgress').style.width = pct + '%';
    document.getElementById('t3ExtractPct').textContent = `${i+1} / ${t3Docs.length}`;

    // Add progress row
    const row = document.createElement('div');
    row.className = 't3-extract-row';
    row.id = 't3row_' + i;
    row.innerHTML = `<span style="color:var(--muted);">🔄</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${doc.name}</span><span style="color:var(--muted);">extracting…</span>`;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;

    try {
      // Step 1: Extract text from document
      const text = await t3ExtractText(doc.file);
      if (!text.trim()) throw new Error('No text found in document');

      // Step 2: Build extraction prompt
      const fieldDefs = t3Fields.map(f => `"${f.code}": ${f.name}`).join(', ');
      const basePrompt = t3CurrentTemplate?.prompt || 'Extract the following fields from the document. Return ONLY valid JSON with confidence scores.';
      const fullPrompt = `${basePrompt}

Fields: ${fieldDefs}

Return format (ONLY JSON, nothing else):
{${t3Fields.map(f => `"${f.code}":{"value":"...","confidence":0}`).join(',')}}

Document text:
${text.slice(0, 4000)}`;

      // Step 3: Call AI
      const raw = await t3CallAI(provider, fullPrompt);

      // Step 4: Parse response
      const clean = raw.replace(/```json|```/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI returned invalid JSON');
      const parsed = JSON.parse(jsonMatch[0]);

      // Step 5: Evaluate result
      const result = {docIdx: i, fileName: doc.name, status: 'ok', fields: {}, provider};
      let filled = 0;
      t3Fields.forEach(f => {
        const val = parsed[f.code];
        if (val && val.value !== null && val.value !== '') {
          result.fields[f.code] = {value: String(val.value), confidence: parseInt(val.confidence) || 50};
          filled++;
        } else {
          result.fields[f.code] = {value: '', confidence: 0};
        }
      });

      const fillRate = filled / t3Fields.length;
      result.status = fillRate >= 0.8 ? 'ok' : fillRate >= 0.5 ? 'warn' : 'fail';
      t3Results.push(result);

      if (result.status === 'ok') ok++;
      else if (result.status === 'warn') warn++;
      else fail++;

      const statusIcon = result.status === 'ok' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
      row.innerHTML = `<span class="t3-status-${result.status}">${statusIcon}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${doc.name}</span><span style="color:var(--muted);font-family:var(--mono);">${filled}/${t3Fields.length} fields</span>`;

    } catch(ex) {
      t3Results.push({docIdx: i, fileName: doc.name, status: 'fail', fields: {}, error: ex.message, provider});
      fail++;
      row.innerHTML = `<span class="t3-status-fail">❌</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${doc.name}</span><span style="color:var(--danger);font-family:var(--mono);">${ex.message.slice(0,40)}</span>`;
    }

    document.getElementById('t3CountOk').textContent = ok;
    document.getElementById('t3CountWarn').textContent = warn;
    document.getElementById('t3CountFail').textContent = fail;

    // Small delay between requests to respect rate limits
    if (i < t3Docs.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  document.getElementById('t3ExtractProgress').style.width = '100%';
  document.getElementById('t3ExtractPct').textContent = `${t3Docs.length} / ${t3Docs.length}`;

  // Auto-advance to review after 1 second
  setTimeout(() => {
    t3ShowStep('t3Review');
    t3RenderReviewTable();
    t3UpdateReviewStats();
  }, 1000);
}

function t3PauseExtraction() {
  t3Paused = !t3Paused;
  document.getElementById('t3PauseBtn').textContent = t3Paused ? '▶ Resume' : '⏸ Pause';
}

function t3StopExtraction() {
  if (!confirm('Stop extraction?\n\nResults so far will be saved and you can review them.')) return;
  t3Stopped = true;
  setTimeout(() => {
    t3ShowStep('t3Review');
    t3RenderReviewTable();
    t3UpdateReviewStats();
  }, 500);
}

// ── REVIEW TABLE ──────────────────────────────────────
function t3UpdateReviewStats() {
  const ok = t3Results.filter(r => r.status === 'ok').length;
  const warn = t3Results.filter(r => r.status === 'warn').length;
  const fail = t3Results.filter(r => r.status === 'fail').length;
  const el = document.getElementById('t3ReviewStats');
  if (el) el.textContent = `${t3Results.length} documents · ✅ ${ok} · ⚠️ ${warn} · ❌ ${fail}`;

  const expStats = document.getElementById('t3ExportStats');
  if (expStats) expStats.innerHTML = `<b>${t3Results.length}</b> documents processed<br>✅ ${ok} complete &nbsp; ⚠️ ${warn} partial &nbsp; ❌ ${fail} failed`;
}

function t3RenderReviewTable() {
  const wrap = document.getElementById('t3ReviewTableWrap');
  if (!wrap) return;

  const filter = document.getElementById('t3ReviewFilter')?.value || 'all';
  const filtered = t3Results.filter(r => filter === 'all' || r.status === filter);

  if (!filtered.length) {
    wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">No results match this filter.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 't3-review-table';

  // Header
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  hrow.innerHTML = '<th>#</th><th>File</th>' + t3Fields.map(f => `<th>${f.code}: ${f.name}</th>`).join('') + '<th>Actions</th>';
  thead.appendChild(hrow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  filtered.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.className = r.status;
    const statusIcon = r.status === 'ok' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
    let cells = `<td>${statusIcon} ${i+1}</td><td title="${r.fileName}" style="max-width:140px;">${r.fileName}</td>`;
    t3Fields.forEach(f => {
      const fd = r.fields[f.code];
      if (!fd || !fd.value) {
        cells += `<td style="color:var(--danger);font-style:italic;">not found</td>`;
      } else {
        const confClass = fd.confidence >= 85 ? 'conf-high' : fd.confidence >= 60 ? 'conf-mid' : 'conf-low';
        cells += `<td><div style="display:flex;align-items:center;gap:4px;"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;" title="${fd.value}">${fd.value}</span><span class="conf-badge ${confClass}">${fd.confidence}%</span></div></td>`;
      }
    });
    cells += `<td><button onclick="t3OpenFixPanel(${t3Results.indexOf(r)})" style="background:none;border:1px solid var(--border);color:var(--muted);font-size:10px;padding:2px 7px;border-radius:4px;cursor:pointer;">✏️ Fix</button></td>`;
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.innerHTML = '';
  wrap.appendChild(table);
}

// ── FIX PANEL ─────────────────────────────────────────
let t3FixingIdx = null;
function t3OpenFixPanel(idx) {
  t3FixingIdx = idx;
  const r = t3Results[idx];
  document.getElementById('t3FixTitle').textContent = '✏️ ' + r.fileName;
  const container = document.getElementById('t3FixFields');
  container.innerHTML = '';
  t3Fields.forEach(f => {
    const fd = r.fields[f.code] || {value:'', confidence:0};
    const col = codeColor(f.code);
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:3px;min-width:140px;';
    div.innerHTML = `<div style="font-size:10px;color:var(--muted);display:flex;align-items:center;gap:4px;"><span style="background:${col};color:#fff;padding:1px 5px;border-radius:3px;font-family:var(--mono);font-size:9px;">${f.code}</span>${f.name}</div><input id="t3fix_${f.code}" value="${fd.value}" style="background:var(--surface2);border:1px solid ${fd.confidence < 60 ? 'var(--danger)' : 'var(--border)'};border-radius:5px;padding:5px 8px;font-size:11px;color:var(--text);font-family:var(--sans);outline:none;width:100%;">`;
    container.appendChild(div);
  });
  document.getElementById('t3FixPanel').style.display = 'block';
}

async function t3ReExtract() {
  if (t3FixingIdx === null) return;
  const r = t3Results[t3FixingIdx];
  const doc = t3Docs[r.docIdx];
  const provider = await t3GetActiveProvider();

  document.getElementById('t3FixTitle').textContent = '🔄 Re-extracting…';
  try {
    const text = await t3ExtractText(doc.file);
    // Use a more explicit retry prompt
    const fieldDefs = t3Fields.map(f => `- ${f.code}: "${f.name}"`).join('\n');
    const retryPrompt = `You are a precise data extraction expert. Extract EXACTLY these fields from the document below.
Be thorough - check the entire document carefully.
Return ONLY valid JSON, no explanation.

Fields needed:
${fieldDefs}

Return format:
{${t3Fields.map(f => `"${f.code}":{"value":"exact text or null","confidence":0}`).join(',')}}

Document:
${text.slice(0, 4000)}`;

    const raw = await t3CallAI(provider, retryPrompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid response');
    const parsed = JSON.parse(jsonMatch[0]);

    t3Fields.forEach(f => {
      const val = parsed[f.code];
      r.fields[f.code] = val && val.value ? {value: String(val.value), confidence: parseInt(val.confidence)||50} : {value:'', confidence:0};
    });

    const filled = Object.values(r.fields).filter(f => f.value).length;
    r.status = filled/t3Fields.length >= 0.8 ? 'ok' : filled/t3Fields.length >= 0.5 ? 'warn' : 'fail';

    t3OpenFixPanel(t3FixingIdx);
    t3RenderReviewTable();
    t3UpdateReviewStats();
  } catch(ex) {
    alert('Re-extraction failed: ' + ex.message);
    document.getElementById('t3FixTitle').textContent = '✏️ ' + r.fileName;
  }
}

function t3MarkReviewed() {
  if (t3FixingIdx === null) return;
  const r = t3Results[t3FixingIdx];
  // Save manually edited values
  t3Fields.forEach(f => {
    const inp = document.getElementById('t3fix_' + f.code);
    if (inp) r.fields[f.code] = {value: inp.value, confidence: 100};
  });
  r.status = 'ok';
  document.getElementById('t3FixPanel').style.display = 'none';
  t3RenderReviewTable();
  t3UpdateReviewStats();
}

// ── EXPORT ────────────────────────────────────────────
function t3ShowExport() {
  t3UpdateReviewStats();
  t3ShowStep('t3Export');
}

function t3BackToReview() {
  t3ShowStep('t3Review');
  t3RenderReviewTable();
}

function t3GetExportRows() {
  const incOk = document.getElementById('t3ExportOk').checked;
  const incWarn = document.getElementById('t3ExportWarn').checked;
  const incFail = document.getElementById('t3ExportFail').checked;
  const incConf = document.getElementById('t3ExportConf').checked;
  const incSrc = document.getElementById('t3ExportSrc').checked;
  const incTs = document.getElementById('t3ExportTs').checked;

  const filtered = t3Results.filter(r =>
    (r.status === 'ok' && incOk) ||
    (r.status === 'warn' && incWarn) ||
    (r.status === 'fail' && incFail)
  );

  const headers = [];
  if (incSrc) headers.push('Source File');
  if (incTs) headers.push('Extracted At');
  t3Fields.forEach(f => {
    headers.push(f.name);
    if (incConf) headers.push(f.name + ' (confidence)');
  });

  const rows = [headers];
  filtered.forEach(r => {
    const row = [];
    if (incSrc) row.push(r.fileName);
    if (incTs) row.push(r.extractedAt || new Date().toLocaleString());
    t3Fields.forEach(f => {
      const fd = r.fields[f.code] || {value:'', confidence:0};
      row.push(fd.value || '');
      if (incConf) row.push(fd.confidence ? fd.confidence + '%' : '');
    });
    rows.push(row);
  });
  return rows;
}

function t3ExportFresh() {
  const rows = t3GetExportRows();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
  XLSX.writeFile(wb, 'extracted_data.xlsx');
}

async function t3ExportAppend() {
  if (!t3TemplateFile) { t3ExportFresh(); return; }
  const data = await t3TemplateFile.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let lastRow = range.e.r + 1;
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({r: range.s.r, c})];
    headers.push(cell ? String(cell.v) : '');
  }
  const rows = t3GetExportRows().slice(1); // skip header row
  rows.forEach(row => {
    headers.forEach((h, c) => {
      const fi = t3Fields.findIndex(f => f.name === h);
      if (fi >= 0) ws[XLSX.utils.encode_cell({r: lastRow, c})] = {v: row[fi] || '', t: 's'};
    });
    lastRow++;
  });
  ws['!ref'] = XLSX.utils.encode_range({s:{r:range.s.r,c:range.s.c},e:{r:lastRow-1,c:range.e.c}});
  XLSX.writeFile(wb, 'extracted_appended.xlsx');
}

// ── SETTINGS PANEL: AI KEYS SECTION ──────────────────
(function addAIKeysToSettings() {
  const body = document.querySelector('.settings-body');
  if (!body || body.querySelector('.ai-settings-section')) return;
  const sec = document.createElement('div');
  sec.className = 'settings-section ai-settings-section';
  sec.innerHTML = `
    <div class="settings-section-title" style="display:flex;align-items:center;justify-content:space-between;">
      🤖 AI Providers (Tool 3)
      <button onclick="t3CheckOllama()" style="background:none;border:none;color:var(--muted);font-size:10px;cursor:pointer;">↻ Check Ollama</button>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.6;">Keys stored locally. Auto-detects in order: Ollama → Gemini → HuggingFace → Claude → OpenAI</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;font-size:11px;"><span style="width:80px;color:var(--muted);">🦙 Ollama</span><span id="settingsOllamaStatus" style="color:var(--muted);font-family:var(--mono);">not checked</span></div>
      <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">♊ Gemini</div><input id="settingsGeminiKey" class="ai-key-input" type="password" placeholder="Gemini API key…"></div>
      <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">🤗 HuggingFace</div><input id="settingsHFKey" class="ai-key-input" type="password" placeholder="HuggingFace token…"></div>
      <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">⚡ Claude</div><input id="settingsClaudeKey" class="ai-key-input" type="password" placeholder="Claude API key…"></div>
      <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">🔮 OpenAI</div><input id="settingsOpenAIKey" class="ai-key-input" type="password" placeholder="OpenAI API key…"></div>
      <button class="tmpl-btn" style="width:100%;" onclick="t3SaveFromSettings()">💾 Save Keys</button>
    </div>
  `;
  body.appendChild(sec);
})();

// Pre-fill settings inputs when settings opens
const _orig_openSettings_v3 = openSettings;
function openSettings() {
  _orig_openSettings_v3();
  const keys = t3LoadKeys();
  const g = id => document.getElementById(id);
  if(g('settingsGeminiKey')) g('settingsGeminiKey').value = keys.gemini || '';
  if(g('settingsHFKey')) g('settingsHFKey').value = keys.hf || '';
  if(g('settingsClaudeKey')) g('settingsClaudeKey').value = keys.claude || '';
  if(g('settingsOpenAIKey')) g('settingsOpenAIKey').value = keys.openai || '';
  t3CheckOllama().then(ok => {
    const el = g('settingsOllamaStatus');
    if(el) el.textContent = ok ? '✅ Running' : 'Not detected';
    if(el) el.style.color = ok ? 'var(--accent2)' : 'var(--muted)';
  });
}

function t3SaveFromSettings() {
  const g = id => document.getElementById(id);
  const keys = {
    gemini: g('settingsGeminiKey')?.value.trim() || '',
    hf: g('settingsHFKey')?.value.trim() || '',
    claude: g('settingsClaudeKey')?.value.trim() || '',
    openai: g('settingsOpenAIKey')?.value.trim() || ''
  };
  localStorage.setItem(T3_KEYS_KEY, JSON.stringify(keys));
  alert('AI keys saved!');
}

// ── VERSION UPDATE ────────────────────────────────────
(function() {
  const ver = '3.0.0';
  const sf = document.querySelector('.settings-footer');
  if (sf) sf.textContent = `OCR Suite v${ver} · All processing local · No data uploaded`;
  const hf = document.querySelector('.home-footer');
  if (hf) hf.textContent = `All tools run locally · No data uploaded anywhere · DocuOps v${ver}`;
})();

if(!navigator.onLine)document.getElementById('netWarn').style.display='block';