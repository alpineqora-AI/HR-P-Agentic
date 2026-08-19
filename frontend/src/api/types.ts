// Mirrors the backend DTOs (com.taportal.api.*). See docs/CONTRACT.md.
// IDs serialize as strings, money as number, dates as ISO strings.

// ---- Jobs / requisitions ----

export interface JobSummary {
  id: string
  title: string
  department: string
  location: string
  workMode: string
  employmentType: string
  family: string
  status: string
  openings: number
  payMin: number
  payMax: number
  payPeriod: string
  applicants: number
  postedAt: string
  summary: string
}

export interface SkillRef {
  id: string
  name: string
  category: string
  weight: number
  required: boolean
}

export interface Knockout {
  id: string
  ordinal: number
  prompt: string
  answerType: string
  choices: string[]
  required: boolean
}

export interface JobPreview {
  headline: string
  mediaUrl: string
  dayInLife: string
}

export interface JobDetail extends JobSummary {
  description: string
  hiringManager: string
  recruiter: string
  skills: SkillRef[]
  knockoutQuestions: Knockout[]
  preview: JobPreview
  languages: string[]
  stageCounts: Record<string, number>
}

// ---- Candidates ----

export interface CandidateSummary {
  id: string
  name: string
  email: string
  location: string
  headline: string
  yearsExperience: number
  source: string
  lifecycle: string
  preferredLanguage: string
  applicationCount: number
  topSkills: string[]
}

export interface CandidateSkill {
  name: string
  category: string
  proficiency: string
  years: number
  inferred: boolean
}

export interface CandidateDetail extends CandidateSummary {
  phone: string
  skills: CandidateSkill[]
  applications: ApplicationRow[]
}

// ---- Applications / pipeline ----

export interface ApplicationRow {
  id: string
  candidateId: string
  candidateName: string
  jobId: string
  jobTitle: string
  stage: string
  source: string
  fitScore: number
  knockoutPassed: boolean
  appliedAt: string
  updatedAt: string
}

export interface PipelineColumn {
  stage: string
  count: number
  cards: ApplicationRow[]
}

// ---- Interviews / scheduling ----

export interface Interview {
  id: string
  applicationId: string
  type: string
  scheduledAt: string
  durationMin: number
  status: string
  interviewers: string[]
  score: number
  recommendation: string
  summary: string
  meetingLink: string | null
}

export interface Slot {
  id: string
  jobId: string
  interviewerId: string
  interviewerName: string
  startsAt: string
  endsAt: string
  booked: boolean
  interviewId: string | null
  status: string
}

// ---- Scheduling radar ----

export interface AttentionItem {
  interviewId: string
  applicationId: string
  candidateName: string
  jobTitle: string
  status: string
  scheduledAt: string | null
  waitingHours: number
  meetingLink: string | null
  interviewers: string[]
}

export interface InterviewerLoad {
  userId: string
  name: string
  initials: string
  role: string
  next7Days: number
}

export interface SchedulingOverview {
  awaitingCandidate: AttentionItem[]
  needsOutcome: AttentionItem[]
  noShows: AttentionItem[]
  today: AttentionItem[]
  load: InterviewerLoad[]
}

// ---- Forms ----

export interface FormDefinitionDto {
  id: string
  purpose: string
  name: string
  schema: string
  template: boolean
  defaultForKind: boolean
  updatedAt: string
}

/** Library listing row (schema omitted). */
export interface FormMeta {
  id: string
  purpose: string
  name: string
  template: boolean
  defaultForKind: boolean
  updatedAt: string
}

export interface FormResponseRow {
  id: string
  formPurpose: string
  answers: string
  createdAt: string
}

// ---- Assessments ----

export interface Assessment {
  id: string
  applicationId: string
  type: string
  name: string
  status: string
  score: number
  percentile: number
  completedAt: string
}

// ---- Offers ----

export interface Offer {
  id: string
  applicationId: string
  candidateName: string
  jobTitle: string
  title: string
  compBase: number
  compPeriod: string
  compBonus: number
  equity: string
  startDate: string
  status: string
  letterBody: string
  sentAt: string
}

// ---- Onboarding ----

export interface OnboardingTask {
  id: string
  applicationId: string
  name: string
  category: string
  status: string
  dueDate: string
}

// ---- Talent intelligence ----

export interface MatchRow {
  candidateId: string
  candidateName: string
  headline: string
  fitScore: number
  explanation: string
  matchedSkills: string[]
  gapSkills: string[]
}

export interface SourcingRow {
  candidateId: string
  candidateName: string
  headline: string
  location: string
  fitScore: number
  lifecycle: string
  source: string
}

export interface MobilityRow {
  employeeId: string
  employeeName: string
  currentRole: string
  jobId: string
  jobTitle: string
  fitScore: number
  rationale: string
}

// ---- Engagement ----

export interface Pool {
  id: string
  name: string
  description: string
  memberCount: number
}

export interface Campaign {
  id: string
  name: string
  audience: string
  channel: string
  status: string
  sent: number
  opened: number
  replied: number
  openRate: number
  replyRate: number
}

export interface Referral {
  id: string
  referrerName: string
  candidateName: string
  jobTitle: string
  status: string
  bonusAmount: number
  createdAt: string
}

export interface EventRow {
  id: string
  name: string
  type: string
  location: string
  startsAt: string
  endsAt: string | null
  timezone: string
  /** Latest approval status (PENDING/APPROVED/AUTO_APPROVED/REJECTED), null if never routed. */
  approvalStatus: string | null
  registrations: number
  attended: number
  hires: number
}

// ---- Campus: schools + event rosters ----

export interface School {
  id: string
  name: string
  location: string | null
  tier: string
}

export interface EventRegistration {
  id: string
  eventId: string
  candidateId: string | null
  name: string
  email: string
  schoolId: string | null
  schoolName: string | null
  major: string | null
  gradYear: number | null
  source: string
  status: string
  checkedInAt: string | null
}

export interface RegisterAttendeeInput {
  name: string
  email: string
  schoolId?: string
  major?: string
  gradYear?: number
  walkIn?: boolean
}

export interface EventCreate {
  name: string
  type: string
  location: string
  startsAt: string
  endsAt?: string
  timezone?: string
  intakeFormId?: string
  /** Route this event down the workflow's flagged/exception path. */
  flaggedCritical?: boolean
}

// ---- Write payloads (recruiter actions) ----

export interface JobCreate {
  title: string
  department: string
  location: string
  workMode: string
  employmentType: string
  family: string
  status: string
  openings: number
  summary?: string
  description?: string
  payMin?: number
  payMax?: number
  payPeriod?: string
}

export interface OfferCreate {
  applicationId: string
  title: string
  compBase?: number
  compPeriod?: string
  compBonus?: number
  equity?: string
  startDate?: string
  letterBody?: string
}

export interface InterviewCreate {
  applicationId: string
  type: string
  durationMin?: number
  interviewers?: string
}

export interface ScheduleInterviewInput {
  id: string
  slotId: string
  scheduledAt?: string
}

export interface PoolCreate {
  name: string
  description?: string
}

export interface SurveyRow {
  id: string
  name: string
  stage: string
  sent: number
  responses: number
  avgSentiment: number
  nps: number
  responseRate: number
}

export interface CopilotArtifact {
  id: string
  kind: string
  jobTitle: string
  content: string
  createdAt: string
}

// ---- Platform ----

export interface Integration {
  id: string
  name: string
  category: string
  status: string
  lastSyncAt: string
}

export interface BiasRow {
  id: string
  jobTitle: string
  stage: string
  dimension: string
  groupLabel: string
  passRate: number
  impactRatio: number
  flagged: boolean
}

export interface AuditRow {
  id: string
  actor: string
  action: string
  entityType: string
  detail: string
  createdAt: string
}

export interface FunnelStage {
  stage: string
  count: number
}

export interface AnalyticsSummary {
  openJobs: number
  activeCandidates: number
  applications30d: number
  interviews30d: number
  offers30d: number
  hires30d: number
  avgTimeToHireDays: number
  avgFitScore: number
  offerAcceptRate: number
  byStage: Record<string, number>
  funnel: FunnelStage[]
}

// ---- Aria conversation engine ----

export interface ChatMessage {
  id: string
  sender: string
  body: string
  intent: string
  createdAt: string
}

export interface ChatState {
  conversationId: string
  status: string
  step: string
  messages: ChatMessage[]
  options?: string[]
  applicationId?: string
}

// ---- Request payloads ----

export interface StartChatInput {
  jobId: string
  channel: string
  language: string
}

export interface ChatReplyInput {
  conversationId: string
  text: string
}

export interface GenerateCopilotInput {
  kind: string
  jobId?: string
  prompt?: string
}

export interface UpdateApplicationStageInput {
  id: string
  stage: string
}
