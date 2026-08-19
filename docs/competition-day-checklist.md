# Live Competition Day Operational Checklist

## 1. Pre-Event Morning Preparation (T-2 Hours)

- [ ] **Venue Wi-Fi & Hotspot Verification**: Verify primary Wi-Fi and 4G/5G backup hotspot at the Scrutineer Desk.
- [ ] **Database Connection Check**: Run a test query in Supabase to confirm database health and connection pooling.
- [ ] **Judge Device Check-In & Battery Check**: Ensure all judge tablets/phones are charged $\ge 90\%$ and connected to the judging Wi-Fi.
- [ ] **Judge Google SSO Sign-in**: Ensure all assigned judges sign in via Google OAuth.
- [ ] **Role Authorization & Seat Assignment**: Confirm each judge is assigned to their designated Category and Seat Number (1, 2, 3...) in the Admin Hub.
- [ ] **Practice Sandbox Run**: Run a 3-minute practice scoring trial in Practice Mode (`/practice`) so judges are comfortable with the touch keypad and masked marks (`*`).
- [ ] **Lock Criteria Version**: Ensure criteria weights, maximum marks, and scoring formula (e.g. Weighted Sum) are finalized.
- [ ] **Participant Roster Verification**: Confirm all participants/chest numbers are correctly imported with their performance order.

---

## 2. Live Competition Operation (During Event)

- [ ] **Operator Stage Progression**: Event Operator in `/admin/control-room` selects active performer slot.
- [ ] **Live Synchronized Timer**: Operator starts authoritative timer when the performer begins their piece.
- [ ] **Judge Readiness Matrix Monitoring**: Monitor judge submission status. Verify each seat indicator turns green (`✓ Submitted / Locked`).
- [ ] **Scrutineer Score Reopen Workflow (If Exception Occurs)**: If a judge makes a transcription error before category conclusion, an Admin opens the Reopen Modal, enters a mandatory audit justification (min 10 chars), and grants temporary edit access.

---

## 3. Post-Category Scrutiny & Result Publication (Post-Event)

- [ ] **Run Result Engine**: Click **"Calculate Official Results"** in the Control Room.
- [ ] **Review Deterministic Tie-Breakers**: Inspect any tied standings to verify algorithmic priority resolution (Average $\rightarrow$ Priority Criterion $\rightarrow$ Variance).
- [ ] **Jury Chair Sign-Off**: Lead Jury and Chief Scrutineer review the certified standings.
- [ ] **Publish Results**: Click **"Publish Results"** to push standings to `/live` and lock official ranks permanently.
- [ ] **Download Sealed PDF / Excel Archive**: Generate official signed PDF with cryptographic SHA-256 seal stamp for archiving.
