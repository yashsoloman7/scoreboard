# Music Competition Management & Digital Judging Platform 🏆

> **Production-Grade, Server-Authoritative Cloud System for State-Level Music Competitions & Digital Scrutiny**

Built with **Next.js 16 (App Router)**, **TypeScript Strict Mode**, **Tailwind CSS**, and **Supabase PostgreSQL 16+** (with RLS, Auth, Realtime & Storage).

---

## 🎯 Key Architectural Capabilities

* **🛡️ Zero-Trust Security & RBAC:** Google OAuth authentication where new accounts possess zero default permissions until authorized by an Administrator.
* **🔒 Server-Authoritative Score Locking:** PostgreSQL RPC triggers prevent post-submission tampering and race conditions at the database level.
* **👁️ Shoulder-Surfing Protection (Masked Marks):** Entered scores confirm locally and mask to `*` to protect marks from being observed in live venues.
* **⏱️ Authoritative Synchronized Timer:** Live countdown clocks synchronize with sub-second server timestamps, displaying warning thresholds (30s remaining) and overtime counters (`+MM:SS`).
* **⚖️ Deterministic Multi-Tier Tie-Breakers:** Algorithmic resolution evaluating Highest Raw Average $\rightarrow$ Priority Criterion $\rightarrow$ Lower Judge Variance (Standard Deviation) $\rightarrow$ Median $\rightarrow$ Audited Jury Override.
* **📊 Dynamic Awards Engine:** Automated winner calculation for 20+ seed and custom awards with audited override capabilities.
* **🛠️ Isolated Practice Sandbox:** Dedicated practice environment (`environment = 'practice'`) with demo participants and test scoring that cannot affect live records.
* **📦 Cryptographic Backups & PDF Export:** Automated event snapshots with SHA-256 digital seals, multi-sheet Excel workbooks, and printable certified PDF judging sheets.

---

## 🚀 Quick Local Setup

### 1. Prerequisites
- Node.js 20+ / LTS
- Free Supabase Account (or local PostgreSQL instance)

### 2. Environment Configuration
Create `.env.local` in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Initialization
Run the unified schema migration script [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase SQL Editor.

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## 📂 Project Architecture

```text
├── src/
│   ├── actions/          # Server Actions (Competitions, Scoring, Timer, Results, Awards)
│   ├── app/              # Next.js 16 App Router Pages
│   │   ├── admin/        # Control Room & Scrutineer Dashboard
│   │   ├── auth/         # Login, Callback, Unauthorized Pages
│   │   ├── judge/        # Touch-Optimized Judge Scoring Console
│   │   └── live/         # Public Live Scoreboard & Podium
│   ├── components/       # UI & Layout Components
│   ├── lib/              # Core Domain Engines (Scoring, Tie-Breakers, Timers, Importers)
│   ├── types/            # Strict TypeScript Interfaces & Domain Models
│   └── __tests__/        # Mathematical & Concurrency Test Suites
├── supabase/
│   ├── migrations/       # Versioned PostgreSQL Migrations & Stored Procedures
│   └── schema.sql        # Unified 1-Click Database Schema
└── docs/                 # Complete Architecture & Operational Guides
```

---

## 📚 Technical Documentation
- [System Architecture Specification](docs/architecture.md)
- [Database Schema & Entity Models](docs/database.md)
- [Production Deployment Guide (Vercel + Free Supabase)](docs/deployment.md)
- [Competition Day Checklist](docs/competition-day-checklist.md)
