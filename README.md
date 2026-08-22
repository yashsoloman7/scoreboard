# 🌌 Score Board — Next-Gen Competition Management & Broadcast Suite

> **Ultra-modern, server-authoritative live competition engine powered by Next.js App Router, Supabase RBAC Auth, Framer Motion, and Google Sheets API.**

---

## ✨ Overview

**Score Board** is a competition management and digital broadcast platform designed for live music championships, choir festivals, and staged competitions. It combines high-end esports/broadcast aesthetics with a modular architecture:

* **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion (physics-based layout transitions & drag-and-drop), and Shadcn UI.
* **Authentication & RBAC:** Supabase Auth (strictly manages logins and role permissions).
* **Storage & Sequence Database:** Google Sheets API v4 (acts as the live database for participant setup, drag-and-drop sequence order, and judge score collection).
* **Security & Blind Scoring:** Zero past score visibility on judge dashboards with instant form clearance and SHA-256 digital seals upon submission.
* **Deployment Target:** Vercel (Edge/Serverless).

---

## 👥 Role-Based Access Control (RBAC) Hierarchy

```
                                  [ Supabase Auth ]
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
          👑 Super Admin                                 🛡️ Admin
      (Master Roles & Google Sheets)              (Events & Approvals)
                   │                                           │
         ┌─────────┴─────────┐                       ┌─────────┴─────────┐
         ▼                   ▼                       ▼                   ▼
  📋 Event Manager     ⏱️ Time Manager           ⚖️ Judge       📊 General User
 (Schedule & Reorder) (Category Presets & Cues)   (Blind Scoring)    (Broadcast Live)
```

| Role | Landing Route | Features & Responsibilities |
| :--- | :--- | :--- |
| 👑 **Super Admin** | `/admin/dashboard`<br>`/admin/users` | Assign and elevate user roles, sync Google Sheets participant rosters, configure master scoring criteria, and trigger emergency overrides. |
| 🛡️ **Admin** | `/admin/dashboard` | Manage events, inspect scoring progress, and authorize event staff and judges. |
| 📋 **Event Manager** | `/admin/staging` | Backstage lineup schedule with **Framer Motion drag-and-drop performance reordering**, calling acts to stage, and setting Standby / On-Deck status. |
| ⏱️ **Time Manager** | `/admin/control-room` | Authoritative countdown clock with category duration presets (**Solo: 4 mins**, **Duet: 5 mins**, **Group: 6 mins**), overtime alerts, and external stage webhook trigger UI. |
| ⚖️ **Judge** | `/judge` | Distraction-free touch scoring portal for the active live act with **Blind Scoring Security** (form clears immediately, past scores locked from view). |
| 📊 **General User** | `/live` (Default) | Read-only esports & TV broadcast-grade digital scoreboard with animated champion podium (#1 Gold, #2 Silver, #3 Bronze) and real-time Google Sheets sync. |

---

## 📊 Google Sheets Data Flow

All participant rosters, category definitions, and judge score marks sync with Google Sheets:

* **Participant Ingestion:** Reads contestant names, duet pairs (both singer names displayed), and choir details from the `Participants` tab.
* **Live Reordering:** Dragging an act up or down in the Event Manager console immediately updates the `Sequence` column in Google Sheets.
* **Score Recording:** When a Judge submits a score, the values append directly to the `Scores` sheet tab with zero blocking latency.
* **Standings & Totaling:** Fetches finalized totals calculated by Google Sheets formulas to display on the public Broadcast Leaderboard.

---

## 🚀 Getting Started

### 1. Prerequisites
* **Node.js**: 20.x or later
* **Supabase Project**: Free tier for Authentication & Role records
* **Google Sheet**: For participant lists and score logs

### 2. Environment Variables
Create `.env.local` in your root folder:

```env
# Supabase Configuration (Auth & RBAC)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Google Sheets API Configuration
GOOGLE_SHEET_ID=your_spreadsheet_id_here
GOOGLE_API_KEY=your_google_api_key_here

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Installation & Run
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run unit test suite (35 tests)
npm test

# Build for production
npm run build
```

---

## 🔒 Security & Verification
* **Blind Scoring Protection:** After submitting a score, the judge form clears immediately and past entries remain hidden to eliminate bias.
* **Digital Signature Receipt:** Every score generates an immutable cryptographic SHA-256 receipt upon submission.
* **TypeScript Strict Mode:** 100% type-checked codebase with 0 errors (`npx tsc --noEmit`).

---

## 📁 Repository Structure

```text
├── src/
│   ├── actions/          # Next.js Server Actions (Sheets, Scoring, Users, Criteria)
│   ├── app/              # Next.js App Router
│   │   ├── admin/        # Control Room, Staging, Users & Dashboard
│   │   ├── auth/         # Login & Role Authorization Verification
│   │   ├── judge/        # Blind Scoring Touch Portal
│   │   └── live/         # Public Esports Broadcast Leaderboard
│   ├── components/       # Score Board UI Components (Navbar, Leaderboard, Staging)
│   ├── lib/              # Core Services (Google Sheets REST API, Supabase Auth)
│   ├── types/            # TypeScript Domain Definitions
│   └── __tests__/        # Automated Test Suites (Vitest)
├── supabase/             # PostgreSQL Schema & Migrations
└── package.json          # Clean, lightweight production dependencies
```

---

## 📜 License
MIT © Score Board Competition Engineering Team
