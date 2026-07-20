import { useMemo, useState } from 'react'
import { rowAction } from '@/lib/a11y'
import { defaultJobId } from '@/lib/jobs'
import SlideOver from '@/components/SlideOver'
import { useJobs, useReactivation, useSourcing } from '@/api/hooks'
import type { MatchRow, SourcingRow } from '@/api/types'

// Eightfold-inspired sourcing: reach passive talent and re-match dormant
// candidates already in the database. Lifecycle badges signal intent.

type Tab = 'passive' | 'reactivation'

function lifecycleBadge(lifecycle: string) {
  const key = lifecycle.toUpperCase()
  if (key === 'ACTIVE') return 'badge--ok'
  if (key === 'PASSIVE') return 'badge--info'
  if (key === 'DORMANT') return 'badge--warn'
  return 'badge'
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

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <div className="progress" style={{ width: 70 }}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="t-num t-strong" style={{ minWidth: 24, textAlign: 'right' }}>{Math.round(score)}</span>
    </div>
  )
}

type Selected =
  | { kind: 'passive'; row: SourcingRow }
  | { kind: 'react'; row: MatchRow }

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--ink-4)' }}>{label}</span>
      <span style={{ color: 'var(--ink-1)', textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function Chips({ items, tone }: { items: string[]; tone: 'ok' | 'warn' }) {
  if (!items || items.length === 0) return <span style={{ fontSize: 12.5, color: 'var(--ink-5)' }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((s) => (
        <span key={s} className={`badge ${tone === 'ok' ? 'badge--ok' : 'badge--warn'}`}>{s}</span>
      ))}
    </div>
  )
}

function SourcingDetail({ sel, onClose }: { sel: Selected; onClose: () => void }) {
  const name = sel.row.candidateName
  const headline = sel.row.headline
  const fit = sel.row.fitScore
  return (
    <SlideOver label={`${name} details`} onClose={onClose} width={420}>
      <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)', lineHeight: 1.2 }}>{name}</div>
            {headline ? <div className="sub" style={{ marginTop: 3, fontSize: 12.5 }}>{headline}</div> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <span className="badge badge--info">Fit {Math.round(fit)}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {sel.kind === 'passive' ? (
          <>
            {sel.row.location ? <Fact label="Location">{sel.row.location}</Fact> : null}
            <Fact label="Lifecycle"><span className={`badge ${lifecycleBadge(sel.row.lifecycle)}`}>{sel.row.lifecycle}</span></Fact>
            <Fact label="Source">{sel.row.source}</Fact>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 16 }}>{sel.row.explanation}</div>
            <div style={{ marginBottom: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Matched skills</div>
              <Chips items={sel.row.matchedSkills} tone="ok" />
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Gap skills</div>
              <Chips items={sel.row.gapSkills} tone="warn" />
            </div>
          </>
        )}
      </div>
    </SlideOver>
  )
}

function PassiveTable({ rows, onSelect }: { rows: SourcingRow[]; onSelect: (r: SourcingRow) => void }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Location</th>
            <th>Lifecycle</th>
            <th>Source</th>
            <th className="t-right">Fit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.candidateId} {...rowAction(() => onSelect(r))}>
              <td>
                <div className="who__name">{r.candidateName}</div>
                <div className="who__sub">{r.headline}</div>
              </td>
              <td className="t-muted">{r.location}</td>
              <td>
                <span className={`badge ${lifecycleBadge(r.lifecycle)}`}>{r.lifecycle}</span>
              </td>
              <td className="t-muted">{r.source}</td>
              <td className="t-right">
                <ScoreBar score={r.fitScore} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReactivationTable({ rows, onSelect }: { rows: MatchRow[]; onSelect: (r: MatchRow) => void }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Dormant candidate</th>
            <th>Why re-matched</th>
            <th className="t-right">Fit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.candidateId} {...rowAction(() => onSelect(r))}>
              <td>
                <div className="who__name">{r.candidateName}</div>
                <div className="who__sub">{r.headline}</div>
              </td>
              <td style={{ maxWidth: 460, color: 'var(--ink-2)' }}>{r.explanation}</td>
              <td className="t-right">
                <ScoreBar score={r.fitScore} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ title, line }: { title: string; line: string }) {
  return (
    <div className="card">
      <div className="card__body" style={{ padding: '44px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>{line}</div>
      </div>
    </div>
  )
}

export default function SourcingPage() {
  const { data: jobs, isLoading: jobsLoading } = useJobs()
  const [jobId, setJobId] = useState<string>('')
  const [tab, setTab] = useState<Tab>('passive')
  const [selected, setSelected] = useState<Selected | null>(null)
  const selectedJob = jobId || defaultJobId(jobs)

  const { data: passive, isLoading: passiveLoading } = useSourcing(selectedJob)
  const { data: dormant, isLoading: dormantLoading } = useReactivation()

  const kpis = useMemo(() => {
    const p = passive ?? []
    const avg = p.length ? Math.round(p.reduce((n, r) => n + r.fitScore, 0) / p.length) : 0
    const strong = p.filter((r) => r.fitScore >= 80).length
    return { passive: p.length, dormant: (dormant ?? []).length, avg, strong }
  }, [passive, dormant])

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Talent intelligence · Sourcing
        </div>
        <div className="page-head__row">
          <div>
            <h1>Sourcing</h1>
            <p className="sub">
              Reach passive talent the moment a role matches their profile, and re-engage dormant candidates already in
              your database with a fresh skills match.
            </p>
          </div>
          <div className="field" style={{ minWidth: 280 }}>
            <label className="field__label" htmlFor="src-job">Role</label>
            <select
              id="src-job"
              className="select"
              value={selectedJob ?? ''}
              onChange={(e) => setJobId(e.target.value)}
              disabled={jobsLoading || !jobs?.length}
            >
              {jobs?.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.department}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <StatTile label="Passive matches" value={kpis.passive} />
        <StatTile label="Reactivation pool" value={kpis.dormant} />
        <StatTile label="Avg fit" value={kpis.avg || '—'} meta="Passive matches" />
        <StatTile label="Strong matches" value={kpis.strong} meta="Fit ≥ 80" />
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        <button className="tab" aria-selected={tab === 'passive'} onClick={() => setTab('passive')}>
          Passive talent
          <span className="count">{passive?.length ?? 0}</span>
        </button>
        <button className="tab" aria-selected={tab === 'reactivation'} onClick={() => setTab('reactivation')}>
          Database reactivation
          <span className="count">{dormant?.length ?? 0}</span>
        </button>
      </div>

      {tab === 'passive' ? (
        jobsLoading || passiveLoading ? (
          <div className="card">
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>Finding passive talent…</div>
          </div>
        ) : !passive || passive.length === 0 ? (
          <Empty title="No passive matches yet" line="When candidates match this role's profile, they'll surface here for outreach." />
        ) : (
          <PassiveTable rows={passive} onSelect={(r) => setSelected({ kind: 'passive', row: r })} />
        )
      ) : dormantLoading ? (
        <div className="card">
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>Re-matching dormant candidates…</div>
        </div>
      ) : !dormant || dormant.length === 0 ? (
        <Empty title="No dormant candidates to reactivate" line="Candidates already in your database get re-matched here as new roles open." />
      ) : (
        <ReactivationTable rows={dormant} onSelect={(r) => setSelected({ kind: 'react', row: r })} />
      )}

      {selected && <SourcingDetail sel={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
