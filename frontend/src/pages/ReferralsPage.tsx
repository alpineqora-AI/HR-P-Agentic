import { useMemo, useState } from 'react'
import { rowAction } from '@/lib/a11y'
import SlideOver from '@/components/SlideOver'
import { useReferrals } from '@/api/hooks'
import { date, money } from '@/lib/format'
import type { Referral } from '@/api/types'

// Sense-inspired employee referrals: track who referred whom, where it is in
// the pipeline, and the bonus on the line.

function statusBadge(status: string) {
  const key = status.toUpperCase()
  if (key === 'HIRED' || key === 'PAID') return 'badge--ok'
  if (key === 'INTERVIEWING' || key === 'IN_REVIEW' || key === 'SUBMITTED') return 'badge--info'
  if (key === 'PENDING' || key === 'NEW') return 'badge--warn'
  if (key === 'REJECTED' || key === 'DECLINED') return 'badge--danger'
  return 'badge'
}

const isHired = (s: string) => ['HIRED', 'PAID'].includes(s.toUpperCase())
const isClosed = (s: string) => ['HIRED', 'PAID', 'REJECTED', 'DECLINED'].includes(s.toUpperCase())

function StatTile({ label, value, meta }: { label: string; value: string | number; meta?: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {meta ? <div className="stat__meta">{meta}</div> : null}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--ink-4)' }}>{label}</span>
      <span style={{ color: 'var(--ink-1)', textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function ReferralDetail({ r, onClose }: { r: Referral; onClose: () => void }) {
  return (
    <SlideOver label={`Referral: ${r.candidateName || r.referrerName}`} onClose={onClose} width={400}>
      <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)', lineHeight: 1.2 }}>{r.candidateName || '—'}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <Fact label="Referred by">{r.referrerName}</Fact>
        <Fact label="Role">{r.jobTitle || '—'}</Fact>
        <Fact label="Bonus">{r.bonusAmount ? money(r.bonusAmount) : '—'}</Fact>
        <Fact label="Submitted">{date(r.createdAt)}</Fact>
        <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5 }}>
          {isHired(r.status)
            ? 'Hired — bonus is payable per the referral policy.'
            : isClosed(r.status)
              ? 'Closed — no bonus due.'
              : 'In progress — bonus is on the line if this referral is hired.'}
        </div>
      </div>
    </SlideOver>
  )
}

export default function ReferralsPage() {
  const { data, isLoading } = useReferrals()
  const [selected, setSelected] = useState<Referral | null>(null)

  const kpis = useMemo(() => {
    const list = data ?? []
    const hired = list.filter((r) => isHired(r.status)).length
    const active = list.filter((r) => !isClosed(r.status)).length
    const atRisk = list
      .filter((r) => !isClosed(r.status))
      .reduce((n, r) => n + (r.bonusAmount || 0), 0)
    return { total: list.length, active, hired, atRisk }
  }, [data])

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Engagement · Referrals
        </div>
        <h1>Referrals</h1>
        <p className="sub">
          Your employees are your best sourcers. Track every referral from submission to hire — and the bonus that comes
          with it.
        </p>
      </div>

      {data && data.length > 0 ? (
        <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
          <StatTile label="Referrals" value={kpis.total} />
          <StatTile label="Active" value={kpis.active} />
          <StatTile label="Hired" value={kpis.hired} />
          <StatTile label="Bonus at risk" value={kpis.atRisk ? money(kpis.atRisk) : '—'} meta="If active ones convert" />
        </div>
      ) : null}

      {isLoading ? (
        <div className="card">
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>Loading referrals…</div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card">
          <div className="card__body" style={{ padding: '44px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>No referrals yet</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>Employee referrals show up here from submission through hire and payout.</div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Referrer</th>
                <th>Candidate</th>
                <th>Role</th>
                <th>Status</th>
                <th className="t-right">Bonus</th>
                <th className="t-right">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} {...rowAction(() => setSelected(r))}>
                  <td className="t-strong">{r.referrerName}</td>
                  <td>{r.candidateName || '—'}</td>
                  <td className="t-muted">{r.jobTitle || '—'}</td>
                  <td>
                    <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="t-right t-num">{r.bonusAmount ? money(r.bonusAmount) : '—'}</td>
                  <td className="t-right t-muted">{date(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <ReferralDetail r={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
