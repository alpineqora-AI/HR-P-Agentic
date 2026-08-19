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
  type: 'trigger' | 'approval' | 'condition' | 'end' | 'policy' | 'email' | 'exception'
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
}

export const toServerDto = (w: ApprovalWorkflow): ServerWorkflowDto => ({
  key: w.id,
  name: w.name,
  trigger: w.trigger,
  enabled: w.enabled,
  autoApprove: w.autoApprove,
  levels: w.levels,
  graph: w.graph ?? null,
  updatedAt: null,
})

export const fromServerDto = (d: ServerWorkflowDto): ApprovalWorkflow => ({
  id: d.key,
  name: d.name,
  trigger: d.trigger,
  enabled: d.enabled,
  autoApprove: d.autoApprove,
  levels: d.levels ?? [],
  graph: d.graph ?? undefined,
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
}

export interface SimulateResult {
  autoApproved: boolean
  path: string[]
  requiredApprovals: { nodeId: string; label: string; role: string }[]
  notes: string[]
}

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
