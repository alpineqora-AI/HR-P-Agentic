import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConfig } from '@/state/config'
import { useStore } from '@/state/store'
import { IconChevronDown, IconChevronUp } from '@/components/icons'
import ApprovalCanvas, { SPEC, Icons } from './ApprovalCanvas'
import {
  useServerWorkflows, useSaveServerWorkflows, useDeleteWorkflow, useChangeAction, fromServerDto, toServerDto, refusalOf,
  type ApprovalWorkflow, type WorkflowChange,
} from './approvals'
import '@/styles/canvas.css'
import '@/styles/workflow.css'

/** Inline trash glyph (the TA icon set has no IconTrash). */
function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

const TRIGGERS = ['Event', 'Offer', 'Requisition', 'Onboarding', 'Compliance', 'Candidate journey']
const CONDITIONS = ['Always', 'In-person event', 'Virtual event', 'Short notice (under 14 days)', 'Flagged critical']

export default function AdminWorkflows() {
  const { roles } = useConfig()
  const { toastMsg: flash } = useStore()
  const roleName = (key: string) => roles.find((r) => r.key === key)?.name ?? key
  const [canvasId, setCanvasId] = useState<string | null>(null)
  // Removing an approval level is destructive to the chain — always confirm.
  const [confirmRemove, setConfirmRemove] = useState<{ wfId: string; wfName: string; levelId: string; index: number; role: string } | null>(null)
  // Deleting a whole workflow is more destructive still — its own confirmation.
  const [confirmDelete, setConfirmDelete] = useState<ApprovalWorkflow | null>(null)
  const deleteWf = useDeleteWorkflow()

  // Workflows live in local state, hydrated from the server and saved back as you edit. Nothing saved
  // here changes a live workflow: the server keeps each edit as a change that an admin who did not
  // make it approves. Only the workflows edited in this screen are sent, each with the copy (base) it
  // was edited from, so the server can refuse an edit made to a copy that is out of date.
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([])
  const workflowsRef = useRef(workflows)
  workflowsRef.current = workflows
  const canvasWorkflow = workflows.find((w) => w.id === canvasId) ?? null
  const { data: serverWorkflows } = useServerWorkflows()
  const saveServer = useSaveServerWorkflows()
  const qc = useQueryClient()
  const changeAction = useChangeAction()
  const hydrated = useRef(false)
  // The workflows edited since the server's copy was last taken, and whether any were.
  const edited = useRef(new Set<string>())
  const dirty = useRef(false)
  // What was last sent, so the same edit is not sent twice.
  const lastPushed = useRef('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<Promise<unknown> | null>(null)
  useEffect(() => {
    // Follow the server while nothing is edited here. react-query may serve a cached copy first and
    // refetch after; hydrating from each fresh answer keeps the screen on the server's latest.
    if (dirty.current) return
    if (Array.isArray(serverWorkflows)) {
      hydrated.current = true
      lastPushed.current = ''
      setWorkflows(serverWorkflows.map(fromServerDto))
    }
  }, [serverWorkflows])

  // Where each workflow stands in review comes from the server's latest answer, not the working copy.
  const serverOf = (key: string) => serverWorkflows?.find((d) => d.key === key)
  const changeOf = (key: string) => serverOf(key)?.change ?? null
  /** Live only when the server says so: a workflow it has not heard of yet is not live. */
  const isLive = (key: string) => serverOf(key)?.live === true
  const liveOn = (key: string) => serverOf(key)?.liveEnabled === true

  /** Drop local edits and take the server's working copy again. */
  const resync = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    edited.current.clear()
    dirty.current = false
    lastPushed.current = ''
    qc.invalidateQueries({ queryKey: ['approval-workflows'] })
  }

  const editedPayload = () => workflowsRef.current.filter((w) => edited.current.has(w.id)).map(toServerDto)

  /**
   * Send the edited workflows now. When nothing newer is waiting, the screen then takes the server's
   * copy, which says where each change stands; otherwise only the bases are taken, so the next save is
   * made against the copy the server now holds.
   */
  const flush = async (): Promise<boolean> => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    if (inFlight.current) await inFlight.current.catch(() => undefined)
    const payload = editedPayload()
    if (!payload.length) return true
    const json = JSON.stringify(payload)
    if (json === lastPushed.current) return true
    lastPushed.current = json
    const sending = saveServer.mutateAsync(payload)
    inFlight.current = sending
    try {
      const data = await sending
      if (!saveTimer.current && JSON.stringify(editedPayload()) === json) {
        edited.current.clear()
        dirty.current = false
        lastPushed.current = ''
        setWorkflows(data.map(fromServerDto))
      } else {
        const bases = new Map(data.map((d) => [d.key, d.base ?? null]))
        setWorkflows((ws) => ws.map((w) => (bases.has(w.id) ? { ...w, base: bases.get(w.id) } : w)))
      }
      return true
    } catch (e) {
      const res = (e as { response?: { status?: number } })?.response
      flash(refusalOf(e, 'Could not save workflows'), 'danger')
      if (!res) {
        lastPushed.current = '' // no answer at all (offline): keep the edits and allow a retry
        return false
      }
      // Refused (an out-of-date copy, or a change that could never apply): nothing of this save was kept.
      // Show what the server holds, rather than a state it never stored.
      resync()
      return false
    } finally {
      inFlight.current = null
    }
  }

  const act = async (change: WorkflowChange, action: 'submit' | 'recall' | 'withdraw', done: string) => {
    // Sending for review sends what the server holds: any edit still on its way goes first.
    if (action === 'submit' && !(await flush())) return
    changeAction.mutate(
      { id: change.id, action },
      {
        onSuccess: () => {
          if (action === 'withdraw') resync()
          flash(done)
        },
        onError: (e) => flash(refusalOf(e, 'Could not update the change'), 'danger'),
      },
    )
  }
  const canvasChange = canvasWorkflow ? changeOf(canvasWorkflow.id) : null
  const canvasNotice = !canvasWorkflow
    ? null
    : !isLive(canvasWorkflow.id)
      ? 'Saving keeps it as a draft. It is added only when an admin who did not edit it approves.'
      : canvasChange?.status === 'PENDING'
        ? 'Waiting for review. Saving again sends it back to draft; the live workflow changes only when a reviewer approves.'
        : 'Saving keeps your changes as a draft. The live workflow changes only when an admin who did not edit it approves.'

  // ---- local mutators (were config-store helpers) ----
  const touch = (id: string) => {
    dirty.current = true
    edited.current.add(id)
  }
  /** A workflow the canvas has just saved: take the server's copy of it, nothing left to send. */
  const savedFromCanvas = (w: ApprovalWorkflow) => {
    edited.current.delete(w.id)
    setWorkflows((ws) => ws.map((x) => (x.id === w.id ? w : x)))
  }
  const updateWorkflow = (id: string, patch: Partial<ApprovalWorkflow>) => {
    touch(id)
    setWorkflows((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }
  const addWorkflowLevel = (id: string) => {
    touch(id)
    setWorkflows((ws) => ws.map((w) => (w.id === id
      ? { ...w, levels: [...w.levels, { id: `l${Date.now()}`, approverRole: roles[0]?.key ?? 'admin', condition: 'Always' }] } : w)))
  }
  const removeWorkflowLevel = (id: string, lid: string) => {
    touch(id)
    setWorkflows((ws) => ws.map((w) => (w.id === id ? { ...w, levels: w.levels.filter((l) => l.id !== lid) } : w)))
  }
  const updateWorkflowLevel = (id: string, lid: string, patch: Partial<ApprovalWorkflow['levels'][number]>) => {
    touch(id)
    setWorkflows((ws) => ws.map((w) => (w.id === id
      ? { ...w, levels: w.levels.map((l) => (l.id === lid ? { ...l, ...patch } : l)) } : w)))
  }
  const moveWorkflowLevel = (id: string, lid: string, dir: -1 | 1) => {
    touch(id)
    setWorkflows((ws) => ws.map((w) => {
      if (w.id !== id) return w
      const i = w.levels.findIndex((l) => l.id === lid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= w.levels.length) return w
      const levels = [...w.levels]
      ;[levels[i], levels[j]] = [levels[j], levels[i]]
      return { ...w, levels }
    }))
  }

  /** Create a workflow with a fresh key; the next save keeps it as a new draft. */
  const addWorkflow = () => {
    const id = `wf-${Date.now()}`
    touch(id)
    setWorkflows((ws) => [
      {
        id,
        name: 'New workflow',
        trigger: 'Event',
        // Drafts start disabled: the trigger routes to ONE enabled workflow,
        // so a new one must not silently collide with the live handler.
        enabled: false,
        autoApprove: false,
        levels: [{ id: 'l1', approverRole: roles[0]?.key ?? 'admin', condition: 'Always' }],
        base: null,
      },
      ...ws,
    ])
    flash('Workflow added as a draft. Send it for review when it is ready.')
  }

  void useMemo

  // Save the edits shortly after the last one.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (!hydrated.current || !dirty.current) return
    if (JSON.stringify(editedPayload()) === lastPushed.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      void flush()
    }, 900)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflows])
  // Leaving the screen with an edit waiting: send it rather than lose it.
  useEffect(() => () => {
    if (saveTimer.current) void flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {canvasWorkflow && (
        <ApprovalCanvas
          workflow={canvasWorkflow}
          onClose={() => setCanvasId(null)}
          onSaved={savedFromCanvas}
          notice={canvasNotice}
        />
      )}
      <div className="card">
        <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', flex: 1 }}>
            Each request type routes through an ordered chain of approval levels. Items that fall within the auto-approve policy
            skip the chain. Rules are evaluated top to bottom; a level fires only when its condition is met.{' '}
            <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
              Changes are reviewed before they go live:
            </strong>{' '}
            edits are kept as a draft, you send them for review, and an admin who did not make them approves.
          </div>
          <button className="btn btn--primary btn--sm" onClick={addWorkflow}>
            New workflow
          </button>
        </div>
      </div>

      {confirmRemove && (
        <div className="scrim" onClick={() => setConfirmRemove(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal__head">
              <h3>Remove approval level?</h3>
              <p>
                Level {confirmRemove.index + 1} ({confirmRemove.role}) will be removed from “{confirmRemove.wfName}”.
                New requests of this type will no longer wait on this sign-off.
              </p>
            </div>
            <div className="modal__foot">
              <button className="btn btn--outline" onClick={() => setConfirmRemove(null)}>
                Cancel
              </button>
              <button
                className="btn btn--danger"
                onClick={() => {
                  removeWorkflowLevel(confirmRemove.wfId, confirmRemove.levelId)
                  flash('Approval level removed')
                  setConfirmRemove(null)
                }}
              >
                Remove level
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="scrim" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal__head">
              <h3>Delete workflow?</h3>
              {isLive(confirmDelete.id) ? (
                <p>
                  Deleting “{confirmDelete.name}” goes to review: it is removed only when an admin who did not ask for it
                  approves
                  {liveOn(confirmDelete.id)
                    ? `, and it keeps running until then. Once it is gone, nothing handles the ${confirmDelete.trigger} trigger, so new ${confirmDelete.trigger.toLowerCase()} requests skip approval entirely.`
                    : '. Its live version is switched off, so nothing changes for requests meanwhile.'}{' '}
                  {changeOf(confirmDelete.id) && changeOf(confirmDelete.id)?.kind !== 'DELETE'
                    ? 'Your open changes to it are discarded. '
                    : ''}
                  Decided requests keep their history.
                </p>
              ) : (
                <p>“{confirmDelete.name}” was never approved, so nothing of it is live. It is discarded now, without review.</p>
              )}
            </div>
            <div className="modal__foot">
              <button className="btn btn--outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="btn btn--danger"
                onClick={async () => {
                  const w = confirmDelete
                  setConfirmDelete(null)
                  const wasLive = isLive(w.id)
                  // An edit still on its way goes first, so the server knows the workflow it is asked to delete.
                  if (!(await flush())) return
                  deleteWf.mutate(w.id, {
                    onSuccess: () => {
                      if (canvasId === w.id) setCanvasId(null)
                      resync()
                      flash(wasLive ? `Deleting “${w.name}” is waiting for review` : `“${w.name}” discarded`)
                    },
                    onError: (e) => {
                      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
                      flash(msg ?? 'Could not delete the workflow', 'danger')
                    },
                  })
                }}
              >
                Delete workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {workflows.map((w) => (
        <WorkflowCard
          key={w.id}
          w={w}
          roleName={roleName}
          roles={roles}
          onName={(v) => updateWorkflow(w.id, { name: v })}
          // Whether a switch-on or a new trigger clashes with another workflow is the server's to say:
          // it answers the save, and a refusal is shown in its words.
          onToggle={() => updateWorkflow(w.id, { enabled: !w.enabled })}
          onTrigger={(v) => updateWorkflow(w.id, { trigger: v })}
          onAuto={() => updateWorkflow(w.id, { autoApprove: !w.autoApprove })}
          onAddLevel={() => addWorkflowLevel(w.id)}
          onRemoveLevel={(lid) => {
            const idx = w.levels.findIndex((l) => l.id === lid)
            setConfirmRemove({ wfId: w.id, wfName: w.name, levelId: lid, index: idx, role: roleName(w.levels[idx]?.approverRole ?? '') })
          }}
          onLevelRole={(lid, v) => updateWorkflowLevel(w.id, lid, { approverRole: v })}
          onLevelCond={(lid, v) => updateWorkflowLevel(w.id, lid, { condition: v })}
          onMove={(lid, dir) => moveWorkflowLevel(w.id, lid, dir)}
          onCanvas={() => setCanvasId(w.id)}
          onDelete={() => setConfirmDelete(w)}
          change={changeOf(w.id)}
          live={isLive(w.id)}
          liveOn={liveOn(w.id)}
          busy={changeAction.isPending || saveServer.isPending}
          onSubmit={(c) => act(c, 'submit', `“${w.name}” sent for review`)}
          onRecall={(c) => act(c, 'recall', 'Taken back from review. Your edits are kept as a draft.')}
          onWithdraw={(c) =>
            act(c, 'withdraw', c.kind === 'CREATE' ? `“${w.name}” discarded` : c.kind === 'DELETE' ? 'Deletion withdrawn' : 'Changes discarded. The live version is as it was.')
          }
        />
      ))}
    </div>
  )
}

/** Read-only mini rendering of the flow: trigger → (auto-approve policy) → levels → approved. */
function MiniFlow({ w, roleName }: { w: ApprovalWorkflow; roleName: (k: string) => string }) {
  const arrow = (
    <span className="wfs-arrow">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </span>
  )
  const pill = (type: keyof typeof SPEC, label: string, cond?: string) => (
    <span className="wfs-pill">
      <span className="wfs-pill__ic" style={{ background: SPEC[type].iconBg, color: SPEC[type].iconFg }}>
        {Icons[type]}
      </span>
      {label}
      {cond && cond !== 'Always' && <span className="wfs-pill__cond">◇ {cond}</span>}
    </span>
  )
  return (
    <div className="wfs-strip">
      {pill('trigger', w.trigger)}
      {w.autoApprove && (
        <>
          {arrow}
          {pill('policy', 'Auto-approve')}
        </>
      )}
      {w.levels.map((l) => (
        <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {arrow}
          {pill('approval', roleName(l.approverRole), l.condition)}
        </span>
      ))}
      {arrow}
      {pill('end', 'Approved')}
    </div>
  )
}

function WorkflowCard({
  w,
  roles,
  roleName,
  onName,
  onToggle,
  onTrigger,
  onAuto,
  onAddLevel,
  onRemoveLevel,
  onLevelRole,
  onLevelCond,
  onMove,
  onCanvas,
  onDelete,
  change,
  live,
  liveOn,
  busy,
  onSubmit,
  onRecall,
  onWithdraw,
}: {
  w: ApprovalWorkflow
  change: WorkflowChange | null
  live: boolean
  liveOn: boolean
  busy: boolean
  onSubmit: (c: WorkflowChange) => void
  onRecall: (c: WorkflowChange) => void
  onWithdraw: (c: WorkflowChange) => void
  roles: { key: string; name: string }[]
  roleName: (k: string) => string
  onName: (v: string) => void
  onToggle: () => void
  onTrigger: (v: string) => void
  onAuto: () => void
  onAddLevel: () => void
  onRemoveLevel: (lid: string) => void
  onLevelRole: (lid: string, v: string) => void
  onLevelCond: (lid: string, v: string) => void
  onMove: (lid: string, dir: -1 | 1) => void
  onCanvas: () => void
  onDelete: () => void
}) {
  // Once a workflow is drawn on the canvas, routing follows the drawing and
  // this chain is rebuilt from it on every canvas save. Editing the chain here
  // would change nothing about where requests go, so it is shown, not edited.
  // (An empty graph is no drawing: the canvas reseeds from the chain and the
  // engine routes by the chain, so the chain must stay editable.)
  const drawn = (w.graph?.nodes?.length ?? 0) > 0
  // A workflow waiting to be deleted is not edited meanwhile (the server keeps no edits to it).
  const deleting = change?.kind === 'DELETE'
  return (
    <div className="card" style={{ opacity: w.enabled || change ? 1 : 0.66 }}>
      {change && (
        <ReviewStrip
          change={change}
          live={live}
          liveOn={liveOn}
          busy={busy}
          onSubmit={() => onSubmit(change)}
          onRecall={() => onRecall(change)}
          onWithdraw={() => onWithdraw(change)}
        />
      )}
      {/* A workflow waiting to be deleted is not edited meanwhile: inert takes it out of reach of mouse and keyboard. */}
      <div style={deleting ? { opacity: 0.55 } : undefined} {...(deleting ? ({ inert: '' } as Record<string, string>) : {})}>
      <div className="card__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            className="wf-name-input"
            value={w.name}
            onChange={(e) => onName(e.target.value)}
            aria-label="Workflow name"
          />
          <span className="badge">{w.trigger}</span>
          {change && live && w.enabled !== liveOn ? (
            <span className="badge" title="The live version is as it was until this change is approved">
              {w.enabled ? 'Active once approved' : 'Disabled once approved'}
            </span>
          ) : (
            <span className={`badge ${w.enabled ? 'badge--ok' : ''}`}>{w.enabled ? 'Active' : 'Disabled'}</span>
          )}
          {drawn && <span className="badge">canvas</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--outline btn--sm" onClick={onCanvas}>
            Open canvas
          </button>
          <button
            className="btn btn--ghost btn--icon btn--sm"
            onClick={onDelete}
            title="Delete workflow"
            aria-label="Delete workflow"
            style={{ color: 'var(--danger-fg)' }}
          >
            <IconTrash className="ic" />
          </button>
          <label className="switch" title="Enable workflow">
            <input type="checkbox" checked={w.enabled} onChange={onToggle} />
            <span className="track" />
          </label>
        </div>
      </div>
      <div className="card__body">
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
          <div className="field" style={{ width: 200 }}>
            <span className="field__label">Trigger</span>
            <select className="select" value={w.trigger} onChange={(e) => onTrigger(e.target.value)}>
              {TRIGGERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 'none' }}>
            <span className="field__label">Auto-approve within policy</span>
            <label className="check" style={{ height: 40 }}>
              <input type="checkbox" checked={w.autoApprove} onChange={onAuto} />
              {w.autoApprove ? 'Enabled' : 'Disabled'}
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <MiniFlow w={w} roleName={roleName} />
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            letterSpacing: '.12em',
            textTransform: 'none',
            color: 'var(--ink-4)',
            marginBottom: 10,
          }}
        >
          Approval chain · {w.levels.length} {w.levels.length === 1 ? 'level' : 'levels'}
        </div>

        {drawn && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 10 }}>
            This workflow is drawn on the canvas, so its steps are edited there.{' '}
            <button
              onClick={onCanvas}
              style={{ font: 'inherit', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--bofa-navy)', fontWeight: 600 }}
            >
              Open canvas
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {w.levels.map((l, i) => (
            <div
              key={l.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--ra-2)',
                background: 'var(--app-sunken)',
                flexWrap: 'wrap',
              }}
            >
              <span
                className="avatar"
                style={{ width: 26, height: 26, fontSize: 12, background: 'var(--bofa-navy)', color: '#fff', borderRadius: 7 }}
              >
                {i + 1}
              </span>
              <div className="field" style={{ width: 200 }}>
                <span className="field__label" style={{ fontSize: 11 }}>
                  Approver role
                </span>
                <select className="select" style={{ height: 34 }} value={l.approverRole} disabled={drawn} onChange={(e) => onLevelRole(l.id, e.target.value)}>
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ width: 240 }}>
                <span className="field__label" style={{ fontSize: 11 }}>
                  Condition
                </span>
                <select className="select" style={{ height: 34 }} value={l.condition} disabled={drawn} onChange={(e) => onLevelCond(l.id, e.target.value)}>
                  {(CONDITIONS.includes(l.condition) ? CONDITIONS : [l.condition, ...CONDITIONS]).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: drawn ? 'none' : 'flex', gap: 4 }}>
                <button className="btn btn--ghost btn--icon btn--sm" disabled={i === 0} onClick={() => onMove(l.id, -1)} title="Move up">
                  <IconChevronUp className="ic" />
                </button>
                <button
                  className="btn btn--ghost btn--icon btn--sm"
                  disabled={i === w.levels.length - 1}
                  onClick={() => onMove(l.id, 1)}
                  title="Move down"
                >
                  <IconChevronDown className="ic" />
                </button>
                <button className="btn btn--ghost btn--icon btn--sm" onClick={() => onRemoveLevel(l.id)} title="Remove level" style={{ color: 'var(--danger-fg)' }}>
                  <IconTrash className="ic" />
                </button>
              </div>
            </div>
          ))}
          {w.levels.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-4)', padding: '8px 2px' }}>
              No approval levels — requests of this type are auto-approved.
            </div>
          )}
        </div>

        {!drawn && (
          <button className="btn btn--outline btn--sm" style={{ marginTop: 14 }} onClick={onAddLevel}>
            + Add approval level
          </button>
        )}

        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink-4)' }}>
          Chain: {w.levels.length === 0 ? 'Auto-approved' : w.levels.map((l) => roleName(l.approverRole)).join(' → ')}
        </div>
      </div>
      </div>
    </div>
  )
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

/** Where a workflow's open change stands, what it changes, and what its editor can do next. */
function ReviewStrip({
  change,
  live,
  liveOn,
  busy,
  onSubmit,
  onRecall,
  onWithdraw,
}: {
  change: WorkflowChange
  live: boolean
  liveOn: boolean
  busy: boolean
  onSubmit: () => void
  onRecall: () => void
  onWithdraw: () => void
}) {
  const waiting = change.status === 'PENDING'
  const deleting = change.kind === 'DELETE'
  const title = deleting
    ? 'Deletion waiting for review'
    : waiting
      ? 'Changes waiting for review'
      : change.kind === 'CREATE'
        ? 'New workflow, not yet sent for review'
        : 'Changes not yet sent for review'
  const meanwhile = !live
    ? 'Not live.'
    : liveOn
      ? 'The live version keeps running as it is until an admin who did not edit this approves.'
      : 'The live version is switched off and stays as it is until an admin who did not edit this approves.'
  const who = waiting
    ? `Sent by ${change.submittedBy ?? 'someone'}, ${when(change.submittedAt)}.`
    : `Being edited by ${change.editors.join(', ') || 'someone'}.`
  const shown = change.summary.slice(0, 4)
  const hidden = change.summary.length - shown.length + (change.more ?? 0)
  return (
    <div
      role="status"
      style={{
        display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', padding: '12px 20px',
        background: waiting ? 'var(--info-bg)' : 'var(--app-sunken)', borderBottom: '1px solid var(--line)',
        borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit',
      }}
    >
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ fontWeight: 650, fontSize: 13.5, color: 'var(--ink-0)' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
          {who} {meanwhile}
        </div>
        {shown.length > 0 && (
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-2)' }}>
            {shown.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
            {hidden > 0 && <li>And {hidden} more.</li>}
          </ul>
        )}
      </div>
      {change.yours && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {change.status === 'DRAFT' && (
            <>
              <button className="btn btn--outline btn--sm" onClick={onWithdraw} disabled={busy}>
                {change.kind === 'CREATE' ? 'Discard' : 'Discard changes'}
              </button>
              <button className="btn btn--primary btn--sm" onClick={onSubmit} disabled={busy}>
                Send for review
              </button>
            </>
          )}
          {waiting && !deleting && (
            <button className="btn btn--outline btn--sm" onClick={onRecall} disabled={busy} title="Back to a draft, with your edits kept">
              Take back to edit
            </button>
          )}
          {waiting && deleting && (
            <button className="btn btn--outline btn--sm" onClick={onWithdraw} disabled={busy}>
              Withdraw deletion
            </button>
          )}
        </div>
      )}
    </div>
  )
}
