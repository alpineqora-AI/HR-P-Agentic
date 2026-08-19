import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApprovalRequests, useDecideApproval, type ApprovalRequestApi } from '@/pages/admin/approvals/approvals'
import { useConfig } from '@/state/config'
import { useStore } from '@/state/store'

/* The approvals work queue (lifted from AlpineQora-Labs/VMS, adapted to the
   TA Portal): requests routed here by the approval workflows — events, offers —
   each clearing its chain level by level. Decisions are role-gated server-side
   (ADMIN / HIRING_MANAGER). */

// Item type is a category, not a state — no color.
const typeBadge = (_t: string) => ''

const typeLabel = (t: string) => t.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())

const fmtWhen = (iso: string) => {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

/** The request's approval chain: cleared steps ✓, the step it's waiting on, upcoming. */
function Chain({ r, roleName }: { r: ApprovalRequestApi; roleName: (k: string) => string }) {
  if (!r.required.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {r.required.map((s, i) => {
        const done = i < r.currentStep
        const current = i === r.currentStep && r.status === 'PENDING'
        return (
          <span
            key={s.nodeId ?? i}
            className={`badge ${done ? 'badge--ok' : current ? 'badge--info' : ''}`}
            title={done ? 'Cleared' : current ? 'Waiting on this step' : 'Upcoming'}
          >
            {done ? '✓ ' : ''}
            {roleName(s.role)}
          </span>
        )
      })}
    </div>
  )
}

export default function ApprovalsPage() {
  const navigate = useNavigate()
  const { toastMsg } = useStore()
  const { roles } = useConfig()
  const roleName = (k: string) => roles.find((r) => r.key === k)?.name ?? k
  const [tab, setTab] = useState<'PENDING' | 'all'>('PENDING')
  const { data, isLoading, isError, refetch } = useApprovalRequests(tab === 'PENDING' ? 'PENDING' : undefined)
  const decide = useDecideApproval()

  const act = (id: string, decision: 'approve' | 'reject') =>
    decide.mutate(
      { id, decision },
      {
        onSuccess: (r) =>
          toastMsg(
            decision === 'reject'
              ? 'Request rejected'
              : r.status === 'APPROVED'
                ? 'Fully approved'
                : 'Step approved — moved to the next level',
          ),
        onError: () => toastMsg('Could not update the request'),
      },
    )

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Recruiting · Approvals
        </div>
        <div className="page-head__row">
          <div>
            <h1>Approvals</h1>
            <p className="sub">Requests routed here by the approval workflows. Each clears its chain level by level.</p>
          </div>
          <button className="btn btn--outline" onClick={() => navigate('/admin?tab=workflow')}>
            Edit workflows
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className="tab" aria-selected={tab === 'PENDING'} onClick={() => setTab('PENDING')}>
          Pending
        </button>
        <button className="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>
          All requests
        </button>
      </div>

      {isLoading ? (
        <div className="card">
          <div className="card__body" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            Loading approvals…
          </div>
        </div>
      ) : isError ? (
        <div className="card">
          <div className="card__body" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ color: 'var(--ink-3)', marginBottom: 12 }}>Couldn’t load approvals.</div>
            <button className="btn btn--outline btn--sm" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 650, color: 'var(--ink-0)' }}>You’re all caught up.</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-4)', marginTop: 6 }}>
              New requests appear here when a workflow routes them for approval.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map((r) => (
            <div key={r.id} className="card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px 14px',
                  padding: '14px 18px',
                  flexWrap: 'wrap',
                }}
              >
                <span className={`badge ${typeBadge(r.itemType)}`}>{typeLabel(r.itemType)}</span>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: 14, color: 'var(--ink-0)' }}>{r.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>
                    {r.sub} · via {r.wfName} · {fmtWhen(r.createdAt)}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Chain r={r} roleName={roleName} />
                  </div>
                </div>
                {r.status === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button className="btn btn--danger btn--sm" onClick={() => act(r.id, 'reject')} disabled={decide.isPending}>
                      Reject
                    </button>
                    <button className="btn btn--primary btn--sm" onClick={() => act(r.id, 'approve')} disabled={decide.isPending}>
                      Approve step {r.currentStep + 1}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <span
                      className={`badge ${
                        r.status === 'REJECTED' ? 'badge--danger' : r.status === 'AUTO_APPROVED' ? 'badge--purple' : 'badge--ok'
                      }`}
                    >
                      {r.status === 'AUTO_APPROVED' ? 'Auto-approved' : r.status === 'REJECTED' ? 'Rejected' : 'Approved'}
                    </span>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 5 }}>
                      {r.decidedBy ? `by ${r.decidedBy}` : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
