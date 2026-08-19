import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfig } from '@/state/config'
import { useStore } from '@/state/store'
import { IconChevronDown, IconChevronUp } from '@/components/icons'
import ApprovalCanvas, { SPEC, Icons } from './ApprovalCanvas'
import {
  useServerWorkflows, useSaveServerWorkflows, useDeleteWorkflow, fromServerDto, toServerDto,
  type ApprovalWorkflow,
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

const TRIGGERS = ['Event', 'Offer', 'Requisition', 'Onboarding', 'Compliance']
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

  // Workflows live in local state, hydrated from the server and debounce-saved back.
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([])
  const canvasWorkflow = workflows.find((w) => w.id === canvasId) ?? null
  const { data: serverWorkflows } = useServerWorkflows()
  const saveServer = useSaveServerWorkflows()
  const hydrated = useRef(false)
  // Serialized snapshot of what the server already has: the debounce-save below
  // only pushes when the working copy actually differs. Without this, a
  // hydration echo or an HMR remount with stale preserved state re-saves and
  // can clobber newer server data (e.g. a workflow saved from the canvas).
  const lastPushed = useRef('')
  // Saves fire ONLY after an explicit user edit in this mount. Hydration echoes,
  // HMR remounts with preserved state, and stale react-query cache can otherwise
  // schedule a push that overwrites newer server data.
  const dirty = useRef(false)
  useEffect(() => {
    // Track the server until the user edits: react-query serves cached (possibly
    // stale) data first and refetches after mount — hydrating once from the cache
    // meant a later edit could push a stale snapshot wholesale (this overwrote
    // saved canvas graphs repeatedly). Re-hydrate on every fresh payload while
    // the working copy is untouched; stop the moment it's dirty.
    if (dirty.current) return
    if (serverWorkflows && serverWorkflows.length) {
      hydrated.current = true
      lastPushed.current = JSON.stringify(serverWorkflows.map((d) => toServerDto(fromServerDto(d))))
      setWorkflows(serverWorkflows.map(fromServerDto))
    }
  }, [serverWorkflows])

  // ---- local mutators (were config-store helpers) ----
  const replaceWorkflows = (list: ApprovalWorkflow[]) => setWorkflows(list)
  const updateWorkflow = (id: string, patch: Partial<ApprovalWorkflow>) => {
    dirty.current = true
    setWorkflows((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }
  const addWorkflowLevel = (id: string) =>
    {
    dirty.current = true
    return setWorkflows((ws) => ws.map((w) => (w.id === id
      ? { ...w, levels: [...w.levels, { id: `l${Date.now()}`, approverRole: roles[0]?.key ?? 'admin', condition: 'Always' }] } : w)))
  }
  const removeWorkflowLevel = (id: string, lid: string) =>
    {
    dirty.current = true
    return setWorkflows((ws) => ws.map((w) => (w.id === id ? { ...w, levels: w.levels.filter((l) => l.id !== lid) } : w)))
  }
  const updateWorkflowLevel = (id: string, lid: string, patch: Partial<ApprovalWorkflow['levels'][number]>) =>
    {
    dirty.current = true
    return setWorkflows((ws) => ws.map((w) => (w.id === id
      ? { ...w, levels: w.levels.map((l) => (l.id === lid ? { ...l, ...patch } : l)) } : w)))
  }
  const moveWorkflowLevel = (id: string, lid: string, dir: -1 | 1) =>
    {
    dirty.current = true
    return setWorkflows((ws) => ws.map((w) => {
      if (w.id !== id) return w
      const i = w.levels.findIndex((l) => l.id === lid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= w.levels.length) return w
      const levels = [...w.levels]
      ;[levels[i], levels[j]] = [levels[j], levels[i]]
      return { ...w, levels }
    }))
  }

  /** Mirror of the server rule: at most one ENABLED workflow per trigger. */
  const triggerTakenBy = (id: string, trigger: string) =>
    workflows.find((w) => w.id !== id && w.enabled && w.trigger.toLowerCase() === trigger.toLowerCase())?.name

  /** Create a workflow with a fresh key; the debounce-save persists it. */
  const addWorkflow = () => {
    dirty.current = true
    const id = `wf-${Date.now()}`
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
      },
      ...ws,
    ])
    flash('Workflow added as a draft — set its chain, then enable it')
  }

  // referenced to satisfy the linter (used via canvas onSaved below)
  void replaceWorkflows
  void useMemo

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (!hydrated.current) return
    if (!dirty.current) return
    const payload = workflows.map(toServerDto)
    const json = JSON.stringify(payload)
    if (json === lastPushed.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      lastPushed.current = json
      saveServer.mutate(payload, {
        onError: (e) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          flash(msg ?? 'Could not save workflows')
          lastPushed.current = '' // allow a retry after the user fixes the conflict
        },
      })
    }, 900)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflows])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {canvasWorkflow && (
        <ApprovalCanvas
          workflow={canvasWorkflow}
          onClose={() => setCanvasId(null)}
          onSaved={(w) => updateWorkflow(w.id, w)}
        />
      )}
      <div className="card">
        <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', flex: 1 }}>
            Each request type routes through an ordered chain of approval levels. Items that fall within the auto-approve policy
            skip the chain. Rules are evaluated top to bottom; a level fires only when its condition is met.
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
              <p>
                “{confirmDelete.name}” will be permanently removed
                {confirmDelete.enabled
                  ? ` — and nothing will handle the ${confirmDelete.trigger} trigger, so new ${confirmDelete.trigger.toLowerCase()} requests will skip approval entirely.`
                  : '.'}{' '}
                Decided requests keep their history.
              </p>
            </div>
            <div className="modal__foot">
              <button className="btn btn--outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="btn btn--danger"
                onClick={() => {
                  const w = confirmDelete
                  setConfirmDelete(null)
                  deleteWf.mutate(w.id, {
                    onSuccess: () => {
                      if (canvasId === w.id) setCanvasId(null)
                      setWorkflows((ws) => {
                        const next = ws.filter((x) => x.id !== w.id)
                        lastPushed.current = JSON.stringify(next.map(toServerDto))
                        return next
                      })
                      flash(`“${w.name}” deleted`)
                    },
                    onError: (e) => {
                      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
                      flash(msg ?? 'Could not delete the workflow')
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
          onToggle={() => {
            if (!w.enabled) {
              const owner = triggerTakenBy(w.id, w.trigger)
              if (owner) {
                flash(`“${owner}” already handles the ${w.trigger} trigger — disable it first`)
                return
              }
            }
            updateWorkflow(w.id, { enabled: !w.enabled })
            flash(`${w.name} ${w.enabled ? 'disabled' : 'enabled'}`)
          }}
          onTrigger={(v) => {
            if (w.enabled) {
              const owner = triggerTakenBy(w.id, v)
              if (owner) {
                flash(`“${owner}” already handles the ${v} trigger — disable it first`)
                return
              }
            }
            updateWorkflow(w.id, { trigger: v })
          }}
          onAuto={() => updateWorkflow(w.id, { autoApprove: !w.autoApprove, graph: undefined })}
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
}: {
  w: ApprovalWorkflow
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
  return (
    <div className="card" style={{ opacity: w.enabled ? 1 : 0.66 }}>
      <div className="card__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            className="wf-name-input"
            value={w.name}
            onChange={(e) => onName(e.target.value)}
            aria-label="Workflow name"
          />
          <span className="badge">{w.trigger}</span>
          <span className={`badge ${w.enabled ? 'badge--ok' : ''}`}>{w.enabled ? 'Active' : 'Disabled'}</span>
          {w.graph && <span className="badge">canvas</span>}
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
            textTransform: 'uppercase',
            color: 'var(--ink-4)',
            marginBottom: 10,
          }}
        >
          Approval chain · {w.levels.length} {w.levels.length === 1 ? 'level' : 'levels'}
        </div>

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
                <select className="select" style={{ height: 34 }} value={l.approverRole} onChange={(e) => onLevelRole(l.id, e.target.value)}>
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
                <select className="select" style={{ height: 34 }} value={l.condition} onChange={(e) => onLevelCond(l.id, e.target.value)}>
                  {CONDITIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 4 }}>
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

        <button className="btn btn--outline btn--sm" style={{ marginTop: 14 }} onClick={onAddLevel}>
          + Add approval level
        </button>

        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink-4)' }}>
          Chain: {w.levels.length === 0 ? 'Auto-approved' : w.levels.map((l) => roleName(l.approverRole)).join(' → ')}
        </div>
      </div>
    </div>
  )
}
