import { useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import { Link } from 'react-router-dom'
import SlideOver from '../components/SlideOver'
import { useCreateJob, useJobs } from '../api/hooks'
import { humanize, money } from '../lib/format'
import type { JobCreate, JobSummary } from '../api/types'

const WORK_MODES = ['On-site', 'Hybrid', 'Remote']
const EMP_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship']
const JOB_STATUSES = ['OPEN', 'DRAFT', 'PAUSED']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  )
}

function NewJobForm({ onClose }: { onClose: () => void }) {
  const create = useCreateJob()
  const { toastMsg } = useStore()
  const [f, setF] = useState<JobCreate>({
    title: '',
    department: '',
    location: '',
    workMode: 'On-site',
    employmentType: 'Full-time',
    family: '',
    status: 'OPEN',
    openings: 1,
  })
  const set = (patch: Partial<JobCreate>) => setF((p) => ({ ...p, ...patch }))
  const valid = f.title.trim() && f.department.trim() && f.location.trim()

  function submit() {
    const payload: JobCreate = {
      ...f,
      title: f.title.trim(),
      department: f.department.trim(),
      location: f.location.trim(),
      family: f.family.trim() || f.department.trim(),
    }
    create.mutate(payload, { onSuccess: (j) => { toastMsg(`Job "${j.title}" created`); onClose() } })
  }

  return (
    <SlideOver label="New job" onClose={onClose} width={460}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)' }}>New job</div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Job title"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Software Engineer" /></Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><Field label="Department"><input className="input" value={f.department} onChange={(e) => set({ department: e.target.value })} placeholder="Global Technology" /></Field></div>
          <div style={{ flex: 1 }}><Field label="Family"><input className="input" value={f.family} onChange={(e) => set({ family: e.target.value })} placeholder="Engineering" /></Field></div>
        </div>
        <Field label="Location"><input className="input" value={f.location} onChange={(e) => set({ location: e.target.value })} placeholder="Charlotte, NC" /></Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><Field label="Work mode"><select className="select" value={f.workMode} onChange={(e) => set({ workMode: e.target.value })}>{WORK_MODES.map((w) => <option key={w}>{w}</option>)}</select></Field></div>
          <div style={{ flex: 1 }}><Field label="Type"><select className="select" value={f.employmentType} onChange={(e) => set({ employmentType: e.target.value })}>{EMP_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field></div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><Field label="Status"><select className="select" value={f.status} onChange={(e) => set({ status: e.target.value })}>{JOB_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field></div>
          <div style={{ flex: 1 }}><Field label="Openings"><input className="input" type="number" min={1} value={f.openings} onChange={(e) => set({ openings: Number(e.target.value) })} /></Field></div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><Field label="Pay min"><input className="input" type="number" value={f.payMin ?? ''} onChange={(e) => set({ payMin: e.target.value ? Number(e.target.value) : undefined })} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Pay max"><input className="input" type="number" value={f.payMax ?? ''} onChange={(e) => set({ payMax: e.target.value ? Number(e.target.value) : undefined })} /></Field></div>
          <div style={{ width: 100 }}><Field label="Period"><select className="select" value={f.payPeriod ?? 'year'} onChange={(e) => set({ payPeriod: e.target.value })}><option value="year">year</option><option value="hour">hour</option></select></Field></div>
        </div>
        <Field label="Summary"><textarea className="input" rows={3} value={f.summary ?? ''} onChange={(e) => set({ summary: e.target.value })} placeholder="One-line role summary…" style={{ resize: 'vertical', fontFamily: 'inherit' }} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" disabled={!valid || create.isPending} onClick={submit}>
          {create.isPending ? 'Creating…' : 'Create job'}
        </button>
      </div>
    </SlideOver>
  )
}

function statusBadgeClass(status: string) {
  const s = status.toLowerCase()
  if (s === 'open' || s === 'active' || s === 'published') return 'badge--ok'
  if (s === 'draft') return 'badge--warn'
  if (s === 'closed' || s === 'filled' || s === 'archived') return 'badge--neutral'
  if (s === 'on hold' || s === 'paused') return 'badge--info'
  return 'badge--neutral'
}

function payRange(j: JobSummary) {
  if (!j.payMin && !j.payMax) return '—'
  const per = j.payPeriod ? ` / ${j.payPeriod.toLowerCase()}` : ''
  return `${money(j.payMin)}–${money(j.payMax)}${per}`
}

const isOpenStatus = (s: string) => ['open', 'active', 'published'].includes(s.toLowerCase())

function StatTile({ label, value, meta }: { label: string; value: string | number; meta?: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {meta ? <div className="stat__meta">{meta}</div> : null}
    </div>
  )
}

export default function JobsPage() {
  const { data, isLoading, isError, refetch } = useJobs()
  const [filter, setFilter] = useState('')
  const [creating, setCreating] = useState(false)

  const kpis = useMemo(() => {
    const list = data ?? []
    const open = list.filter((j) => isOpenStatus(j.status)).length
    const openings = list.reduce((n, j) => n + (j.openings || 0), 0)
    const applicants = list.reduce((n, j) => n + (j.applicants || 0), 0)
    return { open, openings, applicants, avg: list.length ? Math.round(applicants / list.length) : 0 }
  }, [data])

  const rows = useMemo(() => {
    if (!data) return []
    const q = filter.trim().toLowerCase()
    if (!q) return data
    return data.filter((j) =>
      [j.title, j.department, j.location, j.family, j.status].some((v) => v?.toLowerCase().includes(q)),
    )
  }, [data, filter])

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div className="crumb">
          <span className="dot" />
          Recruiting · Jobs
        </div>
        <div className="page-head__row">
          <div>
            <h1 style={{ fontSize: 28 }}>Jobs</h1>
            <p className="sub">Open requisitions across the organization.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="input-group" style={{ width: 240 }}>
              <input
                className="input"
                placeholder="Filter by title, team, location…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <button className="btn btn--primary" onClick={() => setCreating(true)}>New job</button>
          </div>
        </div>
      </div>

      {creating && <NewJobForm onClose={() => setCreating(false)} />}

      {data && data.length > 0 ? (
        <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
          <StatTile label="Open requisitions" value={kpis.open} meta={`of ${data.length} total`} />
          <StatTile label="Total openings" value={kpis.openings} meta="Seats to fill" />
          <StatTile label="Total applicants" value={kpis.applicants.toLocaleString()} />
          <StatTile label="Avg applicants / req" value={kpis.avg} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            Loading jobs…
          </div>
        </div>
      ) : isError ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-0)' }}>
              Couldn’t load jobs.
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '6px 0 16px' }}>
              The API didn’t respond. Check that the backend is running.
            </div>
            <button className="btn btn--outline btn--sm" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            No jobs posted yet.
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
            No jobs match “{filter}”.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Location</th>
                <th>Family</th>
                <th>Status</th>
                <th className="t-right">Openings</th>
                <th className="t-right">Applicants</th>
                <th className="t-right">Pay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link to={`/jobs/${j.id}`} style={{ textDecoration: 'none' }}>
                      <div className="who__name" style={{ color: 'var(--bofa-navy)' }}>
                        {j.title}
                      </div>
                    </Link>
                    <div className="who__sub" style={{ marginTop: 2 }}>
                      {j.department}
                    </div>
                  </td>
                  <td className="t-muted">{j.location}</td>
                  <td className="t-muted">{humanize(j.family)}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(j.status)}`}>{j.status}</span>
                  </td>
                  <td className="t-right t-num">{j.openings}</td>
                  <td className="t-right t-num">{j.applicants}</td>
                  <td className="t-right t-num">{payRange(j)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
