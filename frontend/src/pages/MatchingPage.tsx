import { useState } from 'react'
import { defaultJobId } from '@/lib/jobs'
import { useJobs, useMatch } from '@/api/hooks'
import type { MatchRow } from '@/api/types'

// Eightfold-inspired skills-graph matching. A fit-score ring anchors each row,
// matched skills render as green chips, gaps as amber.

function scoreTone(score: number) {
  if (score >= 80) return { ring: 'var(--c-green)', label: 'Strong fit' }
  if (score >= 60) return { ring: 'var(--c-amber)', label: 'Possible fit' }
  return { ring: 'var(--ink-5)', label: 'Stretch' }
}

function ScoreRing({ score }: { score: number }) {
  const tone = scoreTone(score)
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        background: `conic-gradient(${tone.ring} ${pct * 3.6}deg, var(--app-sunken) 0deg)`,
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: '50%',
          background: 'var(--app-panel)',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 18,
          color: 'var(--ink-0)',
        }}
      >
        {Math.round(score)}
      </div>
    </div>
  )
}

function MatchCard({ row }: { row: MatchRow }) {
  const tone = scoreTone(row.fitScore)
  return (
    <div className="card" style={{ padding: 20, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <div style={{ textAlign: 'center' }}>
        <ScoreRing score={row.fitScore} />
        <div className="eyebrow" style={{ marginTop: 8, fontSize: 9.5, color: tone.ring }}>
          {tone.label}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--ink-0)' }}>
          {row.candidateName}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 2 }}>{row.headline}</div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '12px 0 0', lineHeight: 1.5 }}>{row.explanation}</p>

        {row.matchedSkills.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 7 }}>Matched skills</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {row.matchedSkills.map((s) => (
                <span key={s} className="badge badge--ok">{s}</span>
              ))}
            </div>
          </div>
        )}
        {row.gapSkills.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 7 }}>Skill gaps</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {row.gapSkills.map((s) => (
                <span key={s} className="badge badge--warn">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MatchingPage() {
  const { data: jobs, isLoading: jobsLoading } = useJobs()
  const [jobId, setJobId] = useState<string>('')
  const selectedJob = jobId || defaultJobId(jobs)
  const { data: matches, isLoading: matchesLoading } = useMatch(selectedJob)

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Talent intelligence · Matching
        </div>
        <div className="page-head__row">
          <div>
            <h1>AI Matching</h1>
            <p className="sub">
              Skills-graph matching ranks every candidate against the role on capabilities, not keywords — surfacing
              transferable strengths and explainable gaps.
            </p>
          </div>
          <div className="field" style={{ minWidth: 280 }}>
            <label className="field__label" htmlFor="match-job">Role</label>
            <select
              id="match-job"
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

      {jobsLoading || matchesLoading ? (
        <div className="card">
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>Matching candidates…</div>
        </div>
      ) : !matches || matches.length === 0 ? (
        <div className="card">
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            No ranked candidates for this role yet.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {matches.map((m) => (
            <MatchCard key={m.candidateId} row={m} />
          ))}
        </div>
      )}
    </div>
  )
}
