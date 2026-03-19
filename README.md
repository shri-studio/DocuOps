# DocuOps v3.0.0
### Document Operations. Automated.

Browser-based document intelligence platform for BPO teams and data processing operations. No installation required — runs entirely in Chrome or Edge.

---

## Tools

### 📄 Tool 1 — Document Renamer
Batch rename document files using OCR. Supports JPG, PNG, PDF, MP4.

### 📊 Tool 2 — Data Entry Assistant  
Build custom forms from Excel templates. AI learns document layouts and pre-fills fields automatically.

### 📑 Tool 3 — Batch Data Extractor *(deployment phase)*
AI-powered batch extraction from resumes, contracts, invoices. Upload documents → get Excel automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| OCR | Tesseract.js |
| Excel | XLSX.js |
| PDF | PDF.js |
| DOCX | Mammoth.js |
| Hosting | Vercel |
| Database | Neon PostgreSQL |
| Auth | Clerk.dev |

---

## Project Structure

```
docuops/
├── index.html          # Main app shell
├── css/
│   └── style.css       # All styles + theme variables
├── js/
│   ├── theme.js        # Theme system + settings
│   ├── shared.js       # Utilities + viewer engine + navigation
│   ├── tool1.js        # Document Renamer
│   ├── tool2.js        # Data Entry Assistant
│   ├── learning.js     # Profile + learning + suggestion engine
│   ├── defensive.js    # Session protection + confirmations
│   └── tool3.js        # Batch Data Extractor
├── vercel.json         # Deployment config
├── package.json        # Project config
├── CONTEXT.md          # Full project spec
└── CURSOR_PROMPT.md    # AI assistant context
```

---

## Development

```bash
# Run locally
npx serve .

# Or just open index.html in Chrome/Edge
```

---

## Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

---

## Version History

| Version | Changes |
|---|---|
| 3.0.0 | Tool 3 added, renamed to DocuOps |
| 2.2.4 | Logo as home button, nav fixes |
| 2.2.3 | Readability improvements |
| 2.2.2 | Defensive UX, confirmations |
| 2.2.1 | Bug fixes |
| 2.2.0 | Learning engine, profile system |
| 2.1.0 | Field codes, formula engine |
| 2.0.0 | OCR Suite launch |
| 1.0.0 | Original InvoiceRenamer |

---

*All document processing happens locally in the user's browser. No documents are ever uploaded to any server.*
