# TA Portal — build conventions & API contract

This is the single source of truth that keeps the backend and frontend coherent.
Every agent building a slice MUST follow this.

## Stack & conventions (mirror the VMS project)

Reference implementation to copy patterns from (read these for exact style):
- Backend domain slice: `…/VMS/backend/src/main/java/com/vms/domain/supplier/*` and `…/VMS/api/SupplierController.java`, `SupplierDtos.java`
- Frontend page: `…/VMS/frontend/src/pages/SuppliersPage.tsx`; api: `…/VMS/frontend/src/api/{client,hooks,types}.ts`

Backend rules:
- Package root `com.taportal`. Domain packages under `com.taportal.domain.<area>`; controllers + DTO records under `com.taportal.api`.
- **Entities are FLAT** (Lombok `@Getter @NoArgsConstructor @AllArgsConstructor`, `@Setter` per mutable field). Use JPA `@Enumerated(EnumType.STRING)` for enums, `@GeneratedValue(strategy = GenerationType.UUID)` for ids. **Do NOT use `@ManyToOne`/`@OneToMany` across aggregates** — reference other aggregates by `UUID` column field (e.g. `jobId`), exactly like VMS. This keeps modules independent.
- Column names: match `V1__schema.sql` exactly (snake_case via `@Column(name="…")`). `created_at`/`updated_at` via `@CreationTimestamp`/`@UpdateTimestamp`.
- Repositories: `extends JpaRepository<Entity, UUID>`; add derived queries as needed.
- Services: `@Service @Transactional(readOnly = true)`; write methods annotated `@Transactional`. Map entities → DTO records in the service.
- Controllers: `@RestController @RequestMapping("/v1/<resource>")`. Return DTO records. POST/PATCH take request records (`jakarta.validation` annotations where useful).
- DTOs: Java `record`s grouped in one `<Area>Dtos.java` file per controller (see `SupplierDtos`).
- IDs serialize as strings (UUID → JSON string). Money as number. Dates as ISO strings.

Frontend rules:
- React 18 + Vite + TS, `@/` alias → `src/`. Data via `@tanstack/react-query` + `axios` (`src/api/client.ts` base = `http://localhost:8092/v1`).
- Use the design-system classes from `ds-product.css` (`.card`, `.btn`, `.btn--primary`, `.badge`, `.table`, `.input`, `.nav-item`, `.app__*`, `.eyebrow`, etc.). Do NOT invent new visual primitives; compose existing ones. Headings use `h1..h6`/`.h1..`.
- Each page is a default-exported component in `src/pages/`. Candidate-facing pages in `src/pages/candidate/`.
- Types in `src/api/types.ts` MUST mirror the DTO records below. Hooks in `src/api/hooks.ts`.

## REST endpoints (all under `/v1`)

Recruiter/ATS:
- `GET /jobs`, `GET /jobs/{id}`, `POST /jobs`, `PATCH /jobs/{id}` — job incl. skills[], knockoutQuestions[], counts (applicants, by stage)
- `GET /candidates`, `GET /candidates/{id}` — candidate incl. skills[], applications[]
- `GET /applications?jobId=&stage=` , `GET /applications/{id}`, `PATCH /applications/{id}` (stage change) — pipeline rows
- `GET /pipeline?jobId=` — board grouped by stage (counts + cards)
- `GET /interviews?applicationId=`, `POST /interviews`, `GET /slots?jobId=` , `POST /interviews/{id}/schedule`
- `GET /assessments?applicationId=`
- `GET /offers`, `GET /offers/{id}`, `POST /offers`, `POST /offers/{id}/send`
- `GET /onboarding?applicationId=`
- Talent intelligence: `GET /match?jobId=` (ranked candidates w/ fitScore), `GET /sourcing?jobId=` (passive talent), `GET /reactivation` (dormant re-matched), `GET /mobility` (internal matches)
- Engagement: `GET /pools`, `GET /campaigns`, `GET /referrals`, `GET /events`, `GET /surveys`, `GET /copilot` + `POST /copilot/generate`
- Platform: `GET /integrations`, `GET /compliance/bias`, `GET /audit`, `GET /analytics/summary`, `GET /analytics/metrics?key=`

Candidate-facing (the Aria experience):
- `GET /careers/jobs` (public open jobs + summary), `GET /careers/jobs/{id}` (detail + immersive preview)
- `POST /chat/start` {jobId, channel, language} → conversation + first Aria message
- `POST /chat/{conversationId}/reply` {text} → next Aria message(s) + state (advances apply → knockout screen → schedule). This is the **scripted, LLM-ready** engine.
- `GET /chat/{conversationId}` → full transcript

## DTO shapes (mirror exactly in types.ts)

```
JobSummary   { id, title, department, location, workMode, employmentType, family, status, openings, payMin, payMax, payPeriod, applicants, postedAt, summary }
JobDetail    = JobSummary + { description, hiringManager, recruiter, skills: SkillRef[], knockoutQuestions: Knockout[], preview: {headline, mediaUrl, dayInLife}, languages: string[], stageCounts: Record<string,number> }
SkillRef     { id, name, category, weight, required }
Knockout     { id, ordinal, prompt, answerType, choices: string[], required }
CandidateSummary { id, name, email, location, headline, yearsExperience, source, lifecycle, preferredLanguage, applicationCount, topSkills: string[] }
CandidateDetail = CandidateSummary + { phone, skills: {name,category,proficiency,years,inferred}[], applications: ApplicationRow[] }
ApplicationRow   { id, candidateId, candidateName, jobId, jobTitle, stage, source, fitScore, knockoutPassed, appliedAt, updatedAt }
PipelineColumn   { stage, count, cards: ApplicationRow[] }
Interview    { id, applicationId, type, scheduledAt, durationMin, status, interviewers: string[], score, recommendation, summary }
Slot         { id, jobId, interviewerId, interviewerName, startsAt, endsAt, booked }
Assessment   { id, applicationId, type, name, status, score, percentile, completedAt }
Offer        { id, applicationId, candidateName, jobTitle, title, compBase, compPeriod, compBonus, equity, startDate, status, letterBody, sentAt }
OnboardingTask { id, applicationId, name, category, status, dueDate }
MatchRow     { candidateId, candidateName, headline, fitScore, explanation, matchedSkills: string[], gapSkills: string[] }
SourcingRow  { candidateId, candidateName, headline, location, fitScore, lifecycle, source }
MobilityRow  { employeeId, employeeName, currentRole, jobId, jobTitle, fitScore, rationale }
Pool         { id, name, description, memberCount }
Campaign     { id, name, audience, channel, status, sent, opened, replied, openRate, replyRate }
Referral     { id, referrerName, candidateName, jobTitle, status, bonusAmount, createdAt }
EventRow     { id, name, type, location, startsAt, registrations, attended, hires }
SurveyRow    { id, name, stage, sent, responses, avgSentiment, nps, responseRate }
CopilotArtifact { id, kind, jobTitle, content, createdAt }
Integration  { id, name, category, status, lastSyncAt }
BiasRow      { id, jobTitle, stage, dimension, groupLabel, passRate, impactRatio, flagged }
AuditRow     { id, actor, action, entityType, detail, createdAt }
AnalyticsSummary { openJobs, activeCandidates, applications30d, interviews30d, offers30d, hires30d, avgTimeToHireDays, avgFitScore, offerAcceptRate, byStage: Record<string,number>, funnel: {stage,count}[] }
ChatMessage  { id, sender, body, intent, createdAt }
ChatState    { conversationId, status, step, messages: ChatMessage[], options?: string[], applicationId? }
```

## Aria conversation engine (scripted, LLM-ready)

A `ConversationEngine` service drives the candidate chat deterministically, with a single
seam (`AssistantBrain` interface) so a Claude-backed implementation can be dropped in later
without touching the controller. Flow/state machine:

`GREETING → COLLECT_PROFILE (name/email/phone) → KNOCKOUT (ask each knockout_question in order, evaluate disqualify rule) → [if passed] OFFER_SCHEDULE (present interview_slots, book one → create interview) → DONE` (creates candidate + application, advances stage APPLIED→SCREENED→INTERVIEW). On knockout failure → polite decline, stage REJECTED. Each reply returns the next message(s) + `step` + optional quick-reply `options`.

## Error contract (GlobalExceptionHandler)

Every failed request returns one envelope, translated by `api/GlobalExceptionHandler`
(three-tier rule: no framework or database detail reaches the client):

```json
{ "code": "BUSINESS_RULE_VIOLATION", "message": "Required question has no answer: School", "fieldErrors": { "email": "must not be blank" } }
```

| Status | code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Bean Validation on DTOs (`fieldErrors` populated) or malformed input |
| 404 | `NOT_FOUND` | Missing aggregate (service `EntityNotFoundException` / 404 RSE) |
| 409 | `CONFLICT` | Duplicates & races: service checks, DB unique constraints, optimistic locks |
| 422 | `BUSINESS_RULE_VIOLATION` | Service-layer rule rejections (form logic, workflow state) |
| 500 | `INTERNAL_ERROR` | Unexpected — logged server-side, generic message only |

Clients should read `message` for display and `code` for branching.
