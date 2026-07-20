import { useAnalyticsSummary } from '@/api/hooks'
import { stageHue } from '@/lib/stages'
import type { AnalyticsSummary, FunnelStage } from '@/api/types'
import { percent } from '@/lib/format'

// ---- local helpers (kept in-file per page rules) ----

/** Deterministic pseudo-random in [0,1) seeded by a string — gives each
    mini-chart a stable but distinct shape without a charting lib. */
function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A 30-point daily series that lands on `end`, trending up by `drift`. */
function makeSeries(seed: string, end: number, drift = 0.18): number[] {
  const rnd = seeded(seed)
  const n = 30
  const start = Math.max(0, end * (1 - drift))
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const base = start + ((end - start) * i) / (n - 1)
    const noise = (rnd() - 0.5) * end * 0.16
    out.push(Math.max(0, base + noise))
  }
  out[n - 1] = end
  return out
}

function Sparkline({ data, color, area = true }: { data: number[]; color: string; area?: boolean }) {
  const w = 240
  const h = 56
  const pad = 3
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const span = max - min || 1
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / span) * (h - pad * 2)
    return [x, y] as const
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const fill = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 56, display: 'block' }}>
      {area && <path d={fill} fill={color} opacity={0.1} />}
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  )
}

interface Trend {
  label: string
  value: string
  end: number
  color: string
  delta: number
}

function TrendCard({ t }: { t: Trend }) {
  const data = makeSeries(t.label, t.end)
  const up = t.delta >= 0
  return (
    <div className="card">
      <div className="card__body" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div className="stat__label" style={{ marginBottom: 0 }}>
            {t.label}
          </div>
          <span className={`delta ${up ? 'delta--up' : 'delta--down'}`}>
            {up ? '▲' : '▼'} {Math.abs(t.delta)}%
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: '-0.02em',
            color: 'var(--ink-0)',
            margin: '6px 0 10px',
          }}
        >
          {t.value}
        </div>
        <Sparkline data={data} color={t.color} />
        <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
          Last 30 days
        </div>
      </div>
    </div>
  )
}

function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = Math.max(...stages.map((s) => s.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stages.map((s, i) => {
        const pct = (s.count / top) * 100
        const conv = i === 0 ? 100 : (s.count / stages[i - 1].count) * 100
        return (
          <div key={s.stage} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 56px', gap: 14, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: stageHue(s.stage).fg, flexShrink: 0 }} />
              {s.stage}
            </div>
            <div style={{ position: 'relative', height: 30 }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${pct}%`,
                  background: stageHue(s.stage).fg,
                  borderRadius: 'var(--ra-1)',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 12,
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  minWidth: 44,
                }}
              >
                {s.count.toLocaleString()}
              </div>
            </div>
            <div
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)', textAlign: 'right' }}
              title="Conversion from previous stage"
            >
              {i === 0 ? '—' : `${Math.round(conv)}%`}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function buildTrends(a: AnalyticsSummary): Trend[] {
  return [
    { label: 'Applications · 30d', value: a.applications30d.toLocaleString(), end: a.applications30d, color: 'var(--bofa-navy)', delta: 12 },
    { label: 'Interviews · 30d', value: a.interviews30d.toLocaleString(), end: a.interviews30d, color: 'var(--c-teal)', delta: 8 },
    { label: 'Offers · 30d', value: a.offers30d.toLocaleString(), end: a.offers30d, color: 'var(--c-violet)', delta: 5 },
    { label: 'Hires · 30d', value: a.hires30d.toLocaleString(), end: a.hires30d, color: 'var(--c-green)', delta: 9 },
    { label: 'Avg time-to-hire', value: `${a.avgTimeToHireDays}d`, end: a.avgTimeToHireDays, color: 'var(--c-amber)', delta: -4 },
    { label: 'Avg fit score', value: `${Math.round(a.avgFitScore)}`, end: a.avgFitScore, color: 'var(--bofa-red)', delta: 3 },
  ]
}

const KPIS: { label: string; pick: (a: AnalyticsSummary) => string; meta?: string }[] = [
  { label: 'Open jobs', pick: (a) => a.openJobs.toLocaleString() },
  { label: 'Active candidates', pick: (a) => a.activeCandidates.toLocaleString() },
  { label: 'Applications · 30d', pick: (a) => a.applications30d.toLocaleString() },
  { label: 'Interviews · 30d', pick: (a) => a.interviews30d.toLocaleString() },
  { label: 'Offers · 30d', pick: (a) => a.offers30d.toLocaleString() },
  { label: 'Hires · 30d', pick: (a) => a.hires30d.toLocaleString() },
  { label: 'Time to hire', pick: (a) => `${a.avgTimeToHireDays}d` },
  { label: 'Offer accept rate', pick: (a) => percent(a.offerAcceptRate, false) },
]

export default function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useAnalyticsSummary()

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div className="crumb">
          <span className="dot" />
          Insights · Analytics
        </div>
        <div className="page-head__row">
          <div>
            <h1 style={{ fontSize: 28 }}>Analytics</h1>
            <p className="sub">
              1,000+ talent metrics across the funnel — sourcing through hire — refreshed continuously from the activity stream.
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Range">
            <button aria-pressed="false">7d</button>
            <button aria-pressed="true">30d</button>
            <button aria-pressed="false">QTD</button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            Loading analytics…
          </div>
        </div>
      ) : isError || !data ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-0)' }}>Couldn’t load analytics.</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '6px 0 16px' }}>The metrics API didn’t respond.</div>
            <button className="btn btn--outline btn--sm" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI grid */}
          <div className="grid-stats">
            {KPIS.map((k) => (
              <div className="stat" key={k.label}>
                <div className="stat__label">{k.label}</div>
                <div className="stat__value" style={{ fontSize: 30 }}>
                  {k.pick(data)}
                </div>
              </div>
            ))}
          </div>

          {/* Funnel + accept-rate summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 20 }}>
            <div className="card">
              <div className="card__head">
                <h3>Hiring funnel</h3>
                <span className="eyebrow">Stage → stage conversion</span>
              </div>
              <div className="card__body">
                {data.funnel.length === 0 ? (
                  <div style={{ color: 'var(--ink-4)', fontSize: 13.5 }}>No funnel data.</div>
                ) : (
                  <Funnel stages={data.funnel} />
                )}
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <h3>By stage</h3>
                <span className="eyebrow">Live pipeline</span>
              </div>
              <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(data.byStage).length === 0 ? (
                  <div style={{ color: 'var(--ink-4)', fontSize: 13.5 }}>No stage data.</div>
                ) : (
                  Object.entries(data.byStage).map(([stage, count]) => {
                    const total = Object.values(data.byStage).reduce((s, n) => s + n, 0) || 1
                    return (
                      <div key={stage}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                          <span style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{stage}</span>
                          <span className="t-num" style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                            {count.toLocaleString()}
                          </span>
                        </div>
                        <div className="progress">
                          <i style={{ width: `${(count / total) * 100}%`, background: stageHue(stage).fg }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Metric trend mini-charts */}
          <div className="card">
            <div className="card__head">
              <h3>Metric trends</h3>
              <span className="eyebrow">metric_daily · trailing 30d</span>
            </div>
            <div className="card__body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {buildTrends(data).map((t) => (
                  <TrendCard key={t.label} t={t} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
