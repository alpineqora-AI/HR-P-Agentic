import { useMemo } from 'react'
import { useSurveys } from '@/api/hooks'
import { percent } from '@/lib/format'

function StatTile({ label, value, meta }: { label: string; value: string | number; meta?: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {meta ? <div className="stat__meta">{meta}</div> : null}
    </div>
  )
}

// Sense-inspired candidate experience surveys: capture sentiment at each stage,
// with a colored sentiment indicator (-1..1) and NPS.

function sentimentColor(s: number) {
  if (s >= 0.3) return 'var(--c-green)'
  if (s <= -0.3) return 'var(--bofa-red)'
  return 'var(--c-amber)'
}

function sentimentLabel(s: number) {
  if (s >= 0.3) return 'Positive'
  if (s <= -0.3) return 'Negative'
  return 'Neutral'
}

function Sentiment({ value }: { value: number }) {
  const color = sentimentColor(value)
  // map -1..1 → 0..100 for the position of the marker on the track
  const pos = Math.max(0, Math.min(100, ((value + 1) / 2) * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <div style={{ position: 'relative', width: 64, height: 7, borderRadius: 999, background: 'var(--app-sunken)' }}>
        <span
          style={{
            position: 'absolute',
            top: -2,
            left: `calc(${pos}% - 5px)`,
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: color,
            border: '2px solid var(--app-panel)',
          }}
        />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color, minWidth: 58 }}>{sentimentLabel(value)}</span>
    </div>
  )
}

function npsBadge(nps: number) {
  if (nps >= 50) return 'badge--ok'
  if (nps >= 0) return 'badge--warn'
  return 'badge--danger'
}

export default function SurveysPage() {
  const { data, isLoading } = useSurveys()

  const kpis = useMemo(() => {
    const list = data ?? []
    const sent = list.reduce((n, s) => n + s.sent, 0)
    const rr = list.length ? Math.round(list.reduce((n, s) => n + s.responseRate, 0) / list.length) : 0
    const nps = list.length ? Math.round(list.reduce((n, s) => n + s.nps, 0) / list.length) : 0
    return { total: list.length, sent, rr, nps }
  }, [data])

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Engagement · Experience surveys
        </div>
        <h1>Surveys</h1>
        <p className="sub">
          Candidate-sentiment responses, captured in one place. Surveys are authored and sent from the bank's survey
          platform; results flow in here (via Integrations) so sentiment sits next to the funnel it describes.
        </p>
      </div>

      {data && data.length > 0 ? (
        <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
          <StatTile label="Surveys" value={kpis.total} />
          <StatTile label="Sent" value={kpis.sent.toLocaleString()} />
          <StatTile label="Avg response rate" value={percent(kpis.rr, false)} />
          <StatTile label="Avg NPS" value={kpis.nps} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="card">
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>Loading surveys…</div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card">
          <div className="card__body" style={{ padding: '44px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>No surveys yet</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>Pulse surveys capture candidate sentiment at every stage of the funnel.</div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Survey</th>
                <th>Stage</th>
                <th className="t-right">Sent</th>
                <th className="t-right">Responses</th>
                <th className="t-right">Response rate</th>
                <th className="t-right">Sentiment</th>
                <th className="t-right">NPS</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="t-strong">{s.name}</td>
                  <td className="t-muted">{s.stage}</td>
                  <td className="t-right t-num">{s.sent}</td>
                  <td className="t-right t-num">{s.responses}</td>
                  <td className="t-right t-num">{percent(s.responseRate, false)}</td>
                  <td className="t-right">
                    <Sentiment value={s.avgSentiment} />
                  </td>
                  <td className="t-right">
                    <span className={`badge ${npsBadge(s.nps)}`}>{s.nps}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
