# DocuOps — Change Log

## Current Version: 3.0.0
## Live: https://docu-ops.vercel.app/

---

## 📐 DESIGN PRINCIPLES
- No fake/placeholder buttons ever
- If not built → it doesn't appear
- Every clickable element must work fully
- Coming Soon tools = hidden in app, shown on landing only
- Little by little — one change at a time
- One change → Test → Commit → Next

---

## ✅ DEPLOYED
- 1.0.0 — Original InvoiceRenamer.html
- 2.0.0 — OCR Suite — Tool 1 + Tool 2
- 2.1.0 — Theme system, field codes, 
          formula engine, file naming, 
          template save/load
- 2.2.0 — FSM, profile key system, 
          learning engine, suggestion engine,
          profile manager
- 2.2.1 — Bug fixes (settings button, 
          add field button)
- 2.2.2 — Defensive UX (confirmations, 
          image load control bar, 
          edit template button)
- 2.2.3 — Readability (min 11px fonts, 
          improved contrast)
- 2.2.4 — Logo as home button, 
          confirmation only when session active
- 3.0.0 — Tool 3 added (placeholder),
          renamed to DocuOps,
          refactored to multi-file structure

---

## 📋 QUEUED
(Implement one by one — in this exact order)

### App Fixes
- 3.0.1 — Fix version display (v2.1 → v3.0.0)
           Files: js/defensive.js, js/tool3.js
           
- 3.0.2 — Fix tool names in app
           "OCR Document Renamer" → "Document Renamer"
           "OCR Data Entry" → "Data Entry Assistant"
           Files: index.html

### Landing Page
- 3.1.0 — New landing page (landing.html)
           Sections:
           → Nav (logo + links + Launch App button)
           → Hero (headline + USPs + CTA)
           → How It Works (3 steps)
           → Problem section
           → Privacy/Security (main USP)
           → Tools grid (live + coming soon)
           → Industries section
           → ROI Calculator
           → Why DocuOps vs ChatGPT
           → Pricing (Free/Pro/Team/Enterprise)
           → FAQ
           → Contact / Custom Request form
           → Footer
           NO login button until Clerk is ready
           
- 3.1.1 — Move app to /app/ subfolder
           landing.html becomes index.html
           App lives at docu-ops.vercel.app/app/

### Auth & Database (after presentation)
- 3.2.0 — Clerk.dev integration
           → Google Sign-in
           → Magic Link email
           → User accounts working
           → Sign In button appears in nav
           
- 3.2.1 — Neon PostgreSQL setup
           → Database tables created:
              users, templates, profiles, 
              entries, waitlist
           → Connection to Vercel established

- 3.2.2 — Connect templates to database
           → Templates save to Neon (not localStorage)
           → Load on login from any device
           → Team template sharing

- 3.2.3 — Connect learning profiles to database
           → Profiles save to Neon
           → Sync across devices
           → Team shared profiles

### Tool 3 — Proper Build (after deployment)
- 3.3.0 — Tool 3 backend (Vercel serverless)
           → /api/extract endpoint
           → Groq as primary AI provider
           → Gemini as fallback
           → API keys hidden server-side
           → Users never see keys

- 3.3.1 — Tool 3 UI fixes
           → Fix scrolling
           → Tile view for results (not table)
           → Remove API key input UI
           → Auto-detect provider silently

- 3.3.2 — Tool 3 document parsing
           → Mammoth.js for DOCX
           → PDF.js text extraction
           → Clean text pipeline

### Payments
- 3.4.0 — Stripe integration
           → Free / Pro / Team plans
           → Payment flow working
           → Plan limits enforced

---

## 🗒️ BACKLOG
(Discussed — prioritised — not yet versioned)

### High Priority
- Arabic OCR support
- OCR confidence score display
- Entry review table before export
- Duplicate detection (Tool 2)

### Medium Priority
- Search/filter image strip
- Template library (multiple named)
- Batch auto-fill / lock field value
- Font size/family settings panel

### Low Priority
- Keyboard shortcut cheatsheet
- Click-to-paste from full OCR text
- Undo Ctrl+Z last field fill

### Future Tools
- Tool 4: Document Translator
- Tool 5: Document Summariser
- Tool 6: Document Search
- Tool 7: Document Comparison
- Tool 8: Document Classifier
- Tool 9: Document Redactor
- Tool 10: Document Form Filler
- Tool 11: Document to Email
- Tool 12: Document Validator
- Tool 13: Analytics Dashboard

### Future Features
- Visual auto-grouping (TensorFlow.js)
- Ollama local AI (optional advanced setting)
- Team admin dashboard
- API access for enterprise
- White label option
- Audit trail
- SLA tracking
- Client portal

---

## 🏗️ DEPLOYMENT STACK
- Hosting: Vercel ✅ Live
- Version control: GitHub ✅ Connected
- Database: Neon PostgreSQL (pending)
- Auth: Clerk.dev (pending)
- Payments: Stripe (pending)
- AI providers: Groq + Gemini (pending)
- Domain: docuops.com (pending)
- Ads: Google AdSense — free tier only (future)

---

## 📐 NAMING CONVENTION
- MAJOR.0.0 — Complete rebuild or new tool
- x.MINOR.0 — New feature or section
- x.x.PATCH — Bug fix or small improvement
```

---

## What To Do Now
```
1. Open CHANGE_LOG.md in Cursor
2. Select all (Ctrl+A)
3. Paste the above
4. Save (Ctrl+S)
5. Commit to GitHub