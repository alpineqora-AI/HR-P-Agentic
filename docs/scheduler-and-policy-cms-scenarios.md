# Interview Scheduler & Policy CMS — Scenario Catalog

Target-state scenarios for the TA Portal, modeled on the strongest products in the market
(Paradox/Olivia for conversational + high-volume, GoodTime and ModernLoop for professional-hiring
loop coordination, Prelude, and ATS-native schedulers in Greenhouse/Ashby). Each scenario is
tagged with its build status in THIS app:

- ✅ **built** — working today
- 🔶 **partial** — a foundation exists, needs completing
- ⬜ **new** — not started

The point of the catalog: implement all of it, in the phase order at the bottom.

---

## Part A — Interview scheduling

### A1. Candidate self-scheduling (single interview)

| # | Scenario | Status |
|---|---|---|
| S1 | **Invite → self-schedule.** Candidate gets a link (email/SMS/chat) showing live interviewer availability; picks a slot; everything books itself — calendar events, meeting link, confirmations. | 🔶 chat proposals exist; no standalone self-schedule link page |
| S2 | **Timezone-correct display.** Slots render in the candidate's timezone, auto-detected, switchable. Interviewer sees their own zone. | 🔶 event pattern exists; scheduler shows ET only |
| S3 | **Slot race protection.** Two candidates offered overlapping slots — first confirm wins, second instantly sees refreshed availability (no double-booking, optimistic lock). | ✅ 409 + noRollbackFor pattern built |
| S4 | **Candidate reschedule (policied).** "Reschedule" from any reminder/confirmation; limited to N times; blocked within X hours of the interview; recruiter notified. | 🔶 chat reschedule works; limits/cutoffs not enforced |
| S5 | **Candidate cancel.** Cancel from link/chat → slot released, interviewers freed, recruiter notified, auto re-invite flow offered. | ⬜ |
| S6 | **No workable slots.** Candidate finds nothing → offer waitlist ("notify me when new times open"), plus escalation task to the coordinator with the candidate's stated constraints. | ⬜ |
| S7 | **Reminders with actions.** 24h and 1h reminders carrying Confirm / Reschedule / Cancel actions inline; channel follows candidate preference. | 🔶 24h reminder nudges exist; no inline actions, no 1h |
| S8 | **No-show recovery.** Interview passes unattended → automatic same-day recovery outreach → one-tap rebook; recruiter sees no-show count on the candidate. | ✅ built (Aria recovery → rebook) |
| S9 | **Running-late messaging.** Candidate (or interviewer) says "running 10 min late" in chat → other side notified, interview held rather than marked no-show. | ⬜ |
| S10 | **Natural-language booking.** "Any time Tuesday afternoon works" → parsed against real availability → concrete options offered. Paradox's signature move. | 🔶 scripted option-picking exists; NL parsing needs ClaudeBrain |
| S11 | **Instant scheduling at apply (high-volume).** For hourly/high-volume reqs: the moment screening passes, the same conversation books the interview — no recruiter touch. | 🔶 chat + screening exist; not chained end-to-end |
| S12 | **Time-to-schedule SLA.** Candidate hasn't booked within 48h of invite → automatic nudge; still nothing → recruiter alert in the notification bell + radar. | 🔶 radar exists; SLA nudges not wired to invites |

### A2. Interviewer availability & calendars

| # | Scenario | Status |
|---|---|---|
| S13 | **Connected calendars.** Microsoft Graph / Google free-busy sync; busy blocks always win; writes go back as real calendar events. | 🔶 internal calendar_event with BUSY/INTERVIEW (blocking) + TENTATIVE/IN_OFFICE (soft) + VACATION (blocking) statuses, week-view on /availability; no external sync |
| S14 | **Working hours & OOO.** Per-interviewer working hours, timezone, PTO/OOO windows respected automatically. | ✅ per-person window + timezone (interviewer_settings) + weekly blackout rules ("no Monday mornings"), editable on /availability |
| S15 | **Interview load caps & preferences.** Max interviews/day and /week per interviewer; protected focus blocks; preferred interviewing windows. | ✅ per-person daily+weekly caps, preferred windows via INTERVIEW_BLOCK dedicated time (only-offer-inside semantics) |
| S16 | **Interviewer pools.** Skill/level-tagged pools ("Java panel", "MD approver", "Spanish-speaking") that scheduling draws from. | ⬜ |
| S17 | **Load balancing / fairness.** Rotation within a pool so the same two people don't absorb every interview; fairness stats visible. | 🔶 lightest-load-first picker exists; no rotation memory |
| S18 | **Shadow / training pairs.** Trainee interviewers shadow qualified ones; system pairs them automatically and tracks graduation to solo. | ⬜ |
| S19 | **Interviewer declines.** Interviewer declines the calendar invite → auto-substitute from the same pool without moving the candidate; if impossible, controlled reschedule. | ⬜ |
| S20 | **Calendar event hygiene.** Events carry candidate profile link, resume, scorecard link, meeting link, prep notes; edits cascade to all attendees. | 🔶 events + meeting_link exist; no attachments/scorecards |

### A3. Panels, loops & multi-round

| # | Scenario | Status |
|---|---|---|
| S21 | **Panel interview.** N interviewers, one slot — availability intersection computed across all, plus room. | ✅ interview_panelists + intersection built |
| S22 | **Sequential onsite loop.** A day of back-to-back sessions (4×45min + lunch break), each with its own interviewers; one booking action for the whole day. | ⬜ |
| S23 | **Split loops.** When one day can't fit, split across two days under a policy (max spread). | ⬜ |
| S24 | **Required vs optional attendees; alternates.** Optional can drop without reschedule; required triggers substitution from alternates. | ⬜ |
| S25 | **Rooms & resources.** Onsite rooms booked with the loop; VC link per session for remote. | ⬜ |
| S26 | **Loop templates.** Per job/stage templates ("Tech screen 60m", "Onsite: HM 45 + peer 45 + values 30") applied in one click. | ⬜ |
| S27 | **Reschedule cascade.** One session moves → the whole loop re-optimizes (or flags the minimal set of moves needed). | ⬜ |
| S28 | **Conflict watch.** New busy events landing on booked interviews are detected → auto-proposal to repair before the candidate notices. | ⬜ |

### A4. Recruiter / coordinator operations

| # | Scenario | Status |
|---|---|---|
| S29 | **Batch scheduling.** Select 20 candidates → invite all to self-schedule against one pool/time-grid; watch fill rates live. | ⬜ |
| S30 | **Superday / event interviews.** Campus superday: define time-slot grid × interviewer pool; candidates self-book; auto-assignment balances the grid. Ties into Campus events. | ⬜ |
| S31 | **"What's stuck" radar.** Queues for needs-scheduling / needs-outcome / aging, with per-lane actions. | ✅ built (attention bar + lanes) |
| S32 | **Coordinator override.** Book/move/cancel anything manually, bypassing policy, with an audit note ("booked outside window per candidate request"). | 🔶 manual booking exists; no policy-bypass audit |
| S33 | **Full audit trail.** Every scheduling action (who, what, when, via which channel) queryable per candidate and per interviewer. | 🔶 partial via records; no unified trail |
| S34 | **Scorecard chase.** Interview ends → interviewer gets a scorecard prompt; non-response chased at 24/72h; recruiter sees outstanding feedback in the radar. | 🔶 needs-outcome lane exists; no prompts/chase |
| S35 | **Scheduling analytics.** Time-to-schedule, reschedule rate, no-show rate, interviewer utilization & fairness spread, channel mix — trend lines per job family. | ⬜ |

### A5. Communications & channels

| # | Scenario | Status |
|---|---|---|
| S36 | **Multichannel continuity.** Web chat, SMS, email, WhatsApp — one continuous conversation; channel switch mid-thread keeps context (per aria-orchestration.md). | 🔶 schema supports channels; web chat real, others simulated |
| S37 | **Branded templates per touchpoint.** Invite / confirm / remind / reschedule / no-show emails use the Communications module's templates + merge fields. | 🔶 templates exist; scheduler not wired to them |
| S38 | **Language.** Candidate's preferred language drives all scheduler comms (es/en exist in seed data). | 🔶 |

### A6. Policies & guardrails

| # | Scenario | Status |
|---|---|---|
| S39 | **Scheduling windows.** Min notice (e.g. 20h), max horizon (e.g. 3 weeks), buffers between interviews, blackout dates. | 🔶 notice/buffers/caps built; horizon & blackouts not |
| S40 | **Reschedule limits.** Candidate max N reschedules; inside-cutoff changes require the coordinator. | ⬜ |
| S41 | **Accommodations.** Candidate can request extra time / accessibility accommodations in the flow; visibly attached to the booking. | ⬜ |
| S42 | **Interviewer identity policy.** Configurable: hide interviewer names until confirmed (bias/privacy). | ⬜ |

### A7. The fully-booked-interviewer playbook

What happens when the hiring manager's (or any required interviewer's) calendar has no open
slots. Applied as an escalation LADDER, in order — and note the recruiter's own calendar never
gates scheduling; only actual interview attendees do.

| # | Scenario | Status |
|---|---|---|
| S43 | **Silent widening.** Before reporting failure: extend the search horizon (e.g. 2→4 weeks), relax soft preferences (edge-of-day slots within working hours), shrink optional buffers. | ⬜ |
| S44 | **Role-based substitution.** If the seat needs "someone qualified" rather than a specific person, draw an equivalent interviewer from the pool with fairness rotation (pairs with S16/S19). Not applicable to person-specific interviews (the HM on their own req). | ⬜ |
| S45 | **Ask-to-overbook.** Identify LOW-priority conflicts (recurring 1:1s, focus blocks, tentative holds) and ask the interviewer, one click, to release one for the interview. Load caps become "over-cap with approval," never silent double-booking. | ⬜ |
| S46 | **Waitlist + cancellation pounce.** Candidate joins a watch-list; any freed slot (cancellation, calendar change) is auto-offered to the head of the queue, first-accept-wins under the existing race protection. | ⬜ |
| S47 | **Escalate with options.** After N stuck days: coordinator task + bell notification presenting concrete choices (approve over-cap slot / substitute X / extend horizon) instead of a bare alarm. | ⬜ |
| S48 | **Structural capacity.** Reserved weekly "interview office-hours" blocks that self-scheduling draws from first; utilization analytics exposing chronic bottleneck interviewers; pool-widening via shadow training (S18). | 🔶 dedicated INTERVIEW_BLOCK weekly rules shipped (offers land only inside them); analytics pending |
| S49 | **Hold the candidate's trust.** While resolving: proactive "finding you a time, expect options by <date>" message with an SLA timer and a break-warning nudge. | ⬜ |

---

## Part B — Policy CMS + candidate Q&A through the career-site chat

The goal: a candidate on the career site asks "how many vacation days do I get?" or "what's the
maternity policy?" — the chat detects the intent, retrieves the answer **only from published
policy documents**, answers with a citation, and hands off to a human when it can't.

### B1. CMS (admin side)

| # | Scenario | Status |
|---|---|---|
| C1 | **Policy library.** Admin section to create/upload policy content (Markdown editor + PDF/URL ingest), categorized: Benefits, Leave & Holidays, Parental/Maternity, Health, Retirement/401k, Relocation, Visa & Immigration, Culture & DEI, Compensation practices. | ⬜ |
| C2 | **Versioning & effective dates.** Every doc has versions, an effective date, and a changelog; the chat always answers from the current published version. | ⬜ |
| C3 | **Audience scoping.** Docs tagged by country/entity/business unit; retrieval filters by the candidate's context and *asks* when ambiguous ("US or UK role?"). | ⬜ |
| C4 | **Publish workflow.** Draft → review → published, routed through the existing approval engine (a "Policy" trigger workflow) — reusing the canvas, roles and notifications we already built. | ⬜ engine ready, wiring new |
| C5 | **Retrieval indexing.** On publish, docs are chunked + indexed (keyword/BM25 first; embeddings via the ClaudeBrain seam later). Search runs server-side in the service tier. | ⬜ |
| C6 | **Answer test console.** Admins ask questions as-a-candidate against the live index to QA coverage before publishing. | ⬜ |

### B2. Chat answering (candidate side)

| # | Scenario | Status |
|---|---|---|
| C7 | **Intent detection.** Career-site chat classifies policy questions (holiday / maternity / benefits / 401k / insurance / visa …) apart from apply/schedule intents, without derailing an in-progress flow. | 🔶 intent routing exists for apply/schedule; policy intent new |
| C8 | **Grounded answers with citation.** Answer summarized from retrieved chunks; always cites the source doc + section, links to the full policy page; **never answers from outside the published corpus**. | ⬜ |
| C9 | **Clarify when ambiguous.** Multiple audience-scoped versions match → one clarifying question, then answer. | ⬜ |
| C10 | **Honest fallback + handoff.** No confident answer → say so, offer to connect a recruiter: creates a task + notification (bell) with the question and candidate contact. | ⬜ |
| C11 | **Return to flow.** Mid-application or mid-scheduling, a policy question is answered inline and the prior flow resumes exactly where it left off (continuous-conversation model). | 🔶 conversation state machine exists |
| C12 | **Compliance guardrails.** Benefits/legal disclaimer on answers; no personalized legal/financial advice; PII never echoed into logs. | ⬜ |
| C13 | **Content-gap analytics.** Unanswered/low-confidence questions logged and clustered → admin sees "what candidates ask that we can't answer" → feeds C1 authoring. | ⬜ |
| C14 | **Public policy pages.** Published docs also render as career-site pages (the chat links to them), completing the self-hosted careers portal. | ⬜ |

---

## Phasing (proposed)

**Phase 1 — Scheduler hardening (mostly 🔶 → ✅)**
S1 self-schedule link page, S2 timezones, S4 reschedule limits, S5 cancel, S7 actionable
reminders via Communications templates (S37), S12 SLA nudges, S14/S15 per-interviewer
hours & caps, S39/S40 policy guardrails.

**Phase 2 — Pools, loops, superdays**
S16 pools, S17 fairness rotation, S19 declines/substitution, S22–S27 loops & cascade,
(NEW 2026-08-15: per-requisition interview plans — rounds 1..N with aligned interviewers,
defined at intake on /availability, round-driven self-scheduling, blocked-panel notifications —
cover the plan/round half of the loop scenarios),
S29 batch, S30 superday (ties into Campus), S34 scorecard chase, S43–S49 fully-booked
playbook (widening + substitution + waitlist in P2; ask-to-overbook and office-hours in P4
with calendar sync).

**Phase 3 — Policy CMS + chat Q&A** *(can run in parallel with Phase 2 — different surface)*
C1–C5 CMS + indexing + publish workflow, C7–C11 chat answering with citations and handoff,
C6 test console, C12 guardrails, C13 gap analytics, C14 public pages.

**Phase 4 — Intelligence & integrations**
S10 NL booking + C5 embeddings (both light up via the ClaudeBrain seam + API key),
S13 real Graph/Google calendar sync, S28 conflict watch, S35 analytics, S36 real SMS/WhatsApp.

---

*Compiled 2026-08-14 against the state of the TA Portal at commit `57d1efc`. Product references
(Paradox/Olivia, GoodTime, ModernLoop, Prelude, Greenhouse/Ashby) reflect their publicly known
capabilities as comparison anchors, not feature-for-feature claims.*
