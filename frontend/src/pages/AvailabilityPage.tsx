import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'

/* Interviewer availability — per-person working window + load caps, recurring
   weekly rules ("no Monday mornings", dedicated interview blocks) and a week
   calendar that reads tentative / busy / vacation / in-office / interviews.
   Rules feed straight into the scheduling engine: proposals never land inside
   a blackout, and when someone has interview blocks, only inside them. */

interface Settings {
  workStart: string
  workEnd: string
  timezone: string
  maxPerDay: number
  maxPerWeek: number
}

interface UserRow {
  id: string
  name: string
  role: string
  title: string | null
  settings: Settings
  ruleCount: number
}

interface Rule {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  kind: 'NO_INTERVIEWS' | 'INTERVIEW_BLOCK'
}

interface Detail {
  userId: string
  name: string
  role: string
  settings: Settings
  rules: Rule[]
}

interface CalEvent {
  id: string
  title: string
  startsAt: string
  endsAt: string
  kind: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Kolkata',
]

const roleLabel = (r: string) =>
  r.replace(/_/g, ' ').toLowerCase().replace(/\b./g, (c) => c.toUpperCase())

/* Week-view geometry: 8:00–18:00, 44px per hour. */
const DAY_START = 8
const DAY_END = 18
const HOUR_PX = 44

/* Calendar-status treatments — muted, no loud fills. */
const EVENT_STYLE: Record<string, React.CSSProperties> = {
  BUSY: { background: '#eceff4', border: '1px solid #d6dbe4', color: 'var(--ink-2)' },
  INTERVIEW: { background: 'var(--bofa-navy, #012169)', border: '1px solid var(--bofa-navy, #012169)', color: '#fff' },
  TENTATIVE: { background: '#fff', border: '1.5px dashed #aab2c0', color: 'var(--ink-3)' },
  VACATION: { background: 'repeating-linear-gradient(-45deg, #f6f0e2, #f6f0e2 5px, #efe6cf 5px, #efe6cf 10px)', border: '1px solid #e2d6b4', color: '#6d5c1e' },
  IN_OFFICE: { background: '#eef4ee', border: '1px solid #d3e2d3', color: '#2e5a34' },
}

const KIND_LABEL: Record<string, string> = {
  BUSY: 'Busy',
  INTERVIEW: 'Interview',
  TENTATIVE: 'Tentative',
  VACATION: 'Vacation',
  IN_OFFICE: 'In office',
}

const mondayOf = (d: Date) => {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7))
  return out
}

const isoDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

interface PlanMember {
  userId: string
  name: string
  role: string
}

interface PlanRound {
  id: string
  roundNo: number
  name: string
  durationMin: number
  members: PlanMember[]
}

interface Requisition {
  jobId: string
  title: string
  department: string | null
  status: string
  recruiterName: string | null
  hiringManagerName: string | null
  roundCount: number
}

/* Interview setup — pick a requisition from the grid, then define its plan
   as VERTICAL STAGES on a timeline spine: Candidate ready, Round 1..N,
   Advance to offer. Each stage carries the interviewers aligned at intake and
   the engine's live read of their calendars. */

interface RoundHealth {
  nextAvailable: string | null
  openSlots: number
  blocked: boolean
}

const initialsOf = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

const nextLabel = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

const totalLabel = (rounds: PlanRound[]) => {
  const min = rounds.reduce((t, r) => t + r.durationMin, 0)
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h ? `${h}h` : ''}${h && m ? ' ' : ''}${m ? `${m}m` : ''} of interviews`
}

const SPINE_W = 46

/* One row of the timeline: spine cell (line + node) beside the content. */
function SpineRow({
  node,
  last = false,
  gap = 14,
  children,
}: {
  node: React.ReactNode
  last?: boolean
  gap?: number
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${SPINE_W}px 1fr` }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {node}
        {!last && <div style={{ width: 1.5, flex: 1, background: '#ccd4e0', minHeight: 14 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : gap, minWidth: 0 }}>{children}</div>
    </div>
  )
}

function StageDot() {
  return (
    <span
      style={{
        width: 11, height: 11, borderRadius: 999, background: 'var(--bofa-navy, #012169)',
        marginTop: 5, flexShrink: 0,
      }}
    />
  )
}

function StageNumber({ n }: { n: number }) {
  return (
    <span
      style={{
        width: 26, height: 26, borderRadius: 999, flexShrink: 0,
        border: '1.5px solid var(--bofa-navy, #012169)', color: 'var(--bofa-navy, #012169)',
        background: '#fff', fontSize: 12.5, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {n}
    </span>
  )
}

function StageCard({
  round,
  health,
  users,
  onRename,
  onDuration,
  onRemove,
  onMembers,
}: {
  round: PlanRound
  health: RoundHealth | undefined
  users: UserRow[]
  onRename: (name: string) => void
  onDuration: (min: number) => void
  onRemove: () => void
  onMembers: (userIds: string[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const hasPeople = round.members.length > 0
  return (
    <div
      style={{
        background: '#fff', border: '1px solid var(--line, #dfe4ec)', borderRadius: 12,
        boxShadow: '0 1px 2px rgba(16,22,38,0.04)', padding: '14px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ fontWeight: 650, fontSize: 14, width: 300 }}
          defaultValue={round.name}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v && v !== round.name) onRename(v)
          }}
        />
        <input
          className="input"
          type="number"
          min={15}
          step={15}
          style={{ width: 68 }}
          defaultValue={round.durationMin}
          onBlur={(e) => {
            const v = Number(e.target.value)
            if (v >= 15 && v !== round.durationMin) onDuration(v)
          }}
        />
        <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>min</span>
        <span style={{ marginLeft: 'auto', fontSize: 12 }}>
          {!hasPeople ? (
            <span style={{ color: 'var(--ink-4)' }}>No interviewers yet</span>
          ) : !health ? (
            <span style={{ color: 'var(--ink-4)' }}>Checking calendars…</span>
          ) : health.blocked ? (
            <span style={{ color: '#a33a3a', fontWeight: 600 }}>● Calendars blocked — no open times</span>
          ) : (
            <span style={{ color: 'var(--ink-3)' }}>
              <span style={{ color: '#2e7d43' }}>●</span> Next open: {health.nextAvailable ? nextLabel(health.nextAvailable) : '—'}
            </span>
          )}
        </span>
        <button className="btn btn--ghost btn--sm" onClick={onRemove} aria-label={`Remove round ${round.roundNo}`}>
          Remove
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {round.members.map((m) => (
          <span
            key={m.userId}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px',
              border: '1px solid var(--line, #e2e7ee)', borderRadius: 999, background: '#fafbfd',
            }}
          >
            <span className="avatar" style={{ width: 24, height: 24, fontSize: 9.5 }}>{initialsOf(m.name)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>{m.name}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{roleLabel(m.role)}</span>
            <button
              onClick={() => onMembers(round.members.filter((x) => x.userId !== m.userId).map((x) => x.userId))}
              style={{ font: 'inherit', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 0, lineHeight: 1 }}
              aria-label={`Remove ${m.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <select
            className="input"
            style={{ width: 230 }}
            autoFocus
            defaultValue=""
            onBlur={() => setAdding(false)}
            onChange={(e) => {
              if (e.target.value) onMembers([...round.members.map((m) => m.userId), e.target.value])
              setAdding(false)
            }}
          >
            <option value="" disabled>Add interviewer…</option>
            {users
              .filter((u) => !round.members.some((m) => m.userId === u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {roleLabel(u.role)}</option>
              ))}
          </select>
        ) : (
          <button className="btn btn--outline btn--sm" onClick={() => setAdding(true)}>+ Interviewer</button>
        )}
      </div>
    </div>
  )
}

function InterviewPlans({ users }: { users: UserRow[] }) {
  const [reqs, setReqs] = useState<Requisition[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [rounds, setRounds] = useState<PlanRound[]>([])
  const [health, setHealth] = useState<Record<string, RoundHealth>>({})

  const loadReqs = useCallback(() => {
    api.get<Requisition[]>('/interview-plan/requisitions').then((r) => setReqs(r.data))
  }, [])
  useEffect(loadReqs, [loadReqs])

  const loadPlan = useCallback(() => {
    if (!openId) return
    api.get<PlanRound[]>('/interview-plan', { params: { jobId: openId } }).then((r) => {
      setRounds(r.data)
      for (const round of r.data) {
        if (round.members.length === 0) continue
        api.get<RoundHealth>(`/interview-plan/rounds/${round.id}/health`)
          .then((h) => setHealth((cur) => ({ ...cur, [round.id]: h.data })))
          .catch(() => {})
      }
    })
  }, [openId])
  useEffect(loadPlan, [loadPlan])

  const refresh = () => {
    loadPlan()
    loadReqs()
  }

  const open = reqs.find((r) => r.jobId === openId) ?? null

  if (open) {
    const total = totalLabel(rounds)
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--outline btn--sm" onClick={() => setOpenId(null)}>‹ Requisitions</button>
          <div style={{ minWidth: 0, marginRight: 'auto' }}>
            <h3 style={{ margin: 0 }}>{open.title} — interview plan</h3>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
              {[`${rounds.length} round${rounds.length === 1 ? '' : 's'}`, total,
                open.recruiterName && `Recruiter ${open.recruiterName}`,
                open.hiringManagerName && `HM ${open.hiringManagerName}`]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
        <div className="card__body" style={{ maxWidth: 860 }}>
          <SpineRow node={<StageDot />}>
            <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--ink-3)', paddingTop: 3 }}>Candidate ready for interviews</div>
          </SpineRow>
          {rounds.map((round) => (
            <SpineRow key={round.id} node={<StageNumber n={round.roundNo} />}>
              <StageCard
                round={round}
                health={health[round.id]}
                users={users}
                onRename={(name) => api.put(`/interview-plan/rounds/${round.id}`, { name }).then(refresh)}
                onDuration={(durationMin) => api.put(`/interview-plan/rounds/${round.id}`, { durationMin }).then(refresh)}
                onRemove={() => api.delete(`/interview-plan/rounds/${round.id}`).then(refresh)}
                onMembers={(userIds) => api.put(`/interview-plan/rounds/${round.id}/members`, { userIds }).then(refresh)}
              />
            </SpineRow>
          ))}
          <SpineRow
            node={
              <span
                style={{
                  width: 26, height: 26, borderRadius: 999, flexShrink: 0,
                  border: '1.5px dashed #aab4c4', color: 'var(--ink-3)', background: '#fff',
                  fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                +
              </span>
            }
          >
            <button
              className="btn btn--outline btn--sm"
              style={{ marginTop: 1 }}
              onClick={() => api.post(`/interview-plan/${open.jobId}/rounds`, {}).then(refresh)}
            >
              Add round
            </button>
          </SpineRow>
          <SpineRow node={<StageDot />} last>
            <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--ink-3)', paddingTop: 3 }}>Advance to offer</div>
          </SpineRow>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: '16px 0 0', maxWidth: 640 }}>
            Each round is scheduled against every listed interviewer's calendar — working windows, weekly preferences,
            vacations and load caps all apply. Blocked rounds notify their interviewers automatically.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card__head"><h3>Interview setup</h3></div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Requisition</th>
              <th>Recruiter</th>
              <th>Hiring manager</th>
              <th className="t-right">Rounds</th>
              <th>Plan</th>
            </tr>
          </thead>
          <tbody>
            {reqs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '30px 18px' }}>
                  No open requisitions.
                </td>
              </tr>
            ) : (
              reqs.map((r) => (
                <tr key={r.jobId} onClick={() => setOpenId(r.jobId)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className="t-strong" style={{ display: 'block' }}>{r.title}</span>
                    <span className="t-muted" style={{ display: 'block', fontSize: 12 }}>{r.department || '—'}</span>
                  </td>
                  <td className="t-muted">{r.recruiterName || '—'}</td>
                  <td className="t-muted">{r.hiringManagerName || '—'}</td>
                  <td className="t-num t-right">{r.roundCount || '—'}</td>
                  <td>
                    {r.roundCount > 0
                      ? <span className="badge badge--ok">Configured</span>
                      : <span className="badge badge--warn">Not set</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AvailabilityPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [events, setEvents] = useState<CalEvent[]>([])
  const [form, setForm] = useState<Settings | null>(null)
  const [savedTick, setSavedTick] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // add-rule row state
  const [ruleDay, setRuleDay] = useState(1)
  const [ruleFrom, setRuleFrom] = useState('09:00')
  const [ruleTo, setRuleTo] = useState('12:00')
  const [ruleKind, setRuleKind] = useState<Rule['kind']>('NO_INTERVIEWS')

  const loadUsers = useCallback(() => {
    api.get<UserRow[]>('/availability/users').then((r) => {
      setUsers(r.data)
      setSelected((cur) => cur ?? r.data[0]?.id ?? null)
    })
  }, [])
  useEffect(loadUsers, [loadUsers])

  const loadDetail = useCallback(() => {
    if (!selected) return
    api.get<Detail>(`/availability/${selected}`).then((r) => {
      setDetail(r.data)
      setForm(r.data.settings)
    })
  }, [selected])
  useEffect(loadDetail, [loadDetail])

  useEffect(() => {
    if (!selected) return
    api
      .get<CalEvent[]>(`/availability/${selected}/calendar`, { params: { weekStart: isoDate(weekStart) } })
      .then((r) => setEvents(r.data))
  }, [selected, weekStart, savedTick])

  const saveSettings = async () => {
    if (!selected || !form) return
    setError(null)
    try {
      await api.put(`/availability/${selected}/settings`, form)
      setSavedTick((t) => t + 1)
      loadUsers()
      loadDetail()
    } catch (e) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not save settings.')
    }
  }

  const addRule = async () => {
    if (!selected) return
    setError(null)
    try {
      await api.post(`/availability/${selected}/rules`, {
        dayOfWeek: ruleDay,
        startTime: ruleFrom,
        endTime: ruleTo,
        kind: ruleKind,
      })
      loadDetail()
      loadUsers()
    } catch (e) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not add rule.')
    }
  }

  const deleteRule = async (id: string) => {
    await api.delete(`/availability/rules/${id}`)
    loadDetail()
    loadUsers()
  }

  const tz = detail?.settings.timezone ?? 'America/New_York'

  /* Events positioned into weekday columns, clamped to the visible band. */
  const positioned = useMemo(() => {
    const cols: { ev: CalEvent; top: number; height: number; label: string }[][] = DAYS.slice(0, 5).map(() => [])
    for (const ev of events) {
      const s = new Date(ev.startsAt)
      const e = new Date(ev.endsAt)
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
      }).formatToParts(s)
      const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
      const col = DAYS.indexOf(weekday)
      if (col < 0 || col > 4) continue
      const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 9)
      const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
      const durMin = Math.max(30, (e.getTime() - s.getTime()) / 60000)
      const startMin = Math.max(hour * 60 + minute, DAY_START * 60)
      const endMin = Math.min(hour * 60 + minute + durMin, DAY_END * 60)
      if (endMin <= DAY_START * 60 || startMin >= DAY_END * 60) continue
      const label = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
      cols[col].push({
        ev,
        top: ((startMin - DAY_START * 60) / 60) * HOUR_PX,
        height: Math.max(20, ((endMin - startMin) / 60) * HOUR_PX - 2),
        label,
      })
    }
    return cols
  }, [events, tz])

  /* Weekly rules painted as background stripes per weekday column. */
  const ruleBands = useMemo(() => {
    const cols: { rule: Rule; top: number; height: number }[][] = DAYS.slice(0, 5).map(() => [])
    for (const r of detail?.rules ?? []) {
      if (r.dayOfWeek > 5) continue
      const start = Math.max(minutesOf(r.startTime), DAY_START * 60)
      const end = Math.min(minutesOf(r.endTime), DAY_END * 60)
      if (end <= start) continue
      cols[r.dayOfWeek - 1].push({
        rule: r,
        top: ((start - DAY_START * 60) / 60) * HOUR_PX,
        height: ((end - start) / 60) * HOUR_PX,
      })
    }
    return cols
  }, [detail])

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 4)
    const f = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${f(weekStart)} – ${f(end)}`
  }, [weekStart])

  const shiftWeek = (dir: number) => {
    setWeekStart((w) => {
      const n = new Date(w)
      n.setDate(n.getDate() + dir * 7)
      return n
    })
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Availability</h1>
          <p className="page__sub">
            Working windows, interviewing preferences and calendars. Rules here shape which times the scheduler offers candidates.
          </p>
        </div>
      </div>

      <InterviewPlans users={users} />

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 16, alignItems: 'start' }}>
        {/* interviewer list */}
        <div className="card">
          <div className="card__head"><h3>Interviewers</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u.id)}
                style={{
                  font: 'inherit', textAlign: 'left', cursor: 'pointer', border: 'none',
                  background: u.id === selected ? '#f0f3f8' : 'transparent',
                  borderLeft: u.id === selected ? '3px solid var(--bofa-navy, #012169)' : '3px solid transparent',
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)' }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>
                  {roleLabel(u.role)}
                  {u.ruleCount > 0 ? ` · ${u.ruleCount} rule${u.ruleCount > 1 ? 's' : ''}` : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        {detail && form && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {error && (
              <div style={{ border: '1px solid #ead9ac', background: '#fdf5e3', color: '#7a5c00', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* settings */}
            <div className="card">
              <div className="card__head">
                <h3>Working window & load</h3>
                <button className="btn btn--primary btn--sm" onClick={saveSettings}>Save</button>
              </div>
              <div className="card__body" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label className="field" style={{ width: 110 }}>
                  <span className="field__label">Work start</span>
                  <input className="input" type="time" value={form.workStart} onChange={(e) => setForm({ ...form, workStart: e.target.value })} />
                </label>
                <label className="field" style={{ width: 110 }}>
                  <span className="field__label">Work end</span>
                  <input className="input" type="time" value={form.workEnd} onChange={(e) => setForm({ ...form, workEnd: e.target.value })} />
                </label>
                <label className="field" style={{ width: 190 }}>
                  <span className="field__label">Timezone</span>
                  <select className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                    {(TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES]).map((z) => (
                      <option key={z} value={z}>{z.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ width: 120 }}>
                  <span className="field__label">Max per day</span>
                  <input className="input" type="number" min={1} value={form.maxPerDay} onChange={(e) => setForm({ ...form, maxPerDay: Number(e.target.value) })} />
                </label>
                <label className="field" style={{ width: 120 }}>
                  <span className="field__label">Max per week</span>
                  <input className="input" type="number" min={1} value={form.maxPerWeek} onChange={(e) => setForm({ ...form, maxPerWeek: Number(e.target.value) })} />
                </label>
              </div>
            </div>

            {/* weekly rules */}
            <div className="card">
              <div className="card__head"><h3>Weekly preferences</h3></div>
              <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.rules.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                    No rules yet — interviews can be booked anywhere inside the working window.
                  </div>
                )}
                {detail.rules.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, padding: '6px 0', borderBottom: '1px solid var(--line, #edf0f4)' }}>
                    <span style={{ width: 40, fontWeight: 600 }}>{DAYS[r.dayOfWeek - 1]}</span>
                    <span style={{ width: 110, color: 'var(--ink-2)' }}>{r.startTime} – {r.endTime}</span>
                    <span className={`badge ${r.kind === 'NO_INTERVIEWS' ? 'badge--danger' : 'badge--ok'}`}>
                      {r.kind === 'NO_INTERVIEWS' ? "Can't interview" : 'Dedicated interview time'}
                    </span>
                    <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={() => deleteRule(r.id)}>
                      Remove
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: 8 }}>
                  <label className="field" style={{ width: 90 }}>
                    <span className="field__label">Day</span>
                    <select className="input" value={ruleDay} onChange={(e) => setRuleDay(Number(e.target.value))}>
                      {DAYS.slice(0, 5).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                    </select>
                  </label>
                  <label className="field" style={{ width: 105 }}>
                    <span className="field__label">From</span>
                    <input className="input" type="time" value={ruleFrom} onChange={(e) => setRuleFrom(e.target.value)} />
                  </label>
                  <label className="field" style={{ width: 105 }}>
                    <span className="field__label">To</span>
                    <input className="input" type="time" value={ruleTo} onChange={(e) => setRuleTo(e.target.value)} />
                  </label>
                  <label className="field" style={{ width: 210 }}>
                    <span className="field__label">Type</span>
                    <select className="input" value={ruleKind} onChange={(e) => setRuleKind(e.target.value as Rule['kind'])}>
                      <option value="NO_INTERVIEWS">Can't interview</option>
                      <option value="INTERVIEW_BLOCK">Dedicated interview time</option>
                    </select>
                  </label>
                  <button className="btn btn--outline btn--sm" onClick={addRule}>Add rule</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                  "Can't interview" blocks that window every week. When someone has dedicated interview time, candidates are only offered slots inside it.
                </div>
              </div>
            </div>

            {/* week calendar */}
            <div className="card">
              <div className="card__head" style={{ display: 'flex', alignItems: 'center' }}>
                <h3>Calendar</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => shiftWeek(-1)}>‹</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', minWidth: 110, textAlign: 'center' }}>{weekLabel}</span>
                  <button className="btn btn--ghost btn--sm" onClick={() => shiftWeek(1)}>›</button>
                </div>
              </div>
              <div className="card__body">
                <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(5, 1fr)', gap: 0 }}>
                  <div />
                  {DAYS.slice(0, 5).map((d, i) => {
                    const day = new Date(weekStart)
                    day.setDate(day.getDate() + i)
                    return (
                      <div key={d} style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 650, color: 'var(--ink-3)', paddingBottom: 6 }}>
                        {d} {day.getDate()}
                      </div>
                    )
                  })}
                  {/* hour gutter */}
                  <div style={{ position: 'relative', height: (DAY_END - DAY_START) * HOUR_PX }}>
                    {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                      <div key={i} style={{ position: 'absolute', top: i * HOUR_PX - 6, right: 8, fontSize: 10.5, color: 'var(--ink-4)' }}>
                        {DAY_START + i}:00
                      </div>
                    ))}
                  </div>
                  {DAYS.slice(0, 5).map((d, col) => (
                    <div key={d} style={{ position: 'relative', height: (DAY_END - DAY_START) * HOUR_PX, borderLeft: '1px solid var(--line, #edf0f4)' }}>
                      {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                        <div key={i} style={{ position: 'absolute', top: i * HOUR_PX, left: 0, right: 0, borderTop: '1px solid #f2f4f8' }} />
                      ))}
                      {/* rule bands under events */}
                      {ruleBands[col].map(({ rule, top, height }) => (
                        <div
                          key={rule.id}
                          title={rule.kind === 'NO_INTERVIEWS' ? "Can't interview (weekly)" : 'Dedicated interview time (weekly)'}
                          style={{
                            position: 'absolute', top, height, left: 1, right: 1, borderRadius: 4,
                            ...(rule.kind === 'NO_INTERVIEWS'
                              ? { background: 'repeating-linear-gradient(-45deg, rgba(184,74,74,0.07), rgba(184,74,74,0.07) 5px, rgba(184,74,74,0.13) 5px, rgba(184,74,74,0.13) 10px)' }
                              : { background: 'rgba(58,124,74,0.07)', border: '1px dashed rgba(58,124,74,0.45)' }),
                          }}
                        />
                      ))}
                      {positioned[col].map(({ ev, top, height, label }) => (
                        <div
                          key={ev.id}
                          title={`${KIND_LABEL[ev.kind] ?? ev.kind} · ${ev.title}`}
                          style={{
                            position: 'absolute', top, height, left: 3, right: 3, borderRadius: 6,
                            padding: '3px 7px', fontSize: 11, lineHeight: 1.25, overflow: 'hidden',
                            ...(EVENT_STYLE[ev.kind] ?? EVENT_STYLE.BUSY),
                          }}
                        >
                          <div style={{ fontWeight: 650, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{ev.title}</div>
                          {height > 34 && <div style={{ opacity: 0.75 }}>{label}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {/* legend */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, fontSize: 12, color: 'var(--ink-3)' }}>
                  {(['INTERVIEW', 'BUSY', 'TENTATIVE', 'VACATION', 'IN_OFFICE'] as const).map((k) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, display: 'inline-block', ...(EVENT_STYLE[k]) }} />
                      {KIND_LABEL[k]}
                    </span>
                  ))}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, display: 'inline-block', background: 'repeating-linear-gradient(-45deg, rgba(184,74,74,0.07), rgba(184,74,74,0.07) 3px, rgba(184,74,74,0.16) 3px, rgba(184,74,74,0.16) 6px)' }} />
                    Can't interview
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, display: 'inline-block', background: 'rgba(58,124,74,0.07)', border: '1px dashed rgba(58,124,74,0.45)' }} />
                    Dedicated interview time
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8 }}>
                  Times shown in {tz.replace('_', ' ')}. Tentative and in-office entries don't block scheduling; busy, vacation and interviews do.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
