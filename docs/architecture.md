# System Architecture & Technical Specification

## Overview

The **State-Level Music Competition Management & Digital Judging Platform** is a server-authoritative, cloud-hosted live event system. It is designed to host mission-critical competitions with concurrent judges, zero bias, and real-time state synchronization.

---

## 1. High-Level Architecture Topology

```
                                  [ CLIENT TIER ]
         Judge Touch PWA  ──┐
      Operator Control Room ──┼──► [ Next.js 16 App Router (Vercel Edge) ]
         Admin Scrutineer ──┤                  │
       Public Live Screen ──┘                  ▼
                                ┌──────────────────────────────┐
                                │     Zod Validation Layer     │
                                └──────────────┬───────────────┘
                                               │
                      ┌────────────────────────┴────────────────────────┐
                      ▼                                                 ▼
        [ Supabase Auth + RBAC ]                              [ Upstash Redis ]
        - Google OAuth Zero-Trust                             - Sliding Window Rate Limit
                      │
                      ▼
        [ Supabase PostgreSQL 16+ ]
        - Strict Row Level Security (RLS)
        - Atomic Stored Procedures (RPCs)
        - WAL Realtime Broadcasts (No raw score leaks)
```

---

## 2. Server-Authoritative Guarantees

1. **Score Immutability**: Submitted scores transition to `locked` via atomic PostgreSQL RPC `submit_judge_score`. Trigger `trg_protect_locked_scores` prevents direct table mutation.
2. **Authoritative Live Clocks**: Clients calculate countdown and overtime using server timestamps with calibrated drift offsets $\Delta = t_{\text{server}} - t_{\text{client}}$.
3. **Criteria Snapshots**: Scoring configuration versions (`criteria_versions`) freeze once judging begins.
4. **Deterministic Tie-Breaking**: Configurable 5-stage priority evaluation (Average $\rightarrow$ Priority Criterion $\rightarrow$ Variance $\rightarrow$ Median $\rightarrow$ Manual Jury Override).
