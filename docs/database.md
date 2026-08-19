# Database Architecture & Entity Specifications

## Database Engine
- **Platform**: Supabase PostgreSQL 16+ / Neon Serverless Postgres
- **Extensions**: `uuid-ossp`, `pgcrypto`

## Primary Entities
1. `profiles` & `user_roles`: Zero-trust RBAC profiles with role hierarchy (`super_admin`, `admin`, `event_operator`, `judge`, `unauthorized`).
2. `competitions` & `competition_settings`: Event parameters, multi-device policies, timer warning thresholds.
3. `categories` & `rounds`: Categorized hierarchy with configurable scoring formula (`weighted_sum`, `olympic`, `average`, `total_sum`).
4. `criteria_versions` & `category_criteria`: Versioned criteria snapshots with maximum marks and criteria weights.
5. `participants`, `teams`, `team_members`: Performers roster with environment tag (`live` vs `practice`).
6. `performances`: Scheduled stage slots with performance order and status.
7. `judge_assignments` & `judge_sessions`: Category and seat assignments with active device fingerprint approval.
8. `score_submissions`, `score_entries`, `score_history`: Atomic score submissions, criteria entries, and historical snapshots on reopen.
9. `timers`: Server-authoritative elapsed duration, started timestamp, and overtime accumulator.
10. `results` & `result_entries`: Certified final scores, standard deviations, and tie-breaker scrutiny notes.
11. `tie_break_rules` & `tie_break_decisions`: Configurable tie-breaker priority definitions and jury sign-off records.
12. `awards` & `award_winners`: Dynamic awards roster with audited overrides.
13. `audit_logs` & `backups`: Immutable operational audit logs and cryptographic backup archives.
