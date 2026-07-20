import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAllSlots, useAnalyticsSummary, useApplications, useEvents, useJobs, useOffers } from '../api/hooks'
import { date, initials } from '../lib/format'
import { useConfig } from '@/state/config'
import type { ApplicationRow } from '../api/types'

// Dappr-style home: greeting, icon KPI cards, delta tiles + 7-day trend chart,
// recent applications, and a navy right rail (hiring progress, to-dos, next
// event). Every number is live API data — nothing decorative.

/**
 * Animates the leading number in a stat value (e.g. "1,930", "28d", "50%")
 * counting up over ~600ms on first paint; the suffix renders immediately.
 */
function CountUp({ value }: { value: string | number }) {
  const text = String(value)
  const match = text.match(/^([\d,]+(?:\.\d+)?)(.*)$/)
  const target = match ? Number(match[1].replace(/,/g, '')) : NaN
  const suffix = match ? match[2] : ''
  const [shown, setShown] = useState(Number.isFinite(target) ? 0 : NaN)
  const raf = useRef(0)

  useEffect(() => {
    if (!Number.isFinite(target)) return
    const t0 = performance.now()
    const dur = 600
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(target * eased)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target])

  if (!Number.isFinite(target)) return <>{text}</>
  const decimals = match && match[1].includes('.') ? 1 : 0
  return <>{shown.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}</>
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// ── Icon KPI card (top row) ─────────────────────────────────────────────────
function IconKpi({ glyph, value, label, to }: { glyph: string; value: string | number; label: string; to: string }) {
  return (
    <Link to={to} className="card" style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card__body" style={{ padding: '16px 18px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--ra-2)', background: 'var(--navy-050)', color: 'var(--bofa-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 12 }}>
          {glyph}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink-0)', lineHeight: 1 }}>
          <CountUp value={value} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 6, lineHeight: 1.35 }}>{label}</div>
      </div>
    </Link>
  )
}

// ── Big-number delta tile ───────────────────────────────────────────────────
function DeltaTile({ label, value, delta, meta, to }: { label: string; value: number; delta: number | null; meta?: string; to: string }) {
  const up = (delta ?? 0) >= 0
  return (
    <Link to={to} className="card" style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card__body" style={{ padding: '18px 20px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1, color: 'var(--ink-0)' }}>
            <CountUp value={value} />
          </span>
          {delta !== null && (
            <span className="t-num" style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: up ? '#E4F3EA' : '#F8ECEE', color: up ? '#007840' : 'var(--bofa-red)' }}>
              {up ? '+' : ''}{delta.toFixed(1)}%
            </span>
          )}
        </div>
        {meta && <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 6 }}>{meta}</div>}
      </div>
    </Link>
  )
}

// ── 7-day vs prior-week line chart ──────────────────────────────────────────
function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function TrendChart({ apps }: { apps: ApplicationRow[] }) {
  const { days, thisWeek, priorWeek, max } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const counts = new Map<string, number>()
    for (const a of apps) {
      if (!a.appliedAt) continue
      counts.set(dayKey(new Date(a.appliedAt)), (counts.get(dayKey(new Date(a.appliedAt))) ?? 0) + 1)
    }
    const days: Date[] = []
    const thisWeek: number[] = []
    const priorWeek: number[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86_400_000)
      days.push(d)
      thisWeek.push(counts.get(dayKey(d)) ?? 0)
      const p = new Date(d.getTime() - 7 * 86_400_000)
      priorWeek.push(counts.get(dayKey(p)) ?? 0)
    }
    const max = Math.max(1, ...thisWeek, ...priorWeek)
    return { days, thisWeek, priorWeek, max }
  }, [apps])

  const W = 560
  const H = 150
  const PAD = { l: 26, r: 8, t: 10, b: 22 }
  const x = (i: number) => PAD.l + (i / 6) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const peakIdx = thisWeek.indexOf(Math.max(...thisWeek))

  return (
    <div className="card">
      <div className="card__head">
        <h3 style={{ fontSize: 15 }}>Applications</h3>
        <span className="eyebrow">Last 7 days vs prior week</span>
      </div>
      <div className="card__body" style={{ paddingTop: 6 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Applications per day, this week vs prior week">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.l - 6} y={y(max * f) + 3.5} textAnchor="end" fontSize="9" fill="var(--ink-5)" fontFamily="var(--font-mono)">
                {Math.round(max * f)}
              </text>
            </g>
          ))}
          {/* prior week: light reference line */}
          <path d={path(priorWeek)} fill="none" stroke="#A9C6E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* this week: navy */}
          <path d={path(thisWeek)} fill="none" stroke="var(--bofa-navy)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {thisWeek[peakIdx] > 0 && (
            <g>
              <circle cx={x(peakIdx)} cy={y(thisWeek[peakIdx])} r="4" fill="var(--bofa-navy)" stroke="#fff" strokeWidth="1.6" />
              <rect x={x(peakIdx) - 34} y={y(thisWeek[peakIdx]) - 26} width="68" height="17" rx="5" fill="var(--ink-0)" />
              <text x={x(peakIdx)} y={y(thisWeek[peakIdx]) - 14} textAnchor="middle" fontSize="9" fill="#fff" fontFamily="var(--font-mono)">
                {date(days[peakIdx].toISOString())}: {thisWeek[peakIdx]}
              </text>
            </g>
          )}
          {days.map((d, i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--ink-4)" fontFamily="var(--font-mono)">
              {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          ))}
        </svg>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-4)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--bofa-navy)' }} /> This week
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-4)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: '#A9C6E8' }} /> Prior week
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Right rail ──────────────────────────────────────────────────────────────
function NavyCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bofa-navy)', color: '#fff', borderRadius: 'var(--ra-3)', padding: '18px 20px' }}>
      {children}
    </div>
  )
}

interface Todo {
  key: string
  glyph: string
  label: string
  sub: string
  to: string
}

export default function OverviewPage() {
  const { currentUser } = useConfig()
  const { data: summary } = useAnalyticsSummary()
  const { data: apps } = useApplications()
  const { data: offers } = useOffers()
  const { data: events } = useEvents()
  const { data: jobs } = useJobs()
  const { slots } = useAllSlots(jobs?.map((j) => j.id) ?? [])

  const firstName = currentUser?.name?.split(' ')[0] ?? 'there'
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const derived = useMemo(() => {
    const now = Date.now()
    const wk = 7 * 86_400_000
    const list = apps ?? []
    const in7 = list.filter((a) => a.appliedAt && now - new Date(a.appliedAt).getTime() < wk).length
    const prior7 = list.filter((a) => {
      if (!a.appliedAt) return false
      const age = now - new Date(a.appliedAt).getTime()
      return age >= wk && age < 2 * wk
    }).length
    const delta = prior7 === 0 || in7 === 0 ? null : ((in7 - prior7) / prior7) * 100
    const deltaMeta = in7 === 0 && prior7 > 0 ? `vs ${prior7} last week` : undefined
    const drafts = (offers ?? []).filter((o) => o.status === 'DRAFT')
    const sent = (offers ?? []).filter((o) => o.status === 'SENT')
    const newApps = list.filter((a) => a.stage === 'APPLIED')
    const openSlots = (slots ?? []).filter((s) => !s.booked && new Date(s.startsAt).getTime() > now && new Date(s.startsAt).getTime() < now + wk)
    const recent = [...list]
      .filter((a) => a.appliedAt)
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
      .slice(0, 5)
    const nextEvent = (events ?? [])
      .filter((e) => new Date(e.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]
    const seatsOpen = (jobs ?? []).filter((j) => j.status.toUpperCase() === 'OPEN').reduce((n, j) => n + j.openings, 0)

    const todos: Todo[] = [
      ...drafts.slice(0, 2).map((o) => ({
        key: `o-${o.id}`, glyph: '✉', label: `Send offer — ${o.candidateName ?? o.title}`,
        sub: o.jobTitle ?? 'Draft ready for review', to: '/offers',
      })),
      ...(newApps.length ? [{ key: 'review', glyph: '☰', label: `Review ${newApps.length} new application${newApps.length === 1 ? '' : 's'}`, sub: 'Waiting in Applied', to: '/pipeline' }] : []),
      ...(sent.length ? [{ key: 'sent', glyph: '⏳', label: `${sent.length} offer${sent.length === 1 ? '' : 's'} awaiting decision`, sub: 'Follow up if quiet', to: '/offers' }] : []),
      ...(openSlots.length ? [{ key: 'slots', glyph: '▦', label: `${openSlots.length} open interview slot${openSlots.length === 1 ? '' : 's'} this week`, sub: 'Offer them to candidates', to: '/interviews' }] : []),
    ].slice(0, 4)

    return { in7, delta, deltaMeta, drafts, sent, recent, nextEvent, seatsOpen, todos }
  }, [apps, offers, slots, events, jobs])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 30, margin: 0 }}>{greeting()}, {firstName}!</h1>
          <p className="sub" style={{ margin: '6px 0 0' }}>{todayLabel} — here's where hiring stands.</p>
        </div>
        <Link to="/analytics" className="btn btn--outline btn--sm">Full analytics</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <IconKpi glyph="▤" value={summary?.openJobs ?? '—'} label="Open jobs" to="/jobs" />
            <IconKpi glyph="◎" value={summary?.activeCandidates ?? '—'} label="Active candidates" to="/candidates" />
            <IconKpi glyph="▦" value={summary?.interviews30d ?? '—'} label="Interviews · 30d" to="/interviews" />
            <IconKpi glyph="✦" value={summary ? Math.round(summary.avgFitScore) : '—'} label="Avg fit score" to="/matching" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: 14, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <DeltaTile label="New applications" value={derived.in7} delta={derived.delta} meta={derived.deltaMeta} to="/pipeline" />
              <DeltaTile label="Offers awaiting" value={derived.sent.length} delta={null} to="/offers" />
            </div>
            <TrendChart apps={apps ?? []} />
          </div>

          {/* Recent applications */}
          <div className="card">
            <div className="card__head">
              <h3 style={{ fontSize: 15 }}>Recent applications</h3>
              <Link to="/candidates" className="link">View all</Link>
            </div>
            <div>
              {derived.recent.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
                  New applications will appear here.
                </div>
              ) : (
                derived.recent.map((a) => (
                  <Link key={a.id} to={`/candidates/${a.candidateId}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--line)', textDecoration: 'none' }}>
                    <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(a.candidateName)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.candidateName}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.jobTitle}</span>
                    </span>
                    <span className="t-num" style={{ fontSize: 12, color: 'var(--ink-4)', flexShrink: 0 }}>{date(a.appliedAt)}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <NavyCard>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>Hiring progress</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>Last 30 days</div>
            {(() => {
              const hired = summary?.hires30d ?? 0
              const total = hired + derived.seatsOpen
              const pct = total ? Math.round((hired / total) * 100) : 0
              return (
                <>
                  <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.22)', marginTop: 14 }}>
                    <div style={{ width: `${Math.max(4, pct)}%`, height: '100%', borderRadius: 999, background: '#fff' }} />
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 10, opacity: 0.9 }}>
                    <strong>{hired} hired</strong> · {derived.seatsOpen} seats still open
                  </div>
                </>
              )
            })()}
            <Link to="/pipeline" className="btn btn--sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center', background: '#fff', color: 'var(--bofa-navy)', border: 0 }}>
              View pipeline
            </Link>
          </NavyCard>

          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, color: 'var(--ink-0)', margin: '4px 0 12px' }}>Your to-do list</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {derived.todos.length === 0 ? (
                <div className="card"><div className="card__body" style={{ fontSize: 12.5, color: 'var(--ink-4)', textAlign: 'center', padding: '22px 14px' }}>All clear — nothing waiting on you.</div></div>
              ) : (
                derived.todos.map((t) => (
                  <Link key={t.key} to={t.to} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', textDecoration: 'none' }}>
                    <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--ink-0)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                      {t.glyph}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-4)' }}>{t.sub}</span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {derived.nextEvent && (
            <NavyCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5BE49B' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 15.5 }}>{derived.nextEvent.name}</span>
              </div>
              <div style={{ fontSize: 12.5, marginTop: 8, opacity: 0.9 }}>
                {date(derived.nextEvent.startsAt)}{derived.nextEvent.location ? ` · ${derived.nextEvent.location}` : ''}
              </div>
              <div style={{ fontSize: 11.5, marginTop: 6, opacity: 0.7 }}>
                {derived.nextEvent.registrations.toLocaleString()} registered so far.
              </div>
              <Link to="/events" className="link" style={{ display: 'inline-block', marginTop: 10, color: '#fff', textDecoration: 'underline', fontSize: 12.5 }}>
                Event details →
              </Link>
            </NavyCard>
          )}
        </div>
      </div>
    </div>
  )
}
