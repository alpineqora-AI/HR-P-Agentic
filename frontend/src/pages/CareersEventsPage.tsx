import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'

/* The public campus-events board — the candidate-facing front door the bank
   currently runs on tal.net/Oleeo. Owned by the TA Portal now: our events, our
   pages. Shell-less (no recruiter chrome); each row leads to the /register
   page (form or Aria chat). */

interface PublicEvent {
  id: string
  name: string
  type: string
  location: string
  startsAt: string
  endsAt: string | null
  timezone: string
}

const TYPE_LABEL: Record<string, string> = {
  HIRING_EVENT: 'Recruitment Event',
  CAMPUS: 'Campus Drive',
  WEBINAR: 'Virtual Event',
  CAREER_FAIR: 'Career Fair',
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

/** "2:00–4:00 PM EST" in the event's own timezone. */
const fmtTime = (e: PublicEvent) => {
  const tz = e.timezone || 'America/New_York'
  const f = (iso: string, zone: boolean) =>
    new Date(iso).toLocaleTimeString('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', ...(zone ? { timeZoneName: 'short' } : {}),
    })
  return e.endsAt ? `${f(e.startsAt, false)}–${f(e.endsAt, true)}` : f(e.startsAt, true)
}

const isVirtual = (loc: string) => /virtual|online/i.test(loc)

export default function CareersEventsPage() {
  const [events, setEvents] = useState<PublicEvent[] | null>(null)
  const [location, setLocation] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    api.get<PublicEvent[]>('/events/public').then((r) => setEvents(r.data)).catch(() => setEvents([]))
  }, [])

  const locations = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of events ?? []) counts.set(e.location, (counts.get(e.location) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [events])

  const filtered = useMemo(() => {
    return (events ?? []).filter(
      (e) =>
        (location === 'all' || e.location === location) &&
        (query.trim() === '' || e.name.toLowerCase().includes(query.trim().toLowerCase())),
    )
  }, [events, location, query])

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: 'var(--ink-1, #1d1d1f)' }}>
      {/* Brand bar */}
      <header style={{ borderBottom: '1px solid var(--line, #e5e7eb)', padding: '14px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.02em', color: 'var(--bofa-navy, #012169)' }}>
            BANK OF AMERICA
          </span>
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Campus Careers</span>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: 'var(--bofa-navy, #012169)', color: '#fff' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 24px' }}>
          <div style={{ fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.7 }}>
            Early Careers
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, margin: '8px 0 6px', color: '#fff' }}>Campus Events</h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', maxWidth: 640, margin: 0, lineHeight: 1.55 }}>
            We look forward to meeting you. Explore our upcoming recruitment events, networking sessions, and virtual
            coffee chats — and register in a minute.
          </p>
        </div>
      </div>

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 24px 60px', display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, alignItems: 'start' }}>
        {/* Filters */}
        <aside style={{ position: 'sticky', top: 20 }}>
          <div style={{ fontSize: 12.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 10 }}>
            Location
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FilterRow label="All locations" count={events?.length ?? 0} active={location === 'all'} onClick={() => setLocation('all')} />
            {locations.map(([loc, n]) => (
              <FilterRow key={loc} label={loc} count={n} active={location === loc} onClick={() => setLocation(loc)} />
            ))}
          </div>
        </aside>

        {/* Results */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>
              {events === null ? 'Loading…' : `${filtered.length} event${filtered.length === 1 ? '' : 's'}`}
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter on keywords…"
              style={{
                width: 260, maxWidth: '55vw', padding: '8px 12px', fontSize: 13.5,
                border: '1px solid var(--line, #d2d2d7)', borderRadius: 8, outline: 'none',
              }}
            />
          </div>

          <div style={{ border: '1px solid var(--line, #e5e7eb)', borderRadius: 12, overflow: 'hidden' }}>
            {(filtered).map((e, i) => (
              <div
                key={e.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--line, #f0f0f2)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-0, #1d1d1f)', lineHeight: 1.35 }}>{e.name}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: 12.5, color: 'var(--ink-4)', flexWrap: 'wrap' }}>
                    <span>📅 {fmtDate(e.startsAt)} · {fmtTime(e)}</span>
                    <span>{isVirtual(e.location) ? '💻' : '📍'} {e.location}</span>
                    <span>{TYPE_LABEL[e.type] ?? e.type}</span>
                  </div>
                </div>
                <Link
                  to={`/register/${e.id}`}
                  style={{
                    flexShrink: 0, padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                    background: 'var(--bofa-navy, #012169)', color: '#fff', textDecoration: 'none',
                  }}
                >
                  Register
                </Link>
              </div>
            ))}
            {events !== null && filtered.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
                No events match your filters.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function FilterRow({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '7px 10px', border: 'none', borderRadius: 8, cursor: 'pointer', font: 'inherit',
        fontSize: 13.5, textAlign: 'left', width: '100%',
        background: active ? 'var(--app-sunken, #f0f2f5)' : 'transparent',
        color: active ? 'var(--bofa-navy, #012169)' : 'var(--ink-2, #444)',
        fontWeight: active ? 600 : 400,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: 'var(--ink-5)', fontSize: 12 }}>{count}</span>
    </button>
  )
}
