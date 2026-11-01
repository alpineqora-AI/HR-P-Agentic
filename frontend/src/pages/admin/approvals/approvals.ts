import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

/* Approval-workflow types + server hooks (lifted from AlpineQora-Labs/VMS,
   made self-contained for the TA Portal — no dependency on a global config
   store). Types were in state/config there; they live here now. */

export interface ApprovalLevel {
  id: string
  approverRole: string
  condition: string
}

export interface WorkflowNode {
  id: string
  type: 'trigger' | 'approval' | 'condition' | 'end' | 'policy' | 'email' | 'sms' | 'step' | 'exception'
  position: { x: number; y: number }
  data: {
    label?: string
    approverRole?: string
    condition?: string
    /** Email notification attached to an approval step (dropped on the box). */
    emailAttached?: boolean
    emailTemplateId?: string
    emailTemplateName?: string
    emailTrigger?: string
    smsTemplateId?: string
    smsTemplateName?: string
    smsTrigger?: string
    /** Candidate journey: the point this message is sent at. */
    journeyPoint?: string
    /** Exception: who reviews it, and why requests land here. */
    reviewerRole?: string
    reason?: string
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
}

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface ApprovalWorkflow {
  id: string
  name: string
  trigger: string
  enabled: boolean
  autoApprove: boolean
  levels: ApprovalLevel[]
  graph?: WorkflowGraph
  /** What this copy was built from, as the server said; sent back with an edit so an out-of-date copy is refused. */
  base?: string | null
}

/** A role option for approver dropdowns. */
export interface Role {
  key: string
  name: string
}

// ---- server shape + converters ----

export interface ServerWorkflowDto {
  key: string
  name: string
  trigger: string
  enabled: boolean
  autoApprove: boolean
  levels: ApprovalLevel[]
  graph: WorkflowGraph | null
  updatedAt: string | null
  /** The open change to this workflow (a draft, or waiting for review), or null. Set by the server. */
  change?: WorkflowChange | null
  /** True when the workflow is live; false for a new one not yet approved. Set by the server. */
  live?: boolean | null
  /** Whether the live version is switched on; null when there is none. Set by the server. */
  liveEnabled?: boolean | null
  /** What this copy was built from; sent back unchanged with an edit. */
  base?: string | null
}

/**
 * A proposed change to a workflow. Edits never change a live workflow: they are kept as a change that
 * an admin who did not edit it approves before it goes live.
 */
export interface WorkflowChange {
  id: string
  wfKey: string
  workflowName: string
  kind: 'CREATE' | 'UPDATE' | 'DELETE'
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
  /** What changed, in words, one line each (the first ones; see more). */
  summary: string[]
  /** How many more lines of change there are than summary shows. */
  more: number
  /** Everyone who edited it; none of them may approve it. */
  editors: string[]
  submittedBy: string | null
  submittedAt: string | null
  decidedBy: string | null
  decidedAt: string | null
  note: string | null
  updatedAt: string
  /** The change's revision: a decision names the one the reviewer read. */
  revision: number
  /** True when the acting user edited it, and so may send it, take it back or discard it. */
  yours: boolean
  /** True when the acting user may approve or reject it now. */
  reviewable: boolean
  /** Why the acting user may not, when they may not. */
  whyNotYou: string | null
  /** What became of it, in words, once decided or withdrawn; null while open. */
  outcome: string | null
}

/** Workflow changes: PENDING (waiting for review), OPEN (drafts too) or ALL (the latest fifty). */
export function useWorkflowChanges(status: 'PENDING' | 'OPEN' | 'ALL' = 'PENDING') {
  return useQuery({
    queryKey: ['workflow-changes', status],
    queryFn: () => api.get<WorkflowChange[]>('/workflow-changes', { params: { status } }).then((r) => r.data),
  })
}

/**
 * Act on a change: send it for review, take it back to edit (recall), discard it (withdraw), or decide it.
 * A decision names the revision the reviewer read. Both the review list and the working copy are asked again.
 */
export function useChangeAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, note, revision }: {
      id: string
      action: 'submit' | 'recall' | 'withdraw' | 'approve' | 'reject'
      note?: string
      revision?: number
    }) =>
      api.post<WorkflowChange>(
        `/workflow-changes/${id}/${action}`,
        action === 'approve' || action === 'reject' ? { note, revision } : undefined,
      ).then((r) => r.data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['workflow-changes'] })
      qc.invalidateQueries({ queryKey: ['approval-workflows'] })
    },
  })
}

/** Who the server takes the acting user to be. */
export function useActingUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ id: string | null; name: string | null; role: string | null }>('/me').then((r) => r.data),
  })
}

/** The portal's people, to act as one of them (the prototype has no sign-in). */
export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: () => api.get<{ id: string; name: string; role: string; title: string | null }[]>('/availability/users').then((r) => r.data),
  })
}

/** The server's refusal in words, or a fallback. */
export const refusalOf = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

export const toServerDto = (w: ApprovalWorkflow): ServerWorkflowDto => ({
  key: w.id,
  name: w.name,
  trigger: w.trigger,
  enabled: w.enabled,
  autoApprove: w.autoApprove,
  levels: w.levels,
  graph: w.graph ?? null,
  updatedAt: null,
  base: w.base ?? null,
})

export const fromServerDto = (d: ServerWorkflowDto): ApprovalWorkflow => ({
  id: d.key,
  name: d.name,
  trigger: d.trigger,
  enabled: d.enabled,
  autoApprove: d.autoApprove,
  levels: d.levels ?? [],
  graph: d.graph ?? undefined,
  base: d.base ?? null,
})

export function useServerWorkflows() {
  return useQuery({
    queryKey: ['approval-workflows'],
    queryFn: () => api.get<ServerWorkflowDto[]>('/approval-workflows').then((r) => r.data),
  })
}

export function useSaveServerWorkflows() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workflows: ServerWorkflowDto[]) =>
      api.put<ServerWorkflowDto[]>('/approval-workflows', workflows).then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(['approval-workflows'], data),
  })
}

export interface SimulateInput {
  eventFormat?: string | null
  daysNotice?: number | null
  flaggedCritical?: boolean
  /** The canvas's unsaved state — evaluated instead of the stored graph, so Test never saves. */
  graph?: WorkflowGraph | null
  /** The workflow's auto-approve setting as it stands on screen. */
  autoApprove?: boolean
}

export interface SimulateResult {
  autoApproved: boolean
  path: string[]
  requiredApprovals: { nodeId: string; label: string; role: string }[]
  notes: string[]
  /** Plain-English reasons the route could not be completed; empty when it could. */
  problems?: string[]
  /** The line followed into each step of `path` after the first ('' when it has none). */
  lines?: string[]
}

/** One thing the server says is wrong or unfinished about a drawing. */
export interface CheckIssue {
  code: string
  /** true when it stops the workflow being switched on */
  blocking: boolean
  nodeId: string | null
  message: string
}

/** Ask the server what is left to finish. Stores nothing. */
export const checkWorkflow = (graph: WorkflowGraph, levels: ApprovalLevel[], trigger: string) =>
  api.post<CheckIssue[]>('/approval-workflows/check', { graph, levels, trigger }).then((r) => r.data)

export function useDeleteWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => api.delete(`/approval-workflows/${key}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-workflows'] }),
  })
}

export function useSimulateWorkflow(key: string) {
  return useMutation({
    mutationFn: (input: SimulateInput) =>
      api.post<SimulateResult>(`/approval-workflows/${key}/simulate`, input).then((r) => r.data),
  })
}

/** One live approval request in the queue. */
export interface ApprovalRequestApi {
  id: string
  wfKey: string
  wfName: string
  itemType: string
  itemRef: string
  title: string
  sub: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED'
  currentStep: number
  required: { nodeId: string; label: string; role: string }[]
  decidedBy: string | null
  decidedAt: string | null
  createdAt: string
}

export function useApprovalRequests(status?: ApprovalRequestApi['status']) {
  return useQuery({
    queryKey: ['approval-requests', status ?? 'all'],
    queryFn: () =>
      api.get<ApprovalRequestApi[]>('/approval-requests', { params: status ? { status } : {} }).then((r) => r.data),
  })
}

export function useDecideApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      api.post<ApprovalRequestApi>(`/approval-requests/${id}/${decision}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-requests'] }),
  })
}
