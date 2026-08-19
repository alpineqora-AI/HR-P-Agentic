import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  ConnectionMode,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useUpdateNodeInternals,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react'
import { useQuery } from '@tanstack/react-query'
import '@xyflow/react/dist/style.css'
import '@/styles/canvas.css'
import { useConfig } from '@/state/config'
import type { ApprovalWorkflow, Role, WorkflowGraph, WorkflowNode } from './approvals'
import { useStore } from '@/state/store'
import { useSaveServerWorkflows, useSimulateWorkflow, toServerDto, type SimulateResult } from './approvals'
import { commsApi } from '../communications/commsApi'

type WfData = {
  label?: string
  approverRole?: string
  condition?: string
  lit?: boolean
  emailAttached?: boolean
  emailTemplateId?: string
  emailTemplateName?: string
  emailTrigger?: string
}

/** When an email notification fires, relative to the step/point it sits on. */
const EMAIL_TRIGGERS = [
  'When this point is reached',
  'When the step approves',
  'When the step rejects',
  'When the request is fully approved',
]

/* ---------- node visual spec ---------- */

export const SPEC = {
  trigger: { kicker: 'Trigger', rail: '#012169', iconBg: '#eef2fb', iconFg: '#012169' },
  approval: { kicker: 'Approval', rail: '#3b6fd4', iconBg: '#eaf1fd', iconFg: '#2f5fc0' },
  condition: { kicker: 'Condition', rail: '#c98a00', iconBg: '#fdf5e3', iconFg: '#b07a00' },
  policy: { kicker: 'Policy', rail: '#0e8a80', iconBg: '#e6f5f3', iconFg: '#0b756d' },
  email: { kicker: 'Email', rail: '#7c3aed', iconBg: '#f3ecfd', iconFg: '#6d28d9' },
  exception: { kicker: 'Exception', rail: '#e31837', iconBg: '#fdecee', iconFg: '#c31432' },
  end: { kicker: 'Outcome', rail: '#1a9d55', iconBg: '#e9f7ef', iconFg: '#188a4b' },
} as const

export const Icons = {
  trigger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
    </svg>
  ),
  approval: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 20c.6-3.4 2.8-5 5.5-5s4.9 1.6 5.5 5" />
      <path d="m15 10 2 2 4-4.5" />
    </svg>
  ),
  condition: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v5" />
      <path d="M12 8c-4 0-6 2.5-6 6" />
      <path d="M12 8c4 0 6 2.5 6 6" />
      <path d="m4 12 2 2 2-2" />
      <path d="m16 12 2 2 2-2" />
      <circle cx="12" cy="5" r="0.5" />
    </svg>
  ),
  policy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5 5 5v6c0 4.6 3 8.4 7 9.5 4-1.1 7-4.9 7-9.5V5l-7-2.5Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.6" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  ),
  exception: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.5" />
    </svg>
  ),
  end: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  ),
  arrange: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="5" rx="1.5" />
      <rect x="4" y="10" width="7" height="5" rx="1.5" />
      <rect x="13" y="10" width="7" height="5" rx="1.5" />
      <rect x="8.5" y="17" width="7" height="5" rx="1.5" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4.5 19 12 7 19.5V4.5Z" />
    </svg>
  ),
}

function Card({
  type,
  title,
  sub,
  chip,
  branches,
  lit,
  children,
}: {
  type: keyof typeof SPEC
  title: string
  sub?: string
  chip?: string
  branches?: boolean
  lit?: boolean
  children?: React.ReactNode
}) {
  const s = SPEC[type]
  return (
    <div className={`wfc-node${lit ? ' wfc-node--lit' : ''}`}>
      <span className="wfc-node__rail" style={{ background: s.rail }} />
      <div className="wfc-node__inner">
        <span className="wfc-node__icon" style={{ background: s.iconBg, color: s.iconFg }}>
          {Icons[type]}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="wfc-node__kicker" style={{ color: s.rail }}>
            {s.kicker}
          </div>
          <div className="wfc-node__title">{title}</div>
          {sub && <div className="wfc-node__sub">{sub}</div>}
          {chip && <span className="wfc-node__chip">{chip}</span>}
        </div>
      </div>
      {branches && (
        <div className="wfc-node__branches">
          <span className="yes">Yes</span>
          <span className="no">No</span>
        </div>
      )}
      {children}
    </div>
  )
}

function TriggerNode({ data }: NodeProps) {
  const d = data as WfData
  return (
    <Card type="trigger" title={d.label || 'Request'} sub="Starts the approval flow" lit={d.lit}>
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </Card>
  )
}
function ApprovalNode({ data }: NodeProps) {
  const d = data as WfData
  const { roles, users } = useConfig()
  const role = roles.find((r) => r.name === d.approverRole)
  const names = users.filter((u) => u.roleKey === role?.key).map((u) => u.name)
  const who = names.length ? names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '') : 'No users in role'
  return (
    <Card type="approval" title={d.label || 'Approval step'} sub={who} chip={d.approverRole || 'Any approver'} lit={d.lit}>
      {d.emailAttached && (
        <span className="wfc-node__mail" title={`Email: ${d.emailTemplateName || 'choose a template'} · ${d.emailTrigger || ''}`}>
          {Icons.email}
        </span>
      )}
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </Card>
  )
}
function ConditionNode({ data }: NodeProps) {
  const d = data as WfData
  return (
    <Card type="condition" title={d.condition || 'Always'} sub="Routes the request down a branch" branches lit={d.lit}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="target" position={Position.Right} id="r" />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '75%' }} />
    </Card>
  )
}
function PolicyNode({ data }: NodeProps) {
  const d = data as WfData
  return (
    <Card type="policy" title="Auto-approve" sub={d.label || 'Within policy'} lit={d.lit}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </Card>
  )
}
function EmailNode({ data }: NodeProps) {
  const d = data as WfData
  return (
    <Card type="email" title={d.emailTemplateName || 'Email notification'} sub={d.emailTrigger || 'Choose a template'} lit={d.lit}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </Card>
  )
}
function ExceptionNode({ data }: NodeProps) {
  const d = data as WfData
  return (
    <Card type="exception" title={d.label || 'Exception'} sub="Routed out for review" lit={d.lit}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="target" position={Position.Right} id="r" />
    </Card>
  )
}
function EndNode({ data }: NodeProps) {
  const d = data as WfData
  return (
    <Card type="end" title={d.label || 'Approved'} sub="Flow complete" lit={d.lit}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="target" position={Position.Right} id="r" />
    </Card>
  )
}

const nodeTypes = {
  trigger: TriggerNode,
  approval: ApprovalNode,
  condition: ConditionNode,
  policy: PolicyNode,
  email: EmailNode,
  exception: ExceptionNode,
  end: EndNode,
}

// Explicit dimensions so nodes are "measured" even where ResizeObserver is flaky;
// updateNodeInternals (below) computes handle bounds so edges render on mount.
const DIMS: Record<string, { width: number; height: number }> = {
  trigger: { width: 184, height: 64 },
  approval: { width: 184, height: 86 },
  condition: { width: 184, height: 82 },
  policy: { width: 184, height: 64 },
  email: { width: 184, height: 72 },
  exception: { width: 184, height: 64 },
  end: { width: 184, height: 64 },
}
const sized = (n: Node): Node => ({ ...n, ...DIMS[n.type as string] })

/** Consistent edge look: rounded step path, arrowhead, YES/NO labels off condition
 *  branches — the YES line renders green, the NO line red (matching their ports). */
const decorateEdge = (e: Edge): Edge => {
  const branch = e.sourceHandle === 'yes' ? 'yes' : e.sourceHandle === 'no' ? 'no' : null
  const color = branch === 'no' ? '#e31837' : branch === 'yes' ? '#1a9d55' : '#93a1b8'
  return {
    ...e,
    type: 'smoothstep',
    className: branch ? `wfc-edge--${branch}` : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
    label: branch === 'yes' ? 'YES' : branch === 'no' ? 'NO' : undefined,
    labelStyle: branch ? { fill: branch === 'no' ? '#c31432' : '#147a44', fontWeight: 700 } : undefined,
  }
}

/* ---------- derive an initial graph from the workflow's levels ---------- */

function seedGraph(w: ApprovalWorkflow, roleName: (k: string) => string): { nodes: Node[]; edges: Edge[] } {
  if (w.graph && w.graph.nodes.length) {
    return {
      nodes: (w.graph.nodes as unknown as Node[]).map(sized),
      edges: (w.graph.edges as unknown as Edge[]).map(decorateEdge),
    }
  }
  const nodes: Node[] = [sized({ id: 'trigger', type: 'trigger', position: { x: 260, y: 0 }, data: { label: w.trigger } })]
  const edges: Edge[] = []
  let prev = 'trigger'
  let y = 120
  w.levels.forEach((lv, i) => {
    const id = `lvl-${lv.id}`
    nodes.push(
      sized({
        id,
        type: 'approval',
        position: { x: 260, y },
        data: { label: `Level ${i + 1}`, approverRole: roleName(lv.approverRole), condition: lv.condition },
      }),
    )
    edges.push(decorateEdge({ id: `e-${prev}-${id}`, source: prev, target: id }))
    prev = id
    y += 125
  })
  const endY = y
  nodes.push(sized({ id: 'end', type: 'end', position: { x: 260, y: endY }, data: { label: 'Approved' } }))
  edges.push(decorateEdge({ id: `e-${prev}-end`, source: prev, target: 'end' }))
  // Auto-approve policy: a visible fast-path branch that skips the chain.
  if (w.autoApprove) {
    nodes.push(sized({ id: 'policy', type: 'policy', position: { x: 520, y: Math.max(120, Math.round(endY / 2) - 30) }, data: { label: 'Within policy' } }))
    edges.push(decorateEdge({ id: 'e-trigger-policy', source: 'trigger', target: 'policy' }))
    edges.push(decorateEdge({ id: 'e-policy-end', source: 'policy', target: 'end' }))
  }
  return { nodes, edges }
}

/**
 * Layered auto-layout, tuned so nothing overlaps and every arrow stays visible:
 * - longest-path layering from the trigger (converging branches sit below both parents)
 * - generous row/column spacing relative to the card size
 * - policy (auto-approve bypass) nodes get their own side lane to the right of the
 *   widest row, so their long trigger→policy→end edge routes through empty space
 *   instead of under the chain's boxes
 */
function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const CX = 320 // main-column center
  const SP = 260 // horizontal pitch (cards are 184 wide → ≥76px clear gap)
  const ROW = 165 // vertical pitch (tallest card is 86 → ≥79px clear gap for arrows)
  const TOP = 30

  // Longest-path depth from the trigger (relaxation; graphs are tiny).
  const depth = new Map<string, number>([['trigger', 0]])
  for (let pass = 0; pass <= nodes.length; pass++) {
    let changed = false
    for (const e of edges) {
      const ds = depth.get(e.source)
      if (ds == null) continue
      if ((depth.get(e.target) ?? -1) < ds + 1) {
        depth.set(e.target, ds + 1)
        changed = true
      }
    }
    if (!changed) break
  }

  const lane = nodes.filter((n) => n.type === 'policy')
  const main = nodes.filter((n) => n.type !== 'policy')
  const maxD = Math.max(0, ...main.map((n) => depth.get(n.id) ?? 0))

  const rows = new Map<number, Node[]>()
  for (const n of main) {
    const d = depth.get(n.id) ?? maxD + 1
    rows.set(d, [...(rows.get(d) ?? []), n])
  }
  const pos = new Map<string, { x: number; y: number }>()
  let widest = 1
  for (const [d, row] of rows) {
    widest = Math.max(widest, row.length)
    row.sort((a, b) => a.position.x - b.position.x)
    row.forEach((n, i) => {
      pos.set(n.id, { x: CX + (i - (row.length - 1) / 2) * SP, y: TOP + d * ROW })
    })
  }

  // Side lane: one pitch beyond the widest row, vertically midway between the
  // bypass's source and target rows.
  const laneX = CX + ((widest - 1) / 2) * SP + SP
  for (const n of lane) {
    const srcD = depth.get(edges.find((e) => e.target === n.id)?.source ?? 'trigger') ?? 0
    const tgtD = depth.get(edges.find((e) => e.source === n.id)?.target ?? 'end') ?? maxD
    pos.set(n.id, { x: laneX, y: TOP + Math.round(((srcD + tgtD) / 2) * ROW) })
  }
  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }))
}

/* ---------- the editor ---------- */

/** Blocks the left palette offers — drag onto the canvas (or click to add). */
const BLOCKS: { type: BlockType; label: string }[] = [
  { type: 'approval', label: 'Approver' },
  { type: 'condition', label: 'Condition' },
  { type: 'email', label: 'Email' },
  { type: 'exception', label: 'Exception' },
]

type BlockType = 'approval' | 'condition' | 'email' | 'exception'

const blockDefaults = (type: BlockType, firstRole?: string): WfData =>
  type === 'approval'
    ? { label: 'New approval', approverRole: firstRole }
    : type === 'condition'
      ? { condition: 'Always' }
      : type === 'email'
        ? { label: 'Email notification', emailTrigger: EMAIL_TRIGGERS[0] }
        : { label: 'Exception' }

export default function ApprovalCanvas(props: { workflow: ApprovalWorkflow; onClose: () => void; onSaved: (w: ApprovalWorkflow) => void }) {
  // Portal onto the shell element (not <body>): escapes the content subtree's
  // transformed ancestors — otherwise React Flow can't measure nodes and edges
  // won't render — while still inheriting the shell's geometry CSS vars
  // (--shell-chrome-h / --shell-rail-w), which the overlay uses to cover only
  // the content card. The top band and rail stay visible around it.
  return createPortal(
    <ReactFlowProvider>
      <ApprovalCanvasInner {...props} />
    </ReactFlowProvider>,
    document.querySelector('.app') ?? document.body,
  )
}

function ApprovalCanvasInner({ workflow, onClose, onSaved }: { workflow: ApprovalWorkflow; onClose: () => void; onSaved: (w: ApprovalWorkflow) => void }) {
  const { roles } = useConfig()
  const { toastMsg: flash } = useStore()
  const roleName = useCallback((k: string) => roles.find((r: Role) => r.key === k)?.name ?? k, [roles])

  const seed = useMemo(() => seedGraph(workflow, roleName), [workflow, roleName])
  const [nodes, setNodes, onNodesChange] = useNodesState(seed.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(seed.edges)
  const [selId, setSelId] = useState<string | null>(null)
  const [idc, setIdc] = useState(1)

  // Drag-from-palette snap preview: while a block is dragged over the canvas,
  // the edge (or approver box) it would snap into is highlighted; dropping
  // splices it in and auto-aligns. dataTransfer is unreadable during dragover,
  // so the dragged type lives in a ref set by the palette's dragstart.
  const dragTypeRef = useRef<BlockType | null>(null)
  const [snapEdgeId, setSnapEdgeId] = useState<string | null>(null)
  const [snapNodeId, setSnapNodeId] = useState<string | null>(null)
  const clearSnap = () => {
    setSnapEdgeId(null)
    setSnapNodeId(null)
  }

  // Email templates for the notification rules (right panel).
  const { data: templates } = useQuery({ queryKey: ['email-templates'], queryFn: commsApi.getEmailTemplates })

  // Compute handle bounds after mount so edges render as soon as the canvas opens.
  // Retried on a short schedule: environments without a working ResizeObserver
  // (some embedded browsers) never self-measure, and a single early call can land
  // before layout settles.
  const updateNodeInternals = useUpdateNodeInternals()
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  useEffect(() => {
    // Measure every node in the CURRENT state (not just the seed): after a
    // remount, dynamically-added nodes survive in preserved state but their
    // handle bounds are gone — unmeasured handles silently refuse connections.
    const delays = [60, 200, 450, 800, 1400, 2200]
    const timers = delays.map((ms) =>
      setTimeout(() => nodesRef.current.forEach((n) => updateNodeInternals(n.id)), ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [seed, updateNodeInternals])

  const selected = nodes.find((n) => n.id === selId) ?? null

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) => addEdge(decorateEdge({ ...c, id: `e-${c.source}-${c.target}-${Date.now()}` } as Edge), eds)),
    [setEdges],
  )

  // Same retry schedule as the mount effect: a single early call can land before
  // layout settles (or before a flaky ResizeObserver reports), leaving the new
  // node's handle bounds unknown — which silently breaks connecting to it.
  const measureSoon = useCallback(
    (id: string) => [80, 250, 600, 1200].forEach((ms) => setTimeout(() => updateNodeInternals(id), ms)),
    [updateNodeInternals],
  )

  const addNode = (type: BlockType, position?: { x: number; y: number }) => {
    const id = `n-${type}-${idc}`
    setIdc((n) => n + 1)
    const data: WfData = blockDefaults(type, roles[0]?.name)
    setNodes((ns) => [...ns, sized({ id, type, position: position ?? { x: 560, y: 120 + ns.length * 40 }, data })])
    setSelId(id)
    measureSoon(id)
    return id
  }

  /* ---------- drag & drop from the blocks palette ---------- */

  const { screenToFlowPosition, fitView } = useReactFlow()

  /** Is a flow-space point inside a node's box? */
  const hitNode = (p: { x: number; y: number }, n: Node) => {
    const w = (n.width as number) ?? DIMS[n.type as string]?.width ?? 184
    const h = (n.height as number) ?? DIMS[n.type as string]?.height ?? 80
    return p.x >= n.position.x && p.x <= n.position.x + w && p.y >= n.position.y && p.y <= n.position.y + h
  }

  /** Nearest edge whose segment passes within ~55px of the point (drop "between two boxes"). */
  const nearestEdge = (p: { x: number; y: number }): Edge | null => {
    const center = (id: string) => {
      const n = nodes.find((n) => n.id === id)
      if (!n) return null
      const w = (n.width as number) ?? DIMS[n.type as string]?.width ?? 184
      const h = (n.height as number) ?? DIMS[n.type as string]?.height ?? 80
      return { x: n.position.x + w / 2, y: n.position.y + h / 2 }
    }
    let best: { e: Edge; d: number } | null = null
    for (const e of edges) {
      const a = center(e.source)
      const b = center(e.target)
      if (!a || !b) continue
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2))
      const d = Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)))
      if (d < 55 && (!best || d < best.d)) best = { e, d }
    }
    return best?.e ?? null
  }

  /** Attach an email notification to an approval step (envelope badge on the box). */
  const attachEmail = (nodeId: string) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, emailAttached: true, emailTrigger: (n.data as WfData).emailTrigger ?? 'When the step approves' } }
          : n,
      ),
    )
    setSelId(nodeId)
    flash('Email notification attached — pick a template on the right')
  }

  /** Splice a block into an existing edge (the snap drop), then auto-arrange so
   *  the new step falls in line with the flow. */
  const spliceIntoEdge = (type: BlockType, edge: Edge, p: { x: number; y: number }) => {
    const id = `n-${type}-${idc}`
    setIdc((n) => n + 1)
    const data: WfData = blockDefaults(type, roles[0]?.name)
    const node = sized({ id, type, position: { x: p.x - 92, y: p.y - 36 }, data })
    const newEdges = [
      ...edges.filter((e) => e.id !== edge.id),
      decorateEdge({ id: `e-${edge.source}-${id}`, source: edge.source, target: id, sourceHandle: edge.sourceHandle }),
      // A spliced condition continues down its YES branch; NO stays free to wire.
      // An exception is terminal — it takes the incoming edge and goes no further.
      ...(type === 'exception'
        ? []
        : [decorateEdge({ id: `e-${id}-${edge.target}`, source: id, target: edge.target, sourceHandle: type === 'condition' ? 'yes' : undefined })]),
    ]
    setNodes(autoLayout([...nodes, node], newEdges))
    setEdges(newEdges)
    setSelId(id)
    measureSoon(id)
    setTimeout(() => fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), 90)
    flash(type === 'email' ? 'Email step added to the flow — pick a template on the right' : 'Step added and aligned with the flow')
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const type = dragTypeRef.current
    if (!type) return
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    let nodeId: string | null = null
    if (type === 'email') nodeId = nodes.find((n) => n.type === 'approval' && hitNode(p, n))?.id ?? null
    const edgeId = nodeId ? null : (nearestEdge(p)?.id ?? null)
    if (nodeId !== snapNodeId) setSnapNodeId(nodeId)
    if (edgeId !== snapEdgeId) setSnapEdgeId(edgeId)
  }

  const onDragLeave = (e: React.DragEvent) => {
    // Ignore leave events into our own children — only clear when the drag
    // actually exits the canvas area.
    if (e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) return
    clearSnap()
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/reactflow') as BlockType | ''
    dragTypeRef.current = null
    clearSnap()
    if (!type) return
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    if (type === 'email') {
      const target = nodes.find((n) => n.type === 'approval' && hitNode(p, n))
      if (target) {
        attachEmail(target.id)
        return
      }
    }
    const edge = nearestEdge(p)
    if (edge) {
      spliceIntoEdge(type, edge, p)
      return
    }
    addNode(type, { x: p.x - 92, y: p.y - 32 })
  }

  const arrange = () => {
    setNodes((ns) => autoLayout(ns, edges))
    // Re-frame once the new positions have applied.
    setTimeout(() => fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), 60)
    flash('Auto-arranged')
  }

  const patchData = (patch: Partial<WfData>) =>
    setNodes((ns) => ns.map((n) => (n.id === selId ? { ...n, data: { ...n.data, ...patch } } : n)))

  const deleteSelected = () => {
    if (!selId || selId === 'trigger' || selId === 'end') return
    setNodes((ns) => ns.filter((n) => n.id !== selId))
    setEdges((es) => es.filter((e) => e.source !== selId && e.target !== selId))
    setSelId(null)
  }

  /** Current canvas → the persisted shape (graph + derived chain levels). */
  const buildPatch = useCallback(() => {
    const graph: WorkflowGraph = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type as WorkflowNode['type'],
        position: n.position,
        data: (({ lit: _lit, ...rest }) => rest)(n.data as WfData),
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null })),
    }
    // Keep the tab's approval chain in sync: walk the graph from the trigger in
    // flow order and rebuild levels from the approval nodes it reaches.
    const order: Node[] = []
    const seen = new Set<string>(['trigger'])
    const queue = ['trigger']
    while (queue.length) {
      const cur = queue.shift()!
      for (const e of edges.filter((e) => e.source === cur)) {
        if (seen.has(e.target)) continue
        seen.add(e.target)
        queue.push(e.target)
        const n = nodes.find((n) => n.id === e.target)
        if (n) order.push(n)
      }
    }
    // A step guarded by a condition's YES branch carries that condition. Otherwise
    // keep the condition already on the approval node (seeded from the chain) so a
    // canvas round-trip doesn't collapse "Bill rate over threshold" to "Always".
    const condFor = (node: Node): string => {
      const inc = edges.find((e) => e.target === node.id)
      const src = inc ? nodes.find((n) => n.id === inc.source) : undefined
      if (src?.type === 'condition' && inc!.sourceHandle !== 'no') return (src.data as WfData).condition ?? 'Always'
      return (node.data as WfData).condition ?? 'Always'
    }
    const roleKeyFor = (name?: string) => roles.find((r: Role) => r.name === name)?.key ?? roles[0]?.key ?? 'admin'
    const levels = order
      .filter((n) => n.type === 'approval')
      .map((n, i) => ({
        id: `g${i + 1}`,
        approverRole: roleKeyFor((n.data as WfData).approverRole),
        condition: condFor(n),
      }))
    return { graph, levels }
  }, [nodes, edges, roles])

  const saveServer = useSaveServerWorkflows()

  const save = () => {
    const patch = buildPatch()
    const updated = { ...workflow, ...patch }
    onSaved(updated)
    saveServer.mutate([toServerDto(updated)])
    flash('Workflow saved · approval chain updated')
    onClose()
  }

  /* ---------- test / simulation ---------- */

  const [simOpen, setSimOpen] = useState(false)
  const [sim, setSim] = useState({ format: 'IN_PERSON', notice: '', flagged: false })
  const [simResult, setSimResult] = useState<SimulateResult | null>(null)
  const simulate = useSimulateWorkflow(workflow.id)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearLit = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setNodes((ns) => ns.map((n) => ((n.data as WfData).lit ? { ...n, data: { ...n.data, lit: false } } : n)))
    setEdges((es) =>
      es.map((e) =>
        e.className?.includes('wfc-edge--lit')
          ? { ...e, className: e.className.replace(/\s*wfc-edge--lit/, '') || undefined }
          : e,
      ),
    )
  }, [setNodes, setEdges])

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  const runTest = async () => {
    clearLit()
    setSimResult(null)
    try {
      // Persist the current canvas first so the engine evaluates what's on screen.
      const patch = buildPatch()
      await saveServer.mutateAsync([toServerDto({ ...workflow, ...patch })])
      const res = await simulate.mutateAsync({
        eventFormat: sim.format,
        daysNotice: sim.notice === '' ? null : Number(sim.notice),
        flaggedCritical: sim.flagged,
      })
      setSimResult(res)
      // Light the path node-by-node.
      res.path.forEach((id, i) => {
        timersRef.current.push(
          setTimeout(() => {
            setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, lit: true } } : n)))
            if (i > 0) {
              const prev = res.path[i - 1]
              setEdges((es) =>
                es.map((e) =>
                  e.source === prev && e.target === id
                    ? { ...e, className: e.className ? `${e.className} wfc-edge--lit` : 'wfc-edge--lit' }
                    : e,
                ),
              )
            }
          }, 350 * i),
        )
      })
    } catch {
      flash('Simulation failed — is the backend running?')
    }
  }

  // Snap-preview decoration: highlight the would-be splice edge / attach box.
  const displayEdges = useMemo(
    () => edges.map((e) => (e.id === snapEdgeId ? { ...e, className: `${e.className ?? ''} wfc-edge--snap`.trim() } : e)),
    [edges, snapEdgeId],
  )
  const displayNodes = useMemo(
    () => nodes.map((n) => (n.id === snapNodeId ? { ...n, className: 'wfc-nodesnap' } : n)),
    [nodes, snapNodeId],
  )

  const selSpec = selected ? SPEC[selected.type as keyof typeof SPEC] : null
  const selData = (selected?.data ?? {}) as WfData

  /** Template + trigger selects, shared by email nodes and step-attached notifications. */
  const emailRules = (
    <>
      <label>
        Email template
        <select
          className="select"
          value={selData.emailTemplateId ?? ''}
          onChange={(e) => {
            const t = templates?.find((t) => t.templateId === e.target.value)
            patchData({ emailTemplateId: t?.templateId, emailTemplateName: t?.name })
          }}
        >
          <option value="" disabled>
            Choose a template…
          </option>
          {(templates ?? []).map((t) => (
            <option key={t.templateId} value={t.templateId}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Trigger event
        <select className="select" value={selData.emailTrigger ?? EMAIL_TRIGGERS[0]} onChange={(e) => patchData({ emailTrigger: e.target.value })}>
          {EMAIL_TRIGGERS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
    </>
  )

  return (
    <div className="wfc wfc--card">
      <div className="wfc-top">
        <div className="wfc-top__meta">
          <div className="wfc-top__kicker">Approval canvas</div>
          <div className="wfc-top__title">{workflow.name}</div>
        </div>
        <div className="wfc-palette">
          <button onClick={arrange}>
            <span style={{ color: 'var(--wfc-navy)', display: 'inline-flex', width: 14, height: 14 }}>{Icons.arrange}</span>
            Auto-arrange
          </button>
        </div>
        <button
          className={simOpen ? 'btn btn--primary btn--sm' : 'btn btn--outline btn--sm'}
          onClick={() => {
            if (simOpen) clearLit()
            setSimOpen((o) => !o)
          }}
        >
          Test
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn--primary btn--sm" onClick={save}>
          Save workflow
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* blocks palette — drag onto the canvas */}
        <div className="wfc-blocks">
          <div className="wfc-blocks__head">Blocks</div>
          <div className="wfc-blocks__grid">
            {BLOCKS.map((b) => (
              <div
                key={b.type}
                className="wfc-block"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', b.type)
                  e.dataTransfer.effectAllowed = 'move'
                  dragTypeRef.current = b.type
                }}
                onDragEnd={() => {
                  dragTypeRef.current = null
                  clearSnap()
                }}
                onClick={() => addNode(b.type)}
                title={`${b.label} — drag onto the canvas, or click to add`}
              >
                <span className="wfc-block__icon">{Icons[b.type]}</span>
                <span className="wfc-block__label">{b.label}</span>
              </div>
            ))}
          </div>
          <div className="wfc-blocks__hint">
            Drag a block onto the canvas.
            <br />
            <br />
            Drop <b>Email</b> on an approver box to attach a notification to that step, or between two boxes to add it into the flow —
            then pick the template and trigger on the right.
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelId(n.id)}
            onPaneClick={() => setSelId(null)}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={38}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => SPEC[n.type as keyof typeof SPEC]?.rail ?? '#93a1b8'}
              maskColor="rgba(242, 244, 248, 0.7)"
            />
            <Controls />
          </ReactFlow>
        </div>

        {/* inspector / rules panel */}
        <div className="wfc-inspector">
          {simOpen ? (
            <>
              <div className="wfc-inspector__head">
                <span className="wfc-node__icon" style={{ background: SPEC.policy.iconBg, color: SPEC.policy.iconFg }}>
                  {Icons.play}
                </span>
                <div>
                  <div className="wfc-node__kicker" style={{ color: SPEC.policy.rail }}>
                    Test workflow
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-0)' }}>Sample request</div>
                </div>
              </div>
              <div className="wfc-inspector__body">
                <label>
                  Event format
                  <select className="select" value={sim.format} onChange={(e) => setSim((s) => ({ ...s, format: e.target.value }))}>
                    <option value="IN_PERSON">In-person</option>
                    <option value="VIRTUAL">Virtual</option>
                  </select>
                </label>
                <label>
                  Days of notice
                  <input className="input" type="number" value={sim.notice} onChange={(e) => setSim((s) => ({ ...s, notice: e.target.value }))} placeholder="e.g. 30" />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={sim.flagged} onChange={(e) => setSim((s) => ({ ...s, flagged: e.target.checked }))} />
                  Flagged critical
                </label>
                <button className="btn btn--primary btn--sm" onClick={runTest} disabled={simulate.isPending || saveServer.isPending}>
                  {simulate.isPending || saveServer.isPending ? 'Running…' : 'Run test'}
                </button>

                {simResult && (
                  <div className="wfc-sim-result">
                    {simResult.autoApproved ? (
                      <div className="wfc-sim-result__verdict" style={{ color: SPEC.policy.iconFg }}>
                        ✓ Auto-approved — chain skipped
                      </div>
                    ) : (
                      <div className="wfc-sim-result__verdict" style={{ color: 'var(--wfc-navy)' }}>
                        {simResult.requiredApprovals.length} approval{simResult.requiredApprovals.length === 1 ? '' : 's'} required
                      </div>
                    )}
                    {simResult.requiredApprovals.map((a, i) => (
                      <div key={a.nodeId} className="wfc-sim-result__row">
                        <span className="wfc-sim-result__step">{i + 1}</span>
                        {a.label} · {roleName(a.role) || a.role}
                      </div>
                    ))}
                    {simResult.notes.map((n, i) => (
                      <div key={i} className="wfc-sim-result__note">
                        {n}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : !selected ? (
            <>
              <div className="wfc-inspector__empty">
                Select a node to edit its rules.
                <br />
                <br />
                Drag blocks from the <b>left panel</b> onto the canvas. Drag from a <b>handle</b> (the dot on a node’s edge) to
                another node to connect steps, then <b>Test</b> a sample request to watch the route light up.
              </div>
              <div className="wfc-legend">
                {(Object.keys(SPEC) as (keyof typeof SPEC)[]).map((k) => (
                  <div key={k} className="wfc-legend__row">
                    <span className="wfc-legend__dot" style={{ background: SPEC[k].rail }} />
                    {SPEC[k].kicker}
                    {k === 'condition' ? ' · branches yes / no' : k === 'policy' ? ' · auto-approve fast path' : k === 'email' ? ' · notification step' : k === 'exception' ? ' · terminal · e.g. condition NO' : ''}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="wfc-inspector__head">
                <span className="wfc-node__icon" style={{ background: selSpec!.iconBg, color: selSpec!.iconFg }}>
                  {Icons[selected.type as keyof typeof Icons]}
                </span>
                <div>
                  <div className="wfc-node__kicker" style={{ color: selSpec!.rail }}>
                    {selSpec!.kicker} rules
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-0)' }}>
                    {selData.label || selData.condition || '—'}
                  </div>
                </div>
              </div>
              <div className="wfc-inspector__body">
                <label>
                  Label
                  <input className="input" value={selData.label ?? ''} onChange={(e) => patchData({ label: e.target.value })} />
                </label>
                {selected.type === 'approval' && (
                  <label>
                    Approver role
                    <select className="select" value={selData.approverRole ?? ''} onChange={(e) => patchData({ approverRole: e.target.value })}>
                      {roles.map((r: Role) => (
                        <option key={r.key}>{r.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {selected.type === 'condition' && (
                  <label>
                    Condition
                    <select className="select" value={selData.condition ?? ''} onChange={(e) => patchData({ condition: e.target.value })}>
                      {['Always', 'In-person event', 'Virtual event', 'Short notice (under 14 days)', 'Flagged critical'].map(
                        (c) => (
                          <option key={c}>{c}</option>
                        ),
                      )}
                    </select>
                  </label>
                )}

                {selected.type === 'email' && emailRules}

                {selected.type === 'approval' && (
                  <>
                    <div className="wfc-inspector__divider" />
                    <div className="wfc-inspector__section" style={{ color: SPEC.email.rail }}>
                      <span style={{ display: 'inline-flex', width: 13, height: 13 }}>{Icons.email}</span>
                      Email notification
                    </div>
                    {selData.emailAttached ? (
                      <>
                        {emailRules}
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ color: 'var(--danger-fg, #b3261e)' }}
                          onClick={() => patchData({ emailAttached: false, emailTemplateId: undefined, emailTemplateName: undefined, emailTrigger: undefined })}
                        >
                          Remove notification
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn--outline btn--sm" onClick={() => attachEmail(selected.id)}>
                          + Attach email notification
                        </button>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                          …or drag the <b>Email</b> block from the left panel onto this step.
                        </div>
                      </>
                    )}
                  </>
                )}

                {selected.id !== 'trigger' && selected.id !== 'end' && (
                  <button className="btn btn--danger btn--sm" onClick={deleteSelected}>
                    Delete node
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
