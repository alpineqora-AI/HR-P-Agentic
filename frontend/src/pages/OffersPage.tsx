import { useMemo, useState } from 'react'
import { rowAction } from '@/lib/a11y'
import { useStore } from '@/state/store'
import SlideOver from '@/components/SlideOver'
import { useApplications, useCreateOffer, useOffers, useSendOffer } from '@/api/hooks'
import { date, money } from '@/lib/format'
import type { Offer, OfferCreate } from '@/api/types'

const statusBadge = (status: string) => {
  const s = status.toUpperCase()
  if (s === 'ACCEPTED') return 'badge--ok'
  if (s === 'SENT') return 'badge--info'
  if (s === 'DECLINED') return 'badge--danger'
  return '' // DRAFT → neutral default
}

const comp = (base: number, period: string) => {
  if (!base) return '—'
  const suffix = period ? `/${period.toLowerCase()}` : ''
  return `${money(base)}${suffix}`
}

function Empty({ label }: { label: string }) {
  return (
    <div className="card">
      <div className="card__body" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
        {label}
      </div>
    </div>
  )
}

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

function OfferDetail({ o, onClose }: { o: Offer; onClose: () => void }) {
  const send = useSendOffer()
  const { toastMsg } = useStore()
  const isDraft = (o.status || '').toUpperCase() === 'DRAFT'
  return (
    <SlideOver label={`${o.candidateName} offer`} onClose={onClose} width={480}>
      <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)', lineHeight: 1.2 }}>{o.candidateName || '—'}</div>
            <div className="sub" style={{ marginTop: 3, fontSize: 12.5 }}>{o.title || o.jobTitle}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <span className={`badge ${statusBadge(o.status)}`}>{o.status || '—'}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <Fact label="Role">{o.jobTitle || '—'}</Fact>
        <Fact label="Base">{comp(o.compBase, o.compPeriod)}</Fact>
        <Fact label="Bonus">{o.compBonus ? money(o.compBonus) : '—'}</Fact>
        <Fact label="Equity">{o.equity || '—'}</Fact>
        <Fact label="Start date">{date(o.startDate)}</Fact>
        <Fact label="Sent">{date(o.sentAt)}</Fact>

        <div style={{ marginTop: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Offer letter</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-1)', background: 'var(--app-sunken)', borderRadius: 'var(--ra-2)', padding: '12px 14px' }}>
            {o.letterBody || 'No letter body on file.'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
        {isDraft ? (
          <button className="btn btn--primary btn--sm" style={{ flex: 1 }} disabled={send.isPending} onClick={() => send.mutate(o.id, { onSuccess: () => { toastMsg(`Offer sent${o.candidateName ? ` to ${o.candidateName}` : ''}`); onClose() } })}>
            {send.isPending ? 'Sending…' : 'Send offer'}
          </button>
        ) : (
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-4)', alignSelf: 'center' }}>
            Offer {(o.status || '').toLowerCase()}.
          </span>
        )}
      </div>
    </SlideOver>
  )
}

function NewOfferForm({ onClose }: { onClose: () => void }) {
  const { data: apps } = useApplications()
  const create = useCreateOffer()
  const { toastMsg } = useStore()
  const [f, setF] = useState<OfferCreate>({ applicationId: '', title: '', compPeriod: 'year' })
  const set = (patch: Partial<OfferCreate>) => setF((p) => ({ ...p, ...patch }))
  const valid = f.applicationId && f.title.trim()

  return (
    <SlideOver label="New offer" onClose={onClose} width={460}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)' }}>New offer</div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'block' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Candidate (application)</div>
          <select className="select" value={f.applicationId} onChange={(e) => set({ applicationId: e.target.value })}>
            <option value="">Select an application…</option>
            {(apps ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.candidateName} — {a.jobTitle} · {a.stage}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'block' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Offer title</div>
          <input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Software Engineer — New Grad" />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}><div className="eyebrow" style={{ marginBottom: 6 }}>Base</div><input className="input" type="number" value={f.compBase ?? ''} onChange={(e) => set({ compBase: e.target.value ? Number(e.target.value) : undefined })} /></label>
          <label style={{ width: 110 }}><div className="eyebrow" style={{ marginBottom: 6 }}>Period</div><select className="select" value={f.compPeriod ?? 'year'} onChange={(e) => set({ compPeriod: e.target.value })}><option value="year">year</option><option value="hour">hour</option></select></label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}><div className="eyebrow" style={{ marginBottom: 6 }}>Bonus</div><input className="input" type="number" value={f.compBonus ?? ''} onChange={(e) => set({ compBonus: e.target.value ? Number(e.target.value) : undefined })} /></label>
          <label style={{ flex: 1 }}><div className="eyebrow" style={{ marginBottom: 6 }}>Equity</div><input className="input" value={f.equity ?? ''} onChange={(e) => set({ equity: e.target.value })} placeholder="RSU grant" /></label>
        </div>
        <label style={{ display: 'block' }}><div className="eyebrow" style={{ marginBottom: 6 }}>Start date</div><input className="input" type="date" value={f.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || undefined })} /></label>
        <label style={{ display: 'block' }}><div className="eyebrow" style={{ marginBottom: 6 }}>Letter</div><textarea className="input" rows={3} value={f.letterBody ?? ''} onChange={(e) => set({ letterBody: e.target.value })} placeholder="Offer letter body…" style={{ resize: 'vertical', fontFamily: 'inherit' }} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" disabled={!valid || create.isPending} onClick={() => create.mutate({ ...f, title: f.title.trim() }, { onSuccess: () => { toastMsg('Offer drafted'); onClose() } })}>
          {create.isPending ? 'Creating…' : 'Create draft'}
        </button>
      </div>
    </SlideOver>
  )
}

export default function OffersPage() {
  const { data, isLoading } = useOffers()
  const [selected, setSelected] = useState<Offer | null>(null)
  const [creating, setCreating] = useState(false)

  const kpis = useMemo(() => {
    const list = data ?? []
    const accepted = list.filter((o) => o.status?.toUpperCase() === 'ACCEPTED').length
    const decided = list.filter((o) => ['ACCEPTED', 'DECLINED'].includes(o.status?.toUpperCase())).length
    const bases = list.map((o) => o.compBase).filter((n) => n > 0)
    const avgBase = bases.length ? Math.round(bases.reduce((a, b) => a + b, 0) / bases.length) : 0
    return {
      total: list.length,
      accepted,
      acceptRate: decided > 0 ? Math.round((accepted / decided) * 100) : 0,
      avgBase,
    }
  }, [data])

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Hiring · Offers
        </div>
        <div className="page-head__row">
          <div>
            <h1>Offers</h1>
            <p className="sub">Compensation packages from draft through acceptance, with the full offer letter on hand.</p>
          </div>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>New offer</button>
        </div>
      </div>

      {creating && <NewOfferForm onClose={() => setCreating(false)} />}

      <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <StatTile label="Total offers" value={kpis.total} />
        <StatTile label="Accepted" value={kpis.accepted} meta="Signed" />
        <StatTile label="Acceptance rate" value={`${kpis.acceptRate}%`} meta="Of decided offers" />
        <StatTile label="Avg base" value={kpis.avgBase ? money(kpis.avgBase) : '—'} />
      </div>

      {isLoading ? (
        <Empty label="Loading offers…" />
      ) : !data || data.length === 0 ? (
        <Empty label="No offers extended yet." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role</th>
                <th>Title</th>
                <th className="t-right">Base</th>
                <th className="t-right">Bonus</th>
                <th>Equity</th>
                <th>Start date</th>
                <th>Status</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} {...rowAction(() => setSelected(o))}>
                  <td className="t-strong">{o.candidateName || '—'}</td>
                  <td className="t-muted">{o.jobTitle || '—'}</td>
                  <td>{o.title || '—'}</td>
                  <td className="t-right t-num">{comp(o.compBase, o.compPeriod)}</td>
                  <td className="t-right t-num">{o.compBonus ? money(o.compBonus) : '—'}</td>
                  <td className="t-muted">{o.equity || '—'}</td>
                  <td className="t-muted">{date(o.startDate)}</td>
                  <td>
                    <span className={`badge ${statusBadge(o.status)}`}>{o.status || '—'}</span>
                  </td>
                  <td className="t-muted">{date(o.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <OfferDetail o={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
