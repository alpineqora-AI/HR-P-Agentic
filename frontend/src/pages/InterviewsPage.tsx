import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { defaultJobId } from '@/lib/jobs'
import SlideOver from '@/components/SlideOver'
import { useApplications, useJobInterviews, useJobs, useSlots } from '@/api/hooks'
import { date } from '@/lib/format'
import type { Interview, Slot } from '@/api/types'

const statusBadge = (status: string) => {
  const s = status.toUpperCase()
  if (s === 'COMPLETED' || s === 'DONE') return 'badge--ok'
  if (s === 'SCHEDULED' || s === 'CONFIRMED') return 'badge--info'
  if (s === 'CANCELLED' || s === 'NO_SHOW') return 'badge--danger'
  if (s === 'PENDING' || s === 'REQUESTED') return 'badge--warn'
  return ''
}

const recBadge = (rec: string) => {
  const r = rec.toUpperCase()
  if (r.includes('STRONG_YES') || r === 'HIRE' || r === 'YES') return 'badge--ok'
  if (r.includes('NO')) return 'badge--danger'
  if (r.includes('LEAN') || r === 'MAYBE') return 'badge--warn'
  return ''
}

const time = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function Empty({ label }: { label: string }) {
  return (
    <div className="card">
      <div className="card__body" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
        {label}
      </div>
    </div>
  )
}

// ── Calendar primitives ───────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const HOUR_PX = 46

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = (x.getDay() + 6) % 7 // Monday = 0
  x.setDate(x.getDate() - dow)
  return x
}

type Scale = 'day' | 'week' | 'month'

type CalEvent = {
  id: string
  kind: 'interview' | 'open' | 'booked'
  label: string
  sub: string
  start: Date
  end: Date
  typeKey?: string
  interview?: Interview
  slot?: Slot
}

type Hue = { bg: string; fg: string }

// Interview-type color palette (tinted fills, dark text — same family as the pipeline matrix).
const TYPE_HUES: Hue[] = [
  { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#EEEDFE', fg: '#26215C' },
  { bg: '#FAEEDA', fg: '#633806' },
  { bg: '#FBEAF0', fg: '#4B1528' },
  { bg: '#E1F5EE', fg: '#04342C' },
  { bg: '#FAECE7', fg: '#4A1B0C' },
]
const OPEN_HUE: Hue = { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' }
const BOOKED_HUE: Hue = { bg: 'var(--app-sunken)', fg: 'var(--ink-4)' }

function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}

// Greedy lane assignment so overlapping events sit side by side within a day.
function withLanes(events: CalEvent[]) {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())
  const laneEnds: number[] = []
  const placed = sorted.map((ev) => {
    let lane = laneEnds.findIndex((end) => end <= ev.start.getTime())
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(ev.end.getTime())
    } else {
      laneEnds[lane] = ev.end.getTime()
    }
    return { ev, lane }
  })
  return { placed, laneCount: Math.max(1, laneEnds.length) }
}

function TimeGrid({
  days,
  events,
  hueOf,
  onSelect,
}: {
  days: Date[]
  events: CalEvent[]
  hueOf: (ev: CalEvent) => Hue
  onSelect: (ev: CalEvent) => void
}) {
  const inRange = events.filter((e) => days.some((d) => d.toDateString() === e.start.toDateString()))
  let startHour = 8
  let endHour = 18
  if (inRange.length) {
    const minH = Math.min(...inRange.map((e) => e.start.getHours()))
    const maxH = Math.max(...inRange.map((e) => e.end.getHours() + (e.end.getMinutes() > 0 ? 1 : 0)))
    startHour = Math.max(0, Math.min(startHour, minH))
    endHour = Math.min(24, Math.max(endHour, maxH))
  }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const gridHeight = hours.length * HOUR_PX
  const todayKey = new Date().toDateString()
  const cols = `52px repeat(${days.length}, 1fr)`

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: days.length > 1 ? 720 : 420 }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--line)' }}>
          <div />
          {days.map((d) => {
            const isToday = d.toDateString() === todayKey
            return (
              <div key={d.toISOString()} style={{ padding: '8px 6px', textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="t-num" style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--bofa-navy)' : 'var(--ink-1)', marginTop: 2 }}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: cols, position: 'relative' }}>
          {inRange.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}>
              <div style={{ background: 'var(--app-panel)', border: '1px solid var(--line)', borderRadius: 'var(--ra-2)', padding: '10px 18px', fontSize: 13, color: 'var(--ink-4)', boxShadow: 'var(--shadow-2)' }}>
                Nothing scheduled in this range — try another week or pick a different role.
              </div>
            </div>
          )}
          <div style={{ position: 'relative', height: gridHeight }}>
            {hours.map((h, i) => (
              <div key={h} style={{ position: 'absolute', top: i * HOUR_PX - 6, right: 6, fontSize: 11, color: 'var(--ink-5)' }}>
                {h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'a' : 'p'}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dayEvents = events.filter((e) => e.start.toDateString() === d.toDateString())
            const { placed, laneCount } = withLanes(dayEvents)
            return (
              <div key={d.toISOString()} style={{ position: 'relative', height: gridHeight, borderLeft: '1px solid var(--line)' }}>
                {hours.map((h, i) => (
                  <div key={h} style={{ position: 'absolute', top: i * HOUR_PX, left: 0, right: 0, height: HOUR_PX, borderTop: i === 0 ? 'none' : '1px solid var(--line)', opacity: 0.6 }} />
                ))}
                {placed.map(({ ev, lane }) => {
                  const minutesFromTop = (ev.start.getHours() - startHour) * 60 + ev.start.getMinutes()
                  const durMin = Math.max(20, (ev.end.getTime() - ev.start.getTime()) / 60_000)
                  const widthPct = 100 / laneCount
                  const hue = hueOf(ev)
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onSelect(ev)}
                      title={`${ev.label} · ${time(ev.start.toISOString())}`}
                      style={{
                        position: 'absolute',
                        top: (minutesFromTop / 60) * HOUR_PX,
                        height: Math.max(20, (durMin / 60) * HOUR_PX - 2),
                        left: `calc(${lane * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        borderRadius: 6,
                        padding: '3px 6px',
                        fontSize: 11,
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: hue.bg,
                        color: hue.fg,
                        border: `1px solid ${hue.bg}`,
                      }}
                    >
                      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</div>
                      <div style={{ opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {time(ev.start.toISOString())} · {ev.sub}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MonthGrid({
  monthDate,
  events,
  hueOf,
  onSelect,
}: {
  monthDate: Date
  events: CalEvent[]
  hueOf: (ev: CalEvent) => Hue
  onSelect: (ev: CalEvent) => void
}) {
  const monthStart = startOfMonth(monthDate)
  const gridStart = startOfWeek(monthStart)
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS))
  const todayKey = new Date().toDateString()

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--line)' }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--ink-4)', textAlign: 'center' }}>
            {d.toUpperCase()}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((d) => {
          const isCurrent = d.getMonth() === monthStart.getMonth()
          const isToday = d.toDateString() === todayKey
          const dayEvents = events
            .filter((e) => e.start.toDateString() === d.toDateString())
            .sort((a, b) => a.start.getTime() - b.start.getTime())
          return (
            <div
              key={d.toISOString()}
              style={{
                minHeight: 92,
                borderRight: '1px solid var(--line)',
                borderBottom: '1px solid var(--line)',
                padding: 6,
                background: isCurrent ? 'transparent' : 'var(--app-sunken)',
                opacity: isCurrent ? 1 : 0.55,
              }}
            >
              <div
                className="t-num"
                style={{
                  fontSize: 12,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'var(--bofa-navy)' : 'var(--ink-3)',
                  textAlign: 'right',
                  marginBottom: 4,
                }}
              >
                {d.getDate()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {dayEvents.slice(0, 3).map((ev) => {
                  const hue = hueOf(ev)
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onSelect(ev)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        width: '100%',
                        textAlign: 'left',
                        border: 0,
                        cursor: 'pointer',
                        borderRadius: 5,
                        padding: '2px 5px',
                        fontSize: 11,
                        background: hue.bg,
                        color: hue.fg,
                        overflow: 'hidden',
                      }}
                      title={`${ev.label} · ${time(ev.start.toISOString())}`}
                    >
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</span>
                    </button>
                  )
                })}
                {dayEvents.length > 3 ? (
                  <span style={{ fontSize: 10.5, color: 'var(--ink-4)', paddingLeft: 5 }}>+{dayEvents.length - 3} more</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventDetail({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  const iv = ev.interview
  const slot = ev.slot
  return (
    <SlideOver label={`${ev.label} details`} onClose={onClose} width={400}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>{ev.label}</div>
          <div className="sub" style={{ marginTop: 3, fontSize: 12.5 }}>
            {iv ? iv.type : ev.kind === 'open' ? 'Open availability' : 'Booked slot'}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--ink-4)' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <FactRow label="Date">{date(ev.start.toISOString())}</FactRow>
        <FactRow label="Time">{time(ev.start.toISOString())} – {time(ev.end.toISOString())}</FactRow>
        <FactRow label="Duration">{Math.round((ev.end.getTime() - ev.start.getTime()) / 60_000)} min</FactRow>
        {iv ? (
          <>
            <FactRow label="Status"><span className={`badge ${statusBadge(iv.status)}`}>{iv.status || '—'}</span></FactRow>
            {iv.interviewers?.length ? <FactRow label="Interviewers">{iv.interviewers.join(', ')}</FactRow> : null}
            {iv.score ? <FactRow label="Score">{iv.score.toFixed(1)}</FactRow> : null}
            {iv.recommendation ? (
              <FactRow label="Recommendation"><span className={`badge ${recBadge(iv.recommendation)}`}>{iv.recommendation}</span></FactRow>
            ) : null}
            {iv.summary ? (
              <div style={{ marginTop: 14 }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Summary</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>{iv.summary}</div>
              </div>
            ) : null}
          </>
        ) : slot ? (
          <>
            <FactRow label="Interviewer">{slot.interviewerName || 'Unassigned'}</FactRow>
            <FactRow label="Status"><span className={`badge ${slot.booked ? 'badge--warn' : 'badge--ok'}`}>{slot.booked ? 'Booked' : 'Open'}</span></FactRow>
          </>
        ) : null}
      </div>
    </SlideOver>
  )
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--ink-4)' }}>{label}</span>
      <span style={{ color: 'var(--ink-1)', textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function InterviewCalendar({
  interviews,
  slots,
  nameByApp,
}: {
  interviews: Interview[]
  slots: Slot[]
  nameByApp: Record<string, string>
}) {
  const events = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = []
    for (const s of slots) {
      const start = new Date(s.startsAt)
      const end = s.endsAt ? new Date(s.endsAt) : new Date(start.getTime() + 45 * 60_000)
      if (Number.isNaN(start.getTime())) continue
      out.push({
        id: `slot-${s.id}`,
        kind: s.booked ? 'booked' : 'open',
        label: s.booked ? 'Booked' : 'Open slot',
        sub: s.interviewerName || 'Unassigned',
        start,
        end,
        slot: s,
      })
    }
    for (const iv of interviews) {
      const start = new Date(iv.scheduledAt)
      if (Number.isNaN(start.getTime())) continue
      const end = new Date(start.getTime() + (iv.durationMin || 45) * 60_000)
      out.push({
        id: `iv-${iv.id}`,
        kind: 'interview',
        label: nameByApp[iv.applicationId] || iv.type || 'Interview',
        sub: iv.type || iv.interviewers?.join(', ') || '',
        start,
        end,
        typeKey: iv.type || 'INTERVIEW',
        interview: iv,
      })
    }
    return out
  }, [interviews, slots, nameByApp])

  // Assign a stable color to each interview type for the legend + blocks.
  const typeColors = useMemo(() => {
    const types = [...new Set(events.filter((e) => e.kind === 'interview').map((e) => e.typeKey || 'INTERVIEW'))]
    const map: Record<string, Hue> = {}
    types.forEach((t, i) => {
      map[t] = TYPE_HUES[i % TYPE_HUES.length]
    })
    return map
  }, [events])

  const hueOf = (ev: CalEvent): Hue => {
    if (ev.kind === 'open') return OPEN_HUE
    if (ev.kind === 'booked') return BOOKED_HUE
    return typeColors[ev.typeKey || 'INTERVIEW'] || TYPE_HUES[0]
  }

  const earliest = useMemo(
    () => (events.length ? new Date(Math.min(...events.map((e) => e.start.getTime()))) : new Date()),
    [events],
  )
  const [scale, setScale] = useState<Scale>('week')
  const [cursor, setCursor] = useState(() => earliest)
  const [anchored, setAnchored] = useState(false)
  const [selected, setSelected] = useState<CalEvent | null>(null)
  useEffect(() => {
    if (!anchored && events.length) {
      setCursor(earliest)
      setAnchored(true)
    }
  }, [anchored, events.length, earliest])

  function shift(dir: number) {
    const d = new Date(cursor)
    if (scale === 'day') d.setDate(d.getDate() + dir)
    else if (scale === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCursor(d)
  }

  const weekStart = startOfWeek(cursor)
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS))
  const label =
    scale === 'day'
      ? cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      : scale === 'week'
        ? `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(weekStart.getTime() + 6 * DAY_MS).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const legendTypes = Object.entries(typeColors)

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <button className="btn btn--outline btn--sm" onClick={() => shift(-1)} aria-label="Previous">‹</button>
        <button className="btn btn--outline btn--sm" onClick={() => setCursor(new Date())}>Today</button>
        <button className="btn btn--outline btn--sm" onClick={() => shift(1)} aria-label="Next">›</button>
        <span className="t-strong" style={{ fontSize: 14, marginLeft: 4 }}>{label}</span>
        <div className="segmented" role="group" aria-label="Scale" style={{ marginLeft: 'auto' }}>
          <button aria-pressed={scale === 'day'} onClick={() => setScale('day')}>Day</button>
          <button aria-pressed={scale === 'week'} onClick={() => setScale('week')}>Week</button>
          <button aria-pressed={scale === 'month'} onClick={() => setScale('month')}>Month</button>
        </div>
      </div>

      {legendTypes.length > 0 ? (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-4)' }}>
          {legendTypes.map(([type, hue]) => (
            <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: hue.bg, border: `1px solid ${hue.fg}` }} />
              {type}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--ok-bg)', border: '1px solid var(--ok-line)' }} />
            Open slot
          </span>
        </div>
      ) : null}

      {scale === 'month' ? (
        <MonthGrid monthDate={cursor} events={events} hueOf={hueOf} onSelect={setSelected} />
      ) : (
        <TimeGrid days={scale === 'day' ? [cursor] : weekDays} events={events} hueOf={hueOf} onSelect={setSelected} />
      )}

      {selected && <EventDetail ev={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ── List view (existing tables) ───────────────────────────────────────────────

function ScheduledTable({
  rows,
  isLoading,
  nameByApp,
}: {
  rows: Interview[] | undefined
  isLoading: boolean
  nameByApp: Record<string, string>
}) {
  if (isLoading) return <Empty label="Loading interviews…" />
  if (!rows || rows.length === 0) return <Empty label="No interviews scheduled for this job yet." />
  const sorted = [...rows].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Type</th>
            <th>When</th>
            <th className="t-right">Duration</th>
            <th>Status</th>
            <th>Interviewers</th>
            <th className="t-right">Score</th>
            <th>Recommendation</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((iv) => (
            <tr key={iv.id}>
              <td className="t-strong">{nameByApp[iv.applicationId] || '—'}</td>
              <td>{iv.type}</td>
              <td>
                {date(iv.scheduledAt)}
                <span className="t-muted"> · {time(iv.scheduledAt)}</span>
              </td>
              <td className="t-right t-num">{iv.durationMin ? `${iv.durationMin}m` : '—'}</td>
              <td>
                <span className={`badge ${statusBadge(iv.status)}`}>{iv.status || '—'}</span>
              </td>
              <td className="t-muted">{iv.interviewers?.length ? iv.interviewers.join(', ') : '—'}</td>
              <td className="t-right t-num">{iv.score ? iv.score.toFixed(1) : '—'}</td>
              <td>
                {iv.recommendation ? (
                  <span className={`badge ${recBadge(iv.recommendation)}`}>{iv.recommendation}</span>
                ) : (
                  <span className="t-muted">—</span>
                )}
              </td>
              <td style={{ maxWidth: 320, color: 'var(--ink-3)' }}>{iv.summary || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SlotsList({ slots, isLoading }: { slots: Slot[] | undefined; isLoading: boolean }) {
  if (isLoading) return <Empty label="Loading slots…" />
  if (!slots || slots.length === 0) return <Empty label="No open interview slots for this job." />
  return (
    <div className="card">
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {slots.map((slot) => (
          <div
            key={slot.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '12px 14px',
              borderRadius: 'var(--ra-2)',
              background: slot.booked ? 'var(--app-sunken)' : 'var(--app-panel)',
              border: '1px solid var(--line)',
            }}
          >
            <div>
              <div className="t-strong" style={{ fontSize: 14 }}>
                {date(slot.startsAt)}
              </div>
              <div className="muted" style={{ margin: '2px 0 0' }}>
                {time(slot.startsAt)} – {time(slot.endsAt)} · {slot.interviewerName || 'Unassigned'}
              </div>
            </div>
            <span className={`badge ${slot.booked ? 'badge--warn' : 'badge--ok'}`}>
              {slot.booked ? 'Booked' : 'Open'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function InterviewsPage() {
  const { data: jobs } = useJobs()
  const [params, setParams] = useSearchParams()
  const jobId = params.get('job') ?? ''
  const setJobId = (id: string) => setParams(id ? { job: id } : {}, { replace: true })
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  const effectiveJobId = jobId || defaultJobId(jobs)

  // Every interview for the job = the interviews of all its applications.
  const { data: apps } = useApplications(effectiveJobId ? { jobId: effectiveJobId } : undefined)
  const appIds = useMemo(() => (apps ?? []).map((a) => a.id), [apps])
  const nameByApp = useMemo(
    () => Object.fromEntries((apps ?? []).map((a) => [a.id, a.candidateName])),
    [apps],
  )

  const { interviews, isLoading: ivLoading } = useJobInterviews(appIds)
  const { data: slots, isLoading: slotLoading } = useSlots(effectiveJobId)

  const slotsByJob = useMemo(() => slots ?? [], [slots])

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Hiring · Interviews
        </div>
        <div className="page-head__row">
          <div>
            <h1>Interviews</h1>
            <p className="sub">Scheduled conversations and open interviewer availability, scoped by job and candidate.</p>
          </div>
          <div className="segmented" role="group" aria-label="View">
            <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
          </div>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 18 }}>
        <select
          className="select"
          style={{ width: 280 }}
          value={effectiveJobId ?? ''}
          onChange={(e) => setJobId(e.target.value)}
        >
          {(jobs ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>

      {view === 'calendar' ? (
        <>
          <InterviewCalendar interviews={interviews} slots={slotsByJob} nameByApp={nameByApp} />
          <p className="sub" style={{ marginTop: 12, fontSize: 12.5 }}>
            Every scheduled interview and open slot for this job. Switch Day / Week / Month; click any event for details.
          </p>
        </>
      ) : (
        <>
          <h3 className="h3" style={{ margin: '0 0 12px' }}>
            Scheduled interviews
          </h3>
          <ScheduledTable rows={interviews} isLoading={ivLoading} nameByApp={nameByApp} />

          <h3 className="h3" style={{ margin: '28px 0 12px' }}>
            Open interview slots
          </h3>
          <SlotsList slots={slotsByJob} isLoading={slotLoading && !!effectiveJobId} />
        </>
      )}
    </div>
  )
}
