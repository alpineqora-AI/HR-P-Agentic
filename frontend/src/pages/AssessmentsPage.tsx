import { useMemo, useState } from 'react'
import { defaultJobId } from '@/lib/jobs'
import { useApplications, useAssessments, useJobs } from '@/api/hooks'
import { date, percent } from '@/lib/format'
import type { Assessment } from '@/api/types'

const statusBadge = (status: string) => {
  const s = status.toUpperCase()
  if (s === 'COMPLETED' || s === 'PASSED') return 'badge--ok'
  if (s === 'IN_PROGRESS' || s === 'STARTED') return 'badge--info'
  if (s === 'INVITED' || s === 'PENDING') return 'badge--warn'
  if (s === 'EXPIRED' || s === 'FAILED') return 'badge--danger'
  return ''
}

// Order so completed work sorts to the top, then in-progress, then pending.
const statusRank = (status: string) => {
  const s = status.toUpperCase()
  if (s === 'COMPLETED' || s === 'PASSED') return 0
  if (s === 'IN_PROGRESS' || s === 'STARTED') return 1
  if (s === 'INVITED' || s === 'PENDING') return 2
  return 3
}

const TYPE_LEGEND: { type: string; label: string; blurb: string }[] = [
  { type: 'COGNITIVE', label: 'Cognitive', blurb: 'Reasoning, numerical & verbal aptitude' },
  { type: 'CODING', label: 'Coding', blurb: 'Hands-on technical exercise, auto-scored' },
  { type: 'GAME', label: 'Game-based', blurb: 'Behavioral signals from gamified tasks' },
  { type: 'JOB_TRYOUT', label: 'Job try-out', blurb: 'Realistic on-the-job work sample' },
]

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

const isComplete = (s: string) => ['COMPLETED', 'PASSED'].includes(s.toUpperCase())

export default function AssessmentsPage() {
  const { data: jobs } = useJobs()
  const [jobId, setJobId] = useState<string>('')
  const effectiveJobId = jobId || defaultJobId(jobs)

  const { data: apps } = useApplications(effectiveJobId ? { jobId: effectiveJobId } : undefined)
  const [applicationId, setApplicationId] = useState<string>('')
  const effectiveAppId = applicationId || apps?.[0]?.id

  const { data, isLoading } = useAssessments(effectiveAppId)

  const sorted = useMemo<Assessment[]>(() => {
    if (!data) return []
    return [...data].sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.score - a.score)
  }, [data])

  const kpis = useMemo(() => {
    const list = data ?? []
    const completed = list.filter((a) => isComplete(a.status))
    const scored = completed.filter((a) => a.score > 0)
    const avg = scored.length ? Math.round(scored.reduce((n, a) => n + a.score, 0) / scored.length) : 0
    const passed = completed.filter((a) => a.score >= 70).length
    return {
      total: list.length,
      completed: completed.length,
      avg,
      passRate: completed.length ? Math.round((passed / completed.length) * 100) : 0,
    }
  }, [data])

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Hiring · Assessments
        </div>
        <div className="page-head__row">
          <div>
            <h1>Assessments</h1>
            <p className="sub">
              Structured, evidence-based evaluation across cognitive, technical, and work-sample formats — a HireVue-style
              view of how each candidate performed.
            </p>
          </div>
        </div>
      </div>

      {data && data.length > 0 ? (
        <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
          <StatTile label="Assessments" value={kpis.total} />
          <StatTile label="Completed" value={kpis.completed} />
          <StatTile label="Avg score" value={kpis.avg || '—'} />
          <StatTile label="Pass rate" value={`${kpis.passRate}%`} meta="Score ≥ 70" />
        </div>
      ) : null}

      <div className="grid-stats" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {TYPE_LEGEND.map((t) => (
          <div key={t.type} className="card">
            <div className="card__body" style={{ padding: '14px 16px' }}>
              <span className="badge badge--purple">{t.label}</span>
              <p className="muted" style={{ margin: '10px 0 0' }}>
                {t.blurb}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ marginBottom: 18 }}>
        <select
          className="select"
          style={{ width: 280 }}
          value={effectiveJobId ?? ''}
          onChange={(e) => {
            setJobId(e.target.value)
            setApplicationId('')
          }}
        >
          {(jobs ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 280 }}
          value={effectiveAppId ?? ''}
          onChange={(e) => setApplicationId(e.target.value)}
          disabled={!apps || apps.length === 0}
        >
          {(apps ?? []).length === 0 ? (
            <option value="">No applications</option>
          ) : (
            (apps ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.candidateName} — {a.stage}
              </option>
            ))
          )}
        </select>
      </div>

      {isLoading ? (
        <Empty label="Loading assessments…" />
      ) : sorted.length === 0 ? (
        <div className="card">
          <div className="card__body" style={{ padding: '44px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>No assessments yet</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>This candidate hasn't been sent an assessment for this application.</div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Assessment</th>
                <th>Status</th>
                <th className="t-right">Score</th>
                <th className="t-right">Percentile</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="badge badge--purple">{a.type}</span>
                  </td>
                  <td className="t-strong">{a.name}</td>
                  <td>
                    <span className={`badge ${statusBadge(a.status)}`}>{a.status}</span>
                  </td>
                  <td className="t-right t-num">{a.score ? a.score.toFixed(0) : '—'}</td>
                  <td className="t-right t-num">{a.percentile ? percent(a.percentile, false) : '—'}</td>
                  <td className="t-muted">{date(a.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
