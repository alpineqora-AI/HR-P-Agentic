import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Panel,
  MiniMap,
  useViewport,
  Handle,
  Position,
  MarkerType,
  ConnectionMode,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useUpdateNodeInternals,
  useInternalNode,
  useStore as useFlowStore,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Node,
  type Edge,
  type Connection,
  type FinalConnectionState,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react'
import { useQuery } from '@tanstack/react-query'
import { useJourney } from '@/api/hooks'
import type { JourneyPointInfo } from '@/api/types'
import '@xyflow/react/dist/style.css'
import '@/styles/canvas.css'
import { useConfig } from '@/state/config'
import type { ApprovalWorkflow, Role, WorkflowGraph, WorkflowNode } from './approvals'
import { useStore } from '@/state/store'
import {
  checkWorkflow, useSaveServerWorkflows, useSimulateWorkflow, toServerDto, fromServerDto,
  type CheckIssue, type SimulateResult, type ServerWorkflowDto,
} from './approvals'
import { commsApi } from '../communications/commsApi'
import { SPEC, Icons } from './canvasTheme'
import { CanvasCtx, useCanvas, type AddTarget, type OpenEnds, type StepKind } from './canvasContext'
import AddMenu from './AddMenu'
import RulePanel, { type SideChoice } from './RulePanel'
import WorkflowInWords from './WorkflowInWords'
import {
  JOURNEY, afterRule, continueChoices, cutOff, describe, isOutcome, lanes, rows, ruleTitle, sideOf, startOf, stepName,
  type Answer, type GEdge, type GNode, type WfData,
} from './graphModel'

export { SPEC, Icons }

/** When an SMS fires, relative to the point it sits on in the journey. */
const SMS_TRIGGERS = [
  'When this point is reached',
  'When the interview is scheduled',
  'When the interview is rescheduled',
  '24 hours before the interview',
  'When application status changes',
]

/** When an email notification fires, relative to the step/point it sits on. */
const EMAIL_TRIGGERS = [
  'When this point is reached',
  'When the step approves',
  'When the step rejects',
  'When the request is fully approved',
]

/* Make-style FLOATING edge: attaches to whichever side of each box gives the
   cleanest line (recomputed live as nodes move), drawn as a soft bezier with
   a circular connector on the line — a link dot on plain edges, a YES / NO
   pill on condition branches. Branches keep their labeled bottom ports. */
function WfcEdge(props: EdgeProps) {
  const canvas = useCanvas()
  const sourceNode = useInternalNode(props.source)
  const targetNode = useInternalNode(props.target)
  const branch = props.sourceHandleId === 'yes' ? 'YES' : props.sourceHandleId === 'no' ? 'NO' : null
  // A line of the auto-approve bypass: is a step sitting between the card's lane and the step it returns to?
  const blocked = useFlowStore((st) => {
    const from = st.nodeLookup.get(props.source)
    const to = st.nodeLookup.get(props.target)
    if (!from || !to || from.type !== 'policy') return false
    const y = to.internals.positionAbsolute.y + (to.measured.height ?? 100) / 2
    const a = to.internals.positionAbsolute.x + (to.measured.width ?? 156) / 2
    const b = from.internals.positionAbsolute.x + (from.measured.width ?? 156) / 2
    for (const n of st.nodeLookup.values()) {
      if (n.id === from.id || n.id === to.id) continue
      const x = n.internals.positionAbsolute.x
      const top = n.internals.positionAbsolute.y
      const w = n.measured.width ?? 156
      const h = n.measured.height ?? 100
      if (top - 12 < y && y < top + h + 12 && x < Math.max(a, b) && x + w > Math.min(a, b)) return true
    }
    return false
  })
  /** The bypass is not part of the flow a request walks, so nothing is added on it. */
  const onBypass = sourceNode?.type === 'policy' || targetNode?.type === 'policy'

  let sX = props.sourceX
  let sY = props.sourceY
  let sPos = props.sourcePosition
  let tX = props.targetX
  let tY = props.targetY
  let tPos = props.targetPosition

  if (sourceNode && targetNode) {
    const box = (n: NonNullable<typeof sourceNode>) => ({
      x: n.internals.positionAbsolute.x,
      y: n.internals.positionAbsolute.y,
      w: n.measured.width ?? 156,
      h: n.measured.height ?? 100,
    })
    const sb = box(sourceNode)
    const tb = box(targetNode)
    const scx = sb.x + sb.w / 2
    const scy = sb.y + sb.h / 2
    const tcx = tb.x + tb.w / 2
    const tcy = tb.y + tb.h / 2
    const dx = tcx - scx
    const dy = tcy - scy
    const vertical = Math.abs(dy) >= Math.abs(dx)
    // Target above and a column away: the foot of one column to the head of the next (see autoLayout).
    const climb = !branch && dy < -40 && Math.abs(dx) > 240
    const loop = !branch && dy < -40 && !climb // target sits above: a journey loop-back
    // The auto-approve bypass runs down a lane of its own. It leaves the flow
    // sideways along the start's row and drops into the card from above; it
    // comes back into the outcome from the side — or from underneath when a
    // step sits in the way — so it never crosses the steps it skips.
    const bypass = !branch && !loop && !climb && Math.abs(dx) > 40 && (sourceNode.type === 'policy' ? 'out' : targetNode.type === 'policy' ? 'in' : null)

    if (branch) {
      // Anchor on the box itself (under the YES / NO footer), flush with the
      // border — handle visuals are offset and would leave a gap.
      sPos = Position.Bottom
      sX = sb.x + sb.w * (props.sourceHandleId === 'yes' ? 0.25 : 0.75)
      sY = sb.y + sb.h
    }
    if (climb) {
      // Out of the side, up the gutter between the columns, into the side of the target.
      sPos = dx > 0 ? Position.Right : Position.Left
      sX = dx > 0 ? sb.x + sb.w : sb.x
      sY = scy
      tPos = dx > 0 ? Position.Left : Position.Right
      tX = dx > 0 ? tb.x : tb.x + tb.w
      tY = tcy
    } else if (loop) {
      // Bow around the outer side on its own lane — never through the chain.
      const right = scx >= tcx
      sPos = right ? Position.Right : Position.Left
      sX = right ? sb.x + sb.w : sb.x
      sY = scy
      tPos = right ? Position.Right : Position.Left
      tX = right ? tb.x + tb.w : tb.x
      tY = tcy
    } else if (bypass === 'in') {
      sPos = dx > 0 ? Position.Right : Position.Left
      sX = dx > 0 ? sb.x + sb.w : sb.x
      sY = scy
    } else if (bypass === 'out') {
      sPos = Position.Bottom
      sX = scx
      sY = sb.y + sb.h
    } else if (!branch) {
      if (vertical) {
        sPos = dy > 0 ? Position.Bottom : Position.Top
        sX = scx
        sY = dy > 0 ? sb.y + sb.h : sb.y
      } else {
        sPos = dx > 0 ? Position.Right : Position.Left
        sX = dx > 0 ? sb.x + sb.w : sb.x
        sY = scy
      }
    }
    if (bypass === 'in') {
      tPos = Position.Top
      tX = tcx
      tY = tb.y
    } else if (bypass === 'out' && blocked) {
      tPos = Position.Bottom
      tX = tcx
      tY = tb.y + tb.h
    } else if (bypass === 'out') {
      tPos = dx > 0 ? Position.Left : Position.Right
      tX = dx > 0 ? tb.x : tb.x + tb.w
      tY = tcy
    } else if (!loop && !climb) {
      if (vertical) {
        tPos = dy > 0 ? Position.Top : Position.Bottom
        tX = tcx
        tY = dy > 0 ? tb.y : tb.y + tb.h
      } else {
        tPos = dx > 0 ? Position.Left : Position.Right
        tX = dx > 0 ? tb.x : tb.x + tb.w
        tY = tcy
      }
    }
  }

  // Make-style routing: straight runs with rounded right-angle turns —
  // straight when boxes align, a clean cornered route when they don't.
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: sX,
    sourceY: sY,
    sourcePosition: sPos,
    targetX: tX,
    targetY: tY,
    targetPosition: tPos,
    borderRadius: 14,
    offset: sPos === tPos ? 46 : 22,
  })
  // A rule's two lines often share their middle, so each answer's control
  // sits just under its own port; other lines carry theirs at the midpoint.
  const at = branch ? { x: sX, y: sY + 24 } : { x: labelX, y: labelY }
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd as string | undefined} style={props.style} />
      <EdgeLabelRenderer>
        {onBypass ? (
          <span
            className="wfc-edgedot wfc-edgedot--still nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)` }}
            title="Auto-approve: requests within policy skip the steps"
          />
        ) : (
        <button
          type="button"
          className={`wfc-edgedot nodrag nopan${branch ? ` wfc-edgedot--${branch.toLowerCase()}` : ''}`}
          data-line={props.id}
          style={{ transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)` }}
          aria-label={branch ? `Add a step on the ${branch} side` : 'Add a step on this line'}
          title="Add a step here"
          onClick={(e) => {
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            canvas?.openMenu({ x: r.left + r.width / 2, y: r.bottom + 6 }, { kind: 'edge', edgeId: props.id })
          }}
        >
          {branch}
          <span className="wfc-edgedot__plus">{Icons.plus}</span>
        </button>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { wfc: WfcEdge }

/* Floating preview of the selected Communications template — shown while
   hovering an email step on the canvas. */
function TemplatePreview({ templateId, anchor }: { templateId: string; anchor: DOMRect }) {
  const { data: t } = useQuery({
    queryKey: ['email-template', templateId],
    queryFn: () => commsApi.getEmailTemplate(templateId),
    staleTime: 60_000,
  })
  if (!t) return null
  return createPortal(
    <div
      className="wfc-mailpreview"
      style={{ top: Math.max(12, Math.min(anchor.top, window.innerHeight - 360)), left: Math.min(anchor.right + 14, window.innerWidth - 336) }}
    >
      <div className="wfc-mailpreview__subject">{t.subject || t.name}</div>
      <div className="wfc-mailpreview__meta">
        {t.fromName ? `From ${t.fromName}` : 'Email template'} · {t.status.toLowerCase()}
      </div>
      <div className="wfc-mailpreview__body">
        <div dangerouslySetInnerHTML={{ __html: t.bodyHtml }} />
      </div>
    </div>,
    document.body,
  )
}

/** Wraps a node so hovering it previews its attached email template. */
function MailHover({ templateId, children }: { templateId?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)
  return (
    <div ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {children}
      {hover && templateId && ref.current && (
        <TemplatePreview templateId={templateId} anchor={ref.current.getBoundingClientRect()} />
      )}
    </div>
  )
}

/* Make-style floating canvas toolbar: zoom, fit, arrange. */
function CanvasToolbar({ onArrange, onUndo, canUndo }: { onArrange: (columns: boolean) => void; onUndo: () => void; canUndo: boolean }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { zoom } = useViewport()
  return (
    <Panel position="bottom-center" className="wfc-toolbar">
      <button onClick={onUndo} disabled={!canUndo} title="Undo the last change">
        <span style={{ display: 'inline-flex', width: 13, height: 13 }}>{Icons.undo}</span>
        Undo
      </button>
      <span className="wfc-toolbar__sep" />
      <button onClick={() => zoomOut()} aria-label="Zoom out">−</button>
      <span className="wfc-toolbar__zoom">{Math.round(zoom * 100)}%</span>
      <button onClick={() => zoomIn()} aria-label="Zoom in">+</button>
      <span className="wfc-toolbar__sep" />
      <button onClick={() => fitView({ padding: 0.25, maxZoom: 1 })}>Fit</button>
      <button onClick={() => onArrange(false)} title="One column, top to bottom">
        <span style={{ display: 'inline-flex', width: 13, height: 13 }}>{Icons.arrange}</span>
        Arrange
      </button>
      <button onClick={() => onArrange(true)} title="In columns, so the whole drawing fits the screen">
        Whole drawing
      </button>
    </Panel>
  )
}

/** A dashed stub under an answer (or a step) that has nothing leaving it yet.
 *  Only the pill takes the pointer, so the port above it stays free to draw a line from. */
function OpenEnd({ id, answer }: { id: string; answer: Answer | null }) {
  const canvas = useCanvas()
  return (
    <div
      className={`wfc-stub nodrag nopan${answer ? ` wfc-stub--${answer}` : ''}`}
      style={{ left: answer === 'yes' ? '25%' : answer === 'no' ? '75%' : '50%' }}
    >
      <span className="wfc-stub__line" />
      <button
        type="button"
        className="wfc-stub__pill"
        data-step={id}
        data-answer={answer ?? 'next'}
        aria-label={
          answer ? `Choose what happens on the ${answer === 'yes' ? 'YES' : 'NO (otherwise)'} side` : 'Add the next step'
        }
        title={answer ? 'Choose what happens on this side' : 'Add the next step'}
        // The card is a keyboard target of its own: keys meant for this button stop here.
        onKeyDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          canvas?.openMenu({ x: r.left + r.width / 2, y: r.bottom + 6 }, { kind: 'open', nodeId: id, answer })
        }}
      >
        {answer === 'yes' ? 'YES' : answer === 'no' ? 'NO' : 'Next'}
        <span className="wfc-edgedot__plus">{Icons.plus}</span>
      </button>
    </div>
  )
}

function Card({
  id,
  type,
  title,
  sub,
  chip,
  branches,
  lit,
  children,
}: {
  id: string
  type: keyof typeof SPEC
  title: string
  sub?: string
  chip?: string
  branches?: boolean
  lit?: boolean
  children?: React.ReactNode
}) {
  const s = SPEC[type]
  const open = useCanvas()?.openEnds.get(id)
  return (
    <div className={`wfc-node${lit ? ' wfc-node--lit' : ''}`}>
      {open?.yes && <OpenEnd id={id} answer="yes" />}
      {open?.no && <OpenEnd id={id} answer="no" />}
      {open?.next && <OpenEnd id={id} answer={null} />}
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
          <span className="yes">Yes · then</span>
          <span className="no">No · otherwise</span>
        </div>
      )}
      {children}
    </div>
  )
}

function TriggerNode({ id, data }: NodeProps) {
  const d = data as WfData
  return (
    <Card id={id} type="trigger" title={d.label || 'Request'} sub="Starts the approval flow" lit={d.lit}>
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </Card>
  )
}
function ApprovalNode({ id, data }: NodeProps) {
  const d = data as WfData
  const { roles, users } = useConfig()
  const role = roles.find((r) => r.name === d.approverRole)
  const names = users.filter((u) => u.roleKey === role?.key).map((u) => u.name)
  const who = names.length ? names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '') : 'No users in role'
  return (
    <MailHover templateId={d.emailAttached ? d.emailTemplateId : undefined}>
    <Card id={id} type="approval" title={d.label || 'Approval step'} sub={who} chip={d.approverRole || 'Any approver'} lit={d.lit}>
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
    </MailHover>
  )
}
function ConditionNode({ id, data }: NodeProps) {
  const d = data as WfData
  return (
    <Card id={id} type="condition" title={ruleTitle(d.condition)} branches lit={d.lit}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="target" position={Position.Right} id="r" />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '75%' }} />
    </Card>
  )
}
function PolicyNode({ id, data }: NodeProps) {
  const d = data as WfData
  return (
    <Card id={id} type="policy" title="Auto-approve" sub={d.label || 'Within policy'} lit={d.lit}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </Card>
  )
}
function EmailNode({ id, data }: NodeProps) {
  const d = data as WfData
  return (
    <MailHover templateId={d.emailTemplateId}>
      <Card id={id} type="email" title={d.emailTemplateName || 'Email notification'} sub={d.emailTrigger || 'Choose a template'} lit={d.lit}>
        <Handle type="target" position={Position.Top} id="t" />
        <Handle type="source" position={Position.Bottom} id="b" />
        <Handle type="source" position={Position.Left} id="l" />
        <Handle type="source" position={Position.Right} id="r" />
      </Card>
    </MailHover>
  )
}
/* Floating phone-bubble preview of an SMS template while hovering the step. */
function SmsPreview({ templateId, anchor }: { templateId: string; anchor: DOMRect }) {
  const { data: t } = useQuery({
    queryKey: ['sms-template', templateId],
    queryFn: () => commsApi.getSmsTemplate(templateId),
    staleTime: 60_000,
  })
  if (!t) return null
  const segments = Math.max(1, Math.ceil(t.body.length / 160))
  return createPortal(
    <div
      className="wfc-smspreview"
      style={{ top: Math.max(12, Math.min(anchor.top, window.innerHeight - 240)), left: Math.min(anchor.right + 14, window.innerWidth - 296) }}
    >
      <div className="wfc-smspreview__head">
        {t.name} · {t.body.length} chars · {segments} segment{segments > 1 ? 's' : ''}
      </div>
      <div className="wfc-smspreview__bubble">{t.body}</div>
    </div>,
    document.body,
  )
}

function SmsHover({ templateId, children }: { templateId?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)
  return (
    <div ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {children}
      {hover && templateId && ref.current && (
        <SmsPreview templateId={templateId} anchor={ref.current.getBoundingClientRect()} />
      )}
    </div>
  )
}

function SmsNode({ id, data }: NodeProps) {
  const d = data as WfData
  return (
    <SmsHover templateId={d.smsTemplateId}>
      <Card id={id} type="sms" title={d.smsTemplateName || 'SMS message'} sub={d.smsTrigger || 'Choose a template'} lit={d.lit}>
        <Handle type="target" position={Position.Top} id="t" />
        <Handle type="target" position={Position.Left} id="l2" />
        <Handle type="source" position={Position.Bottom} id="b" />
        <Handle type="source" position={Position.Left} id="l" />
        <Handle type="source" position={Position.Right} id="r" />
      </Card>
    </SmsHover>
  )
}

function StepNode({ id, data }: NodeProps) {
  const d = data as WfData
  return (
    <Card id={id} type="step" title={d.label || 'Journey step'} sub="Candidate action" lit={d.lit}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Right} id="r2" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </Card>
  )
}

function ExceptionNode({ id, data }: NodeProps) {
  const d = data as WfData
  return (
    <Card id={id} type="exception" title={d.label || 'Exception'} sub="Routed out for review" lit={d.lit}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="target" position={Position.Right} id="r" />
    </Card>
  )
}
function EndNode({ id, data }: NodeProps) {
  const d = data as WfData
  return (
    <Card id={id} type="end" title={d.label || 'Approved'} sub="Flow complete" lit={d.lit}>
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
  sms: SmsNode,
  step: StepNode,
  exception: ExceptionNode,
  end: EndNode,
}

// Explicit dimensions so nodes are "measured" even where ResizeObserver is flaky;
// updateNodeInternals (below) computes handle bounds so edges render on mount.
const DIMS: Record<string, { width: number; height: number }> = {
  trigger: { width: 156, height: 108 },
  approval: { width: 156, height: 136 },
  condition: { width: 156, height: 132 },
  policy: { width: 156, height: 108 },
  email: { width: 156, height: 120 },
  sms: { width: 156, height: 120 },
  step: { width: 156, height: 116 },
  exception: { width: 156, height: 108 },
  end: { width: 156, height: 108 },
}
const sized = (n: Node): Node => ({ ...n, ...DIMS[n.type as string] })

/** Consistent edge look: rounded step path, arrowhead, YES/NO labels off condition
 *  branches — the YES line renders green, the NO line red (matching their ports). */
const decorateEdge = (e: Edge): Edge => {
  const branch = e.sourceHandle === 'yes' ? 'yes' : e.sourceHandle === 'no' ? 'no' : null
  const color = branch === 'no' ? '#e31837' : branch === 'yes' ? '#1a9d55' : '#93a1b8'
  return {
    ...e,
    type: 'wfc',
    className: branch ? `wfc-edge--${branch}` : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13, color },
    label: undefined,
    labelStyle: undefined,
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
  return { nodes: autoLayout(nodes, edges), edges }
}

/**
 * Layered auto-layout, tuned so nothing overlaps and every arrow stays visible:
 * - rows by longest path from the start (converging branches sit below both parents)
 * - columns by lane: the main flow keeps one column from top to bottom, a
 *   rule's own sides sit in columns of their own to its left and right
 * - policy (auto-approve bypass) nodes get their own side lane to the right of the
 *   widest row, so their long trigger→policy→end edge routes through empty space
 *   instead of under the chain's boxes
 */
/**
 * Places every step. With {@code columns}, a long drawing is wrapped into
 * columns of at most seven rows, read top to bottom then left to right, so
 * the whole of it fits one screen; a line from the foot of one column to
 * the head of the next runs up the gutter between them (see WfEdge).
 */
function autoLayout(nodes: Node[], edges: Edge[], columns = false): Node[] {
  const CX = 320 // main-flow column
  const LANE = 196 // column pitch: a card (156) and 40 clear, so neighbouring lanes never touch
  const GAP = 196 // two cards in a row are never closer than this
  const ROW = 210 // vertical pitch (tallest card is 136 → ≥74px clear for lines and their controls)
  const TOP = 30

  const depth = rows(nodes as GNode[], edges as GEdge[])
  const start = startOf(nodes as GNode[]) ?? 'trigger'

  const policy = nodes.filter((n) => n.type === 'policy')
  const main = nodes.filter((n) => n.type !== 'policy')
  const maxD = Math.max(0, ...main.map((n) => depth.get(n.id) ?? 0))

  const byRow = new Map<number, Node[]>()
  for (const n of main) {
    const d = depth.get(n.id) ?? maxD + 1
    byRow.set(d, [...(byRow.get(d) ?? []), n])
  }

  const laneOf = lanes(nodes as GNode[], edges as GEdge[])
  // Where steps share a lane on a row, an exception gives way: it ends a path, so it is never the main flow.
  const sideLast = (a: Node, b: Node) => Number(a.type === 'exception') - Number(b.type === 'exception')
  const pos = new Map<string, { x: number; y: number }>()
  let rightmost = CX
  for (const [d, row] of byRow) {
    const byLane = new Map<number, Node[]>()
    for (const n of row) {
      const l = laneOf.get(n.id) ?? 0
      byLane.set(l, [...(byLane.get(l) ?? []), n])
    }
    const order = [...byLane.keys()].sort((a, b) => a - b)
    const put = (n: Node, x: number) => {
      pos.set(n.id, { x, y: TOP + d * ROW })
      rightmost = Math.max(rightmost, x)
    }
    // The main flow keeps its column. Whatever shares its row is placed
    // outward from it — never on top of it, and never pushing it aside.
    let right = -Infinity
    let left = Infinity
    for (const l of order.filter((l) => l >= 0)) {
      for (const n of [...byLane.get(l)!].sort((a, b) => sideLast(a, b) || a.position.x - b.position.x)) {
        const x = Math.max(CX + l * LANE, right + GAP)
        put(n, x)
        right = x
        left = Math.min(left, x)
      }
    }
    for (const l of order.filter((l) => l < 0).reverse()) {
      for (const n of [...byLane.get(l)!].sort((a, b) => sideLast(a, b) || b.position.x - a.position.x)) {
        const x = Math.min(CX + l * LANE, left - GAP)
        put(n, x)
        left = x
      }
    }
  }

  // Auto-approve side lane: one column beyond the widest row, vertically
  // midway between the bypass's source and target rows.
  const laneX = rightmost + GAP + 44
  for (const n of policy) {
    const srcD = depth.get(edges.find((e) => e.target === n.id)?.source ?? start) ?? 0
    const tgtD = depth.get(edges.find((e) => e.source === n.id)?.target ?? 'end') ?? maxD
    pos.set(n.id, { x: laneX, y: TOP + Math.round(((srcD + tgtD) / 2) * ROW) })
  }
  const ROWS_PER_COLUMN = 7
  if (columns && policy.length === 0 && maxD + 1 > ROWS_PER_COLUMN) {
    // Rows are dealt into columns of about equal height. A rule is never the
    // last row of a column: its answers stay under it, so the only line that
    // climbs to the next column is the main flow's.
    const count = Math.ceil((maxD + 1) / ROWS_PER_COLUMN)
    const perColumn = Math.ceil((maxD + 1) / count)
    const isRuleRow = (d: number) => (byRow.get(d) ?? []).some((n) => n.type === 'condition')
    const columnOf = new Map<number, { column: number; row: number }>()
    let column = 0
    let d = 0
    while (d <= maxD) {
      let end = Math.min(d + perColumn - 1, maxD)
      while (end < maxD && isRuleRow(end)) end += 1
      for (let r = d; r <= end; r++) columnOf.set(r, { column, row: r - d })
      d = end + 1
      column += 1
    }
    const xs = main.map((n) => pos.get(n.id)?.x ?? CX)
    const span = Math.max(...xs) + 156 - Math.min(...xs)
    const pitch = span + LANE + 40 // a clear gutter for the line that climbs to the next column
    for (const n of main) {
      const at = columnOf.get(depth.get(n.id) ?? maxD + 1)
      const p = pos.get(n.id)
      if (!p || !at) continue
      pos.set(n.id, { x: p.x + at.column * pitch, y: TOP + at.row * ROW })
    }
  }
  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }))
}

/* ---------- the editor ---------- */

/** Blocks the left palette offers — drag onto the canvas (or click to add). */
const BLOCKS: { type: BlockType; label: string }[] = [
  { type: 'approval', label: 'Approver' },
  { type: 'condition', label: 'Rule' },
  { type: 'email', label: 'Email' },
  { type: 'sms', label: 'SMS' },
  { type: 'step', label: 'Journey step' },
  { type: 'exception', label: 'Exception' },
]

/** Which point of the candidate journey a message is sent at. The points are the server's. */
function SentWhen({ points, value, onChange }: {
  points: JourneyPointInfo[]
  value: string | undefined
  onChange: (point: JourneyPointInfo | undefined) => void
}) {
  const chosen = points.find((p) => p.key === value)
  return (
    <>
      <label>
        Sent when
        <select
          className="select"
          value={chosen ? chosen.key : ''}
          onChange={(e) => onChange(points.find((p) => p.key === e.target.value))}
        >
          <option value="">Choose when this is sent</option>
          {points.map((p) => (
            <option key={p.key} value={p.key}>{p.sentWhen}</option>
          ))}
        </select>
      </label>
      {!chosen && (
        <div className="wfc-inspector__hint">
          {value
            ? 'This step is set to a point this kind of message cannot be sent at. Choose another.'
            : 'Until a point is chosen, this step sends nothing.'}
        </div>
      )}
      {chosen && chosen.needs.length > 0 && (
        <div className="wfc-inspector__hint">
          The message has to carry {chosen.needs.map((f) => `{{${f}}}`).join(', ')}. Only templates that do are listed.
        </div>
      )}
    </>
  )
}

type BlockType = 'approval' | 'condition' | 'email' | 'sms' | 'step' | 'exception'

/** @param journey true on a candidate journey: a message there is sent at a journey point, chosen on the right */
const blockDefaults = (type: BlockType, firstRole?: string, journey = false): WfData =>
  type === 'approval'
    ? { label: 'New approval', approverRole: firstRole }
    : type === 'condition'
      ? { condition: '' } // nothing chosen yet: the panel asks what to check
      : type === 'email'
        ? { label: 'Email notification', ...(journey ? {} : { emailTrigger: EMAIL_TRIGGERS[0] }) }
        : type === 'sms'
          ? { label: 'SMS message', ...(journey ? {} : { smsTrigger: SMS_TRIGGERS[0] }) }
          : type === 'step'
            ? { label: 'Journey step' }
            : { label: 'Sent for review' }

/** Always listened for — taking the keys away while one is held down would miss its release. */
const DELETE_KEYS = ['Backspace', 'Delete']

/** The start and the outcome are part of every workflow: they are never removed. */
const fixed = (n: Node | undefined) => !n || n.type === 'trigger' || n.type === 'end' || n.id === 'end'

/** An id no line in `among` uses. */
const freshLineId = (among: Edge[], source: string, target: string, handle?: string | null) => {
  const base = `e-${source}-${handle ?? 'x'}-${target}`
  let id = base
  let k = 2
  while (among.some((e) => e.id === id)) id = `${base}-${k++}`
  return id
}

/**
 * Put lines where another line was. A step with several lines out follows the
 * first of them, so the order of the lines is part of the workflow: a line
 * that replaces another must take its place, not go to the back.
 */
const swapLine = (edges: Edge[], id: string, ...put: Edge[]): Edge[] => {
  const at = edges.findIndex((e) => e.id === id)
  if (at < 0) return [...edges, ...put]
  return [...edges.slice(0, at), ...put, ...edges.slice(at + 1)]
}

/**
 * The drawing without one step. Lines that led to it carry on to where it
 * led, each in the place of the line it replaces, so the flow is joined back
 * together as it was.
 */
function withoutStep(nodes: Node[], edges: Edge[], id: string): { nodes: Node[]; edges: Edge[]; healed: boolean } {
  const step = nodes.find((n) => n.id === id)
  const isBypass = (target: string) => nodes.find((n) => n.id === target)?.type === 'policy'
  // Where the step led: the line a request follows out of it. The auto-approve
  // card is a bypass, not a step on the way — joining the flow around it would
  // draw a line from the start straight to the outcome.
  const followed = step?.type === 'policy' ? undefined : edges.find((e) => e.source === id && e.target !== id && !isBypass(e.target))
  const onward = followed?.target ?? null
  const put: Edge[] = []
  let healed = false
  for (const e of edges) {
    if (e.source === id) continue
    if (e.target !== id) {
      put.push(e)
      continue
    }
    if (!onward || e.source === onward) continue
    put.push(
      decorateEdge({
        id: freshLineId([...edges, ...put], e.source, onward, e.sourceHandle),
        source: e.source,
        target: onward,
        sourceHandle: e.sourceHandle,
      }),
    )
    healed = true
  }
  // Two lines between the same steps are one line: the first keeps its place.
  const met = new Set<string>()
  const next = put.filter((e) => {
    const key = `${e.source}|${e.sourceHandle ?? ''}|${e.target}`
    if (met.has(key)) return false
    met.add(key)
    return true
  })
  return { nodes: nodes.filter((n) => n.id !== id), edges: next, healed }
}

/** A question asked over the canvas. Takes the keyboard while it is open and hands it back after. */
function CanvasDialog({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const stops = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
    stops()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close.current()
        return
      }
      if (e.key !== 'Tab') return
      const all = stops()
      if (all.length === 0) return
      const at = all.indexOf(document.activeElement as HTMLElement)
      const to = e.shiftKey ? (at <= 0 ? all.length - 1 : at - 1) : at === all.length - 1 || at < 0 ? 0 : at + 1
      e.preventDefault()
      all[to].focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])
  return createPortal(
    <div className="scrim" style={{ zIndex: 200 }} onClick={onClose}>
      <div ref={ref} className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default function ApprovalCanvas(props: {
  workflow: ApprovalWorkflow
  onClose: () => void
  onSaved: (w: ApprovalWorkflow) => void
  /** A line under the title: where this drawing stands in review. */
  notice?: string | null
}) {
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

function ApprovalCanvasInner({ workflow, onClose, onSaved, notice }: { workflow: ApprovalWorkflow; onClose: () => void; onSaved: (w: ApprovalWorkflow) => void; notice?: string | null }) {
  const { roles } = useConfig()
  const { toastMsg: flash } = useStore()
  const flashRef = useRef(flash)
  flashRef.current = flash
  const roleName = useCallback((k: string) => roles.find((r: Role) => r.key === k)?.name ?? k, [roles])

  const seed = useMemo(() => seedGraph(workflow, roleName), [workflow, roleName])
  const [nodes, setNodes, onNodesChange] = useNodesState(seed.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(seed.edges)
  const [selId, setSelId] = useState<string | null>(null)
  /** A step id no other step in this graph uses. (A per-session counter restarted
   *  at 1 every time the canvas opened, so a second visit could mint an id that
   *  was already taken and silently merge two steps.) */
  const nextId = (type: BlockType) => {
    const taken = new Set(nodesRef.current.map((n) => n.id))
    let k = 1
    while (taken.has(`n-${type}-${k}`)) k++
    return `n-${type}-${k}`
  }

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
  const { data: smsTemplates } = useQuery({ queryKey: ['sms-templates'], queryFn: commsApi.getSmsTemplates })
  // A candidate journey sends its messages at the journey's points; the server says which there are.
  const isJourney = workflow.trigger === JOURNEY
  const { data: journey } = useJourney()

  // Compute handle bounds after mount so edges render as soon as the canvas opens.
  // Retried on a short schedule: environments without a working ResizeObserver
  // (some embedded browsers) never self-measure, and a single early call can land
  // before layout settles.
  const updateNodeInternals = useUpdateNodeInternals()
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges
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
    (c: Connection) => {
      rememberRef.current()
      setEdges((eds) => addEdge(decorateEdge({ ...c, id: `e-${c.source}-${c.target}-${Date.now()}` } as Edge), eds))
    },
    [setEdges],
  )

  /**
   * Why a line can't be drawn, or null when it can. Lines a request could
   * never follow are refused as they are drawn: nothing leaves an outcome, a
   * rule has one line per answer, and any other step leads to one next step.
   */
  const whyNot = useCallback((c: { source: string | null; target: string | null; sourceHandle?: string | null }) => {
    const src = nodesRef.current.find((n) => n.id === c.source)
    const tgt = nodesRef.current.find((n) => n.id === c.target)
    if (!src || !tgt || c.source === c.target) return 'A line joins two different steps'
    if (src.type === 'exception' || src.type === 'end') return 'Nothing follows an outcome'
    if (src.type === 'policy' || tgt.type === 'policy') return 'The auto-approve card is set by the workflow’s policy, not drawn'
    if (tgt.type === 'trigger') return 'Nothing leads back to the start'
    if (src.type === 'condition') {
      // A line may only leave a rule from its YES or NO port. In loose mode a
      // drag that ENDS on one of the rule's other ports would otherwise make
      // the rule the source of an unmarked line: never followed, not drawn.
      if (c.sourceHandle !== 'yes' && c.sourceHandle !== 'no') return 'A rule’s lines leave from YES or NO'
      return edgesRef.current.some((e) => e.source === c.source && e.sourceHandle === c.sourceHandle)
        ? `This rule already has a line for ${c.sourceHandle === 'yes' ? 'YES' : 'NO'} — remove it first, or use the rule’s panel`
        : null
    }
    const leads = edgesRef.current.some(
      (e) => e.source === c.source && nodesRef.current.find((n) => n.id === e.target)?.type !== 'policy',
    )
    return leads ? 'A step leads to one next step — add a rule to go two ways' : null
  }, [])

  const isValidConnection = useCallback((c: Connection | Edge) => whyNot(c) === null, [whyNot])

  /** A line that was refused says why, so the refusal is not a mystery. */
  const onConnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid || !state.fromNode || !state.toNode || !state.fromHandle) return
      // In loose mode a line can be dragged from either end.
      const forward = state.fromHandle.type === 'source'
      const why = whyNot({
        source: forward ? state.fromNode.id : state.toNode.id,
        target: forward ? state.toNode.id : state.fromNode.id,
        sourceHandle: forward ? state.fromHandle.id : state.toHandle?.id,
      })
      if (why) flashRef.current(why, 'danger')
    },
    [whyNot],
  )

  /** Steps are removed one way only — healed, confirmed and undoable — so the
   *  keyboard hands them to that path instead of cutting them out itself. */
  const removeStepsRef = useRef<(ids: string[], lineIds?: string[]) => void>(() => {})
  const rememberRef = useRef<() => void>(() => {})
  /** True while a menu or a question is open: the keyboard belongs to it. */
  const busyRef = useRef(false)
  const onBeforeDelete = useCallback(
    async ({ nodes: doomed, edges: cut }: { nodes: Node[]; edges: Edge[] }) => {
      if (busyRef.current) return false
      if (doomed.length === 0) {
        if (cut.length) rememberRef.current()
        return { nodes: [], edges: cut }
      }
      // `cut` also lists the lines of the doomed steps, and a selection box
      // marks those lines selected too. Only a line chosen on its own is the
      // user's to remove — the lines of a removed step are joined back together.
      const touches = (e: Edge) => doomed.some((n) => n.id === e.source || n.id === e.target)
      removeStepsRef.current(
        doomed.map((n) => n.id),
        cut.filter((e) => e.selected && !touches(e)).map((e) => e.id),
      )
      return false
    },
    [],
  )

  // Same retry schedule as the mount effect: a single early call can land before
  // layout settles (or before a flaky ResizeObserver reports), leaving the new
  // node's handle bounds unknown — which silently breaks connecting to it.
  const measureSoon = useCallback(
    (id: string) => [80, 250, 600, 1200].forEach((ms) => setTimeout(() => updateNodeInternals(id), ms)),
    [updateNodeInternals],
  )

  const addNode = (type: BlockType, position?: { x: number; y: number }) => {
    rememberRef.current()
    const id = nextId(type)
    const data: WfData = blockDefaults(type, roles[0]?.name, isJourney)
    setNodes((ns) => [...ns, sized({ id, type, position: position ?? { x: 560, y: 120 + ns.length * 40 }, data })])
    setSelId(id)
    measureSoon(id)
    return id
  }

  /* ---------- drag & drop from the blocks palette ---------- */

  const { screenToFlowPosition, fitView, setCenter, getZoom } = useReactFlow()

  /** Is a flow-space point inside a node's box? */
  const hitNode = (p: { x: number; y: number }, n: Node) => {
    const w = (n.width as number) ?? DIMS[n.type as string]?.width ?? 184
    const h = (n.height as number) ?? DIMS[n.type as string]?.height ?? 80
    return p.x >= n.position.x && p.x <= n.position.x + w && p.y >= n.position.y && p.y <= n.position.y + h
  }

  /** Nearest edge whose segment passes within ~55px of the point (drop "between two boxes"). */
  const nearestEdge = (p: { x: number; y: number }): Edge | null => {
    const box = (id: string) => {
      const n = nodes.find((n) => n.id === id)
      if (!n) return null
      const w = (n.width as number) ?? DIMS[n.type as string]?.width ?? 184
      const h = (n.height as number) ?? DIMS[n.type as string]?.height ?? 80
      return { x: n.position.x, y: n.position.y, w, h }
    }
    const bypass = new Set(nodes.filter((n) => n.type === 'policy').map((n) => n.id))
    let best: { e: Edge; d: number } | null = null
    for (const e of edges) {
      if (bypass.has(e.source) || bypass.has(e.target)) continue
      const from = box(e.source)
      const to = box(e.target)
      if (!from || !to) continue
      // A rule's lines leave by their own ports, so YES and NO can be told
      // apart even when both lead to the same step.
      const a =
        e.sourceHandle === 'yes' || e.sourceHandle === 'no'
          ? { x: from.x + from.w * (e.sourceHandle === 'yes' ? 0.25 : 0.75), y: from.y + from.h }
          : { x: from.x + from.w / 2, y: from.y + from.h / 2 }
      const b = { x: to.x + to.w / 2, y: to.y + to.h / 2 }
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2))
      const d = Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)))
      if (d < 55 && (!best || d < best.d)) best = { e, d }
    }
    return best?.e ?? null
  }

  /** Attach an email notification to an approval step (envelope badge on the box). */
  const attachEmail = (nodeId: string) => {
    rememberRef.current()
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

  /* ---------- history: every change to the drawing can be undone ---------- */

  /** Timers lighting a test's path, step by step. */
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const history = useRef<{ nodes: Node[]; edges: Edge[] }[]>([])
  const [canUndo, setCanUndo] = useState(false)
  /** The field last typed into, so a burst of typing is one step back — not one per letter. */
  const typing = useRef<{ key: string; at: number } | null>(null)
  const remember = () => {
    history.current.push({ nodes: nodesRef.current, edges: edgesRef.current })
    if (history.current.length > 40) history.current.shift()
    typing.current = null
    setCanUndo(true)
  }
  rememberRef.current = remember
  const undo = () => {
    const last = history.current.pop()
    if (!last) return
    typing.current = null
    // Anything being asked about the drawing as it was is no longer a question.
    setMenu(null)
    setGuard(null)
    setDoomedRule(null)
    // The drawing comes back; what was selected or lit by a test at the time does not.
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setNodes(
      last.nodes.map((n) =>
        n.selected || (n.data as WfData).lit ? { ...n, selected: false, data: { ...n.data, lit: false } } : n,
      ),
    )
    setEdges(
      last.edges.map((e) =>
        e.selected || e.className?.includes('wfc-edge--lit')
          ? { ...e, selected: false, className: e.className?.replace(/\s*wfc-edge--lit/, '') || undefined }
          : e,
      ),
    )
    setSelId(null)
    setCanUndo(history.current.length > 0)
    last.nodes.forEach((n) => measureSoon(n.id))
    flash('Undone')
  }
  const undoRef = useRef(undo)
  undoRef.current = undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      if (busyRef.current) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      e.preventDefault()
      undoRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- adding steps ---------- */

  /** An id no line in this drawing uses. */
  const lineId = (source: string, target: string, handle?: string | null) =>
    freshLineId(edgesRef.current, source, target, handle)

  /** Put the drawing in its new shape, tidy it, and bring it into view. */
  const redraw = (nextNodes: Node[], nextEdges: Edge[], select?: string) => {
    setNodes(autoLayout(nextNodes, nextEdges).map((n) => (select ? { ...n, selected: n.id === select } : n)))
    setEdges(nextEdges)
    if (select) setSelId(select)
    nextNodes.forEach((n) => measureSoon(n.id))
    setTimeout(() => fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), 90)
  }

  /**
   * Put a new step on a line. A rule arrives complete: both of its answers
   * lead on to the step that followed the line, so "otherwise" is never left
   * undrawn — the panel then asks what should be different on each side.
   */
  const insertOnEdge = (type: BlockType, edge: Edge, p?: { x: number; y: number }) => {
    remember()
    const id = nextId(type)
    const src = nodes.find((n) => n.id === edge.source)
    const tgt = nodes.find((n) => n.id === edge.target)
    const at = p ?? {
      x: ((src?.position.x ?? 0) + (tgt?.position.x ?? 0)) / 2 + 78,
      y: ((src?.position.y ?? 0) + (tgt?.position.y ?? 0)) / 2 + 50,
    }
    const node = sized({ id, type, position: { x: at.x - 78, y: at.y - 50 }, data: blockDefaults(type, roles[0]?.name, isJourney) })
    const onward =
      type === 'condition'
        ? (['yes', 'no'] as const).map((answer) =>
            decorateEdge({ id: lineId(id, edge.target, answer), source: id, target: edge.target, sourceHandle: answer }),
          )
        : [decorateEdge({ id: lineId(id, edge.target), source: id, target: edge.target })]
    const next = swapLine(
      edges,
      edge.id,
      decorateEdge({ id: lineId(edge.source, id, edge.sourceHandle), source: edge.source, target: id, sourceHandle: edge.sourceHandle }),
      ...onward,
    )
    redraw([...nodes, node], next, id)
    flash(
      type === 'condition'
        ? 'Rule added — choose what it checks'
        : type === 'email' || type === 'sms'
          ? `${type === 'sms' ? 'Text message' : 'Email'} added — pick a template on the right`
          : 'Step added to the flow',
    )
  }

  /** Dropping a block from the palette onto a line. */
  const spliceIntoEdge = (type: BlockType, edge: Edge, p: { x: number; y: number }) => insertOnEdge(type, edge, p)

  /** Add a step after one that has nothing following it (or on an unanswered side of a rule). */
  const appendFrom = (nodeId: string, answer: Answer | null, type: BlockType) => {
    const src = nodes.find((n) => n.id === nodeId)
    if (!src) return
    remember()
    const id = nextId(type)
    const node = sized({
      id,
      type,
      position: { x: src.position.x + (answer === 'yes' ? -120 : answer === 'no' ? 120 : 0), y: src.position.y + 210 },
      data: blockDefaults(type, roles[0]?.name, isJourney),
    })
    const next = [
      ...edges,
      decorateEdge({ id: lineId(nodeId, id, answer), source: nodeId, target: id, sourceHandle: answer ?? undefined }),
    ]
    redraw([...nodes, node], next, id)
  }

  /* ---------- the "what happens next?" menu ---------- */

  const [menu, setMenu] = useState<{ at: { x: number; y: number }; target: AddTarget } | null>(null)
  const openMenu = useCallback((at: { x: number; y: number }, target: AddTarget) => setMenu({ at, target }), [])
  /** A line an exception is about to be placed on: ask whether it always stops there. */
  const [guard, setGuard] = useState<Edge | null>(null)

  const pick = (kind: StepKind) => {
    const target = menu?.target
    setMenu(null)
    if (!target) return
    if (target.kind === 'open') {
      appendFrom(target.nodeId, target.answer, kind)
      return
    }
    const edge = edges.find((e) => e.id === target.edgeId)
    if (!edge) return
    const onBypass = [edge.source, edge.target].some((id) => nodes.find((n) => n.id === id)?.type === 'policy')
    if (onBypass) return
    if (kind === 'exception') setGuard(edge)
    else insertOnEdge(kind, edge)
  }

  const removeLine = () => {
    const target = menu?.target
    setMenu(null)
    if (target?.kind !== 'edge') return
    remember()
    setEdges((es) => es.filter((e) => e.id !== target.edgeId))
    flash('Connection removed')
  }

  /** What stopping the flow on the guarded line would cut off. */
  const guardCut = useMemo(() => {
    if (!guard) return []
    const next = [
      ...edges.filter((e) => e.id !== guard.id),
      { id: '__stop__', source: guard.source, target: '__stop__', sourceHandle: guard.sourceHandle },
    ]
    return cutOff(nodes as GNode[], edges as GEdge[], next as GEdge[])
  }, [guard, nodes, edges])

  /** Exception "only in some cases": a rule decides, and the flow carries on otherwise. */
  const stopSometimes = () => {
    const edge = guard
    setGuard(null)
    if (!edge) return
    remember()
    const rule = nextId('condition')
    const exc = nextId('exception')
    const src = nodes.find((n) => n.id === edge.source)
    const at = { x: src?.position.x ?? 320, y: (src?.position.y ?? 0) + 210 }
    const added = [
      sized({ id: rule, type: 'condition', position: at, data: blockDefaults('condition') }),
      sized({ id: exc, type: 'exception', position: { x: at.x - 120, y: at.y + 210 }, data: blockDefaults('exception') }),
    ]
    const next = swapLine(
      edges,
      edge.id,
      decorateEdge({ id: lineId(edge.source, rule, edge.sourceHandle), source: edge.source, target: rule, sourceHandle: edge.sourceHandle }),
      decorateEdge({ id: lineId(rule, exc, 'yes'), source: rule, target: exc, sourceHandle: 'yes' }),
      decorateEdge({ id: lineId(rule, edge.target, 'no'), source: rule, target: edge.target, sourceHandle: 'no' }),
    )
    redraw([...nodes, ...added], next, rule)
    flash('Rule added — choose when a request should stop for review')
  }

  /** Exception "always": everything after this point is no longer reached. */
  const stopAlways = () => {
    const edge = guard
    setGuard(null)
    if (!edge) return
    remember()
    const exc = nextId('exception')
    const src = nodes.find((n) => n.id === edge.source)
    const gone = new Set(guardCut.filter((n) => n.type !== 'trigger' && n.type !== 'end').map((n) => n.id))
    const kept = nodes.filter((n) => !gone.has(n.id))
    const next = swapLine(
      edges,
      edge.id,
      decorateEdge({ id: lineId(edge.source, exc, edge.sourceHandle), source: edge.source, target: exc, sourceHandle: edge.sourceHandle }),
    ).filter((e) => !gone.has(e.source) && !gone.has(e.target))
    const node = sized({
      id: exc,
      type: 'exception',
      position: { x: src?.position.x ?? 320, y: (src?.position.y ?? 0) + 210 },
      data: blockDefaults('exception'),
    })
    redraw([...kept, node], next, exc)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const type = dragTypeRef.current
    if (!type) return
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    let nodeId: string | null = null
    if (type === 'email') nodeId = nodes.find((n) => n.type === 'approval' && hitNode(p, n))?.id ?? null
    const edgeId = nodeId || type === 'exception' ? null : (nearestEdge(p)?.id ?? null)
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
    // An exception ends its path, so splicing one INTO a line would cut off
    // everything after it. Place it beside the line instead and let the user
    // wire it from the side of a rule it belongs to.
    if (edge && type !== 'exception') {
      spliceIntoEdge(type, edge, p)
      return
    }
    addNode(type, { x: p.x - 92, y: p.y - 32 })
    if (type === 'exception') flash('Exception added — connect it from the YES or NO side of a rule')
  }

  const arrange = (columns = false) => {
    remember()
    setNodes((ns) => autoLayout(ns, edges, columns))
    // Re-frame once the new positions have applied.
    setTimeout(() => fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), 60)
    flash(columns ? 'Arranged in columns' : 'Auto-arranged')
  }

  const patchData = (patch: Partial<WfData>) => {
    const key = `${selId}:${Object.keys(patch).sort().join(',')}`
    const now = Date.now()
    const sameBurst = typing.current?.key === key && now - typing.current.at < 1500
    if (!sameBurst) remember()
    typing.current = { key, at: now }
    setNodes((ns) => ns.map((n) => (n.id === selId ? { ...n, data: { ...n.data, ...patch } } : n)))
  }

  /* ---------- removing steps ---------- */

  /** A rule about to be removed: confirmed first, because its sides go with it. */
  const [doomedRule, setDoomedRule] = useState<string | null>(null)
  busyRef.current = !!(menu || guard || doomedRule)

  /**
   * The drawing once a rule is taken out. Requests go on to where its answers
   * rejoined — or, when only one answer carried on, to the first step of that
   * answer, so the flow after the rule is kept whole.
   */
  const withoutRule = (id: string) => {
    const onward = afterRule(nodes as GNode[], edges as GEdge[], id)
    const next: Edge[] = []
    for (const e of edges) {
      if (e.source === id) continue
      if (e.target !== id) {
        next.push(e)
        continue
      }
      if (!onward || e.source === onward.id) continue
      next.push(
        decorateEdge({
          id: freshLineId([...edges, ...next], e.source, onward.id, e.sourceHandle),
          source: e.source,
          target: onward.id,
          sourceHandle: e.sourceHandle,
        }),
      )
    }
    // Steps that only existed on the rule's sides are no longer reached.
    const gone = cutOff(nodes as GNode[], edges as GEdge[], next as GEdge[]).filter(
      (n) => n.id !== id && !fixed(n as Node),
    )
    return { onward, gone, next }
  }

  const removeRule = () => {
    const id = doomedRule
    setDoomedRule(null)
    if (!id) return
    remember()
    const { gone, next } = withoutRule(id)
    const out = new Set([id, ...gone.map((n) => n.id)])
    redraw(
      nodes.filter((n) => !out.has(n.id)),
      next.filter((e) => !out.has(e.source) && !out.has(e.target)),
    )
    setSelId(null)
    flash('Rule removed')
  }

  /**
   * Remove steps (and any lines selected with them), joining the flow back
   * together around each. A rule is only ever removed alone, after the
   * question about its sides has been answered.
   */
  const removeSteps = (ids: string[], lineIds: string[] = []) => {
    const doomed = ids.map((id) => nodes.find((n) => n.id === id)).filter((n): n is Node => !fixed(n))
    const rules = doomed.filter((n) => n.type === 'condition')
    const steps = doomed.filter((n) => n.type !== 'condition')
    if (steps.length === 0 && lineIds.length === 0) {
      if (rules.length === 1) setDoomedRule(rules[0].id)
      else if (rules.length > 1) flash('Rules are removed one at a time — select one and choose Remove rule')
      return
    }
    remember()
    let next = { nodes: nodes as Node[], edges: edges.filter((e) => !lineIds.includes(e.id)), healed: false }
    let healed = false
    for (const step of steps) {
      next = withoutStep(next.nodes, next.edges, step.id)
      healed = healed || next.healed
    }
    redraw(next.nodes, next.edges)
    setSelId(null)
    const what =
      steps.length === 0
        ? 'Connection removed'
        : steps.length === 1
          ? healed
            ? 'Step removed — the flow was joined back together'
            : 'Step removed'
          : `${steps.length} steps removed`
    flash(rules.length ? `${what}. Rules are removed one at a time` : what)
  }
  removeStepsRef.current = removeSteps

  const deleteSelected = () => {
    if (selId) removeSteps([selId])
  }

  /* ---------- a rule's two sides ---------- */

  const chooseSide = (
    ruleId: string,
    answer: Answer,
    choice: SideChoice,
    anchor: { x: number; y: number },
    destId?: string,
  ) => {
    const side = sideOf(nodes as GNode[], edges as GEdge[], ruleId, answer)
    if (choice === 'addFirst') {
      openMenu(anchor, side.edge ? { kind: 'edge', edgeId: side.edge.id } : { kind: 'open', nodeId: ruleId, answer })
      return
    }
    if (choice === 'add') {
      if (side.state === 'steps') {
        const last = side.steps[side.steps.length - 1]
        if (last.type === 'condition') {
          selectStep(last.id) // a rule inside this side: its own panel continues the story
          return
        }
        const onward = edges.find((e) => e.source === last.id)
        openMenu(anchor, onward ? { kind: 'edge', edgeId: onward.id } : { kind: 'open', nodeId: last.id, answer: null })
      } else if (side.edge) openMenu(anchor, { kind: 'edge', edgeId: side.edge.id })
      else openMenu(anchor, { kind: 'open', nodeId: ruleId, answer })
      return
    }
    const rule = nodes.find((n) => n.id === ruleId)
    if (!rule) return
    /** This answer's line, replaced in the place it held. */
    const lineTo = (target: string) => {
      const line = decorateEdge({ id: lineId(ruleId, target, answer), source: ruleId, target, sourceHandle: answer })
      return side.edge ? swapLine(edges, side.edge.id, line) : [...edges, line]
    }
    if (choice === 'stop') {
      remember()
      const exc = nextId('exception')
      const node = sized({
        id: exc,
        type: 'exception',
        position: { x: rule.position.x + (answer === 'yes' ? -196 : 196), y: rule.position.y + 210 },
        data: blockDefaults('exception'),
      })
      const next = lineTo(exc)
      const left = cutOff(nodes as GNode[], edges as GEdge[], next as GEdge[]).filter((n) => !fixed(n as Node))
      redraw([...nodes, node], next, ruleId)
      if (left.length) {
        flash(
          `${left.length} step${left.length === 1 ? ' is' : 's are'} no longer reached: ${left.map((n) => stepName(n)).join(', ')}. Undo brings ${left.length === 1 ? 'it' : 'them'} back`,
          'danger',
        )
      }
      return
    }
    // Carry on: to the step that was chosen, else the nearest one there is.
    const choices = continueChoices(nodes as GNode[], edges as GEdge[], ruleId, answer)
    const dest = choices.find((n) => n.id === destId) ?? (destId ? undefined : choices[0])
    if (!dest) {
      flash('There is nowhere to continue to yet — add an outcome first', 'danger')
      return
    }
    if (side.edge?.target === dest.id) return
    remember()
    const next = lineTo(dest.id)
    // An exception nothing else leads to goes with the line that led to it.
    const orphan =
      side.state === 'stop' && side.target && !next.some((e) => e.target === side.target!.id) ? side.target.id : null
    redraw(
      nodes.filter((n) => n.id !== orphan),
      next.filter((e) => e.source !== orphan),
      ruleId,
    )
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

  const save = async () => {
    const patch = buildPatch()
    const updated = { ...workflow, ...patch }
    let saved: ServerWorkflowDto | undefined
    try {
      // The server keeps it as a change for review, not as the live workflow; its answer says which.
      const data = await saveServer.mutateAsync([toServerDto(updated)])
      saved = data.find((d) => d.key === updated.id)
    } catch (e) {
      // The server refused (a rule with no NO path on a live workflow, or a copy that is out of date).
      // Keep the canvas open with the work intact and say why.
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      flash(msg ?? 'Could not save the workflow', 'danger')
      return
    }
    onSaved(saved ? fromServerDto(saved) : updated)
    flash(
      !saved?.change
        ? 'Saved. It matches the live version, so there is nothing to review.'
        : saved.change.status === 'DRAFT'
          ? 'Saved as a draft. Send it for review from its card when it is ready.'
          : 'Saved.',
    )
    onClose()
  }

  /* ---------- reading the drawing ---------- */

  /** Select a step and bring it into view (from the read-back, the to-do list, a rule's side). */
  const selectStep = (id: string) => {
    const n = nodes.find((x) => x.id === id)
    if (!n) return
    setSelId(id)
    setNodes((ns) => ns.map((x) => ({ ...x, selected: x.id === id })))
    setCenter(n.position.x + 78, n.position.y + 60, { zoom: Math.max(getZoom(), 0.8), duration: 300 })
  }

  /** Answers and steps with nothing leaving them: shown on the canvas as dashed stubs. */
  const openEnds = useMemo(() => {
    const ends = new Map<string, OpenEnds>()
    for (const n of nodes) {
      const leaving = edges.filter((e) => e.source === n.id)
      if (n.type === 'condition') {
        const yes = !leaving.some((e) => e.sourceHandle === 'yes')
        const no = !leaving.some((e) => e.sourceHandle === 'no')
        if (yes || no) ends.set(n.id, { yes, no, next: false })
      } else if (!isOutcome(n as GNode) && n.type !== 'policy' && leaving.length === 0) {
        ends.set(n.id, { yes: false, no: false, next: true })
      }
    }
    return ends
  }, [nodes, edges])

  const canvasActions = useMemo(() => ({ openMenu, openEnds }), [openMenu, openEnds])

  /** The drawing minus where things sit: dragging a card changes nothing that needs re-reading. */
  const structure = useMemo(
    () =>
      JSON.stringify({
        n: nodes.map((n) => [n.id, n.type, (({ lit: _lit, ...rest }) => rest)(n.data as WfData)]),
        e: edges.map((e) => [e.source, e.target, e.sourceHandle ?? null]),
      }),
    [nodes, edges],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sentences = useMemo(() => describe(nodes as GNode[], edges as GEdge[]), [structure])

  // What is left to finish is the server's call; the canvas only asks.
  const [issues, setIssues] = useState<CheckIssue[]>([])
  const [checkState, setCheckState] = useState<'checking' | 'done' | 'failed'>('checking')
  const buildPatchRef = useRef(buildPatch)
  buildPatchRef.current = buildPatch
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      const { graph, levels } = buildPatchRef.current()
      checkWorkflow(graph, levels, workflow.trigger)
        .then((found) => {
          if (!live) return
          setIssues(found)
          setCheckState('done')
        })
        // No answer is not the same as nothing to finish: say it could not be checked.
        .catch(() => live && setCheckState('failed'))
    }, 450)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [structure, workflow.trigger])

  /* ---------- test / simulation ---------- */

  const [simOpen, setSimOpen] = useState(false)
  const [sim, setSim] = useState({ format: 'IN_PERSON', notice: '', flagged: false })
  const [simResult, setSimResult] = useState<SimulateResult | null>(null)
  const simulate = useSimulateWorkflow(workflow.id)

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
      // Send the canvas as drawn; the engine evaluates it without saving.
      const res = await simulate.mutateAsync({
        eventFormat: sim.format,
        daysNotice: sim.notice === '' ? null : Number(sim.notice),
        flaggedCritical: sim.flagged,
        graph: buildPatch().graph,
        autoApprove: workflow.autoApprove,
      })
      setSimResult(res)
      // Light the path node-by-node.
      res.path.forEach((id, i) => {
        timersRef.current.push(
          setTimeout(() => {
            setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, lit: true } } : n)))
            if (i > 0) {
              const prev = res.path[i - 1]
              const followed = res.lines?.[i - 1]
              setEdges((es) => {
                // The engine names the line it followed. Two lines can join the
                // same pair of steps (a rule's YES and NO), so never match by ends alone.
                const line = (followed && es.find((e) => e.id === followed)) || es.find((e) => e.source === prev && e.target === id)
                if (!line) return es
                return es.map((e) =>
                  e.id === line.id ? { ...e, className: e.className ? `${e.className} wfc-edge--lit` : 'wfc-edge--lit' } : e,
                )
              })
            }
          }, 350 * i),
        )
      })
    } catch (e) {
      // Only blame the connection when there was no answer at all.
      const res = (e as { response?: { data?: { message?: string } } })?.response
      flash(res ? (res.data?.message ?? 'The test could not be run') : 'Simulation failed — is the backend running?', 'danger')
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
  // On a journey the point comes first, and the server says which templates can word it.
  // With no point chosen yet there is nothing to choose a template for.
  const point = isJourney ? journey?.points.find((p) => p.key === selData.journeyPoint) : undefined
  const ownFirst = <T extends { templateKey?: string | null }>(list: T[]) =>
    point ? [...list].sort((x, y) => Number(y.templateKey === point.templateKey) - Number(x.templateKey === point.templateKey)) : list
  const emailChoices = !isJourney
    ? (templates ?? [])
    : ownFirst((templates ?? []).filter((t) => point?.emailTemplates.includes(t.templateId)))
  const smsChoices = !isJourney
    ? (smsTemplates ?? [])
    : ownFirst((smsTemplates ?? []).filter((t) => point?.textTemplates.includes(t.id)))

  const emailRules = (
    <>
      {isJourney && (
        <SentWhen
          points={(journey?.points ?? []).filter((p) => p.drawn && p.byEmail)}
          value={selData.journeyPoint}
          onChange={(p) => {
            // A new point brings its own wording; what worded the old point does not follow.
            const own = (templates ?? []).find((t) => p && t.templateKey === p.templateKey && p.emailTemplates.includes(t.templateId))
            patchData({
              journeyPoint: p?.key, emailTrigger: p?.sentWhen,
              emailTemplateId: own?.templateId, emailTemplateName: own?.name,
            })
          }}
        />
      )}
      <div className="wfc-inspector__label">Email template</div>
      <div className="wfc-tpl-list">
        {emailChoices.map((t) => (
          <button
            key={t.templateId}
            className={`wfc-tpl${selData.emailTemplateId === t.templateId ? ' is-on' : ''}`}
            onClick={() => patchData({ emailTemplateId: t.templateId, emailTemplateName: t.name })}
          >
            <span className={`wfc-tpl__dot${t.status === 'ACTIVE' ? ' is-active' : ''}`} />
            <span style={{ minWidth: 0 }}>
              <span className="wfc-tpl__name">{t.name}</span>
              <span className="wfc-tpl__subject">{t.subject || 'No subject yet'}</span>
            </span>
          </button>
        ))}
        {emailChoices.length === 0 && (
          <div className="wfc-tpl-empty">
            {(templates ?? []).length === 0
              ? 'No templates yet. Create them in Admin, Communications.'
              : isJourney && !point
                ? 'Choose when this is sent, then its wording.'
                : 'No template can word this message. The journey’s own wording is sent.'}
          </div>
        )}
      </div>
      <div className="wfc-inspector__hint">
        Templates come from <b>Communications</b>. Hover the step on the canvas to preview the selected email.
        {isJourney ? ' With none chosen, the journey’s own wording is sent.' : ''}
      </div>
      {!isJourney && (
        <label>
          Trigger event
          <select className="select" value={selData.emailTrigger ?? EMAIL_TRIGGERS[0]} onChange={(e) => patchData({ emailTrigger: e.target.value })}>
            {EMAIL_TRIGGERS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      )}
    </>
  )

  const smsRules = (
    <>
      {isJourney && (
        <SentWhen
          points={(journey?.points ?? []).filter((p) => p.drawn && p.byText)}
          value={selData.journeyPoint}
          onChange={(p) => {
            const own = (smsTemplates ?? []).find((t) => p && t.templateKey === p.templateKey && p.textTemplates.includes(t.id))
            patchData({
              journeyPoint: p?.key, smsTrigger: p?.sentWhen,
              smsTemplateId: own?.id, smsTemplateName: own?.name,
            })
          }}
        />
      )}
      <div className="wfc-inspector__label">SMS template</div>
      <div className="wfc-tpl-list">
        {smsChoices.map((t) => (
          <button
            key={t.id}
            className={`wfc-tpl${selData.smsTemplateId === t.id ? ' is-on' : ''}`}
            onClick={() => patchData({ smsTemplateId: t.id, smsTemplateName: t.name })}
          >
            <span className={`wfc-tpl__dot${t.status === 'ACTIVE' ? ' is-active' : ''}`} />
            <span style={{ minWidth: 0 }}>
              <span className="wfc-tpl__name">{t.name}</span>
              <span className="wfc-tpl__subject">{t.body}</span>
            </span>
          </button>
        ))}
        {smsChoices.length === 0 && (
          <div className="wfc-tpl-empty">
            {(smsTemplates ?? []).length === 0
              ? 'No SMS templates yet. Create them in Admin, Communications.'
              : isJourney && !point
                ? 'Choose when this is sent, then its wording.'
                : 'No template can word this message. The journey’s own wording is sent.'}
          </div>
        )}
      </div>
      <div className="wfc-inspector__hint">
        SMS templates come from <b>Communications</b>. Hover the step on the canvas to preview the message.
        {isJourney ? ' With none chosen, the journey’s own wording is sent.' : ''}
      </div>
      {!isJourney && (
        <label>
          Send when
          <select className="select" value={selData.smsTrigger ?? SMS_TRIGGERS[0]} onChange={(e) => patchData({ smsTrigger: e.target.value })}>
            {SMS_TRIGGERS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      )}
    </>
  )

  return (
    <CanvasCtx.Provider value={canvasActions}>
    <div className="wfc wfc--card">
      {menu && (
        <AddMenu at={menu.at} target={menu.target} onPick={pick} onRemoveLine={removeLine} onClose={() => setMenu(null)} />
      )}

      {guard && (
        <CanvasDialog label="Add an exception" onClose={() => setGuard(null)}>
          <div className="modal__head">
            <h3>When should requests stop here?</h3>
            <p>An exception ends the path: the request stops and is sent for review.</p>
          </div>
          <div className="wfc-guard">
            <button className="wfc-guard__choice" onClick={stopSometimes}>
              <span className="wfc-guard__name">Only in some cases</span>
              <span className="wfc-guard__hint">
                Adds a rule. Requests that match it stop for review; all others carry on to{' '}
                <b>{stepName(nodes.find((n) => n.id === guard.target) as GNode | undefined)}</b>.
              </span>
            </button>
            <button className="wfc-guard__choice" onClick={stopAlways}>
              <span className="wfc-guard__name">Always stop here</span>
              <span className="wfc-guard__hint">
                Every request stops for review at this point.{' '}
                {guardCut.length > 0 && (
                  <>
                    {guardCut.length} step{guardCut.length === 1 ? '' : 's'} after it will no longer be reached:{' '}
                    <b>{guardCut.map((n) => stepName(n)).join(', ')}</b>.
                  </>
                )}
              </span>
            </button>
          </div>
          <div className="modal__foot">
            <button className="btn btn--outline" onClick={() => setGuard(null)}>
              Cancel
            </button>
          </div>
        </CanvasDialog>
      )}

      {doomedRule &&
        (() => {
          const rule = nodes.find((n) => n.id === doomedRule)
          const { onward, gone } = withoutRule(doomedRule)
          return (
            <CanvasDialog label="Remove rule" onClose={() => setDoomedRule(null)}>
              <div className="modal__head">
                <h3>Remove this rule?</h3>
                <p>
                  {((rule?.data ?? {}) as WfData).condition?.trim() === ''
                    ? 'This rule'
                    : `“${stepName(rule as GNode | undefined)}”`}{' '}
                  will be removed.{' '}
                  {onward ? (
                    <>
                      Every request will go straight on to <b>{stepName(onward)}</b>.
                    </>
                  ) : (
                    'Nothing will follow the step before it until you add the next one.'
                  )}{' '}
                  {gone.length > 0 && (
                    <>
                      {gone.length} step{gone.length === 1 ? '' : 's'} that {gone.length === 1 ? 'is' : 'are'} no longer reached
                      will be removed too: <b>{gone.map((n) => stepName(n)).join(', ')}</b>.
                    </>
                  )}{' '}
                  You can undo this.
                </p>
              </div>
              <div className="modal__foot">
                <button className="btn btn--outline" onClick={() => setDoomedRule(null)}>
                  Cancel
                </button>
                <button className="btn btn--danger" onClick={removeRule}>
                  Remove rule
                </button>
              </div>
            </CanvasDialog>
          )
        })()}

      <div className="wfc-top">
        <div className="wfc-top__meta">
          <div className="wfc-top__kicker">Workflow canvas</div>
          <div className="wfc-top__title">{workflow.name}</div>
          {notice && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{notice}</div>}
        </div>

        {/* A journey is not routed like a request, so there is no route to test (the server refuses too). */}
        {!isJourney && (
          <button
            className={simOpen ? 'btn btn--primary btn--sm' : 'btn btn--outline btn--sm'}
            onClick={() => {
              if (simOpen) clearLit()
              setSimOpen((o) => !o)
            }}
          >
            Test
          </button>
        )}
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
            isValidConnection={isValidConnection}
            onBeforeDelete={onBeforeDelete}
            deleteKeyCode={DELETE_KEYS}
            onConnectEnd={onConnectEnd}
            onNodeDragStart={() => rememberRef.current()}
            onNodeClick={(_, n) => setSelId(n.id)}
            onPaneClick={() => setSelId(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={38}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#d3d9e5" />
            <MiniMap
              pannable
              zoomable
              style={{ width: 140, height: 92 }}
              nodeColor={(n) => SPEC[n.type as keyof typeof SPEC]?.rail ?? '#93a1b8'}
              maskColor="rgba(242, 244, 248, 0.7)"
            />
            <CanvasToolbar onArrange={(columns) => arrange(columns)} onUndo={undo} canUndo={canUndo} />
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
                <button className="btn btn--primary btn--sm" onClick={runTest} disabled={simulate.isPending}>
                  {simulate.isPending ? 'Running…' : 'Run test'}
                </button>

                {simResult && (
                  <div className="wfc-sim-result">
                    {simResult.autoApproved ? (
                      <div className="wfc-sim-result__verdict" style={{ color: SPEC.policy.iconFg }}>
                        ✓ Auto-approved — chain skipped
                      </div>
                    ) : (simResult.problems ?? []).length > 0 ? (
                      <div className="wfc-sim-result__verdict" style={{ color: 'var(--wfc-red)' }}>
                        This request can't be routed
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
                    {(simResult.problems ?? []).map((p, i) => (
                      <div key={`p${i}`} className="wfc-sim-result__problem" role="alert">
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : !selected ? (
            <>
              <WorkflowInWords sentences={sentences} issues={issues} state={checkState} onSelect={selectStep} />
            </>
          ) : (
            <>
              <div className="wfc-inspector__head">
                <span className="wfc-node__icon" style={{ background: selSpec!.iconBg, color: selSpec!.iconFg }}>
                  {Icons[selected.type as keyof typeof Icons]}
                </span>
                <div>
                  <div className="wfc-node__kicker" style={{ color: selSpec!.rail }}>
                    {selected.type === 'condition' ? 'Rule' : selSpec!.kicker}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-0)' }}>
                    {stepName(selected as GNode)}
                  </div>
                </div>
              </div>
              {selected.type === 'condition' ? (
                <div className="wfc-inspector__body">
                  <RulePanel
                    trigger={workflow.trigger}
                    rule={selected as GNode}
                    nodes={nodes as GNode[]}
                    edges={edges as GEdge[]}
                    onCondition={(value) => patchData({ condition: value })}
                    onSide={(answer, choice, anchor, destId) => chooseSide(selected.id, answer, choice, anchor, destId)}
                    onSelect={selectStep}
                    onRemove={() => removeSteps([selected.id])}
                  />
                </div>
              ) : (
              <div className="wfc-inspector__body">
                <label>
                  {selected.type === 'exception' ? 'Name' : 'Label'}
                  <input className="input" value={selData.label ?? ''} onChange={(e) => patchData({ label: e.target.value })} />
                </label>
                {selected.type === 'exception' && (
                  <>
                    <label>
                      Who reviews it
                      <select className="select" value={selData.reviewerRole ?? ''} onChange={(e) => patchData({ reviewerRole: e.target.value })}>
                        <option value="">Choose a role…</option>
                        {roles.map((r: Role) => (
                          <option key={r.key}>{r.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Reason
                      <input
                        className="input"
                        value={selData.reason ?? ''}
                        placeholder="Flagged critical — needs compliance review"
                        onChange={(e) => patchData({ reason: e.target.value })}
                      />
                    </label>
                    <div className="wfc-rule__readback">
                      <div className="wfc-inspector__label">Reads as</div>
                      Stop and send to {selData.reviewerRole || 'a reviewer'} for review
                      {selData.reason ? `. Reason: ${selData.reason}` : ''}.
                    </div>
                    <div className="wfc-inspector__hint">
                      Recorded with the workflow. Sending stopped requests to the reviewer arrives in a later release.
                    </div>
                  </>
                )}
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
                {selected.type === 'email' && emailRules}
                {selected.type === 'sms' && smsRules}

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

                {!fixed(selected) && (
                  <button className="btn btn--danger btn--sm" onClick={deleteSelected}>
                    Remove step
                  </button>
                )}
              </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </CanvasCtx.Provider>
  )
}
