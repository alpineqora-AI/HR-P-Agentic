import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCandidate, useCandidates, useJobInterviews } from '../api/hooks'
import AriaConversations from '@/components/AriaConversations'
import type { CandidateSummary } from '../api/types'
import { date, humanize, initials } from '../lib/format'

// Split-view pilot: the candidate list docks left, the record lives on the
// right — no overlay, no open/close ceremony. ↑/↓ moves the selection, the
// detail tab stays put while you hop candidates, and ?sel= keeps the view
// shareable. This is the app's drawer-replacement pattern for triage pages.

const ivTime = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function ivStatusBadge(status: string) {
  const s = (status || '').toUpperCase()
  if (s === 'COMPLETED' || s === 'DONE') return 'badge--ok'
  if (s === 'SCHEDULED' || s === 'CONFIRMED') return 'badge--info'
  if (s === 'CANCELLED' || s === 'NO_SHOW') return 'badge--danger'
  return 'badge--neutral'
}

function lifecycleClass(lifecycle: string) {
  const s = lifecycle.toLowerCase()
  if (s.includes('hire') || s === 'active') return 'badge--ok'
  if (s.includes('lead') || s.includes('prospect') || s.includes('new')) return 'badge--info'
  if (s.includes('reject') || s.includes('declin') || s.includes('withdraw')) return 'badge--neutral'
  if (s.includes('nurtur') || s.includes('passive')) return 'badge--purple'
  return 'badge--neutral'
}

function fitClass(score: number) {
  if (score >= 80) return 'badge--ok'
  if (score >= 60) return 'badge--info'
  if (score >= 40) return 'badge--warn'
  return 'badge--danger'
}

function stageClass(stage: string) {
  const s = stage.toLowerCase()
  if (s.includes('hire') || s.includes('offer')) return 'badge--ok'
  if (s.includes('reject') || s.includes('declin') || s.includes('withdraw')) return 'badge--neutral'
  if (s.includes('interview') || s.includes('screen')) return 'badge--info'
  return 'badge--neutral'
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--ink-4)' }}>{label}</span>
      <span style={{ color: 'var(--ink-1)', textAlign: 'right' }}>{children}</span>
    </div>
  )
}

type Tab = 'overview' | 'applications' | 'interviews' | 'aria'

// ── Right pane: the live record ─────────────────────────────────────────────
function CandidateDetailPane({ summary, tab, setTab }: {
  summary: CandidateSummary
  tab: Tab
  setTab: (t: Tab) => void
}) {
  const { data: c, isLoading } = useCandidate(summary.id)
  const skills = c?.skills ?? []
  const apps = c?.applications ?? []
  const appIds = useMemo(() => apps.map((a) => a.id), [apps])
  const { interviews, isLoading: ivLoading } = useJobInterviews(appIds)
  const jobByApp = useMemo(() => Object.fromEntries(apps.map((a) => [a.id, a.jobTitle])), [apps])
  const [note, setNote] = useState('')

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'applications', label: 'Applications', count: apps.length },
    { key: 'interviews', label: 'Interviews', count: interviews.length },
    { key: 'aria', label: 'Aria chat' },
  ]

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px 11px', borderBottom: '1px solid var(--line)' }}>
        <div className="avatar" style={{ width: 38, height: 38, fontSize: 13.5 }}>
          {initials(summary.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17.5, color: 'var(--ink-0)', lineHeight: 1.2 }}>
            {summary.name}
          </div>
          {summary.headline ? (
            <div className="sub" style={{ marginTop: 2, fontSize: 12 }}>{summary.headline}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <span className={`badge ${lifecycleClass(summary.lifecycle)}`}>{summary.lifecycle}</span>
            <span className="badge">{humanize(summary.source)}</span>
          </div>
        </div>
        <Link to={`/candidates/${summary.id}`} className="btn btn--outline btn--sm" style={{ flexShrink: 0 }}>
          Open full record
        </Link>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, padding: '0 12px', borderBottom: '1px solid var(--line)' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: 0,
              background: 'none',
              cursor: 'pointer',
              padding: '9px 11px',
              fontSize: 12.5,
              fontWeight: tab === t.key ? 600 : 500,
              color: tab === t.key ? 'var(--bofa-navy)' : 'var(--ink-4)',
              borderBottom: tab === t.key ? '2px solid var(--bofa-navy)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
            {typeof t.count === 'number' ? <span style={{ color: 'var(--ink-5)', marginLeft: 5 }}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '13px 16px' }}>
        {tab === 'overview' && (
          <>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Personal</div>
            {summary.location ? <Fact label="Location">{summary.location}</Fact> : null}
            {summary.yearsExperience ? <Fact label="Experience">{summary.yearsExperience} yrs</Fact> : null}
            {summary.preferredLanguage ? <Fact label="Language">{summary.preferredLanguage}</Fact> : null}
            {isLoading ? (
              <Fact label="Contact">Loading…</Fact>
            ) : c ? (
              <>
                {c.email ? (
                  <Fact label="Email">
                    <a className="link" href={`mailto:${c.email}`}>{c.email}</a>
                  </Fact>
                ) : null}
                {c.phone ? <Fact label="Phone">{c.phone}</Fact> : null}
              </>
            ) : null}

            {skills.length > 0 ? (
              <div style={{ marginTop: 18 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skills.map((s) => (
                    <span
                      key={s.name}
                      className={`badge ${s.inferred ? 'badge--purple' : 'badge--neutral'}`}
                      title={`${s.proficiency}${s.years ? ` · ${s.years} yrs` : ''}${s.inferred ? ' · inferred' : ''}`}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Notes</div>
              <textarea
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a private note about this candidate…"
                rows={3}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 4 }}>Local to this view — not yet saved to the server.</div>
            </div>
          </>
        )}

        {tab === 'applications' && (
          isLoading ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Loading…</div>
          ) : apps.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>No applications on record.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {apps.map((a) => (
                <Link
                  key={a.id}
                  to={`/jobs/${a.jobId}`}
                  className="card"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', textDecoration: 'none', border: '1px solid var(--line)' }}
                >
                  <span style={{ fontSize: 13, color: 'var(--ink-0)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.jobTitle}
                  </span>
                  <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span className={`badge ${stageClass(a.stage)}`}>{a.stage}</span>
                    <span className={`badge ${fitClass(a.fitScore)}`}>{Math.round(a.fitScore)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )
        )}

        {tab === 'aria' && (
          <AriaConversations apps={apps.map((a) => ({ id: a.id, jobTitle: a.jobTitle }))} />
        )}

        {tab === 'interviews' && (
          ivLoading ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Loading…</div>
          ) : interviews.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>No interviews on record.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...interviews]
                .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                .map((iv) => (
                  <div key={iv.id} className="card" style={{ padding: '11px 13px', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span className="t-strong" style={{ fontSize: 13.5 }}>{iv.type || 'Interview'}</span>
                      <span className={`badge ${ivStatusBadge(iv.status)}`}>{iv.status || '—'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>
                      {date(iv.scheduledAt)} · {ivTime(iv.scheduledAt)}
                      {jobByApp[iv.applicationId] ? ` · ${jobByApp[iv.applicationId]}` : ''}
                    </div>
                    {(iv.score || iv.recommendation) && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        {iv.score ? <span className="badge badge--neutral">Score {iv.score.toFixed(1)}</span> : null}
                        {iv.recommendation ? <span className="badge">{iv.recommendation}</span> : null}
                      </div>
                    )}
                    {iv.summary ? (
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>{iv.summary}</div>
                    ) : null}
                  </div>
                ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ── Page: master list + detail pane ─────────────────────────────────────────
export default function CandidatesPage() {
  const { data, isLoading, isError, refetch } = useCandidates()
  const [filter, setFilter] = useState('')
  const [params, setParams] = useSearchParams()
  const sel = params.get('sel')
  const [tab, setTab] = useState<Tab>('overview')

  const rows = useMemo(() => {
    if (!data) return []
    const q = filter.trim().toLowerCase()
    if (!q) return data
    return data.filter((c) =>
      [c.name, c.headline, c.location, c.source, c.lifecycle, ...(c.topSkills ?? [])].some((v) =>
        v?.toLowerCase().includes(q),
      ),
    )
  }, [data, filter])

  const selected = rows.find((c) => c.id === sel) ?? null
  const setSel = (id: string) => setParams(id ? { sel: id } : {}, { replace: true })

  // Land on the first visible candidate when nothing (valid) is selected.
  useEffect(() => {
    if (!selected && rows.length > 0) setSel(rows[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selected])

  // ↑/↓ move the selection — the split view's superpower.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (rows.length === 0) return
      e.preventDefault()
      const idx = rows.findIndex((c) => c.id === sel)
      const next = e.key === 'ArrowDown' ? Math.min(idx + 1, rows.length - 1) : Math.max(idx - 1, 0)
      setSel(rows[Math.max(next, 0)].id)
      document.getElementById(`cand-${rows[Math.max(next, 0)].id}`)?.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sel])

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div className="crumb">
          <span className="dot" />
          Recruiting · Candidates
        </div>
        <div className="page-head__row">
          <div>
            <h1 style={{ fontSize: 28 }}>Candidates</h1>
            <p className="sub">Everyone in the talent pool — click through or use ↑↓ to move between records.</p>
          </div>
          <div className="input-group" style={{ width: 280 }}>
            <input
              className="input"
              placeholder="Filter by name, skill, source…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            Loading candidates…
          </div>
        </div>
      ) : isError ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-0)' }}>
              Couldn’t load candidates.
            </div>
            <button className="btn btn--outline btn--sm" style={{ marginTop: 14 }} onClick={() => refetch()}>
              Retry
            </button>
          </div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            No candidates in the pool yet.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '264px minmax(0, 1fr)', gap: 14, height: 'calc(100vh - 232px)', minHeight: 420 }}>
          {/* Master list */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
              <span className="eyebrow">{rows.length} of {data.length} candidates</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {rows.length === 0 ? (
                <div style={{ padding: '30px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-4)' }}>
                  No candidates match “{filter}”.
                </div>
              ) : (
                rows.map((c) => {
                  const active = c.id === sel
                  return (
                    <button
                      key={c.id}
                      id={`cand-${c.id}`}
                      onClick={() => setSel(c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        textAlign: 'left',
                        border: 0,
                        cursor: 'pointer',
                        font: 'inherit',
                        padding: '7px 10px',
                        background: active ? 'var(--navy-050)' : 'transparent',
                        borderLeft: active ? '3px solid var(--bofa-navy)' : '3px solid transparent',
                        borderBottom: '1px solid var(--line)',
                      }}
                    >
                      <span className="avatar" style={{ width: 26, height: 26, fontSize: 10.5, flexShrink: 0 }}>{initials(c.name)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? 'var(--bofa-navy)' : 'var(--ink-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </span>
                          <span className={`badge ${lifecycleClass(c.lifecycle)}`} style={{ flexShrink: 0 }}>{c.lifecycle}</span>
                        </span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                          {c.headline || humanize(c.source)}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Detail pane */}
          {selected ? (
            <CandidateDetailPane key={selected.id} summary={selected} tab={tab} setTab={setTab} />
          ) : (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>
              Select a candidate to see their record.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
