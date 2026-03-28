// ============================================================
// DocuOps v3.0.0 — Tool 2 — Data Entry Assistant
// OCR Data Entry — all t2* functions, formula engine, file naming
// ============================================================

// ════════════════════════════════════════════════════
// FIELD CODE SYSTEM
// ════════════════════════════════════════════════════
function genCode(idx){
  // Excel-style: A,B,...,Z,AA,AB,...
  let code='',n=idx+1;
  while(n>0){code=String.fromCharCode(64+(n%26||26))+code;n=Math.floor((n-1)/26);}
  return code;
}

function assignCodes(fields){
  let mainIdx=0;
  fields.forEach(f=>{
    if(!f.customCode){f.code=genCode(mainIdx);}
    mainIdx++;
    // sub-fields for repeat get parent code + sub letter
    if(f.type==='repeat'&&f.subFields){
      f.subFields.forEach((sf,si)=>{
        if(!sf.customCode)sf.code=f.code+String.fromCharCode(65+si);
      });
    }
  });
}

function codeColor(code){
  const colors=['#4f8ef7','#38d9a9','#f7a94f','#a78bfa','#f76f6f','#38bdf8','#fb7185','#34d399'];
  let h=0;for(const c of code)h=(h*31+c.charCodeAt(0))%colors.length;
  return colors[h];
}

// ════════════════════════════════════════════════════
// TOOL 2
// ════════════════════════════════════════════════════
let t2Fields=[];
let t2Files=[],t2ActiveFile=0,t2Entries=[],t2ActiveFieldId=null;
let t2RepeatData={},t2TemplateFile=null,t2NamingPatternOverride=null;
const T2_AUTOSAVE_KEY='ocrSuite_t2Template';
const T2_AUTOSAVE_HISTORY_KEY='ocrSuite_t2TemplateHistory';

function t2GetTemplateHistory(){
  try{
    const raw = localStorage.getItem(T2_AUTOSAVE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e){ return []; }
}

function t2SetTemplateHistory(history){
  localStorage.setItem(T2_AUTOSAVE_HISTORY_KEY, JSON.stringify(history));
}

function t2AddTemplateHistoryRecord(data){
  const history = t2GetTemplateHistory();
  const stamp = new Date().toLocaleString();
  const name = data.name || `Session ${stamp}`;
  const existing = history.find(h => h.name===name);
  if(existing){ existing.savedAt = stamp; existing.data = data; }
  else { history.unshift({name, savedAt: stamp, data}); }
  const keep = history.slice(0, 10);
  t2SetTemplateHistory(keep);
}


// ── SUPABASE TEMPLATE SYNC ──────────────────────────
const _sbUrl = 'https://mawyhvjvnkzgohujxubl.supabase.co';
const _sbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hd3lodmp2bmt6Z29odWp4dWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDc2NDUsImV4cCI6MjA4OTQ4MzY0NX0.BGx1DABC9Algtfguw3Mh61aXJZjhRYhS3RLttivrivo';

async function _getSupabase() {
  if (window._sb) return window._sb;
  return null;
}

async function _getCurrentUserId() {
  const sb = await _getSupabase();
  if (!sb) return null;
  try {
    const { data: { session } } = await sb.auth.getSession();
    return session?.user?.id || null;
  } catch(e) { return null; }
}

async function t2SaveTemplateToCloud(data) {
  const sb = await _getSupabase();
  const userId = await _getCurrentUserId();
  if (!sb || !userId) return; // offline — localStorage only

  try {
    // Check if template exists for this user
    const { data: existing } = await sb
      .from('templates')
      .select('id')
      .eq('user_id', userId)
      .eq('name', 'default')
      .single();

    if (existing) {
      // Update existing
      await sb.from('templates').update({
        fields: data.fields,
        naming_pattern: data.namingPattern,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id);
    } else {
      // Insert new
      await sb.from('templates').insert({
        user_id: userId,
        name: 'default',
        fields: data.fields,
        naming_pattern: data.namingPattern || ''
      });
    }
    console.log('✅ Template synced to cloud');
  } catch(e) {
    console.warn('Template cloud sync failed:', e.message);
  }
}

async function t2LoadTemplateFromCloud() {
  const sb = await _getSupabase();
  const userId = await _getCurrentUserId();
  if (!sb || !userId) return null;

  try {
    const { data } = await sb
      .from('templates')
      .select('*')
      .eq('user_id', userId)
      .eq('name', 'default')
      .single();

    if (data) {
      return {
        fields: data.fields || [],
        namingPattern: data.naming_pattern || '',
        savedAt: new Date(data.updated_at).toLocaleString()
      };
    }
  } catch(e) {
    console.warn('Template cloud load failed:', e.message);
  }
  return null;
}

function t2ShowSetup(){
  ['t2Setup','t2Builder','t2Work','t2Done'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=id==='t2Setup'?'flex':'none';
  });
  (async()=>{
    const cloud=await t2LoadTemplateFromCloud();
    if(cloud) localStorage.setItem(T2_AUTOSAVE_KEY,JSON.stringify(cloud));
    const saved=localStorage.getItem(T2_AUTOSAVE_KEY);
    if(saved){
      try{
        const data=JSON.parse(saved);
        const fields=data.fields||[];
        const info=`${fields.length} field${fields.length!==1?'s':''} · Saved ${data.savedAt||''}`;
        if(typeof t2ShowReturn==='function') t2ShowReturn(info);
      }catch(e){
        if(typeof t2ShowEmpty==='function') t2ShowEmpty();
      }
    } else {
      if(typeof t2ShowEmpty==='function') t2ShowEmpty();
    }
  })();
}

function t2PopulateTemplateSelector(){
  const sel=document.getElementById('t2TemplateSelector');
  if(!sel) return;
  const history = t2GetTemplateHistory();
  sel.innerHTML = '';
  if(history.length===0){
    const opt = document.createElement('option');
    opt.value=''; opt.textContent='No saved templates';
    sel.appendChild(opt);
    return;
  }
  history.forEach((h,i)=>{
    const opt=document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${h.name || 'Template'} · ${h.savedAt || ''}`;
    sel.appendChild(opt);
  });
  sel.selectedIndex = 0; // Default to most recent
}

function t2ShowLoadModal(){
  t2PopulateTemplateSelector();
  document.getElementById('t2LoadModal').style.display = 'flex';
}

function t2CloseLoadModal(){
  document.getElementById('t2LoadModal').style.display = 'none';
}

function t2BrowseTemplate(){
  document.getElementById('t2TmplIn').click();
}

function t2LoadTemplateSelector(){
  const sel = document.getElementById('t2TemplateSelector');
  if(!sel || !sel.value) return;
  const index = parseInt(sel.value, 10);
  if(Number.isNaN(index)) return;
  t2LoadTemplateFromHistory(index);
  t2CloseLoadModal();
}

// Template persistence
function t2SaveTemplate(){
  if(t2Fields.length===0){alert('No fields to save.');return;}
  const data={
    fields:t2Fields,
    namingPattern:document.getElementById('t2NamingPattern')?.value||'{A}',
    savedAt:new Date().toLocaleString()
  };
  // Save to localStorage (instant)
  localStorage.setItem(T2_AUTOSAVE_KEY,JSON.stringify(data));
  // Save to Supabase (sync across devices)
  t2SaveTemplateToCloud(data).then(()=>{});
  // Export as JSON file
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='docuops_template.json';a.click();
  alert('Template saved!\n\nSynced to your account — available on any device.');
}

function t2LoadTemplateFile(){
  document.getElementById('t2TmplLoadIn').click();
}

function t2CheckAutoSave(){
  const saved=localStorage.getItem(T2_AUTOSAVE_KEY);
  if(!saved){alert('No auto-saved template found.');return;}
  try{
    const data=JSON.parse(saved);
    if(!confirm(`Load auto-saved template from ${data.savedAt}?\n\nFields: ${data.fields.length}`))return;
    t2Fields=data.fields||[];
    t2ShowBuilder();
    if(data.namingPattern){
      const np=document.getElementById('t2NamingPattern');
      if(np)np.value=data.namingPattern;
    }
  }catch(e){alert('Could not load auto-save: '+e.message);}
}

// Upload Excel template
const t2TmplIn = document.getElementById('t2TmplIn');
if (t2TmplIn) {
  t2TmplIn.addEventListener('change', async e => {
  const file=e.target.files[0];if(!file)return;
  // Handle JSON template loading
  if(file.name.endsWith('.json')){
    const text=await file.text();
    try{
      const data=JSON.parse(text);
      t2Fields=data.fields||[];
      t2ShowBuilder();
      if(data.namingPattern){
        const np=document.getElementById('t2NamingPattern');
        if(np)np.value=data.namingPattern;
      }
      document.getElementById('t2TmplName').textContent=`Loaded: ${file.name}`;
    }catch(err){alert('Invalid template file: '+err.message);}
    return;
  }
  // Handle Excel files
  const data=await file.arrayBuffer();
  const wb=XLSX.read(data);
  const ws=wb.Sheets[wb.SheetNames[0]];
  const headers=[];
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  for(let c=range.s.c;c<=range.e.c;c++){
    const cell=ws[XLSX.utils.encode_cell({r:range.s.r,c})];
    if(cell&&cell.v)headers.push(String(cell.v));
  }
  t2Fields=headers.map((h,i)=>({id:'f'+i,name:h,type:'text',options:'',formula:'',required:false,subFields:[],customCode:false}));
  assignCodes(t2Fields);
  t2ShowBuilder();
});
}

// Upload Excel template via separate input
const t2ExcelIn = document.getElementById('t2ExcelIn');
if (t2ExcelIn) {
  t2ExcelIn.addEventListener('change', async e => {
  const file=e.target.files[0];if(!file)return;
  t2TemplateFile=file;
  const data=await file.arrayBuffer();
  const wb=XLSX.read(data);
  const ws=wb.Sheets[wb.SheetNames[0]];
  const headers=[];
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  for(let c=range.s.c;c<=range.e.c;c++){
    const cell=ws[XLSX.utils.encode_cell({r:range.s.r,c})];
    if(cell&&cell.v)headers.push(String(cell.v));
  }
  t2Fields=headers.map((h,i)=>({id:'f'+i,name:h,type:'text',options:'',formula:'',required:false,subFields:[],customCode:false}));
  assignCodes(t2Fields);
  t2ShowBuilder();
});
}

function t2BuildManual(){
  t2Fields=[{id:'f0',name:'Field 1',type:'text',options:'',formula:'',required:false,subFields:[],customCode:false}];
  assignCodes(t2Fields);
  t2ShowBuilder();
}

function t2EnsureBackToSetupBtn(){
  const bh=document.querySelector('.builder-hdr');
  if(!bh || bh.querySelector('.back-setup-btn')) return;
  const backBtn=document.createElement('button');
  backBtn.className='btn back-setup-btn';
  backBtn.style.cssText='padding:6px 12px;font-size:11px;background:none;border:1px solid var(--border);color:var(--muted);margin-right:8px;';
  backBtn.textContent='↩ Setup';
  backBtn.onclick=t2BackToSetup;
  const actions = bh.querySelector('.builder-actions');
  if(actions){ bh.insertBefore(backBtn, actions); }
  else { bh.appendChild(backBtn); }
}

function t2ShowBuilder(){
  ['t2Setup','t2Builder','t2Work','t2Done'].forEach(id=>{
    document.getElementById(id).style.display=id==='t2Builder'?'flex':'none';
  });
  t2EnsureBackToSetupBtn();
  // Auto-save on builder open
  t2AutoSave();
  t2RenderBuilder();
}

function t2AutoSave(){
  if(t2Fields.length===0)return;
  const np=document.getElementById('t2NamingPattern');
  const data={fields:t2Fields,namingPattern:np?np.value:'{A}',savedAt:new Date().toLocaleString()};
  localStorage.setItem(T2_AUTOSAVE_KEY,JSON.stringify(data));
  t2AddTemplateHistoryRecord(data);
  // Silent cloud sync
  t2SaveTemplateToCloud(data).catch(()=>{});
}

function t2RenderBuilder(){
  assignCodes(t2Fields);
  const list = document.getElementById('t2FieldList');
  const prev = document.getElementById('t2Preview');
  if(!list) return;
  list.innerHTML = '';
  if(prev) prev.innerHTML = '';

  t2Fields.forEach((f, i) => {
    const col = codeColor(f.code || 'A');
    const showOpts = f.type === 'dropdown';
    const showRepeat = f.type === 'repeat';
    const showFormula = f.type === 'formula';

    const card = document.createElement('div');
    card.className = 'fc';
    card.dataset.index = i;

    // ── TOP ROW ──────────────────────────────
    const top = document.createElement('div');
    top.className = 'fc-top';

    // Drag handle
    const handle = document.createElement('span');
    handle.className = 'fc-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';
    handle.draggable = true;
    handle.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', i);
      card.style.opacity = '0.5';
    });
    handle.addEventListener('dragend', () => card.style.opacity = '1');
    top.appendChild(handle);

    // Code badge
    const codeBadge = document.createElement('div');
    codeBadge.className = 'fc-code';
    codeBadge.style.background = col;
    codeBadge.title = 'Click to rename code';
    codeBadge.onclick = () => t2RenameCode(i);
    if(f.customCode){
      const ci = document.createElement('input');
      ci.value = f.code;
      ci.style.cssText = 'color:#fff;background:transparent;border:none;outline:none;width:26px;font-family:var(--mono);font-size:10px;font-weight:700;text-align:center;';
      ci.onchange = e => t2SetCode(i, e.target.value);
      ci.onclick = e => e.stopPropagation();
      codeBadge.appendChild(ci);
    } else {
      codeBadge.textContent = f.code;
    }
    top.appendChild(codeBadge);

    // Field name
    const nameInp = document.createElement('input');
    nameInp.className = 'fc-name';
    nameInp.value = f.name;
    nameInp.placeholder = 'Field name';
    nameInp.onchange = e => t2FieldSet(i, 'name', e.target.value);
    if(f.required) nameInp.title = f.name + ' *';
    top.appendChild(nameInp);

    // Type selector — full labels with icons
    const typeSel = document.createElement('select');
    typeSel.className = 'fc-type';
    [
      ['text','📝 Text'],
      ['number','🔢 Number'],
      ['date','📅 Date'],
      ['dropdown','📋 Dropdown'],
      ['repeat','➕ Repeating'],
      ['formula','🧮 Formula']
    ].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if(f.type === val) opt.selected = true;
      typeSel.appendChild(opt);
    });
    typeSel.onchange = e => t2FieldSet(i, 'type', e.target.value);
    top.appendChild(typeSel);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'fc-actions';

    // Required toggle — asterisk icon
    const reqBtn = document.createElement('button');
    reqBtn.className = 'fc-btn ' + (f.required ? 'fc-req-on' : 'fc-req-off');
    reqBtn.textContent = '*';
    reqBtn.style.fontWeight = '900';
    reqBtn.style.fontSize = '16px';
    reqBtn.title = f.required ? 'Required — click to make optional' : 'Optional — click to make required';
    reqBtn.onclick = () => { t2Fields[i].required = !t2Fields[i].required; t2RenderBuilder(); };
    actions.appendChild(reqBtn);

    // Profile key — brain icon
    const keyBtn = document.createElement('button');
    keyBtn.className = 'fc-btn ' + (f.isProfileKey ? 'fc-key-on' : 'fc-key-off');
    keyBtn.textContent = '🧠';
    keyBtn.style.fontSize = '12px';
    keyBtn.title = f.isProfileKey
      ? 'Profile Key — AI learns layout from this field. Click to remove.'
      : 'Set as Profile Key — AI will learn field positions from this.';
    keyBtn.onclick = () => { t2Fields[i].isProfileKey = !t2Fields[i].isProfileKey; t2RenderBuilder(); };
    actions.appendChild(keyBtn);

    // Duplicate check — magnifying glass icon
    const dupBtn = document.createElement('button');
    dupBtn.className = 'fc-btn ' + (f.isUnique ? 'fc-duplicate-on' : 'fc-duplicate-off');
    dupBtn.textContent = '🔍';
    dupBtn.style.fontSize = '12px';
    dupBtn.title = f.isUnique
      ? 'Warn on duplicate — click to disable'
      : 'Check for duplicates — warn if same value exists';
    dupBtn.onclick = () => { t2Fields[i].isUnique = !t2Fields[i].isUnique; t2RenderBuilder(); };
    actions.appendChild(dupBtn);

    // Up arrow
    if(i > 0){
      const upBtn = document.createElement('button');
      upBtn.className = 'fc-btn';
      upBtn.textContent = '↑';
      upBtn.style.color = 'var(--muted)';
      upBtn.title = 'Move up';
      upBtn.onclick = () => {
        [t2Fields[i-1], t2Fields[i]] = [t2Fields[i], t2Fields[i-1]];
        t2RenderBuilder();
      };
      actions.appendChild(upBtn);
    }

    // Down arrow
    if(i < t2Fields.length - 1){
      const dnBtn = document.createElement('button');
      dnBtn.className = 'fc-btn';
      dnBtn.textContent = '↓';
      dnBtn.style.color = 'var(--muted)';
      dnBtn.title = 'Move down';
      dnBtn.onclick = () => {
        [t2Fields[i], t2Fields[i+1]] = [t2Fields[i+1], t2Fields[i]];
        t2RenderBuilder();
      };
      actions.appendChild(dnBtn);
    }

    // Delete — trash icon with confirmation
    const delBtn = document.createElement('button');
    delBtn.className = 'fc-btn fc-del';
    delBtn.textContent = '🗑';
    delBtn.style.fontSize = '12px';
    delBtn.title = 'Delete this field';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if(!confirm(`Delete field "${f.name}"?\n\nThis cannot be undone.`)) return;
      t2Fields.splice(i, 1);
      t2RenderBuilder();
    });
    actions.appendChild(delBtn);

    top.appendChild(actions);
    card.appendChild(top);



    // ── EXTRA SECTION (dropdown/repeat/formula) ──
    if(showOpts || showRepeat || showFormula){
      const extra = document.createElement('div');
      extra.className = 'fc-extra';

      if(showOpts){
        const label = document.createElement('div');
        label.style.cssText = 'font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-family:var(--mono);';
        label.textContent = 'Options (one per line)';
        extra.appendChild(label);
        const ta = document.createElement('textarea');
        ta.className = 'field-textarea';
        ta.placeholder = 'Option 1\nOption 2\nOption 3';
        ta.value = f.options || '';
        ta.rows = 3;
        ta.onchange = e => t2FieldSet(i, 'options', e.target.value);
        extra.appendChild(ta);
      }

      if(showRepeat){
        extra.innerHTML += t2RenderSubFields(f, i);
      }

      if(showFormula){
        const fLabel = document.createElement('div');
        fLabel.style.cssText = 'font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-family:var(--mono);';
        fLabel.textContent = 'Formula';
        extra.appendChild(fLabel);

        const fInp = document.createElement('input');
        fInp.className = 'field-inp-sm';
        fInp.id = `formula_inp_${i}`;
        fInp.placeholder = 'e.g. ={A}*{B} or =ROUND({C}*0.15,2)';
        fInp.value = f.formula || '';
        fInp.style.fontFamily = 'var(--mono)';
        fInp.oninput = e => {
          t2Fields[i].formula = e.target.value;
          t2ValidateFormula(e.target, e.target.value, i);
          setTimeout(t2AutoSave, 200);
        };
        extra.appendChild(fInp);

        const fStatus = document.createElement('div');
        fStatus.id = `formula_status_${i}`;
        fStatus.style.cssText = 'font-size:11px;font-family:var(--mono);min-height:16px;';
        extra.appendChild(fStatus);

        const fExamples = document.createElement('div');
        fExamples.style.cssText = 'font-size:10px;color:var(--muted);line-height:1.8;';
        fExamples.innerHTML = `
          <span style="color:var(--text);font-weight:600;">Examples:</span>
          <span class="formula-ex" onclick="t2SetFormula(${i},'={A}*{B}')">={A}*{B}</span>
          <span class="formula-ex" onclick="t2SetFormula(${i},'=ROUND({A}*0.15,2)')">VAT 15%</span>
          <span class="formula-ex" onclick="t2SetFormula(${i},'={A}+{B}+{C}')">Sum 3 fields</span>
          <span class="formula-ex" onclick="t2SetFormula(${i},'=IF({A}>100,&quot;High&quot;,&quot;Low&quot;)')">IF condition</span>
          <br><span style="color:var(--text);font-weight:600;">Functions:</span> ROUND · IF · SUM · AVERAGE · COUNT
        `;
        extra.appendChild(fExamples);

        if(f.formula) setTimeout(() => t2ValidateFormula(fInp, f.formula, i), 100);
      }

      card.appendChild(extra);
    }

    // ── DRAG DROP TARGET ──────────────────────
    card.addEventListener('dragover', e => {
      e.preventDefault();
      card.style.borderColor = 'var(--green)';
    });
    card.addEventListener('dragleave', () => {
      card.style.borderColor = '';
    });
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.style.borderColor = '';
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = i;
      if(fromIdx === toIdx) return;
      const moved = t2Fields.splice(fromIdx, 1)[0];
      t2Fields.splice(toIdx, 0, moved);
      t2RenderBuilder();
    });

    list.appendChild(card);
  });

  // Profile key summary
  const pkFields = t2Fields.filter(f => f.isProfileKey);
  const pkSum = document.createElement('div');
  pkSum.style.cssText = 'font-size:11px;color:var(--muted);padding:8px;background:var(--surface2);border-radius:6px;margin:4px 0;border-left:3px solid ' + (pkFields.length ? 'var(--warn)' : 'var(--border)') + ';';
  pkSum.innerHTML = pkFields.length
    ? '🧠 <b style="color:var(--text);">Profile Keys:</b> ' + pkFields.map(f => `<span style="background:${codeColor(f.code)};color:#fff;padding:1px 6px;border-radius:3px;font-family:var(--mono);font-size:10px;">${f.code}</span> ${f.name}`).join(' + ')
    : '☆ No Profile Keys set — click 🧠 on a field to enable AI layout learning';
  list.appendChild(pkSum);

  // Add field button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-field-btn';
  addBtn.textContent = '+ Add Field';
  addBtn.onclick = t2AddField;
  list.appendChild(addBtn);

  // Update all panels
  t2RenderFormPreview();
  t2RenderExcelPreview();

  setTimeout(t2AutoSave, 200);
}

function t2SetFormula(idx, formula) {
  t2Fields[idx].formula = formula;
  const inp = document.getElementById(`formula_inp_${idx}`);
  if(inp) { inp.value = formula; t2ValidateFormula(inp, formula, idx); }
  setTimeout(t2AutoSave, 200);
}


// Add dynamic styles for field card buttons + formula examples
(function(){
  const s = document.createElement('style');
  s.textContent = [
    '.formula-ex{color:var(--blue);cursor:pointer;margin-right:6px;font-family:var(--mono);font-size:10px;}',
    '.formula-ex:hover{text-decoration:underline;}',
    // Brain icon — profile key active state
    '.fc-key-on{color:#f59e0b !important;background:rgba(245,158,11,.15) !important;border-radius:4px;}',
    '.fc-key-off{color:var(--border);}',
    '.fc-key-off:hover{color:var(--muted);}',
    // Search icon — duplicate check active state
    '.fc-duplicate-on{color:#5b8df6 !important;background:rgba(91,141,246,.15) !important;border-radius:4px;}',
    '.fc-duplicate-off{color:var(--border);}',
    '.fc-duplicate-off:hover{color:var(--muted);}',
    // Duplicate warning on input
    '.duplicate-warning{border-color:var(--danger) !important;background:rgba(248,113,113,.06) !important;}',
  ].join('');
  document.head.appendChild(s);
})();

function switchBuilderTab(n) {
  // Tab 1: Fields + Form Preview (side by side)
  // Tab 2: Excel Preview
  const p1 = document.getElementById('bPanel1');
  const p1b = document.getElementById('bPanel1b'); // form preview
  const p2 = document.getElementById('bPanel2');
  const t1 = document.getElementById('bTab1');
  const t2 = document.getElementById('bTab2');

  if(n === 1) {
    if(p1) p1.style.display = 'flex';
    if(p1b) p1b.style.display = 'flex';
    if(p2) p2.style.display = 'none';
    if(t1) t1.classList.add('active');
    if(t2) t2.classList.remove('active');
  } else {
    if(p1) p1.style.display = 'none';
    if(p1b) p1b.style.display = 'none';
    if(p2) p2.style.display = 'flex';
    if(t1) t1.classList.remove('active');
    if(t2) t2.classList.add('active');
    t2RenderExcelPreview();
  }
}

function t2RenderFormPreview() {
  const prev = document.getElementById('t2Preview');
  if(!prev) return;
  prev.innerHTML = '';
  t2Fields.forEach(f => {
    const col = codeColor(f.code || 'A');
    const wrap = document.createElement('div');
    wrap.className = 'prev-field';
    const lbl = document.createElement('div');
    lbl.className = 'prev-field-lbl';
    const badges = [
      f.required    ? `<span style="color:var(--warn);font-weight:900;margin-left:3px;">*</span>` : '',
      f.isProfileKey ? `<span title="Profile Key — AI learns layout from this field" style="font-size:10px;margin-left:4px;opacity:.85;">🧠</span>` : '',
      f.isUnique     ? `<span title="Duplicate check enabled" style="font-size:10px;margin-left:2px;opacity:.85;">🔍</span>` : '',
    ].join('');
    lbl.innerHTML = `<span class="prev-field-code" style="background:${col};">${f.code}</span> ${f.name}${badges}`;
    wrap.appendChild(lbl);

    if(f.type === 'dropdown'){
      const opts = (f.options||'').split('\n').filter(Boolean);
      const sel = document.createElement('select');
      sel.className = 'prev-inp';
      sel.innerHTML = '<option>— Select —</option>' + opts.map(o=>`<option>${o}</option>`).join('');
      wrap.appendChild(sel);
    } else if(f.type === 'formula'){
      const div = document.createElement('div');
      div.className = 'prev-inp';
      div.style.cssText = 'color:var(--blue);font-family:var(--mono);font-size:11px;';
      div.textContent = f.formula || '=formula';
      wrap.appendChild(div);
    } else if(f.type === 'repeat'){
      const subs = f.subFields || [];
      const div = document.createElement('div');
      div.style.cssText = 'font-size:11px;color:var(--muted);';
      div.innerHTML = 'Repeating: ' + (subs.map(sf => `<span style="background:${codeColor(sf.code||'A')};color:#fff;padding:1px 5px;border-radius:3px;font-size:10px;font-family:var(--mono);">${sf.code}</span> ${sf.name}`).join(' · ') || 'add sub-fields');
      wrap.appendChild(div);
    } else {
      const inp = document.createElement('input');
      inp.className = 'prev-inp';
      inp.type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
      inp.placeholder = f.name;
      wrap.appendChild(inp);
    }
    prev.appendChild(wrap);
  });
}

function t2RenderExcelPreview() {
  const wrap = document.getElementById('t2ExcelPreview');
  if (!wrap) return;

  // No fields yet — nothing to show
  if (!t2Fields.length) {
    wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">Add fields to see the Excel structure.</div>';
    return;
  }

  const internalHeaders = ['Source File', 'Timestamp', 'Saved As'];
  const userHeaders = t2Fields.map(f => f.name);
  const headers = [...internalHeaders, ...userHeaders];

  let html = '<table class="excel-preview-table">';
  html += '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
  html += '<tbody>';

  if (!t2Entries.length) {
    // Show placeholder row so column structure is visible immediately
    html += '<tr>' + headers.map(() => `<td style="color:var(--border);font-size:11px;font-family:var(--mono);">—</td>`).join('') + '</tr>';
    html += `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--muted);font-size:11px;padding:14px 12px;border:none;font-style:italic;">Entries will appear here as you save them</td></tr>`;
  } else {
    t2Entries.forEach(entry => {
      html += '<tr>';
      html += `<td>${entry._file || '—'}</td>`;
      html += `<td>${entry._timestamp || '—'}</td>`;
      html += `<td>${entry._savedAs || '—'}</td>`;
      userHeaders.forEach(h => {
        html += `<td>${entry[h] || ''}</td>`;
      });
      html += '</tr>';
    });
  }

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function t2RenderSubFields(f,fi){
  let html=`<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Sub-fields (columns in each row):</div>`;
  (f.subFields||[]).forEach((sf,si)=>{
    const col=codeColor(sf.code||'A');
    html+=`<div class="sub-field-row">
      <span class="sub-code" style="background:${col};">${sf.code||'?'}</span>
      <input style="background:transparent;border:none;color:var(--text);font-size:11px;outline:none;flex:1;" value="${sf.name}" onchange="t2SubFieldName(${fi},${si},this.value)" placeholder="Sub-field name">
      <button style="background:none;border:none;color:var(--border);cursor:pointer;font-size:12px;" onclick="t2DelSubField(${fi},${si})">×</button>
    </div>`;
  });
  html+=`<button class="add-field-btn" style="margin-top:4px;padding:5px;" onclick="t2AddSubField(${fi})">+ Sub-field</button>`;
  return html;
}

function t2FieldSet(i,k,v){t2Fields[i][k]=v;t2RenderBuilder();}
function t2DelField(i){t2Fields.splice(i,1);t2RenderBuilder();}
function t2AddField(){t2Fields.push({id:'f'+Date.now(),name:'New Field',type:'text',options:'',formula:'',required:false,subFields:[],customCode:false});assignCodes(t2Fields);t2RenderBuilder();}
function t2AddSubField(fi){if(!t2Fields[fi].subFields)t2Fields[fi].subFields=[];t2Fields[fi].subFields.push({name:'Sub '+( t2Fields[fi].subFields.length+1),customCode:false});assignCodes(t2Fields);t2RenderBuilder();}
function t2DelSubField(fi,si){t2Fields[fi].subFields.splice(si,1);assignCodes(t2Fields);t2RenderBuilder();}
function t2SubFieldName(fi,si,v){t2Fields[fi].subFields[si].name=v;t2RenderBuilder();}

function t2ValidateFormula(inp, formula, fieldIdx) {
  const statusEl = document.getElementById('formula_status_' + fieldIdx);
  if (!statusEl) return;
  if (!formula || formula === '=') {
    statusEl.textContent = '';
    inp.style.borderColor = 'var(--border)';
    return;
  }
  if (!formula.startsWith('=')) {
    statusEl.innerHTML = '<span style="color:var(--danger);">❌ Formula must start with =</span>';
    inp.style.borderColor = 'var(--danger)';
    return;
  }
  // Test with dummy values
  try {
    const dummyFields = t2Fields.map(f => ({ ...f }));
    const getVal = (id) => '10'; // dummy value
    const getRepeat = (code) => ['10'];
    evalFormula(formula, dummyFields, getVal, getRepeat);
    statusEl.innerHTML = '<span style="color:var(--green);">✅ Valid formula</span>';
    inp.style.borderColor = 'var(--green)';
  } catch(e) {
    statusEl.innerHTML = `<span style="color:var(--warn);">⚠️ ${e.message||'Check formula syntax'}</span>`;
    inp.style.borderColor = 'var(--warn)';
  }
}

function t2RenameCode(i){t2Fields[i].customCode=!t2Fields[i].customCode;t2RenderBuilder();}
function t2SetCode(i,v){t2Fields[i].code=v.toUpperCase();t2Fields[i].customCode=true;t2RenderBuilder();}

// ────────────────────────────────────────────────────
// FORMULA ENGINE
// ────────────────────────────────────────────────────
function evalFormula(expr,fields,getVal,getRepeatVals){
  if(!expr||!expr.startsWith('='))return expr;
  let e=expr.slice(1).trim();

  // Replace field references {Code} or {Name}
  fields.forEach(f=>{
    const v=parseFloat(getVal(f.id))||0;
    e=e.replace(new RegExp(`\\{${f.code}\\}`,'g'),v);
    e=e.replace(new RegExp(`\\{${f.name}\\}`,'gi'),v);
  });

  // SUM({Code}) — sum repeat sub-field
  e=e.replace(/SUM\(\{([^}]+)\}\)/gi,(m,code)=>{
    const vals=getRepeatVals(code);
    return vals.reduce((a,b)=>a+(parseFloat(b)||0),0);
  });
  // AVERAGE
  e=e.replace(/AVERAGE\(\{([^}]+)\}\)/gi,(m,code)=>{
    const vals=getRepeatVals(code);
    if(!vals.length)return 0;
    return vals.reduce((a,b)=>a+(parseFloat(b)||0),0)/vals.length;
  });
  // COUNT
  e=e.replace(/COUNT\(\{([^}]+)\}\)/gi,(m,code)=>{
    return getRepeatVals(code).filter(v=>v!=='').length;
  });
  // ROUND(x,n)
  e=e.replace(/ROUND\(([^,]+),([^)]+)\)/gi,(m,x,n)=>{
    try{const xv=Function('"use strict";return ('+x+')')();return Math.round(xv*Math.pow(10,+n))/Math.pow(10,+n);}catch(err){return 0;}
  });
  // ROUNDUP
  e=e.replace(/ROUNDUP\(([^,]+),([^)]+)\)/gi,(m,x,n)=>{
    try{const xv=Function('"use strict";return ('+x+')')();const f=Math.pow(10,+n);return Math.ceil(xv*f)/f;}catch(err){return 0;}
  });
  // ROUNDDOWN
  e=e.replace(/ROUNDDOWN\(([^,]+),([^)]+)\)/gi,(m,x,n)=>{
    try{const xv=Function('"use strict";return ('+x+')')();const f=Math.pow(10,+n);return Math.floor(xv*f)/f;}catch(err){return 0;}
  });
  // IF(cond,true,false)
  e=e.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi,(m,cond,t,f)=>{
    try{const cv=Function('"use strict";return ('+cond+')')();return cv?t:f;}catch(err){return 0;}
  });

  try{
    const result=Function('"use strict";return ('+e+')')();
    return isNaN(result)||result===Infinity?'#ERR':Math.round(result*1e6)/1e6;
  }catch(err){return '#ERR';}
}

function t2CheckDuplicate(fieldId, value, currentEntryIndex) {
  if (!value || value.trim() === '') return null;
  const f = t2Fields.find(f => f.id === fieldId);
  if (!f || !f.isUnique) return null;
  const duplicateEntry = t2Entries.find((entry, idx) => {
    // Skip the current entry if we're editing (for future use)
    if (currentEntryIndex !== undefined && idx === currentEntryIndex) return false;
    return entry[f.name] === value;
  });
  if (duplicateEntry) {
    const entryIndex = t2Entries.indexOf(duplicateEntry) + 1;
    return entryIndex;
  }
  return null;
}

function t2GetFieldVal(fieldId){
  const el=document.getElementById('dei_'+fieldId);
  if(!el)return '';
  return el.tagName==='SELECT'?el.value:el.value||'';
}

function t2GetRepeatVals(code){
  // Find sub-field with this code across all repeat groups
  const vals=[];
  t2Fields.forEach(f=>{
    if(f.type==='repeat'&&f.subFields){
      f.subFields.forEach((sf,si)=>{
        if(sf.code===code.toUpperCase()){
          const rows=t2RepeatData[f.id]||[{}];
          rows.forEach((_,ri)=>{
            const inp=document.getElementById(`rei_${f.id}_${ri}_${si}`);
            if(inp)vals.push(inp.value);
          });
        }
      });
    }
  });
  return vals;
}

function t2UpdateFormulas(){
  t2Fields.filter(f=>f.type==='formula').forEach(f=>{
    const el=document.getElementById('dei_'+f.id);
    if(!el)return;
    const result=evalFormula(f.formula,t2Fields,t2GetFieldVal,t2GetRepeatVals);
    el.textContent=result;
  });
  t2UpdateEntryFilename();
}

// ────────────────────────────────────────────────────
// FILE NAMING
// ────────────────────────────────────────────────────
function t2BuildFilename(override){
  const pattern=override||t2NamingPatternOverride||document.getElementById('t2NamingPattern')?.value||'{A}';
  let name=pattern;
  const warnings=[];

  // Replace {Code} with field values
  t2Fields.forEach(f=>{
    const regex=new RegExp(`\\{${f.code}\\}`,'g');
    if(regex.test(name)){
      const val=t2GetFieldVal(f.id)||'';
      if(!val)warnings.push(f.code+' ('+f.name+')');
      name=name.replace(new RegExp(`\\{${f.code}\\}`,'g'),val);
    }
    // Also support {FieldName}
    name=name.replace(new RegExp(`\\{${f.name}\\}`,'gi'),t2GetFieldVal(f.id)||'');
  });

  // Remove empty segments
  name=name.replace(/-+/g,'-').replace(/^-|-$/g,'');
  return{name:sanitize(name)||'document',warnings};
}

function t2UpdateEntryFilename(){
  const{name,warnings}=t2BuildFilename();
  const valEl=document.getElementById('t2EntryFnameVal');
  const warnEl=document.getElementById('t2FnameWarn');
  if(valEl)valEl.textContent=name+'.jpg';
  if(warnEl){
    if(warnings.length){warnEl.textContent=`⚠ Empty: ${warnings.join(', ')}`;warnEl.style.display='inline';}
    else warnEl.style.display='none';
  }
}

function t2EditFname(){
  const current=document.getElementById('t2EntryFnameVal').textContent.replace('.jpg','');
  const newName=prompt('Edit filename for this entry:',current);
  if(newName!==null){
    t2NamingPatternOverride=newName;
    document.getElementById('t2EntryFnameVal').textContent=sanitize(newName)+'.jpg';
    document.getElementById('t2FnameWarn').style.display='none';
  }
}

// ────────────────────────────────────────────────────
// DATA ENTRY
// ────────────────────────────────────────────────────
async function t2StartEntry(){
  if(t2Fields.length===0){alert('Add at least one field.');return;}
  ['t2Setup','t2Builder','t2Work','t2Done'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('t2Work').style.display='flex';
  document.getElementById('t2StripWrap').style.display='block';
  t2AutoSave();
  t2RenderForm();

  v2.s.onOCR=(text)=>{
    if(!t2ActiveFieldId)return;
    t2FillField(t2ActiveFieldId,text.trim());
  };
  v2.attachEvents('de');
}

function t2RenderForm(){
  const container=document.getElementById('t2Form');
  container.innerHTML='';
  assignCodes(t2Fields);
  t2Fields.forEach(f=>{
    const col=codeColor(f.code||'A');
    const wrap=document.createElement('div');wrap.className='de-wrap';wrap.dataset.fid=f.id;

    // Label with code badge
    const lbl=document.createElement('div');
    lbl.className='de-lbl';lbl.dataset.fid=f.id;
    lbl.innerHTML=`<span class="de-code" style="background:${col};">${f.code}</span>${f.name}${f.required?'<span style="color:var(--danger)"> *</span>':''}<span class="de-ocr-tag">OCR</span>`;
    if(f.type!=='formula')lbl.onclick=()=>t2ActivateField(f.id);
    wrap.appendChild(lbl);

    if(f.type==='dropdown'){
      const sel=document.createElement('select');sel.className='de-sel';sel.id='dei_'+f.id;
      const opts=f.options.split('\n').filter(Boolean);
      sel.innerHTML=`<option value="">— Select —</option>${opts.map(o=>`<option>${o.trim()}</option>`).join('')}`;
      sel.onchange=()=>t2UpdateFormulas();
      wrap.appendChild(sel);
    } else if(f.type==='formula'){
      const div=document.createElement('div');div.className='de-formula';div.id='dei_'+f.id;div.textContent='—';
      wrap.appendChild(div);
    } else if(f.type==='repeat'){
      if(!t2RepeatData[f.id])t2RepeatData[f.id]=[{}];
      const grp=document.createElement('div');grp.className='repeat-grp';grp.id='grp_'+f.id;
      const hdr=document.createElement('div');hdr.className='repeat-grp-hdr';
      hdr.innerHTML=`<span class="de-code" style="background:${col};">${f.code}</span> ${f.name}`;
      grp.appendChild(hdr);
      const rowsWrap=document.createElement('div');rowsWrap.id='rows_'+f.id;
      t2RepeatData[f.id].forEach((_,ri)=>rowsWrap.appendChild(t2MakeRepeatRow(f,ri)));
      grp.appendChild(rowsWrap);
      const addBtn=document.createElement('button');addBtn.className='add-repeat-btn';addBtn.textContent='+ Add Row';
      addBtn.onclick=()=>{t2RepeatData[f.id].push({});const rw=document.getElementById('rows_'+f.id);rw.appendChild(t2MakeRepeatRow(f,t2RepeatData[f.id].length-1));t2UpdateFormulas();};
      grp.appendChild(addBtn);
      wrap.appendChild(grp);
    } else {
      const inp=document.createElement('input');inp.className='de-inp';inp.id='dei_'+f.id;
      inp.type=f.type==='number'?'number':f.type==='date'?'date':'text';inp.placeholder=f.name;
      inp.oninput=()=>{t2UpdateFormulas();t2UpdateEntryFilename();};
      if(f.isUnique){
        inp.classList.add('unique-field');
        inp.addEventListener('input',function(){
          const duplicateEntryIndex=t2CheckDuplicate(f.id,this.value);
          if(duplicateEntryIndex){
            this.classList.add('duplicate-warning');
            this.title=`⚠️ Duplicate of entry #${duplicateEntryIndex}`;
          }else{
            this.classList.remove('duplicate-warning');
            this.title='';
          }
        });
        setTimeout(()=>{
          const duplicateEntryIndex=t2CheckDuplicate(f.id,inp.value);
          if(duplicateEntryIndex){
            inp.classList.add('duplicate-warning');
            inp.title=`⚠️ Duplicate of entry #${duplicateEntryIndex}`;
          }
        },10);
      }
      wrap.appendChild(inp);
    }
    container.appendChild(wrap);
  });

  document.getElementById('t2EntryFname').style.display='flex';
  t2UpdateFormulas();
}

function t2MakeRepeatRow(f,ri){
  const subs=f.subFields||[];
  const row=document.createElement('div');row.className='repeat-row';
  row.style.gridTemplateColumns=`repeat(${subs.length},1fr) 24px`;
  subs.forEach((sf,si)=>{
    const col=codeColor(sf.code||'A');
    const inp=document.createElement('input');
    inp.className='de-inp';inp.id=`rei_${f.id}_${ri}_${si}`;
    inp.placeholder=`${sf.code} ${sf.name}`;
    inp.title=sf.name;
    inp.style.cssText=`border-left:3px solid ${col};font-size:11px;`;
    inp.oninput=()=>t2UpdateFormulas();
    // Click sub-field label to activate OCR
    inp.onfocus=()=>{
      t2ActiveFieldId=`rei_${f.id}_${ri}_${si}`;
      document.getElementById('t2Hint').textContent=`✏️ Active: ${sf.code} ${sf.name} — draw box on image`;
    };
    row.appendChild(inp);
  });
  const del=document.createElement('button');del.className='del-row-btn';del.textContent='×';
  del.onclick=()=>{
    if(t2RepeatData[f.id].length<=1)return;
    t2RepeatData[f.id].splice(ri,1);
    const rw=document.getElementById('rows_'+f.id);
    rw.innerHTML='';
    t2RepeatData[f.id].forEach((_,i)=>rw.appendChild(t2MakeRepeatRow(f,i)));
    t2UpdateFormulas();
  };
  row.appendChild(del);
  return row;
}

function t2ActivateField(id){
  t2ActiveFieldId=id;
  t2NamingPatternOverride=null;
  document.querySelectorAll('.de-lbl').forEach(l=>l.classList.toggle('active',l.dataset.fid===id));
  document.querySelectorAll('.de-inp').forEach(inp=>inp.classList.toggle('active',inp.id==='dei_'+id));
  const f=t2Fields.find(f=>f.id===id);
  document.getElementById('t2Hint').textContent=`✏️ Active field: [${f?.code}] ${f?.name} — draw a box on the image`;
  v2.resetSel();
}

function t2FillField(id,text){
  // Handle repeat sub-field (id starts with 'rei_')
  if(id.startsWith('rei_')){
    const inp=document.getElementById(id);
    if(inp){inp.value=text.split('\n')[0].trim();t2UpdateFormulas();}
    return;
  }
  const f=t2Fields.find(x=>x.id===id);if(!f)return;
  if(f.type==='dropdown'){
    const sel=document.getElementById('dei_'+id);if(!sel)return;
    const opts=Array.from(sel.options);
    const match=opts.find(o=>o.text.toLowerCase().includes(text.toLowerCase().split('\n')[0].trim().substring(0,10)));
    if(match)sel.value=match.value;
    t2UpdateFormulas();
  } else {
    const el=document.getElementById('dei_'+id);
    if(el){
      const first=text.split('\n')[0].trim();
      el.value=f.type==='number'?first.replace(/[^\d.,-]/g,''):first;
      t2UpdateFormulas();t2UpdateEntryFilename();
    }
  }
  // Auto-advance to next non-formula field
  const idx=t2Fields.findIndex(f=>f.id===id);
  if(idx>=0&&idx<t2Fields.length-1){
    const next=t2Fields.slice(idx+1).find(f=>f.type!=='formula'&&f.type!=='repeat');
    if(next)t2ActivateField(next.id);
  }
}

function t2ClearForm(){
  t2Fields.forEach(f=>{
    const el=document.getElementById('dei_'+f.id);
    if(el){if(el.tagName==='SELECT')el.selectedIndex=0;else if(el.tagName==='INPUT')el.value='';else el.textContent='—';}
  });
  Object.keys(t2RepeatData).forEach(id=>{t2RepeatData[id]=[{}];});
  t2NamingPatternOverride=null;
  t2RenderForm();
  t2ActiveFieldId=null;
  document.getElementById('t2Hint').textContent='💡 Click a field label to activate, then draw a box on the image';
}

async function t2SaveEntry(){
  // Validate required
  let valid=true;
  t2Fields.forEach(f=>{
    if(f.required&&f.type!=='formula'&&f.type!=='repeat'){
      const el=document.getElementById('dei_'+f.id);
      const val=el?(el.tagName==='SELECT'?el.value:el.value):'';
      if(!val){valid=false;if(el)el.style.borderColor='var(--danger)';}
    }
  });
  if(!valid){alert('Please fill required fields (*).');return;}

  // Duplicate check for fields marked isUnique
  for (const f of t2Fields) {
    if (f.isUnique && f.type !== 'formula' && f.type !== 'repeat') {
      const currentVal = t2GetFieldVal(f.id);
      if (currentVal && currentVal.trim() !== '') {
        const duplicateEntry = t2Entries.find(entry => entry[f.name] === currentVal);
        if (duplicateEntry) {
          const entryIndex = t2Entries.indexOf(duplicateEntry) + 1;
          const confirmMsg = `⚠️ Duplicate value found for "${f.name}": "${currentVal}"\nThis already exists in entry #${entryIndex}.\n\nSave anyway?`;
          if (!confirm(confirmMsg)) {
            return; // Cancel save
          }
          break; // Only warn once per save
        }
      }
    }
  }

  const{name,warnings}=t2BuildFilename();
  const row={_file:t2Files[t2ActiveFile]?.name||'—',_timestamp:new Date().toLocaleString(),_savedAs:name+'.jpg'};

  // Collect field values
  t2Fields.forEach(f=>{
    if(f.type==='formula'){
      const el=document.getElementById('dei_'+f.id);row[f.name]=el?el.textContent:'';
    } else if(f.type==='repeat'){
      const subs=f.subFields||[];
      const rows=[];
      (t2RepeatData[f.id]||[{}]).forEach((_,ri)=>{
        const rrow={};
        subs.forEach((sf,si)=>{const inp=document.getElementById(`rei_${f.id}_${ri}_${si}`);rrow[sf.name]=inp?inp.value:'';});
        if(Object.values(rrow).some(v=>v))rows.push(rrow);
      });
      row[f.name]=JSON.stringify(rows);
    } else {
      const el=document.getElementById('dei_'+f.id);
      row[f.name]=el?(el.tagName==='SELECT'?el.value:el.value):'';
    }
  });
  t2Entries.push(row);

  // Refresh Excel preview with real data
  t2RenderExcelPreview();

  // Save renamed file
  if(v2.s.blob){
    const blob=await v2.buildRotBlob();
    await saveBlob(blob,name+'.jpg');
  }

  // Mark strip thumb done
  const thumb=document.getElementById('st_'+t2ActiveFile);
  if(thumb)thumb.classList.add('done');

  const btn=document.getElementById('t2SaveBtn');
  btn.textContent=`✔ Saved! (${t2Entries.length})`;
  setTimeout(()=>btn.textContent='✔ Save Entry',1500);

  t2ClearForm();

  // Move to next undone
  const next=t2Files.findIndex((_,i)=>i>t2ActiveFile&&!document.getElementById('st_'+i)?.classList.contains('done'));
  if(next!==-1)t2LoadInViewer(next);
}

function t2Finish(){
  if(t2Entries.length===0&&!confirm('No entries yet. Export empty file?'))return;
  document.getElementById('t2Work').style.display='none';
  document.getElementById('t2Done').style.display='flex';
  document.getElementById('t2ExportPanel').style.display='none';
  t2RenderReviewTable();
}

function t2RenderReviewTable(){
  const wrap = document.getElementById('t2ReviewTableWrap');
  const count = document.getElementById('t2ReviewCount');
  if(!wrap) return;

  const n = t2Entries.length;
  if(count) count.textContent = n + ' entr' + (n===1?'y':'ies');

  if(!n){
    wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">No entries yet.</div>';
    return;
  }

  // Build headers — skip internal fields
  const skip = ['_file','_timestamp','_savedAs'];
  const headers = t2Fields.map(f=>f.name);

  const table = document.createElement('table');
  table.className = 't2-review-table';

  // Header row
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  hrow.innerHTML = '<th>#</th><th>Source File</th>' +
    headers.map(h=>`<th>${h}</th>`).join('') +
    '<th>Actions</th>';
  thead.appendChild(hrow);
  table.appendChild(thead);

  // Body rows
  const tbody = document.createElement('tbody');
  t2Entries.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="color:var(--muted);font-family:var(--mono);">${idx+1}</td>`;
    cells += `<td style="color:var(--muted);font-size:11px;" title="${entry._file||''}">${(entry._file||'—').slice(0,20)}</td>`;

    headers.forEach(h => {
      const val = entry[h] || '';
      cells += `<td class="editable" title="${val}" onclick="t2EditCell(this, ${idx}, '${h.replace(/'/g,"\'")}')">
        ${val || '<span style="color:var(--border);">—</span>'}
      </td>`;
    });

    cells += `<td>
      <button onclick="t2DeleteEntry(${idx})" style="background:none;border:1px solid var(--border);color:var(--danger);font-size:10px;padding:2px 7px;border-radius:4px;cursor:pointer;transition:all .15s;" onmouseover="this.style.background='var(--danger)';this.style.color='#fff'" onmouseout="this.style.background='none';this.style.color='var(--danger)'">Delete</button>
    </td>`;

    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  wrap.innerHTML = '';
  wrap.appendChild(table);
}

function t2EditCell(td, entryIdx, fieldName){
  const current = t2Entries[entryIdx][fieldName] || '';
  const input = document.createElement('input');
  input.className = 'cell-edit';
  input.value = current;
  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  input.select();

  function save(){
    t2Entries[entryIdx][fieldName] = input.value;
    td.innerHTML = input.value || '<span style="color:var(--border);">—</span>';
    td.onclick = () => t2EditCell(td, entryIdx, fieldName);
  }
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if(e.key === 'Enter') { e.preventDefault(); save(); }
    if(e.key === 'Escape') { td.innerHTML = current || '<span style="color:var(--border);">—</span>'; td.onclick = () => t2EditCell(td, entryIdx, fieldName); }
  });
}

function t2DeleteEntry(idx){
  if(!confirm(`Delete entry ${idx+1}?\nThis cannot be undone.`)) return;
  t2Entries.splice(idx, 1);
  t2RenderReviewTable();
}

function t2ShowExportPanel(){
  const wrap = document.getElementById('t2ReviewTableWrap');
  const panel = document.getElementById('t2ExportPanel');
  const summary = document.getElementById('t2ExportSummary');
  if(wrap) wrap.style.display='none';
  if(panel) panel.style.display='flex';
  if(summary) summary.textContent = `${t2Entries.length} entries · ${t2Fields.length} fields ready to export`;
}

function t2BackToReview(){
  const wrap = document.getElementById('t2ReviewTableWrap');
  const panel = document.getElementById('t2ExportPanel');
  if(wrap) wrap.style.display='block';
  if(panel) panel.style.display='none';
}

function t2Continue(){document.getElementById('t2Done').style.display='none';document.getElementById('t2Work').style.display='flex';}

function t2ExportFresh(){
  const headers=['Source File','Timestamp','Saved As',...t2Fields.map(f=>f.name)];
  const rows=[headers,...t2Entries.map(e=>headers.map(h=>e[h]||''))];
  const ws=XLSX.utils.aoa_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Data');
  XLSX.writeFile(wb,'docuops_data.xlsx');
}

async function t2ExportAppend(){
  if(!t2TemplateFile){t2ExportFresh();return;}
  const data=await t2TemplateFile.arrayBuffer();
  const wb=XLSX.read(data);
  const ws=wb.Sheets[wb.SheetNames[0]];
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  let lastRow=range.e.r+1;
  const headers=[];
  for(let c=range.s.c;c<=range.e.c;c++){
    const cell=ws[XLSX.utils.encode_cell({r:range.s.r,c})];
    headers.push(cell?String(cell.v):'');
  }
  t2Entries.forEach(entry=>{
    headers.forEach((h,c)=>{
      if(entry[h]!==undefined)
        ws[XLSX.utils.encode_cell({r:lastRow,c})]={v:entry[h],t:'s'};
    });
    lastRow++;
  });
  ws['!ref']=XLSX.utils.encode_range({s:{r:range.s.r,c:range.s.c},e:{r:lastRow-1,c:range.e.c}});
  XLSX.writeFile(wb,'docuops_data_appended.xlsx');
}

// Unified export prompt — called from Export button in Done screen
function t2ExportPrompt(){
  const panel=document.getElementById('t2ExportPanel');
  const wrap=document.getElementById('t2ReviewTableWrap');
  if(wrap) wrap.style.display='none';
  if(panel) panel.style.display='flex';
  // Update summary
  const summary=document.getElementById('t2ExportSummary');
  if(summary) summary.textContent=`${t2Entries.length} entr${t2Entries.length===1?'y':'ies'} · ${t2Fields.length} fields`;
  // Show/hide append button based on whether a template file was loaded
  const appendBtn=document.getElementById('t2ExportAppendBtn');
  if(appendBtn) appendBtn.style.display=t2TemplateFile?'inline-flex':'none';
}

// Image strip
function t2PromptFiles(){
  const inp=document.createElement('input');inp.type='file';inp.multiple=true;
  inp.accept='.jpg,.jpeg,.png,.webp,.bmp,.gif,.pdf,.mp4';
  inp.onchange=async e=>{
    const files=Array.from(e.target.files).filter(f=>ACCEPT.test(f.name));
    if(!files.length)return;
    t2Files=files;t2ActiveFile=0;
    await t2BuildStrip();
    await t2LoadInViewer(0);
  };
  inp.click();
}

async function t2BuildStrip(){
  const strip=document.getElementById('t2Strip');strip.innerHTML='';
  for(let i=0;i<t2Files.length;i++){
    const file=t2Files[i];const ft=getFileType(file.name);
    const th=document.createElement('div');th.className='s-thumb';th.id='st_'+i;th.onclick=()=>t2LoadInViewer(i);
    const dn=document.createElement('div');dn.className='s-done';dn.textContent='✓';th.appendChild(dn);
    const lb=document.createElement('div');lb.className='s-lbl';lb.textContent=file.name;th.appendChild(lb);
    if(ft==='mp4'||ft==='pdf'){
      const ic=document.createElement('div');ic.style.cssText='display:flex;align-items:center;justify-content:center;height:56px;font-size:22px;';
      ic.textContent=ft==='mp4'?'🎬':'📄';th.insertBefore(ic,dn);
    } else {
      const img=document.createElement('img');img.src=URL.createObjectURL(file);img.style.cssText='width:100%;height:70px;object-fit:cover;';
      th.insertBefore(img,dn);
    }
    strip.appendChild(th);
  }
}

async function t2LoadInViewer(i){
  // Guard: check for unsaved form data before switching (defined in defensive.js)
  if(typeof _t2SwitchGuard === 'function' && !_t2SwitchGuard(i)) return;
  t2ActiveFile=i;
  document.querySelectorAll('.s-thumb').forEach((t,idx)=>t.classList.toggle('active',idx===i));
  const file=t2Files[i];const ft=getFileType(file.name);const tb=getTypeBadge(ft);
  document.getElementById('t2FName').textContent=file.name;
  const ftb=document.getElementById('t2FType');ftb.textContent=tb.label;ftb.className='file-type-badge '+tb.cls;
  v2.reset();
  if(ft==='pdf')await v2.loadPDF(file);
  else if(ft==='mp4')await v2.loadVideo(file);
  else await v2.loadImg(file);
}

function t2SaveProject() {
  if(t2Fields.length===0){alert('No fields to save.');return;}
  const project = {
    version: 2,
    savedAt: new Date().toLocaleString(),
    fields: t2Fields,
    namingPattern: document.getElementById('t2NamingPattern')?.value||'{A}',
    entries: t2Entries
  };
  // Save project JSON — local only, never synced to DB
  const blob = new Blob([JSON.stringify(project,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'docuops_project.json';
  a.click();
  URL.revokeObjectURL(a.href);

  // Also bundle Excel if there are entries
  if(t2Entries.length>0){
    setTimeout(()=>{
      const headers=['Source File','Timestamp','Saved As',...t2Fields.map(f=>f.name)];
      const rows=[headers,...t2Entries.map(e=>headers.map(h=>e[h]||''))];
      const ws=XLSX.utils.aoa_to_sheet(rows);
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,'Data');
      XLSX.writeFile(wb,'docuops_project_data.xlsx');
    },400);
  }
}

function t2LoadProject() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const project = JSON.parse(text);
      // Basic validation
      if (!project.fields || !project.entries) {
        alert('Invalid project file: missing fields or entries.');
        return;
      }
      // Confirm replacement
      if (!confirm('Replace current work with loaded project?\nAny unsaved changes will be lost.')) return;
      // Restore state
      t2Fields = project.fields;
      if (project.namingPattern) {
        const np = document.getElementById('t2NamingPattern');
        if (np) np.value = project.namingPattern;
      }
      t2Entries = project.entries;
      // Refresh UI – go to builder (or you can go to work area)
      t2ShowBuilder();
      t2RenderBuilder();
      t2RenderExcelPreview();
      alert(`Project loaded: ${t2Entries.length} entries.`);
    } catch (err) {
      alert('Error loading project: ' + err.message);
    }
  };
  inp.click();
}

// T2 keyboard
document.addEventListener('keydown',e=>{
  if(document.getElementById('t2Work').style.display==='none')return;
  if(e.key==='['||e.key==='{')v2.rotate(-90);
  if(e.key===']'||e.key==='}')v2.rotate(90);
  if(e.key==='ArrowLeft')t2LoadInViewer(Math.max(0,t2ActiveFile-1));
  if(e.key==='ArrowRight')t2LoadInViewer(Math.min(t2Files.length-1,t2ActiveFile+1));
});


