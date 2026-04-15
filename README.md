# VedaVoice — Site Payroll & Safety Engine

> *"Ek awaaz mein poora hisaab."*
> One voice command. Complete site records.

VedaVoice is a voice-first payroll and site safety platform built for India's construction contractors and labour supervisors. It eliminates paper-based wage tracking by letting supervisors speak naturally in Hindi or Hinglish — recording attendance, advances, payments, and material expenses hands-free, on a live construction site.

Built at **Mind Installers Hackathon 4.0** as a full-stack product pivot from a general shopkeeper ledger to a specialized contractor operations system.

---

## The Problem

India's construction sector employs over 6 crore unorganised workers. Their supervisors manage daily wages, advances, attendance, and safety — simultaneously — using torn diaries and memory. A single missed payment record leads to worker disputes and work stoppages. There is no tool built for how these supervisors actually work: outdoors, hands occupied, speaking Hindi.

---

## What VedaVoice Does

| Layer | Technology | What It Solves |
|---|---|---|
| Voice Payroll | Gemini 2.5 Flash NLP | Logs transactions in natural Hindi speech |
| Attendance | Supabase + Voice Parser | Marks hajiri, auto-calculates daily wage bill |
| Worker Payroll | Formula Engine | Tracks gross earned, advances, net dues per worker |
| Site Safety | Duality AI + YOLOv8 | Detects PPE compliance via synthetic-data-trained CV model |
| AI Assistant | Saathi (Gemini) | Answers Hindi queries grounded in live site data |
| Reporting | CSV Export + Invoicing | Weekly worker receipts, builder-ready exports |

---

## Core Features

### Voice-to-Ledger Engine
Speak a command in Hindi or Hinglish. Gemini extracts structured entities and logs the transaction instantly. Handles complex arithmetic natively.

```
"Raju ka 500 advance diya, 50 khane mein kata"
→ { name: "Raju", action: "ADVANCE", amount: 450, notes: "50 deducted for food" }
```

Supported intents: `PAYMENT` · `ADVANCE` · `UDHAAR` · `RECEIPT` · `MATERIAL` · `ATTENDANCE`

### Progressive Worker Identity
Workers are created automatically on first mention. Same-name disambiguation is handled via qualifier extraction ("Chhota Raju" vs "Delhi wala Raju") and a tap-to-resolve bottom sheet — no typing required.

### Hajiri (Attendance)
Daily attendance marking via voice or tap. Status multipliers (Present = 1.0, Half Day = 0.5, Absent = 0.0) feed directly into the payroll engine. One-tap "Sab Present" for full-site marking.

### Payroll & Settlement Engine
Per-worker wage calculation across any date range:

```
Gross Earned = (Present Days × 1.0 + Half Days × 0.5) × Daily Rate
Net Due      = Gross Earned − (Total Advances + Total Payments)
```

Smart Payment Engine handles overpayments automatically — splitting excess into a `PAYMENT` + `ADVANCE` record to prevent negative balances.

### Site Safety Module (Duality AI Integration)
A live camera feed runs a YOLOv8 object detection model trained on synthetic construction site data generated via Duality AI's Falcon platform. Detections are logged as timestamped compliance events alongside the financial ledger.

Endpoint for model integration:
```
POST /api/safety/detect
Body: { frame: string }        // base64 JPEG
Response: { detections: [...], timestamp: string }
```

### Saathi AI Assistant
A context-aware Hindi/Hinglish chat assistant grounded in live site data. Saathi knows each worker's rates, attendance, advances, and outstanding dues — answering payroll queries, generating safety briefings, and calculating material quantities.

```
"Is hafte Ramesh ko kitna dena hai?"
→ Calculates from real attendance + transaction data, not generic AI
```

### Audit Khata & Reporting
- Time-range filtering: Aaj / Hafta / Mahina
- Per-worker PDF/CSV invoices with ISO week bucketing
- UTF-8 BOM CSV export respecting active UI filters
- Site-wide cash flow: `Receipts − (Payments + Materials)`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS v4 + Material Symbols |
| Database & Auth | Supabase (PostgreSQL + RLS) |
| NLP Extraction | Google Gemini 2.5 Flash via `/api/extract` |
| Computer Vision | YOLOv8 trained on Duality AI Falcon synthetic data |
| AI Assistant | Gemini 2.5 Flash with live Supabase context injection |
| Voice Input | Web Speech API (`en-IN`) with browser-side fuzzy matching |

---

## Architecture Overview

```
Browser (Web Speech API)
        │
        ▼
/api/extract  ──→  Gemini 2.5 Flash  ──→  Structured JSON
        │
        ▼
useWorkers.ts  (fuzzy match / disambiguation)
        │
        ├──→  Supabase: transactions table
        ├──→  Supabase: workers table
        └──→  Supabase: attendance table
                        │
                        ▼
              Payroll Engine (finance.ts)
              Saathi Context Builder
              CSV / Invoice Generator

/api/safety/detect  ──→  YOLOv8 (Duality-trained)  ──→  Compliance Log
```

---

## Running Locally

```bash
git clone https://github.com/your-org/vedavoice
cd vedavoice
npm install
npm run dev
```

Configure `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

### Database Setup

Run the following migrations in your Supabase SQL editor in order:

```sql
-- 1. Workers table
CREATE TABLE workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users,
  name text NOT NULL,
  qualifier text,
  daily_rate integer,
  phone text,
  created_at timestamptz DEFAULT now()
);

-- 2. Attendance table
CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users,
  worker_id uuid NOT NULL REFERENCES workers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL CHECK (status IN ('present', 'half', 'absent')),
  marked_via text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  UNIQUE(worker_id, date)
);

-- 3. Extend transactions table
ALTER TABLE transactions
  ADD COLUMN worker_id uuid REFERENCES workers(id),
  ADD COLUMN qualifier text,
  ADD COLUMN unit text DEFAULT 'INR',
  ADD COLUMN notes text;
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Voice input + confirmation flow
│   ├── workers/page.tsx      # Payroll dashboard
│   ├── hajiri/page.tsx       # Attendance marking
│   ├── safety/page.tsx       # Duality AI CV feed
│   ├── saathi/page.tsx       # AI assistant chat
│   ├── customers/page.tsx    # Legacy ledger view
│   └── api/
│       ├── extract/          # Gemini NLP endpoint
│       ├── saathi/           # Contextual AI endpoint
│       ├── attendance/parse/ # Voice attendance parser
│       └── safety/detect/    # YOLOv8 inference endpoint
├── hooks/
│   ├── useVoice.ts
│   ├── useWorkers.ts
│   ├── useAttendance.ts
│   └── useLedger.ts
└── lib/
    ├── finance.ts            # All payroll formulas
    ├── smartPayment.ts       # Overpayment split logic
    └── saathiContext.ts      # Context builder for AI
```

---

## License

This repository is protected under a **Custom Non-Commercial Educational License**.

- Personal study and code review: permitted
- Commercial use, hosting, or monetization: prohibited
- Submission to competitions or incubators by third parties: prohibited
- Representing this codebase as original work by others: prohibited

See `LICENSE` for full terms.

---

*Built for Mind Installers Hackathon 4.0 · April 2026*