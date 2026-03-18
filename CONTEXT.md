# DocuOps — Project Context & Spec
## For use with Cursor AI and Claude

---

## Project Overview
**Name:** DocuOps  
**Tagline:** Document Operations. Automated.  
**Version:** 3.0.0  
**Type:** Browser-based document intelligence platform  
**Target Market:** BPO companies, data entry teams, document processing operations  

---

## File Structure
```
index.html       — app shell, HTML only
css/style.css    — all styles
js/theme.js      — theme + settings
js/shared.js     — utilities, viewer engine, navigation
js/tool1.js      — Document Renamer (t1*)
js/tool2.js      — Data Entry Assistant (t2*)
js/learning.js   — Profile + learning + suggestions
js/defensive.js  — Session protection + confirmations
js/tool3.js      — Batch Data Extractor (t3*)
```

---

## Three Tools
- **Tool 1:** Document Renamer — batch OCR rename files (t1*)
- **Tool 2:** Data Entry Assistant — form-based OCR entry (t2*)
- **Tool 3:** Batch Data Extractor — AI batch extraction (t3*)

---

## Critical Rules When Editing
1. Never rewrite large sections — targeted edits only
2. Preserve ALL existing functionality
3. Minimum font size 11px everywhere
4. Confirmations only when _sessionActive=true
5. Use confirm() for all dialogs
6. Update version number (MAJOR.MINOR.PATCH)
7. Test in Chrome after every change
8. Script load order in index.html must be preserved

---

## Key Variables

### Global
```javascript
sharedWorker        // Tesseract.js OCR worker (shared)
sharedFolder        // FileSystemDirectoryHandle for saving
_sessionActive      // boolean — session protection flag
ACCEPT              // RegExp — valid file extensions
```

### Viewer Engine
```javascript
v1, v2              // viewer instances (Tool 1 and 2)
v.s                 // state object
v.s.canvas          // HTMLCanvasElement
v.s.blob            // raw file data
v.s.zoom            // zoom level (1-8)
v.s.rot             // rotation (0/90/180/270)
v.s.hasSel          // boolean — selection box exists
v.s.sx/sy/sw/sh     // selection box coordinates
v.s.onOCR           // callback(text) when OCR completes
```

### Tool 2
```javascript
t2Fields            // [{id, name, code, type, formula, isProfileKey, subFields}]
t2Entries           // saved rows for export
t2ActiveFieldId     // field currently waiting for OCR
t2RepeatData        // {fieldId: [{}, {}...]} repeat rows
t2NamingPatternOverride  // per-entry filename override
T2_AUTOSAVE_KEY     // localStorage key for template
PROFILES_KEY        // localStorage key for profiles
```

### Learning System
```javascript
t2CurrentSuggestions    // {fieldId: {x,y,w,h,confidence}}
t2SuggestionMode        // boolean
FSM                     // File System Manager object
```

### Tool 3
```javascript
t3Fields            // extraction field definitions
t3Docs              // loaded documents array
t3Results           // extraction results
T3_KEYS_KEY         // localStorage key for AI keys
```

---

## DOM ID Patterns
```
dei_[fieldId]                    — data entry input (Tool 2)
rei_[fieldId]_[rowIndex]_[subIdx]— repeat group input
grp_[fieldId]                    — repeat group container
rows_[fieldId]                   — repeat rows wrapper
st_[index]                       — Tool 2 strip thumbnail
t3st_[index]                     — Tool 3 strip thumbnail
t1*/t2*/t3*                      — prefixed IDs per tool
```

---

## CSS Variables
```css
--bg              /* page background */
--surface         /* card/panel background */
--surface2        /* input/secondary background */
--border          /* border color */
--accent          /* #4f8ef7 — primary blue */
--accent2         /* #38d9a9 — primary green */
--warn            /* #f7a94f — warnings */
--danger          /* #f76f6f — destructive */
--text            /* main text */
--muted           /* #8b95bb — secondary text */
--purple          /* #a78bfa — Tool 2 accent */
```

---

## Version History
```
3.0.0  Tool 3 added, renamed to DocuOps
2.2.4  Logo as home button, nav fixes
2.2.3  Readability — 11px min fonts
2.2.2  Defensive UX — confirmations
2.2.1  Bug fixes
2.2.0  Learning engine, FSM, profiles
2.1.0  Field codes, formula engine, templates
2.0.0  OCR Suite — Tool 1 + Tool 2
1.0.0  Original InvoiceRenamer
```

---

## Deployment Stack (planned)
```
Hosting:   Vercel (free tier)
Database:  Neon PostgreSQL
Auth:      Clerk.dev (Google + Magic Link)
Payments:  Stripe
AI:        Groq (primary) + Gemini (fallback)
Domain:    docuops.com
```
