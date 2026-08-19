import { useMemo } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  SchedulingOverview,
  FormDefinitionDto,
  FormMeta,
  FormResponseRow,
  School,
  EventRegistration,
  RegisterAttendeeInput,
  AnalyticsSummary,
  ApplicationRow,
  Assessment,
  AuditRow,
  BiasRow,
  Campaign,
  CandidateDetail,
  CandidateSummary,
  ChatReplyInput,
  ChatState,
  CopilotArtifact,
  EventCreate,
  EventRow,
  InterviewCreate,
  JobCreate,
  OfferCreate,
  PoolCreate,
  ScheduleInterviewInput,
  GenerateCopilotInput,
  Integration,
  Interview,
  JobDetail,
  JobSummary,
  MatchRow,
  MobilityRow,
  Offer,
  OnboardingTask,
  PipelineColumn,
  Pool,
  Referral,
  Slot,
  SourcingRow,
  StartChatInput,
  SurveyRow,
  UpdateApplicationStageInput,
} from './types'

// Centralised query keys so mutations can invalidate precisely.
export const qk = {
  jobs: ['jobs'] as const,
  job: (id: string | undefined) => ['job', id] as const,
  candidates: ['candidates'] as const,
  candidate: (id: string | undefined) => ['candidate', id] as const,
  applications: (params?: ApplicationsParams) => ['applications', params ?? {}] as const,
  pipeline: (jobId: string | undefined) => ['pipeline', jobId] as const,
  interviews: (applicationId: string | undefined) => ['interviews', applicationId] as const,
  slots: (jobId: string | undefined) => ['slots', jobId] as const,
  assessments: (applicationId: string | undefined) => ['assessments', applicationId] as const,
  offers: ['offers'] as const,
  onboarding: (applicationId: string | undefined) => ['onboarding', applicationId] as const,
  match: (jobId: string | undefined) => ['match', jobId] as const,
  sourcing: (jobId: string | undefined) => ['sourcing', jobId] as const,
  reactivation: ['reactivation'] as const,
  mobility: ['mobility'] as const,
  pools: ['pools'] as const,
  campaigns: ['campaigns'] as const,
  referrals: ['referrals'] as const,
  events: ['events'] as const,
  surveys: ['surveys'] as const,
  copilot: ['copilot'] as const,
  integrations: ['integrations'] as const,
  bias: ['bias'] as const,
  audit: ['audit'] as const,
  analyticsSummary: ['analytics', 'summary'] as const,
  careerJobs: ['careers', 'jobs'] as const,
  careerJob: (id: string | undefined) => ['careers', 'job', id] as const,
  chat: (conversationId: string | undefined) => ['chat', conversationId] as const,
}

export interface ApplicationsParams {
  jobId?: string
  stage?: string
}

// ---- Jobs / requisitions ----

export function useJobs() {
  return useQuery({ queryKey: qk.jobs, queryFn: () => api.get<JobSummary[]>('/jobs').then((r) => r.data) })
}

export function useJob(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.job(id),
    queryFn: () => api.get<JobDetail>(`/jobs/${id}`).then((r) => r.data),
  })
}

// ---- Candidates ----

export function useCandidates() {
  return useQuery({
    queryKey: qk.candidates,
    queryFn: () => api.get<CandidateSummary[]>('/candidates').then((r) => r.data),
  })
}

export function useCandidate(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.candidate(id),
    queryFn: () => api.get<CandidateDetail>(`/candidates/${id}`).then((r) => r.data),
  })
}

// ---- Applications / pipeline ----

export function useApplications(params?: ApplicationsParams) {
  return useQuery({
    queryKey: qk.applications(params),
    queryFn: () => api.get<ApplicationRow[]>('/applications', { params }).then((r) => r.data),
  })
}

export function usePipeline(jobId: string | undefined) {
  return useQuery({
    enabled: !!jobId,
    queryKey: qk.pipeline(jobId),
    queryFn: () => api.get<PipelineColumn[]>('/pipeline', { params: { jobId } }).then((r) => r.data),
  })
}

// ---- Interviews / scheduling ----

export function useInterviews(applicationId: string | undefined) {
  return useQuery({
    enabled: !!applicationId,
    queryKey: qk.interviews(applicationId),
    queryFn: () => api.get<Interview[]>('/interviews', { params: { applicationId } }).then((r) => r.data),
  })
}

export function useSlots(jobId: string | undefined) {
  return useQuery({
    enabled: !!jobId,
    queryKey: qk.slots(jobId),
    queryFn: () => api.get<Slot[]>('/slots', { params: { jobId } }).then((r) => r.data),
  })
}

// Calendar-driven scheduling actions (ported from the VMS engine). All of them
// change interview + slot state, so invalidate both families broadly.
function useSchedulingMutation<TArg>(fn: (arg: TArg) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviews'] })
      qc.invalidateQueries({ queryKey: ['slots'] })
      qc.invalidateQueries({ queryKey: ['scheduling-overview'] })
    },
  })
}

/** Recruiter one-click: offer times computed from the hiring team's calendars.
 *  Pass interviewerUserIds to set/replace the panel first. */
export function useProposeTimes() {
  return useSchedulingMutation(({ interviewId, interviewerUserIds }: { interviewId: string; interviewerUserIds?: string[] }) =>
    api.post(`/interviews/${interviewId}/propose`, interviewerUserIds ? { interviewerUserIds } : {}))
}

/** The cross-job scheduling radar: what's stuck, what's today, who's loaded. */
export function useSchedulingOverview() {
  return useQuery({
    queryKey: ['scheduling-overview'],
    queryFn: () => api.get<SchedulingOverview>('/scheduling/overview').then((r) => r.data),
    refetchInterval: 15_000,
  })
}

/** Free the booked time and immediately re-offer fresh options. */
export function useRescheduleInterview() {
  return useSchedulingMutation((interviewId: string) => api.post(`/interviews/${interviewId}/reschedule`))
}

/** COMPLETED | CANCELED | NO_SHOW. */
export function useTransitionInterview() {
  return useSchedulingMutation(({ interviewId, status }: { interviewId: string; status: string }) =>
    api.post(`/interviews/${interviewId}/transition`, { status }))
}

/** The options currently awaiting the candidate for an interview. */
export function useProposedSlots(interviewId: string | undefined) {
  return useQuery({
    enabled: !!interviewId,
    queryKey: ['proposed-slots', interviewId],
    queryFn: () => api.get<Slot[]>(`/interviews/${interviewId}/proposed-slots`).then((r) => r.data),
  })
}

// ---- Forms (purpose-keyed definitions + responses) ----

export function useFormDefinition(purpose: string) {
  return useQuery({
    queryKey: ['form', purpose],
    queryFn: () => api.get<FormDefinitionDto>(`/forms/${purpose}`).then((r) => r.data),
  })
}

export function useSaveFormDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ purpose, name, schema }: { purpose: string; name: string; schema: string }) =>
      api.put(`/forms/${purpose}`, { name, schema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['form'] }),
  })
}

export function useSubmitFormResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ purpose, subjectType, subjectId, answers, formId }: { purpose: string; subjectType: string; subjectId: string; answers: string; formId?: string }) =>
      api.post(`/forms/${purpose}/responses`, { subjectType, subjectId, answers, formId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['form-responses'] }),
  })
}

// ---- Form library (many named forms per kind + templates) ----

export function useFormsList() {
  return useQuery({
    queryKey: ['form-defs'],
    queryFn: () => api.get<FormMeta[]>('/form-defs').then((r) => r.data),
  })
}

export function useFormDefById(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['form-def', id],
    queryFn: () => api.get<FormDefinitionDto>(`/form-defs/${id}`).then((r) => r.data),
  })
}

function useLibraryMutation<TArg>(fn: (arg: TArg) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-defs'] })
      qc.invalidateQueries({ queryKey: ['form-def'] })
      qc.invalidateQueries({ queryKey: ['form'] })
    },
  })
}

export function useCreateForm() {
  return useLibraryMutation((input: { purpose: string; name: string; fromFormId?: string; template?: boolean }) =>
    api.post<FormDefinitionDto>('/form-defs', input).then((r) => r.data))
}

export function useUpdateFormDef() {
  return useLibraryMutation(({ id, name, schema }: { id: string; name: string; schema: string }) =>
    api.put(`/form-defs/${id}`, { name, schema }))
}

export function useSaveAsTemplate() {
  return useLibraryMutation(({ id, name }: { id: string; name: string }) =>
    api.post(`/form-defs/${id}/save-as-template`, { name }))
}

export function useMakeDefaultForm() {
  return useLibraryMutation((id: string) => api.post(`/form-defs/${id}/make-default`))
}

export function useDeleteForm() {
  return useLibraryMutation((id: string) => api.delete(`/form-defs/${id}`))
}

export function useFormResponses(subjectType: string, subjectId: string | undefined) {
  return useQuery({
    enabled: !!subjectId,
    queryKey: ['form-responses', subjectType, subjectId],
    queryFn: () => api.get<FormResponseRow[]>('/form-responses', { params: { subjectType, subjectId } }).then((r) => r.data),
  })
}

// ---- Campus: schools + event rosters ----

export function useSchools() {
  return useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools').then((r) => r.data),
  })
}

export function useEventRoster(eventId: string | undefined) {
  return useQuery({
    enabled: !!eventId,
    queryKey: ['event-roster', eventId],
    queryFn: () => api.get<EventRegistration[]>(`/events/${eventId}/registrations`).then((r) => r.data),
  })
}

function useRosterMutation<TArg>(fn: (arg: TArg) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-roster'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
    },
  })
}

/** Pre-registration or booth walk-in — also materializes the candidate. */
export function useRegisterAttendee() {
  return useRosterMutation(({ eventId, input }: { eventId: string; input: RegisterAttendeeInput }) =>
    api.post(`/events/${eventId}/registrations`, input))
}

/** CHECKED_IN | NO_SHOW | REGISTERED */
export function useRegistrationTransition() {
  return useRosterMutation(({ registrationId, status }: { registrationId: string; status: string }) =>
    api.post(`/event-registrations/${registrationId}/transition`, { status }))
}

// Pipelines for many jobs at once (jobs×stages matrix). /pipeline is per-job,
// so fan out one query per job and key the result by jobId.
export function useAllPipelines(jobIds: string[]) {
  const results = useQueries({
    queries: jobIds.map((id) => ({
      enabled: !!id,
      queryKey: qk.pipeline(id),
      queryFn: () => api.get<PipelineColumn[]>('/pipeline', { params: { jobId: id } }).then((r) => r.data),
    })),
  })
  const signature = results.map((r) => r.dataUpdatedAt).join(',')
  const byJob = useMemo(() => {
    const map: Record<string, PipelineColumn[]> = {}
    jobIds.forEach((id, i) => {
      map[id] = results[i]?.data ?? []
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, jobIds.join(',')])
  const isLoading = results.length > 0 && results.some((r) => r.isLoading)
  return { byJob, isLoading }
}

// Open/booked slots across many jobs (for the Overview schedule timeline).
export function useAllSlots(jobIds: string[]) {
  const results = useQueries({
    queries: jobIds.map((id) => ({
      enabled: !!id,
      queryKey: qk.slots(id),
      queryFn: () => api.get<Slot[]>('/slots', { params: { jobId: id } }).then((r) => r.data),
    })),
  })
  const signature = results.map((r) => r.dataUpdatedAt).join(',')
  const slots = useMemo(
    () => results.flatMap((r) => r.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  )
  const isLoading = results.length > 0 && results.some((r) => r.isLoading)
  return { slots, isLoading }
}

// All interviews for a job, aggregated across its applications.
// (/interviews is application-scoped, so we fan out one query per application.)
export function useJobInterviews(applicationIds: string[]) {
  const results = useQueries({
    queries: applicationIds.map((id) => ({
      enabled: !!id,
      queryKey: qk.interviews(id),
      queryFn: () => api.get<Interview[]>('/interviews', { params: { applicationId: id } }).then((r) => r.data),
    })),
  })
  const signature = results.map((r) => r.dataUpdatedAt).join(',')
  const interviews = useMemo(
    () => results.flatMap((r) => r.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  )
  const isLoading = results.length > 0 && results.some((r) => r.isLoading)
  return { interviews, isLoading }
}

// ---- Assessments ----

export function useAssessments(applicationId?: string) {
  return useQuery({
    queryKey: qk.assessments(applicationId),
    queryFn: () => api.get<Assessment[]>('/assessments', { params: { applicationId } }).then((r) => r.data),
  })
}

// ---- Offers ----

export function useOffers() {
  return useQuery({ queryKey: qk.offers, queryFn: () => api.get<Offer[]>('/offers').then((r) => r.data) })
}

// ---- Onboarding ----

export function useOnboarding(applicationId?: string) {
  return useQuery({
    queryKey: qk.onboarding(applicationId),
    queryFn: () => api.get<OnboardingTask[]>('/onboarding', { params: { applicationId } }).then((r) => r.data),
  })
}

// ---- Talent intelligence ----

export function useMatch(jobId: string | undefined) {
  return useQuery({
    enabled: !!jobId,
    queryKey: qk.match(jobId),
    queryFn: () => api.get<MatchRow[]>('/match', { params: { jobId } }).then((r) => r.data),
  })
}

export function useSourcing(jobId: string | undefined) {
  return useQuery({
    enabled: !!jobId,
    queryKey: qk.sourcing(jobId),
    queryFn: () => api.get<SourcingRow[]>('/sourcing', { params: { jobId } }).then((r) => r.data),
  })
}

export function useReactivation() {
  return useQuery({
    queryKey: qk.reactivation,
    queryFn: () => api.get<MatchRow[]>('/reactivation').then((r) => r.data),
  })
}

export function useMobility() {
  return useQuery({ queryKey: qk.mobility, queryFn: () => api.get<MobilityRow[]>('/mobility').then((r) => r.data) })
}

// ---- Engagement ----

export function usePools() {
  return useQuery({ queryKey: qk.pools, queryFn: () => api.get<Pool[]>('/pools').then((r) => r.data) })
}

export function useCampaigns() {
  return useQuery({ queryKey: qk.campaigns, queryFn: () => api.get<Campaign[]>('/campaigns').then((r) => r.data) })
}

export function useReferrals() {
  return useQuery({ queryKey: qk.referrals, queryFn: () => api.get<Referral[]>('/referrals').then((r) => r.data) })
}

export function useEvents() {
  return useQuery({ queryKey: qk.events, queryFn: () => api.get<EventRow[]>('/events').then((r) => r.data) })
}

export function useSurveys() {
  return useQuery({ queryKey: qk.surveys, queryFn: () => api.get<SurveyRow[]>('/surveys').then((r) => r.data) })
}

export function useCopilot() {
  return useQuery({ queryKey: qk.copilot, queryFn: () => api.get<CopilotArtifact[]>('/copilot').then((r) => r.data) })
}

// ---- Platform ----

export function useIntegrations() {
  return useQuery({
    queryKey: qk.integrations,
    queryFn: () => api.get<Integration[]>('/integrations').then((r) => r.data),
  })
}

export function useBias() {
  return useQuery({ queryKey: qk.bias, queryFn: () => api.get<BiasRow[]>('/compliance/bias').then((r) => r.data) })
}

export function useAudit() {
  return useQuery({ queryKey: qk.audit, queryFn: () => api.get<AuditRow[]>('/audit').then((r) => r.data) })
}

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: qk.analyticsSummary,
    queryFn: () => api.get<AnalyticsSummary>('/analytics/summary').then((r) => r.data),
  })
}

// ---- Candidate-facing (career site) ----

export function useCareerJobs() {
  return useQuery({
    queryKey: qk.careerJobs,
    queryFn: () => api.get<JobSummary[]>('/careers/jobs').then((r) => r.data),
  })
}

export function useCareerJob(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: qk.careerJob(id),
    queryFn: () => api.get<JobDetail>(`/careers/jobs/${id}`).then((r) => r.data),
  })
}

// Recruiter-facing: the Aria transcript tied to an application (null if none).
export function useApplicationConversation(applicationId: string | undefined, enabled: boolean) {
  return useQuery({
    enabled: enabled && !!applicationId,
    queryKey: ['conversation', 'by-application', applicationId],
    queryFn: () =>
      api.get<ChatState | null>(`/chat/by-application/${applicationId}`).then((r) => r.data),
  })
}

export function useChat(conversationId: string | undefined) {
  return useQuery({
    enabled: !!conversationId,
    queryKey: qk.chat(conversationId),
    queryFn: () => api.get<ChatState>(`/chat/${conversationId}`).then((r) => r.data),
  })
}

// ---- Mutations ----

export function useStartChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: StartChatInput) => api.post<ChatState>('/chat/start', input).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(qk.chat(data.conversationId), data),
  })
}

export function useChatReply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, text }: ChatReplyInput) =>
      api.post<ChatState>(`/chat/${conversationId}/reply`, { text }).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(qk.chat(data.conversationId), data),
  })
}

export function useGenerateCopilot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateCopilotInput) =>
      api.post<CopilotArtifact>('/copilot/generate', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.copilot }),
  })
}

export function useUpdateApplicationStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: UpdateApplicationStageInput) =>
      api.patch<ApplicationRow>(`/applications/${id}`, { stage }).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: qk.pipeline(data.jobId) })
    },
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EventCreate) => api.post<EventRow>('/events', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events }),
  })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: JobCreate) => api.post<JobDetail>('/jobs', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobs }),
  })
}

export function useCreateOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: OfferCreate) => api.post<Offer>('/offers', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.offers }),
  })
}

export function useSendOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Offer>(`/offers/${id}/send`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.offers }),
  })
}

export function useCreateInterview() {
  return useMutation({
    mutationFn: (input: InterviewCreate) => api.post<Interview>('/interviews', input).then((r) => r.data),
  })
}

export function useScheduleInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, slotId, scheduledAt }: ScheduleInterviewInput) =>
      api.post<Interview>(`/interviews/${id}/schedule`, { slotId, scheduledAt }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slots'] })
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
  })
}

export function useCreatePool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PoolCreate) => api.post<Pool>('/pools', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.pools }),
  })
}

export function useAddPoolMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ poolId, candidateId }: { poolId: string; candidateId: string }) =>
      api.post(`/pools/${poolId}/members`, { candidateId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.pools }),
  })
}
