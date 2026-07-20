import { Link, useParams } from 'react-router-dom'
import AriaConversations from '@/components/AriaConversations'
import { useCandidate } from '../api/hooks'
import { humanize, initials } from '../lib/format'

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

export default function CandidateDetailPage() {
  const { id } = useParams()
  const { data: c, isLoading, isError, refetch } = useCandidate(id)

  if (isLoading) {
    return (
      <div className="card">
        <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
          Loading candidate…
        </div>
      </div>
    )
  }

  if (isError || !c) {
    return (
      <div className="card">
        <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-0)' }}>
            Couldn’t load this candidate.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
            <button className="btn btn--outline btn--sm" onClick={() => refetch()}>
              Retry
            </button>
            <Link to="/candidates" className="btn btn--ghost btn--sm">
              Back to candidates
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div className="crumb">
          <span className="dot" />
          <Link to="/candidates" className="link" style={{ fontSize: 11, letterSpacing: 'inherit' }}>
            Candidates
          </Link>
          <span style={{ color: 'var(--ink-5)' }}>/</span>
          {c.lifecycle}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
            {initials(c.name)}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 26, margin: 0 }}>{c.name}</h1>
            {c.headline ? <p className="sub" style={{ marginTop: 4 }}>{c.headline}</p> : null}
            <div
              style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                marginTop: 10,
                fontSize: 13,
                color: 'var(--ink-4)',
              }}
            >
              {c.location ? <span>{c.location}</span> : null}
              {c.email ? <a className="link" href={`mailto:${c.email}`}>{c.email}</a> : null}
              {c.phone ? <span>{c.phone}</span> : null}
              {c.yearsExperience ? <span>{c.yearsExperience} yrs experience</span> : null}
            </div>
          </div>
          <span className="badge">{humanize(c.source)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card__head">
            <h3 style={{ fontSize: 15 }}>Applications</h3>
            <span className="eyebrow">{c.applications?.length ?? 0} total</span>
          </div>
          {c.applications && c.applications.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Stage</th>
                  <th className="t-right">Fit</th>
                </tr>
              </thead>
              <tbody>
                {c.applications.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/jobs/${a.jobId}`} style={{ textDecoration: 'none' }}>
                        <span className="t-strong" style={{ color: 'var(--bofa-navy)' }}>
                          {a.jobTitle}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${stageClass(a.stage)}`}>{a.stage}</span>
                    </td>
                    <td className="t-right">
                      <span className={`badge ${fitClass(a.fitScore)}`}>{Math.round(a.fitScore)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="card__body" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
              No applications on record.
            </div>
          )}
        </div>

        <div className="card" style={{ gridColumn: 1 }}>
          <div className="card__head">
            <h3 style={{ fontSize: 15 }}>Aria conversations</h3>
            <span className="eyebrow">From the career-site chat</span>
          </div>
          <div className="card__body">
            <AriaConversations apps={(c.applications ?? []).map((a) => ({ id: a.id, jobTitle: a.jobTitle }))} />
          </div>
        </div>

        <div className="card" style={{ gridColumn: 2, gridRow: '1 / span 2' }}>
          <div className="card__head">
            <h3 style={{ fontSize: 15 }}>Skills</h3>
            <span className="eyebrow">{c.skills?.length ?? 0} mapped</span>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            {c.skills && c.skills.length > 0 ? (
              c.skills.map((s) => (
                <div
                  key={s.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-0)' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                      {s.proficiency}
                      {s.years ? ` · ${s.years} yrs` : ''}
                    </div>
                  </div>
                  <span className={`badge ${s.inferred ? 'badge--purple' : 'badge--info'}`}>
                    {s.inferred ? 'Inferred' : 'Stated'}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
                No skills mapped yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
