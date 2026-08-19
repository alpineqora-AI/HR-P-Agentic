import { useEffect, useMemo, useState } from 'react'
import { defaultJobId } from '@/lib/jobs'
import { Link, useSearchParams } from 'react-router-dom'
import SlideOver from '../components/SlideOver'
import ConfirmButton from '../components/ConfirmButton'
import { useStore } from '@/state/store'
import {
  useAllPipelines,
  useApplicationConversation,
  useCandidate,
  useCreateInterview,
  useJobs,
  usePipeline,
  useScheduleInterview,
  useSlots,
  useUpdateApplicationStage,
} from '../api/hooks'
import type { ApplicationRow, JobSummary } from '../api/types'
import { date, initials } from '../lib/format'
import { api } from '@/api/client'
import { stageHue } from '@/lib/stages'

// Terminal stages folded into the collapsible "Closed" lane so the active board
// fits the viewport without horizontal scrolling.
const CLOSED_STAGES = new Set(['REJECTED', 'WITHDRAWN'])

// Per-row hue palette for the all-jobs matrix (count chips tinted by job).
const ROW_HUES = [
  { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#EEEDFE', fg: '#534AB7' },
  { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#FBEAF0', fg: '#993556' },
  { bg: '#FAECE7', fg: '#993C1D' },
  { bg: '#EAF3DE', fg: '#3B6D11' },
]

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

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

function CandidateCard({ app, tag, onSelect }: { app: ApplicationRow; tag?: string; onSelect: (app: ApplicationRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(app)}
      className="card"
      style={{
        padding: '10px 12px',
        display: 'block',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: '1px solid var(--line)',
        background: 'var(--app-panel)',
        font: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-0)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {app.candidateName}
        </span>
        <span className={`badge ${fitClass(app.fitScore)}`}>{Math.round(app.fitScore)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>{app.source}</span>
        {tag && <span className="badge">{tag}</span>}
        {app.knockoutPassed ? null : <span className="badge badge--danger">Knockout</span>}
      </div>
    </button>
  )
}

function StageStepper({ stages, current }: { stages: string[]; current: string }) {
  const idx = stages.indexOf(current)
  return (
    <div>
      <div style={{ display: 'flex', gap: 5 }}>
        {stages.map((s, i) => (
          <span
            key={s}
            title={titleCase(s)}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              // Completed segments wear their own stage color — the same hue
              // language as the board columns.
              background: idx >= 0 && i <= idx ? stageHue(s).fg : 'var(--app-sunken)',
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 6 }}>
        {idx >= 0 ? `Stage ${idx + 1} of ${stages.length} · ${titleCase(current)}` : titleCase(current)}
      </div>
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

/* Candidate self-scheduling from the drawer. When the requisition has an
   interview plan (defined at intake on the Availability screen), the recruiter
   picks the round — its lineup and length drive the proposed times. */
function SelfScheduleLink({ applicationId, jobId }: { applicationId: string; jobId: string }) {
  const { toastMsg } = useStore()
  const [busy, setBusy] = useState(false)
  const [rounds, setRounds] = useState<{ id: string; roundNo: number; name: string; members: { name: string }[] }[]>([])
  const [roundId, setRoundId] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ id: string; roundNo: number; name: string; members: { name: string }[] }[]>('/interview-plan', { params: { jobId } })
      .then((r) => {
        setRounds(r.data)
        setRoundId((cur) => cur ?? r.data[0]?.id ?? null)
      })
      .catch(() => setRounds([]))
  }, [jobId])

  const selected = rounds.find((r) => r.id === roundId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rounds.length > 0 && (
        <select className="input" value={roundId ?? ''} onChange={(e) => setRoundId(e.target.value)} style={{ fontSize: 13 }}>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              Round {r.roundNo} — {r.name}
            </option>
          ))}
        </select>
      )}
      {selected && selected.members.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
          With {selected.members.map((m) => m.name).join(', ')}
        </div>
      )}
      <button
        className="btn btn--outline btn--sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const r = await api.post<{ id: string }>('/interviews/self-schedule', {
              applicationId,
              ...(roundId ? { roundId } : {}),
            })
            const url = `${window.location.origin}/schedule/${r.data.id}`
            await navigator.clipboard.writeText(url)
            toastMsg('Self-schedule link copied — send it to the candidate')
          } catch {
            toastMsg('Could not create the self-schedule link')
          } finally {
            setBusy(false)
          }
        }}
      >
        Copy self-schedule link
      </button>
    </div>
  )
}

function ScheduleInterview({ applicationId, jobId }: { applicationId: string; jobId: string }) {
  const [open, setOpen] = useState(false)
  const { data: slots } = useSlots(open ? jobId : undefined)
  const create = useCreateInterview()
  const schedule = useScheduleInterview()
  const [booked, setBooked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const free = (slots ?? []).filter((s) => !s.booked)

  function book(slotId: string, label: string) {
    if (busy) return
    setBusy(true)
    create.mutate(
      { applicationId, type: 'PHONE_SCREEN', durationMin: 30 },
      {
        onSuccess: (iv) =>
          schedule.mutate(
            { id: iv.id, slotId },
            { onSuccess: () => { setBooked(label); setBusy(false) }, onError: () => setBusy(false) },
          ),
        onError: () => setBusy(false),
      },
    )
  }

  return (
    <div style={{ marginTop: 18 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'var(--bofa-navy)', fontSize: 13, fontWeight: 600 }}
      >
        <span style={{ fontSize: 11 }}>{open ? '▾' : '▸'}</span>
        Schedule interview
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {booked ? (
            <div style={{ fontSize: 12.5, color: 'var(--ok-fg)' }}>Booked for {booked} ✓</div>
          ) : free.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>No open interview slots for this job.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {free.map((s) => {
                const label = `${date(s.startsAt)} · ${new Date(s.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                return (
                  <button
                    key={s.id}
                    className="btn btn--outline btn--sm"
                    disabled={busy}
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => book(s.id, label)}
                  >
                    {label}{s.interviewerName ? ` · ${s.interviewerName}` : ''}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Recruiter view of the candidate's Aria chat (collapsed until opened).
function AriaTranscript({ applicationId }: { applicationId: string }) {
  // Load eagerly so the toggle can advertise that a transcript exists.
  const { data: convo, isLoading } = useApplicationConversation(applicationId, true)
  const msgCount = convo?.messages?.length ?? 0
  const [userToggled, setUserToggled] = useState<boolean | null>(null)
  // Auto-expand when a conversation exists; the user's own toggle wins.
  const open = userToggled ?? msgCount > 0

  return (
    <div style={{ marginTop: 18 }}>
      <button
        onClick={() => setUserToggled(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'var(--bofa-navy)', fontSize: 13, fontWeight: 600 }}
      >
        <span style={{ fontSize: 11 }}>{open ? '▾' : '▸'}</span>
        Aria chat transcript
        {msgCount > 0 && <span className="badge badge--info">{msgCount} messages</span>}
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {isLoading ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Loading transcript…</div>
          ) : !convo || !convo.messages || convo.messages.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>No Aria conversation for this candidate.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 280, overflowY: 'auto', padding: '2px 2px 2px 0' }}>
              {convo.messages.map((m) => {
                const me = m.sender === 'CANDIDATE'
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: me ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      padding: '7px 10px',
                      borderRadius: 10,
                      background: me ? 'var(--bofa-navy)' : 'var(--app-sunken)',
                      color: me ? '#fff' : 'var(--ink-1)',
                    }}
                  >
                    {m.body}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CandidateDrawer({
  app,
  stages,
  onClose,
}: {
  app: ApplicationRow
  stages: string[]
  onClose: () => void
}) {
  const { data: c, isLoading } = useCandidate(app.candidateId)
  const advance = useUpdateApplicationStage()
  const { toastMsg } = useStore()
  const [stage, setStage] = useState(app.stage)

  useEffect(() => setStage(app.stage), [app.id, app.stage])

  const idx = stages.indexOf(stage)
  const nextStage = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null

  function move(to: string) {
    advance.mutate(
      { id: app.id, stage: to },
      {
        onSuccess: (row) => {
          setStage(row.stage)
          toastMsg(
            to === 'REJECTED'
              ? `${app.candidateName} rejected`
              : `${app.candidateName} advanced to ${titleCase(row.stage)}`,
          )
        },
      },
    )
  }

  return (
    <SlideOver label={`${app.candidateName} details`} onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="avatar" style={{ width: 46, height: 46, fontSize: 16 }}>
            {initials(app.candidateName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)', lineHeight: 1.2 }}>
              {app.candidateName}
            </div>
            <div className="sub" style={{ marginTop: 3, fontSize: 12.5 }}>
              {c?.headline || app.jobTitle}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
              <span className={`badge ${fitClass(app.fitScore)}`}>Fit {Math.round(app.fitScore)}</span>
              <span className={`badge ${stageClass(stage)}`}>{titleCase(stage)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--ink-4)', padding: 2 }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <StageStepper stages={stages} current={stage} />

          <div style={{ marginTop: 18 }}>
            <Fact label="Source">{app.source}</Fact>
            <Fact label="Screening">
              {app.knockoutPassed ? (
                <span style={{ color: 'var(--ok-ink, #1f7a4d)' }}>Passed knockout</span>
              ) : (
                <span className="badge badge--danger">Knockout failed</span>
              )}
            </Fact>
            {isLoading ? (
              <Fact label="Profile">Loading…</Fact>
            ) : c ? (
              <>
                {c.location ? <Fact label="Location">{c.location}</Fact> : null}
                {c.yearsExperience ? <Fact label="Experience">{c.yearsExperience} yrs</Fact> : null}
                {c.email ? (
                  <Fact label="Email">
                    <a className="link" href={`mailto:${c.email}`}>{c.email}</a>
                  </Fact>
                ) : null}
                {c.phone ? <Fact label="Phone">{c.phone}</Fact> : null}
              </>
            ) : null}
            <Fact label="Applied">{date(app.appliedAt)}</Fact>
          </div>

          {c && c.skills && c.skills.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {c.skills.map((s) => (
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

          <div style={{ marginTop: 18, background: 'var(--app-sunken)', borderRadius: 'var(--ra-2)', padding: '12px 14px' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Why this fit</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
              Fit {Math.round(app.fitScore)} from the matching engine — based on skills and experience
              against {app.jobTitle}. Open the full profile for the scored breakdown.
            </div>
          </div>

          <ScheduleInterview applicationId={app.id} jobId={app.jobId} />
          <div style={{ marginTop: 10 }}>
            <SelfScheduleLink applicationId={app.id} jobId={app.jobId} />
          </div>
          <AriaTranscript applicationId={app.id} />
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
          {nextStage ? (
            <button className="btn btn--primary btn--sm" style={{ flex: 1 }} disabled={advance.isPending} onClick={() => move(nextStage)}>
              {advance.isPending ? 'Saving…' : `Advance to ${titleCase(nextStage)}`}
            </button>
          ) : (
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-4)', alignSelf: 'center' }}>Final stage.</span>
          )}
          <Link to={`/candidates/${app.candidateId}`} className="btn btn--outline btn--sm">
            Full profile
          </Link>
          {!CLOSED_STAGES.has(stage) && (
            <ConfirmButton label="Reject" confirmLabel="Confirm reject?" onConfirm={() => move('REJECTED')} />
          )}
        </div>
    </SlideOver>
  )
}

const MATRIX_STAGES = ['APPLIED', 'SCREENED', 'MATCHED', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED']

function PipelineMatrix({ jobs, onPick }: { jobs: JobSummary[]; onPick: (jobId: string) => void }) {
  const jobIds = useMemo(() => jobs.map((j) => j.id), [jobs])
  const { byJob, isLoading } = useAllPipelines(jobIds)

  // Only show stage columns that some job actually has candidates in.
  const stages = useMemo(() => {
    const present = new Set<string>()
    Object.values(byJob).forEach((cols) => cols.forEach((c) => present.add(c.stage)))
    return MATRIX_STAGES.filter((s) => present.has(s))
  }, [byJob])

  const cols = stages.length ? stages : MATRIX_STAGES
  const gridCols = `minmax(180px, 1.4fr) repeat(${cols.length}, minmax(0, 1fr))`

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 720 }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: '1px solid var(--line)', padding: '0 4px' }}>
            <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--ink-4)' }}>JOB</div>
            {cols.map((s) => (
              <div key={s} style={{ padding: '10px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--ink-4)', textAlign: 'center' }}>
                {s}
              </div>
            ))}
          </div>

          {jobs.map((job, i) => {
            const counts = new Map((byJob[job.id] ?? []).map((c) => [c.stage, c.count]))
            const total = (byJob[job.id] ?? []).reduce((n, c) => n + c.count, 0)
            const hue = ROW_HUES[i % ROW_HUES.length]
            return (
              <button
                key={job.id}
                onClick={() => onPick(job.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 0,
                  borderBottom: '1px solid var(--line)',
                  cursor: 'pointer',
                  padding: '0 4px',
                  font: 'inherit',
                }}
              >
                <div style={{ padding: '10px 12px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 1 }}>
                    {isLoading ? 'Loading…' : `${total} in pipeline`}
                  </div>
                </div>
                {cols.map((s) => {
                  const n = counts.get(s) ?? 0
                  return (
                    <div key={s} style={{ padding: '7px 6px', display: 'flex', justifyContent: 'center' }}>
                      {n > 0 ? (
                        <span
                          className="t-num"
                          style={{
                            minWidth: 34,
                            textAlign: 'center',
                            fontSize: 13,
                            fontWeight: 600,
                            padding: '5px 8px',
                            borderRadius: 'var(--ra-1)',
                            background: hue.bg,
                            color: hue.fg,
                          }}
                        >
                          {n}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-5)', fontSize: 13 }}>—</span>
                      )}
                    </div>
                  )
                })}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const { data: jobs, isLoading: jobsLoading } = useJobs()
  const [params, setParams] = useSearchParams()
  const jobId = params.get('job') ?? undefined
  // Keep the selected requisition in the URL so pipeline views are shareable.
  const setJobId = (id: string | undefined) =>
    setParams(id ? { job: id } : {}, { replace: true })
  const [closedOpen, setClosedOpen] = useState(false)
  const [selected, setSelected] = useState<ApplicationRow | null>(null)
  const [mode, setMode] = useState<'board' | 'matrix'>('board')

  useEffect(() => {
    if (jobId || !jobs || jobs.length === 0) return
    setJobId(defaultJobId(jobs))
  }, [jobs, jobId])

  // Close the drawer when the requisition changes.
  useEffect(() => setSelected(null), [jobId])

  const { data: columns, isLoading, isError, refetch } = usePipeline(jobId)
  const selectedJob = jobs?.find((j) => j.id === jobId)

  const stageCols = columns ?? []
  const activeCols = stageCols.filter((c) => !CLOSED_STAGES.has(c.stage))
  const closedCols = stageCols.filter((c) => CLOSED_STAGES.has(c.stage))
  const closedCount = closedCols.reduce((n, c) => n + c.count, 0)
  const closedCards = closedCols.flatMap((c) =>
    c.cards.map((card) => ({ card, tag: titleCase(c.stage) })),
  )
  const stepStages = activeCols.map((c) => c.stage)

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div className="crumb">
          <span className="dot" />
          Recruiting · Pipeline
        </div>
        <div className="page-head__row">
          <div>
            <h1 style={{ fontSize: 28 }}>Pipeline</h1>
            <p className="sub">
              {mode === 'board'
                ? 'Candidates by stage for the selected requisition.'
                : 'Every requisition’s funnel at a glance. Click a job to open its board.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="segmented" role="group" aria-label="View">
              <button aria-pressed={mode === 'board'} onClick={() => setMode('board')}>Board</button>
              <button aria-pressed={mode === 'matrix'} onClick={() => setMode('matrix')}>All jobs</button>
            </div>
            {mode === 'board' && (
              <div className="field" style={{ minWidth: 280 }}>
                <select
                  className="select"
                  value={jobId ?? ''}
                  onChange={(e) => setJobId(e.target.value || undefined)}
                  disabled={jobsLoading || !jobs || jobs.length === 0}
                >
                  {jobsLoading ? (
                    <option>Loading jobs…</option>
                  ) : !jobs || jobs.length === 0 ? (
                    <option>No jobs</option>
                  ) : (
                    jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} · {j.department}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === 'matrix' ? (
        !jobs || jobs.length === 0 ? (
          <div className="card">
            <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
              {jobsLoading ? 'Loading…' : 'No jobs to show.'}
            </div>
          </div>
        ) : (
          <PipelineMatrix
            jobs={jobs}
            onPick={(id) => {
              setJobId(id)
              setMode('board')
            }}
          />
        )
      ) : !jobId ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            {jobsLoading ? 'Loading…' : 'Select a job to view its pipeline.'}
          </div>
        </div>
      ) : isLoading ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            Loading pipeline…
          </div>
        </div>
      ) : isError ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-0)' }}>
              Couldn’t load the pipeline.
            </div>
            <button className="btn btn--outline btn--sm" style={{ marginTop: 14 }} onClick={() => refetch()}>
              Retry
            </button>
          </div>
        </div>
      ) : !columns || columns.length === 0 || stageCols.every((c) => c.count === 0) ? (
        <div className="card">
          <div className="card__body" style={{ padding: '52px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)' }}>
              No candidates in this pipeline yet
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>
              {selectedJob ? `${selectedJob.title} has no active applications.` : 'This requisition has no active applications.'}
              {' '}Try AI Matching to surface people already in your database.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <Link className="btn btn--primary btn--sm" to="/matching">View AI matches</Link>
              <button className="btn btn--outline btn--sm" onClick={() => setMode('matrix')}>See all pipelines</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Active stages as a board that fills the width (no horizontal scroll). */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${activeCols.length}, minmax(0, 1fr))`,
              gap: 12,
              alignItems: 'start',
            }}
          >
            {activeCols.map((col) => {
              const hue = stageHue(col.stage)
              return (
              <div
                key={col.stage}
                style={{ background: 'var(--app-sunken)', borderRadius: 'var(--ra-3)', padding: 10, minWidth: 0, borderTop: `3px solid ${hue.fg}` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '2px 4px 10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--ink-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: hue.fg, flexShrink: 0 }} />
                    {col.stage}
                  </span>
                  <span
                    className="t-num"
                    style={{ fontSize: 11.5, fontWeight: 600, color: hue.fg, background: hue.bg, borderRadius: 999, padding: '1px 8px' }}
                  >
                    {col.count}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.cards.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', padding: '14px 0' }}>—</div>
                  ) : (
                    col.cards.map((app) => <CandidateCard key={app.id} app={app} onSelect={setSelected} />)
                  )}
                </div>
              </div>
              )
            })}
          </div>

          {/* Collapsible "Closed" lane — terminal stages folded away by default. */}
          <div className="card" style={{ marginTop: 16 }}>
            <button
              onClick={() => setClosedOpen((o) => !o)}
              aria-expanded={closedOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                background: 'none',
                border: 0,
                cursor: 'pointer',
                padding: '12px 14px',
                color: 'var(--ink-1)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--ink-4)', width: 12 }}>{closedOpen ? '▾' : '▸'}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Closed</span>
              <span className="badge" style={{ marginLeft: 2 }}>{closedCount}</span>
              <span className="sub" style={{ margin: 0, marginLeft: 'auto', fontSize: 12 }}>Rejected · Withdrawn</span>
            </button>
            {closedOpen && (
              closedCards.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--ink-5)', padding: '0 14px 14px' }}>No closed candidates.</div>
              ) : (
                /* Closed records read better as a table — they're history, not work in flight. */
                <table className="data-table" style={{ borderTop: '1px solid var(--line)' }}>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Role</th>
                      <th>Outcome</th>
                      <th className="t-right">Fit</th>
                      <th>Applied</th>
                      <th>Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedCards.map(({ card, tag }) => (
                      <tr key={card.id} onClick={() => setSelected(card)} style={{ cursor: 'pointer' }}>
                        <td>
                          <span className="who">
                            <span className="avatar" style={{ width: 28, height: 28, fontSize: 10.5 }}>{initials(card.candidateName)}</span>
                            <span className="t-strong">{card.candidateName}</span>
                          </span>
                        </td>
                        <td className="t-muted">{card.jobTitle}</td>
                        <td>
                          <span className={`badge ${tag === 'Rejected' ? 'badge--danger' : 'badge--purple'}`}>{tag}</span>
                        </td>
                        <td className="t-num t-right">{card.fitScore}</td>
                        <td className="t-muted">{date(card.appliedAt)}</td>
                        <td className="t-muted">{date(card.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </>
      )}

      {selected && (
        <CandidateDrawer app={selected} stages={stepStages} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
