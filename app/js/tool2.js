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

function t2ShowSetup(){
  ['t2Setup','t2Builder','t2Work','t2Done'].forEach(id=>{
    const el=document.getElementById(id);
    el.style.display=id==='t2Setup'?'flex':'none';
  });
  // Check for auto-saved template
  const saved=localStorage.getItem(T2_AUTOSAVE_KEY);
  if(saved){
    try{
      const d=JSON.parse(saved);
      document.getElementById('t2TmplName').textContent=`Auto-saved: ${d.savedAt||''}`;
      document.getElementById('t2TmplName').style.display='inline';
    }catch(e){}
  }
}

// Template persistence
function t2SaveTemplate(){
  if(t2Fields.length===0){alert('No fields to save.');return;}
  const data={
    fields:t2Fields,
    namingPattern:document.getElementById('t2NamingPattern')?.value||'{A}',
    savedAt:new Date().toLocaleString()
  };
  // Auto-save to localStorage
  localStorage.setItem(T2_AUTOSAVE_KEY,JSON.stringify(data));
  // Export as JSON file
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='ocr_template.json';a.click();
  alert('Template saved!\n\nAlso auto-saved in your browser for next time.');
}

function t2LoadTemplateFile(){
  document.getElementById('t2TmplLoadIn').click();
}
document.getElementById('t2TmplLoadIn').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const text=await file.text();
    const data=JSON.parse(text);
    t2Fields=data.fields||[];
    t2ShowBuilder();
    if(data.namingPattern){
      const np=document.getElementById('t2NamingPattern');
      if(np)np.value=data.namingPattern;
    }
    alert('Template loaded successfully!');
  }catch(ex){alert('Error loading template: '+ex.message);}
});

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
document.getElementById('t2TmplIn').addEventListener('change',async e=>{
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

function t2BuildManual(){
  t2Fields=[{id:'f0',name:'Field 1',type:'text',options:'',formula:'',required:false,subFields:[],customCode:false}];
  assignCodes(t2Fields);
  t2ShowBuilder();
}

function t2ShowBuilder(){
  ['t2Setup','t2Builder','t2Work','t2Done'].forEach(id=>{
    document.getElementById(id).style.display=id==='t2Builder'?'flex':'none';
  });
  // Auto-save on builder open
  t2AutoSave();
  t2RenderBuilder();
}

function t2AutoSave(){
  if(t2Fields.length===0)return;
  const np=document.getElementById('t2NamingPattern');
  const data={fields:t2Fields,namingPattern:np?np.value:'{A}',savedAt:new Date().toLocaleString()};
  localStorage.setItem(T2_AUTOSAVE_KEY,JSON.stringify(data));
}

function t2RenderBuilder(){
  assignCodes(t2Fields);
  const list=document.getElementById('t2FieldList');
  const prev=document.getElementById('t2Preview');
  list.innerHTML='';prev.innerHTML='';

  t2Fields.forEach((f,i)=>{
    const col=codeColor(f.code||'A');
    const showOpts=f.type==='dropdown';
    const showRepeat=f.type==='repeat';
    const showFormula=f.type==='formula';

    const card=document.createElement('div');card.className='field-card';
    card.innerHTML=`
      <div class="field-card-top">
        <div class="field-code-badge" style="background:${col};" title="Click to rename code" onclick="t2RenameCode(${i})">
          ${f.customCode?`<input class="field-code-inp" value="${f.code}" onchange="t2SetCode(${i},this.value)" onclick="event.stopPropagation()" style="color:#fff;">`:`<span>${f.code}</span>`}
        </div>
        <input class="field-name-inp" value="${f.name}" onchange="t2FieldSet(${i},'name',this.value)" placeholder="Field name">
        <select class="field-type-sel" onchange="t2FieldSet(${i},'type',this.value)">
          <option value="text" ${f.type==='text'?'selected':''}>📝 Text</option>
          <option value="number" ${f.type==='number'?'selected':''}>🔢 Number</option>
          <option value="date" ${f.type==='date'?'selected':''}>📅 Date</option>
          <option value="dropdown" ${f.type==='dropdown'?'selected':''}>📋 Dropdown</option>
          <option value="repeat" ${f.type==='repeat'?'selected':''}>➕ Repeating</option>
          <option value="formula" ${f.type==='formula'?'selected':''}>🧮 Formula</option>
        </select>
        <label class="field-req"><input type="checkbox" ${f.required?'checked':''} onchange="t2FieldSet(${i},'required',this.checked)"> Req</label>
        <button title="${f.isProfileKey?'Profile Key — click to remove':'Set as Profile Key'}" onclick="t2Fields[${i}].isProfileKey=!t2Fields[${i}].isProfileKey;t2RenderBuilder();" style="background:none;border:none;font-size:14px;cursor:pointer;padding:2px 4px;flex-shrink:0;color:${f.isProfileKey?'#f7a94f':'var(--border)'};">${f.isProfileKey?'★':'☆'}</button>
        <button class="field-del" onclick="t2DelField(${i})">×</button>
      </div>
      <div class="field-extra ${showOpts||showRepeat||showFormula?'show':''}">
        ${showOpts?`<textarea class="field-textarea" placeholder="Options — one per line" onchange="t2FieldSet(${i},'options',this.value)">${f.options}</textarea>`:''}
        ${showRepeat?t2RenderSubFields(f,i):''}
        ${showFormula?`
          <input class="field-inp-sm" placeholder="e.g. ={EB}*{EC} or =ROUND({D}*0.05,2)" value="${f.formula}" onchange="t2FieldSet(${i},'formula',this.value)">
          <div style="font-size:11px;color:var(--muted);">Use ={FieldCode} or ={FieldName}. Functions: ROUND, IF, SUM, AVERAGE, COUNT</div>
        `:''}
      </div>
    `;
    list.appendChild(card);

    // Preview
    const pf=document.createElement('div');pf.className='prev-field';
    pf.innerHTML=`<div class="prev-field-lbl"><span class="prev-field-code" style="background:${col};">${f.code}</span> ${f.name}${f.required?' *':''}</div>`;
    if(f.type==='dropdown'){
      const opts=f.options.split('\n').filter(Boolean);
      pf.innerHTML+=`<select class="prev-inp"><option>— Select —</option>${opts.map(o=>`<option>${o}</option>`).join('')}</select>`;
    } else if(f.type==='formula'){
      pf.innerHTML+=`<div class="prev-inp" style="color:var(--accent);font-family:var(--mono);font-size:11px;">${f.formula||'=formula'}</div>`;
    } else if(f.type==='repeat'){
      const subs=(f.subFields||[]);
      pf.innerHTML+=`<div style="font-size:11px;color:var(--muted);">Repeating: ${subs.map(sf=>`<span style="background:${codeColor(sf.code||'A')};color:#fff;padding:1px 5px;border-radius:3px;font-size:11px;font-family:var(--mono);margin-right:3px;">${sf.code}</span>${sf.name}`).join(' · ')||'add sub-fields ↑'}</div>`;
    } else {
      pf.innerHTML+=`<input class="prev-inp" type="${f.type==='number'?'number':f.type==='date'?'date':'text'}" placeholder="${f.name}">`;
    }
    prev.appendChild(pf);
  });

  // Profile key summary
  const pkFields=t2Fields.filter(f=>f.isProfileKey);
  const pkSum=document.createElement('div');
  pkSum.style.cssText='font-size:11px;color:var(--muted);padding:8px;background:var(--surface2);border-radius:6px;margin-bottom:4px;border-left:3px solid '+(pkFields.length?'var(--warn)':'var(--border)')+';';
  pkSum.innerHTML=pkFields.length
    ?'🧠 <b>Profile Keys:</b> '+pkFields.map(f=>`<span style="background:${codeColor(f.code)};color:#fff;padding:1px 6px;border-radius:3px;font-family:var(--mono);font-size:11px;">${f.code}</span> ${f.name}`).join(' + ')+' — system learns from these'
    :'☆ No Profile Keys set — click ★ on a field to enable learning';
  list.appendChild(pkSum);

  const addBtn=document.createElement('button');
  addBtn.className='add-field-btn';addBtn.textContent='+ Add Field';
  addBtn.onclick=t2AddField;list.appendChild(addBtn);

  // Auto-save on every render
  setTimeout(t2AutoSave,200);
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
  t2PromptFiles();
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
  document.getElementById('t2DE').textContent=t2Entries.length;
  document.getElementById('t2DF').textContent=t2Fields.filter(f=>f.type!=='formula').length;
}

function t2Continue(){document.getElementById('t2Done').style.display='none';document.getElementById('t2Work').style.display='flex';}

function t2ExportFresh(){
  const headers=['Source File','Timestamp','Saved As',...t2Fields.map(f=>f.name)];
  const rows=[headers,...t2Entries.map(e=>headers.map(h=>e[h]||''))];
  const ws=XLSX.utils.aoa_to_sheet(rows);
  // Style header row
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Data');
  XLSX.writeFile(wb,'ocr_data_entry.xlsx');
}

async function t2ExportAppend(){
  if(!t2TemplateFile){t2ExportFresh();return;}
  const data=await t2TemplateFile.arrayBuffer();
  const wb=XLSX.read(data);
  const ws=wb.Sheets[wb.SheetNames[0]];
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  let lastRow=range.e.r+1;
  const headers=[];
  for(let c=range.s.c;c<=range.e.c;c++){const cell=ws[XLSX.utils.encode_cell({r:range.s.r,c})];headers.push(cell?String(cell.v):'');}
  t2Entries.forEach(entry=>{
    headers.forEach((h,c)=>{if(entry[h]!==undefined)ws[XLSX.utils.encode_cell({r:lastRow,c})]={v:entry[h],t:'s'};});
    lastRow++;
  });
  ws['!ref']=XLSX.utils.encode_range({s:{r:range.s.r,c:range.s.c},e:{r:lastRow-1,c:range.e.c}});
  XLSX.writeFile(wb,'ocr_data_appended.xlsx');
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

// T2 keyboard
document.addEventListener('keydown',e=>{
  if(document.getElementById('t2Work').style.display==='none')return;
  if(e.key==='['||e.key==='{')v2.rotate(-90);
  if(e.key===']'||e.key==='}')v2.rotate(90);
  if(e.key==='ArrowLeft')t2LoadInViewer(Math.max(0,t2ActiveFile-1));
  if(e.key==='ArrowRight')t2LoadInViewer(Math.min(t2Files.length-1,t2ActiveFile+1));
});


