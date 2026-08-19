import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/client'

/* Candidate self-scheduling — the shell-less page behind the link recruiters
   (and Aria) send. Shows live proposals in the CANDIDATE'S OWN timezone,
   books race-protected, and offers policied reschedule / cancel once booked. */

interface Slot {
  id: string
  startsAt: string
  endsAt: string
}

interface Info {
  interviewId: string
  candidateName: string
  jobTitle: string
  type: string
  durationMin: number
  status: string
  scheduledAt: string | null
  meetingLink: string | null
  proposedSlots: Slot[]
  reschedulesRemaining: number
  rescheduleCutoffHours: number
}

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: localTz })

const timeOf = (iso: string, withZone = false) =>
  new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: localTz, ...(withZone ? { timeZoneName: 'short' } : {}),
  })

const typeLabel = (t: string) => (t || 'Interview').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())

export default function SelfSchedulePage() {
  const { interviewId } = useParams()
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const load = useCallback(() => {
    api.get<Info>(`/schedule/${interviewId}/public`).then((r) => setInfo(r.data)).catch(() => setError('This scheduling link is no longer valid.'))
  }, [interviewId])
  useEffect(load, [load])

  const act = async (path: string) => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<Info>(`/schedule/${interviewId}/${path}`)
      setInfo(r.data)
    } catch (e) {
      const msg = (e as { response?: { status?: number; data?: { message?: string } } })?.response
      if (msg?.status === 409) {
        setError('That time was just taken — here are the latest options.')
        load()
      } else {
        setError(msg?.data?.message ?? 'Something went wrong — please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const book = (slotId: string) => {
    setBusy(true)
    setError(null)
    api.post<Info>(`/schedule/${interviewId}/select`, { slotId })
      .then((r) => setInfo(r.data))
      .catch((e) => {
        const resp = (e as { response?: { status?: number; data?: { message?: string } } })?.response
        if (resp?.status === 409) {
          setError('That time was just taken — here are the latest options.')
          load()
        } else {
          setError(resp?.data?.message ?? 'Something went wrong — please try again.')
        }
      })
      .finally(() => setBusy(false))
  }

  const grouped = useMemo(() => {
    const m = new Map<string, Slot[]>()
    for (const s of info?.proposedSlots ?? []) {
      const k = dayOf(s.startsAt)
      m.set(k, [...(m.get(k) ?? []), s])
    }
    return [...m.entries()]
  }, [info])

  const booked = !!info?.scheduledAt && info.status === 'SCHEDULED'
  const cancelled = info?.status === 'CANCELED'

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fa', color: 'var(--ink-1, #1d1d1f)' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid var(--line, #e5e7eb)', padding: '14px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.02em', color: 'var(--bofa-navy, #012169)' }}>
            BANK OF AMERICA
          </span>
          <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Interview scheduling</span>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>
        {!info && !error ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-4)', padding: 60 }}>Loading…</div>
        ) : error && !info ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 60 }}>{error}</div>
        ) : info ? (
          <>
            <div style={{ marginBottom: 22 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, margin: 0, color: 'var(--ink-0, #111)' }}>
                {booked ? 'Your interview is booked' : cancelled ? 'Interview cancelled' : 'Pick your interview time'}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
                {info.candidateName} · {typeLabel(info.type)}{info.jobTitle ? ` · ${info.jobTitle}` : ''} · {info.durationMin} minutes
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>
                Times shown in your timezone: {localTz.replace('_', ' ')}
              </p>
            </div>

            {error && (
              <div style={{ background: '#fdf5e3', border: '1px solid #ead9ac', color: '#7a5c00', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, marginBottom: 16 }}>
                {error}
              </div>
            )}

            {cancelled ? (
              <div className="card" style={{ padding: '28px 22px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid var(--line, #e5e7eb)' }}>
                <div style={{ fontSize: 15, color: 'var(--ink-1)' }}>This interview has been cancelled.</div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>
                  Our recruiting team has been notified and will reach out about next steps.
                </div>
              </div>
            ) : booked ? (
              <div className="card" style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--line, #e5e7eb)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--bofa-navy, #012169)', color: '#fff', padding: '18px 22px' }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Confirmed</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 2 }}>
                    {dayOf(info.scheduledAt!)} · {timeOf(info.scheduledAt!, true)}
                  </div>
                </div>
                <div style={{ padding: '18px 22px' }}>
                  {info.meetingLink && (
                    <p style={{ fontSize: 14, margin: '0 0 14px' }}>
                      Join link:{' '}
                      <a href={info.meetingLink} style={{ color: 'var(--bofa-navy, #012169)' }}>
                        {info.meetingLink}
                      </a>
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn--outline btn--sm"
                      disabled={busy || info.reschedulesRemaining <= 0}
                      onClick={() => act('reschedule')}
                      title={info.reschedulesRemaining <= 0 ? 'Reschedule limit reached — contact your recruiter' : undefined}
                    >
                      Reschedule{info.reschedulesRemaining > 0 ? ` (${info.reschedulesRemaining} left)` : ''}
                    </button>
                    {confirmCancel ? (
                      <>
                        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--ink-3)' }}>Cancel this interview?</span>
                        <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => act('cancel')}>
                          Yes, cancel
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={() => setConfirmCancel(false)}>
                          Keep it
                        </button>
                      </>
                    ) : (
                      <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setConfirmCancel(true)}>
                        Cancel interview
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 12 }}>
                    Changes closer than {info.rescheduleCutoffHours} hours to the interview need a recruiter.
                  </p>
                </div>
              </div>
            ) : grouped.length === 0 ? (
              <div className="card" style={{ padding: '28px 22px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid var(--line, #e5e7eb)' }}>
                <div style={{ fontSize: 15, color: 'var(--ink-1)' }}>No open times right now.</div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>
                  Our recruiting team has been notified and will follow up with options shortly.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {grouped.map(([day, slots]) => (
                  <div key={day}>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--ink-2)', marginBottom: 8 }}>{day}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {slots.map((s) => (
                        <button
                          key={s.id}
                          disabled={busy}
                          onClick={() => book(s.id)}
                          style={{
                            font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                            padding: '12px 18px', borderRadius: 10,
                            border: '1.5px solid var(--bofa-navy, #012169)', color: 'var(--bofa-navy, #012169)',
                            background: '#fff',
                          }}
                        >
                          {timeOf(s.startsAt)} – {timeOf(s.endsAt, true)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
