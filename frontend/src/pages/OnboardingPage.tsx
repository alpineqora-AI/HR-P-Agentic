import { useMemo, useState } from 'react'
import { defaultJobId } from '@/lib/jobs'
import { useApplications, useJobs, useOnboarding } from '@/api/hooks'
import { date } from '@/lib/format'
import type { OnboardingTask } from '@/api/types'

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'DOCS', label: 'Documents' },
  { key: 'IT', label: 'IT & access' },
  { key: 'COMMS', label: 'Communications' },
  { key: 'DAY_ONE', label: 'Day one' },
  { key: 'COMPLIANCE', label: 'Compliance' },
]

const statusBadge = (status: string) => {
  const s = status.toUpperCase()
  if (s === 'COMPLETED') return 'badge--ok'
  if (s === 'SENT') return 'badge--info'
  return 'badge--warn' // PENDING
}

const isDone = (status: string) => status.toUpperCase() === 'COMPLETED'

function Empty({ label }: { label: string }) {
  return (
    <div className="card">
      <div className="card__body" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
        {label}
      </div>
    </div>
  )
}

function CategoryCard({ label, tasks }: { label: string; tasks: OnboardingTask[] }) {
  const done = tasks.filter((t) => isDone(t.status)).length
  return (
    <div className="card">
      <div className="card__head">
        <h3>{label}</h3>
        <span className="eyebrow">
          {done}/{tasks.length} done
        </span>
      </div>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map((t) => {
          const complete = isDone(t.status)
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 'var(--ra-2)',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  aria-hidden
                  style={{
                    width: 20,
                    height: 20,
                    flex: 'none',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    background: complete ? 'var(--ok-bg)' : 'var(--app-sunken)',
                    color: complete ? 'var(--ok-fg)' : 'var(--ink-5)',
                    border: `1px solid ${complete ? 'var(--ok-line)' : 'var(--line-2)'}`,
                  }}
                >
                  {complete ? '✓' : ''}
                </span>
                <div>
                  <div className="t-strong" style={{ fontSize: 14 }}>
                    {t.name}
                  </div>
                  {t.dueDate && (
                    <div className="muted" style={{ margin: '2px 0 0' }}>
                      Due {date(t.dueDate)}
                    </div>
                  )}
                </div>
              </div>
              <span className={`badge ${statusBadge(t.status)}`}>{t.status}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  const { data: jobs } = useJobs()
  const [jobId, setJobId] = useState<string>('')
  const effectiveJobId = jobId || defaultJobId(jobs)

  const { data: apps } = useApplications(effectiveJobId ? { jobId: effectiveJobId } : undefined)
  const [applicationId, setApplicationId] = useState<string>('')
  const effectiveAppId = applicationId || apps?.[0]?.id

  const { data, isLoading } = useOnboarding(effectiveAppId)

  const { grouped, pct } = useMemo(() => {
    const tasks = data ?? []
    const byCat = new Map<string, OnboardingTask[]>()
    for (const t of tasks) {
      const list = byCat.get(t.category) ?? []
      list.push(t)
      byCat.set(t.category, list)
    }
    const total = tasks.length
    const done = tasks.filter((t) => isDone(t.status)).length
    return { grouped: byCat, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [data])

  const orderedCats = CATEGORIES.filter((c) => grouped.has(c.key))
  // Surface any categories the backend sends that we didn't anticipate.
  const extraCats = [...grouped.keys()].filter((k) => !CATEGORIES.some((c) => c.key === k))

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Hiring · Onboarding
        </div>
        <div className="page-head__row">
          <div>
            <h1>Onboarding</h1>
            <p className="sub">Everything that has to be true for a new hire to be ready and productive on day one.</p>
          </div>
        </div>
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
        <Empty label="Loading onboarding plan…" />
      ) : !data || data.length === 0 ? (
        <Empty label="No onboarding tasks for this application yet." />
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card__body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <p className="eyebrow" style={{ margin: 0 }}>
                    Ready for day one
                  </p>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 32,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                      color: 'var(--ink-0)',
                      marginTop: 4,
                    }}
                  >
                    {pct}% complete
                  </div>
                </div>
                <span className={`badge ${pct === 100 ? 'badge--ok' : 'badge--info'}`}>
                  {pct === 100 ? 'All set' : 'In progress'}
                </span>
              </div>
              <div className={`progress ${pct === 100 ? 'progress--ok' : ''}`} style={{ marginTop: 14 }}>
                <i style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {orderedCats.map((c) => (
              <CategoryCard key={c.key} label={c.label} tasks={grouped.get(c.key) ?? []} />
            ))}
            {extraCats.map((k) => (
              <CategoryCard key={k} label={k} tasks={grouped.get(k) ?? []} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
