# CURSOR_PROMPT.md
# Paste this at the START of every Cursor AI session

---

## Project: DocuOps v3.0.0
**Tagline:** Document Operations. Automated.

Single-page app split across multiple files.
Vanilla JavaScript, no frameworks.
Target: BPO companies and data entry teams.

## File Structure
```
index.html       — HTML shell only
css/style.css    — all styles
js/theme.js      — theme + settings panel
js/shared.js     — utilities + viewer engine + navigation
js/tool1.js      — Document Renamer (all t1* functions)
js/tool2.js      — Data Entry Assistant (all t2* functions)
js/learning.js   — learning engine + profile system
js/defensive.js  — confirmations + session protection
js/tool3.js      — Batch Data Extractor (all t3* functions)
```

## CRITICAL Rules
1. Make TARGETED edits — never rewrite large sections
2. Preserve ALL existing functionality
3. Font size minimum 11px everywhere
4. Confirmations: only when _sessionActive === true
5. Dialog style: use confirm() consistently
6. After ANY change: update version in theme.js and index.html
7. Always test in Chrome after changes

## Key Variables (memorise these)
```
v1, v2              viewer instances
v.s.hasSel          selection box exists
v.s.sx/sy/sw/sh     selection coordinates  
v.s.onOCR           OCR callback function
t2Fields            [{id,name,code,type,formula,isProfileKey}]
t2Entries           saved rows for export
t2ActiveFieldId     field waiting for OCR
_sessionActive      session protection flag
FSM                 File System Manager
T2_AUTOSAVE_KEY     localStorage template key
PROFILES_KEY        localStorage profiles key
```

## DOM Patterns
```
dei_[fieldId]       data entry input
rei_[fid]_[ri]_[si] repeat group input
st_[index]          strip thumbnail
```

## CSS Color Variables
```
--accent    #4f8ef7  blue — primary actions
--accent2   #38d9a9  green — save/confirm
--warn      #f7a94f  orange — warnings
--danger    #f76f6f  red — delete/destructive
--muted     #8b95bb  grey — secondary text
```

## When I Give You a Task
- Read the relevant JS file first
- Make minimal targeted changes
- Preserve existing code style
- Update version number
- Tell me what you changed

