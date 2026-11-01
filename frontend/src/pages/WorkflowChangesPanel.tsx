import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  refusalOf,
  useActingUser,
  useChangeAction,
  usePeople,
  useWorkflowChanges,
  type WorkflowChange,
} from '@/pages/admin/approvals/approvals'
import { useStore } from '@/state/store'

/* Workflow changes waiting for review (maker-checker). An edit to a workflow never changes the live
   one: it waits here until an admin who did not edit it approves it, or rejects it with a note. The
   server decides who may review; this screen shows its answer and asks. */

const KIND: Record<WorkflowChange['kind'], string> = { CREATE: 'New workflow', UPDATE: 'Change', DELETE: 'Deletion' }
const STATUS: Record<WorkflowChange['status'], { label: string; tone: string }> = {
  DRAFT: { label: 'Draft', tone: '' },
  PENDING: { label: 'Waiting for review', tone: 'badge--info' },
  APPROVED: { label: 'Approved', tone: 'badge--ok' },
  REJECTED: { label: 'Rejected', tone: 'badge--danger' },
  WITHDRAWN: { label: 'Withdrawn', tone: '' },
}
const ROLE: Record<string, string> = {
  ADMIN: 'Admin', RECRUITER: 'Recruiter', HIRING_MANAGER: 'Hiring manager', COORDINATOR: 'Coordinator', VIEWER: 'Viewer',
}
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

export default function WorkflowChangesPanel() {
  const navigate = useNavigate()
  const { toastMsg } = useStore()
  const [view, setView] = useState<'PENDING' | 'ALL'>('PENDING')
  const { data, isLoading, isError, refetch } = useWorkflowChanges(view)
  const action = useChangeAction()
  const { data: me } = useActingUser()
  const { data: people } = usePeople()
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')

  /** The prototype has no sign-in: who you are is chosen here and sent with every request. */
  const actAs = (id: string) => {
    try {
      localStorage.setItem('taportal.userId', id)
    } catch {
      /* storage blocked: the choice cannot be kept */
    }
    // An ?as= in the address would choose again on reload: take it out so this choice holds.
    const url = new URL(window.location.href)
    url.searchParams.delete('as')
    window.history.replaceState(null, '', url.toString())
    window.location.reload()
  }
  // The acting user is always in the list, even one the list leaves out (a viewer, say).
  const options = [
    ...(me?.id && !(people ?? []).some((p) => p.id === me.id) ? [{ id: me.id, name: me.name ?? 'You', role: me.role ?? '', title: null }] : []),
    ...(people ?? []),
  ]

  const decide = (c: WorkflowChange, decision: 'approve' | 'reject') =>
    action.mutate(
      { id: c.id, action: decision, note: decision === 'reject' ? note : undefined, revision: c.revision },
      {
        onSuccess: (done) => {
          setRejecting(null)
          setNote('')
          toastMsg(`“${c.workflowName}”: ${done.outcome ?? (decision === 'approve' ? 'Approved.' : 'Rejected.')}`)
        },
        onError: (e) => toastMsg(refusalOf(e, 'Could not record the decision'), 'danger'),
      },
    )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 18px' }}>
          <div style={{ flex: '1 1 320px', fontSize: 13, color: 'var(--ink-3)' }}>
            A workflow change goes live only when an admin who did not edit it approves it.{' '}
            {me?.name ? (
              <>
                You are reviewing as <strong style={{ color: 'var(--ink-1)' }}>{me.name}</strong>
                {me.role ? ` (${ROLE[me.role] ?? me.role})` : ''}.
              </>
            ) : null}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-3)' }}>
            Act as
            <select className="select" style={{ height: 34, width: 240 }} value={me?.id ?? ''} onChange={(e) => actAs(e.target.value)}>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {ROLE[p.role] ?? p.role}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Show">
            <button aria-pressed={view === 'PENDING'} onClick={() => setView('PENDING')}>Waiting</button>
            <button aria-pressed={view === 'ALL'} onClick={() => setView('ALL')}>History</button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card">
          <div className="card__body" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>Loading changes…</div>
        </div>
      ) : isError ? (
        <div className="card">
          <div className="card__body" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ color: 'var(--ink-3)', marginBottom: 12 }}>Couldn’t load workflow changes.</div>
            <button className="btn btn--outline btn--sm" onClick={() => refetch()}>Retry</button>
          </div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 650, color: 'var(--ink-0)' }}>
              {view === 'PENDING' ? 'No workflow changes are waiting.' : 'No workflow changes yet.'}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-4)', marginTop: 6 }}>
              A change appears here when its editor sends it for review from the Workflows screen.
            </div>
          </div>
        </div>
      ) : (
        data.map((c) => (
          <div key={c.id} className="card">
            <div style={{ display: 'flex', gap: '10px 16px', padding: '14px 18px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <span className="badge">{KIND[c.kind]}</span>
              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 14, color: 'var(--ink-0)' }}>{c.workflowName}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>
                  {c.submittedBy ? `Sent by ${c.submittedBy}, ${when(c.submittedAt)}` : `Last edited ${when(c.updatedAt)}`}
                  {c.editors.length > 0 ? ` · Edited by ${c.editors.join(', ')}` : ''}
                </div>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  {c.summary.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                  {c.more > 0 && <li>And {c.more} more.</li>}
                </ul>
                {c.status !== 'PENDING' && (c.outcome || c.note) && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8 }}>
                    {c.outcome ?? ''}
                    {c.decidedBy ? ` Decided by ${c.decidedBy}, ${when(c.decidedAt)}.` : ''}
                    {c.note ? ` ${c.decidedBy ? 'Note' : 'Why'}: ${c.note}` : ''}
                  </div>
                )}
                {rejecting === c.id && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                      Why it is not approved (the editor sees this)
                      <textarea
                        className="textarea"
                        style={{ width: '100%', marginTop: 4, minHeight: 64 }}
                        value={note}
                        maxLength={1000}
                        onChange={(e) => setNote(e.target.value)}
                        autoFocus
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn--outline btn--sm" onClick={() => { setRejecting(null); setNote('') }}>Cancel</button>
                      <button className="btn btn--danger btn--sm" disabled={!note.trim() || action.isPending} onClick={() => decide(c, 'reject')}>
                        Reject change
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 'auto' }}>
                {c.status !== 'PENDING' && <span className={`badge ${STATUS[c.status].tone}`}>{STATUS[c.status].label}</span>}
                {c.status === 'PENDING' && c.reviewable && rejecting !== c.id && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => {
                        setNote('')
                        setRejecting(c.id)
                      }}
                      disabled={action.isPending}
                    >
                      Reject
                    </button>
                    <button className="btn btn--primary btn--sm" onClick={() => decide(c, 'approve')} disabled={action.isPending}>
                      Approve
                    </button>
                  </div>
                )}
                {c.status === 'PENDING' && !c.reviewable && c.whyNotYou && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', maxWidth: 260, textAlign: 'right' }}>{c.whyNotYou}</div>
                )}
                {c.kind !== 'DELETE' && c.status === 'PENDING' && (
                  <button className="btn btn--ghost btn--sm" onClick={() => navigate('/admin?tab=workflow')}>
                    See it in Workflows
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
