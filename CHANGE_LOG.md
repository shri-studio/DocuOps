# DocuOps — Change Log

## Current Version: 3.3.7
Live: https://docu-ops.vercel.app

---

## 📐 DESIGN PRINCIPLES
- No fake/placeholder buttons ever
- If not built → it doesn't appear
- Every clickable element must work fully
- Little by little — one change at a time
- One change → Test → Commit → Next
- Minimum 11px font everywhere
- Clean and simple — never UI/UX heavy
- Feels like a tool, not a website
- Version bump = visual confirmation of deployment

---

## ✅ DEPLOYED
- 1.0.0 — Original InvoiceRenamer
- 2.0.0 — OCR Suite — Tool 1 + Tool 2
- 2.1.0 — Theme, field codes, formula engine
- 2.2.0 — FSM, learning engine, profiles
- 2.2.1 — Bug fixes
- 2.2.2 — Defensive UX
- 2.2.3 — Readability fixes
- 2.2.4 — Logo as home button
- 3.0.0 — Tool 3 placeholder, renamed DocuOps
- 3.1.0 — Landing page created
- 3.1.1 — Redirect fixes
- 3.1.2 — Unified design system
- 3.1.3 — Supabase auth (Google + Magic Link)
- 3.1.4 — Settings fixed, Tool 3 coming soon
- 3.1.5 — Footer visible, font unified, AI removed from settings
- 3.1.6 — Supabase template + profile sync

---

## 📋 QUEUED
(In order — one at a time)

### Settings & Account
- 3.1.7 — Settings redesign
           → Remove Data Folder section
           → Rename "Learned Profiles" → "Document Layouts"
           → Add Account section (name, email, plan, upgrade)
           → Clean professional layout

- 3.1.8 — Font unification
           → Remove IBM Plex Sans from app.html head
           → Plus Jakarta Sans everywhere

### App Home
- 3.1.9 — Personalized greeting
           → "Good morning, Rishabha 👋"
           → Subtle, clean, not heavy
           → Time-based (morning/afternoon/evening)

- 3.2.0 — Quick stats bar on app home
           → Documents processed this month
           → Time saved estimate
           → Most used tool
           → Simple, one line, not a dashboard

- 3.2.1 — Plan indicator
           → "Free Plan · 3/50 docs used"
           → Subtle progress — not aggressive
           → Upgrade link at right moment

### Tool Experience
- 3.2.2 — Empty states
           → Tool 2 no template → friendly guided state
           → Clear illustration + action buttons
           → "Upload Template" or "Build from Scratch"

- 3.2.3 — Onboarding flow (first time only)
           → One-time welcome after first sign in
           → "What would you like to do first?"
           → Skippable
           → Never shows again after dismissed

- 3.2.4 — Success moments
           → After saving entries: "47 entries saved!"
           → After renaming: "42 files renamed · ~2 hours saved"
           → Subtle — not dramatic
           → Auto-dismisses after 3 seconds

- 3.2.5 — Progress indicators
           → OCR running: "Reading document 3 of 12..."
           → Percentage + cancel button
           → Estimated time remaining

- 3.2.6 — Field activation clearer (Tool 2)
           → Animated pulse on first field
           → Tooltip on first use
           → Clear active state

### Communication & Trust
- 3.2.7 — Humanised error messages
           → "Couldn't read that area — try a clearer region"
           → "Image resolution might be low — try zooming in"
           → "No text found — is this a scanned document?"
           → Friendly, actionable, not technical

- 3.2.8 — Loading states micro-copy
           → "Reading your document..."
           → "Extracting text..."
           → "Almost done..."
           → Feels alive, not robotic

- 3.2.9 — Cloud sync indicator
           → Small "Synced ✅" in corner when saved
           → Builds trust
           → Subtle green dot, auto-hides after 2s

- 3.3.0 — Tooltips
           → Hover any button → explains what it does
           → Field code badges explained
           → Formula fields explained
           → First-use hints only (not permanent)

### Navigation
- 3.3.1 — Keyboard shortcut panel
           → ? key opens shortcuts overlay
           → Clean, dismissable
           → Shows all available shortcuts

- 3.3.2 — Processing history
           → Recent activity on app home
           → "Invoice renamed 2 hours ago"
           → Last 5 actions only
           → Subtle, not prominent

### Mobile
- 3.3.3 — Mobile responsiveness
           → Landing page perfect on mobile
           → App home accessible on mobile
           → Settings accessible on mobile
           → Tool 1 usable on mobile

---

## 🗒️ BACKLOG
### App Improvements
- Arabic OCR support (🔴 High)
- OCR confidence score display (🔴 High)
- Entry review table before export (🔴 High)
- Duplicate detection Tool 2 (🟡 Medium)
- Search/filter image strip (🟡 Medium)
- Template library — multiple named templates (🟡 Medium)
- Batch auto-fill / lock field value (🟡 Medium)
- Font size/family settings panel (🟡 Medium)
- Undo Ctrl+Z (🟢 Low)
- Click-to-paste OCR text (🟢 Low)

### Tool 3 — Proper Build
- 3.4.0 — Tool 3 backend (Vercel serverless)
           → /api/extract endpoint
           → Groq primary, Gemini fallback
           → API keys server-side only

- 3.4.1 — Tool 3 UI rebuild
           → Tile view for results
           → Fix scrolling
           → No API key UI for users

- 3.4.2 — Tool 3 Arabic support
           → Qwen 2.5 for Arabic documents

### Payments
- 3.5.0 — Stripe integration
           → Free / Pro / Team plans
           → Plan limits enforced
           → Upgrade flow

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

---

## 🏗️ DEPLOYMENT STACK
- Hosting: Vercel ✅
- Version control: GitHub ✅
- Auth: Supabase ✅
- Database: Supabase PostgreSQL ✅
- Tables: profiles, templates, learning_profiles, waitlist ✅
- Payments: Stripe (pending)
- AI: Groq + Gemini (pending — Tool 3)
- Domain: docuops.com (pending)

---

## 📐 NAMING CONVENTION
- MAJOR.0.0 — Complete rebuild or major new feature
- x.MINOR.0 — New feature or section
- x.x.PATCH — Bug fix or small improvement

---

## 🛠️ DEVELOPMENT WORKFLOW
- Claude → architecture, design, complex builds
- Cursor → daily coding, bug fixes
- GitHub → version control
- Vercel → auto-deploy on push
- Every change → version bump in shared.js
- Version on screen = deployment confirmed