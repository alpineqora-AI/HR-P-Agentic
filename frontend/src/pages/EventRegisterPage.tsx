import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { DISPLAY_TYPES, fieldVisible, flattenIntake, normalizeIntake, type IntakeField, type IntakeForm } from './admin/FormBuilder'
import { IntakeInput, answerText, type Answer } from './admin/IntakeInput'

/* The public event-registration surface — what the QR code on the booth banner
   opens. Shell-less (no recruiter chrome). One form definition
   (EVENT_REGISTRATION), two renderers side by side:
   - Form: the classic web form, if/then rules mirrored live
   - Aria: the same questions asked conversationally, rules driving follow-ups
   Either path lands on the same authoritative backend service. */

interface EventInfo {
  id: string
  name: string
  type: string
  location: string
  startsAt: string
  endsAt: string | null
  timezone: string
}

interface ChatTurn {
  conversationId: string
  done: boolean
  messages: { sender: string; body: string }[]
  options: string[]
}

/** The event's schedule in ITS OWN timezone — "Thu, Oct 14 · 5:00–7:00 PM EDT". */
const when = (e: { startsAt: string; endsAt: string | null; timezone: string }) => {
  const tz = e.timezone || 'America/New_York'
  const day = new Date(e.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz })
  const t = (iso: string, zone: boolean) =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', ...(zone ? { timeZoneName: 'short' } : {}) })
  return `${day} · ${e.endsAt ? `${t(e.startsAt, false)}–${t(e.endsAt, true)}` : t(e.startsAt, true)}`
}

export default function EventRegisterPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [form, setForm] = useState<IntakeForm | null>(null)
  const [mode, setMode] = useState<'form' | 'chat'>('form')

  useEffect(() => {
    if (!eventId) return
    api.get<EventInfo>(`/events/${eventId}/public`).then((r) => setEvent(r.data)).catch(() => setEvent(null))
    api.get<{ schema: string }>('/forms/EVENT_REGISTRATION').then((r) => {
      try {
        setForm(normalizeIntake(JSON.parse(r.data.schema)))
      } catch {
        setForm(null)
      }
    })
  }, [eventId])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--bofa-navy, #012169)', color: '#fff', padding: '16px 22px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Bank of America · Campus</div>
        {event && (
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
            {event.name} · {when(event)} · {event.location}
          </div>
        )}
      </header>

      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '26px 16px' }}>
        <div style={{ width: '100%', maxWidth: 620 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: '0 0 4px' }}>Register for this event</h1>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ink-4)' }}>
            Fill the quick form — or just chat with Aria. Same questions, your choice.
          </p>

          <div className="segmented" role="group" aria-label="Mode" style={{ marginBottom: 16 }}>
            <button aria-pressed={mode === 'form'} onClick={() => setMode('form')}>Form</button>
            <button aria-pressed={mode === 'chat'} onClick={() => setMode('chat')}>Chat with Aria</button>
          </div>

          {mode === 'form'
            ? (eventId && form ? <RegisterForm eventId={eventId} form={form} /> : <p className="muted">Loading…</p>)
            : (eventId ? <AriaRegisterChat eventId={eventId} /> : null)}
        </div>
      </main>
    </div>
  )
}

/* ── Web-form renderer: rules mirrored client-side, enforced server-side ──── */
function RegisterForm({ eventId, form }: { eventId: string; form: IntakeForm }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ kind: 'ok' | 'dup' | 'err'; message: string } | null>(null)

  const isVisible = (f: IntakeField) => fieldVisible(form, f.id, (id) => answerText(answers[id]))
  const visibleFields = flattenIntake(form).filter(isVisible)
  const valid = visibleFields.every((f) => DISPLAY_TYPES.includes(f.type) || !f.required || answerText(answers[f.id]).trim() !== '')

  const submit = () => {
    setBusy(true)
    const payload = visibleFields
      .filter((f) => !DISPLAY_TYPES.includes(f.type))
      .map((f) => ({ fieldId: f.id, label: f.label || 'Untitled', value: answerText(answers[f.id]) }))
      .filter((a) => a.value.trim() !== '')
    api.post(`/events/${eventId}/register-form`, { answers: JSON.stringify(payload) })
      .then(() => setOutcome({ kind: 'ok', message: "You're registered! Check your email for what's next — and come say hi at the booth." }))
      .catch((e: { response?: { status?: number; data?: { message?: string } } }) => {
        if (e.response?.status === 409) setOutcome({ kind: 'dup', message: "You're already registered for this event — no need to do anything else." })
        else setOutcome({ kind: 'err', message: e.response?.data?.message ?? 'Something went wrong — please try again.' })
      })
      .finally(() => setBusy(false))
  }

  if (outcome && outcome.kind !== 'err') {
    return (
      <div className="card" style={{ padding: '30px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 34 }}>{outcome.kind === 'ok' ? '🎉' : '👋'}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, margin: '8px 0 4px' }}>
          {outcome.kind === 'ok' ? 'See you there!' : 'Already on the list'}
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0 }}>{outcome.message}</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {form.rows.map((row) => {
          const shown = row.slots.filter((f): f is IntakeField => f !== null && isVisible(f))
          if (row.slots.some((f) => f !== null) && shown.length === 0) return null
          return (
            <div key={row.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(shown.length, 1)}, minmax(0, 1fr))`, gap: 12 }}>
              {shown.map((f) => (
                <IntakeInput key={f.id} f={f} value={answers[f.id]} onChange={(v) => setAnswers((prev) => ({ ...prev, [f.id]: v }))} />
              ))}
            </div>
          )
        })}
      </div>
      {outcome?.kind === 'err' && (
        <p style={{ fontSize: 12.5, color: 'var(--bofa-red, #c41230)', margin: '12px 0 0' }}>{outcome.message}</p>
      )}
      <button className="btn btn--primary" style={{ marginTop: 16, width: '100%' }} disabled={!valid || busy} onClick={submit}>
        {busy ? 'Registering…' : 'Register'}
      </button>
    </div>
  )
}

/* ── Aria renderer: same definition, same rules, conversational ───────────── */
function AriaRegisterChat({ eventId }: { eventId: string }) {
  const [turn, setTurn] = useState<ChatTurn | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    api.post<ChatTurn>(`/aria/events/${eventId}/registration-chat`).then((r) => setTurn(r.data))
  }, [eventId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [turn])

  const send = (message: string) => {
    if (!turn || !message.trim() || busy) return
    setBusy(true)
    setText('')
    api.post<ChatTurn>(`/aria/registration-chat/${turn.conversationId}`, { text: message })
      .then((r) => setTurn(r.data))
      .finally(() => setBusy(false))
  }

  const bubbles = useMemo(() => turn?.messages ?? [], [turn])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 480, overflow: 'hidden' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bubbles.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.sender === 'ARIA' ? 'flex-start' : 'flex-end' }}>
            <div style={{
              maxWidth: '82%', padding: '9px 13px', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-line',
              borderRadius: m.sender === 'ARIA' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
              background: m.sender === 'ARIA' ? 'var(--app-sunken)' : 'var(--bofa-navy, #012169)',
              color: m.sender === 'ARIA' ? 'var(--ink-1)' : '#fff',
            }}>
              {m.body}
            </div>
          </div>
        ))}
      </div>
      {turn && turn.options.length > 0 && !turn.done && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 16px' }}>
          {turn.options.map((o) => (
            <button key={o} className="btn btn--outline btn--sm" style={{ fontSize: 12 }} disabled={busy} onClick={() => send(o)}>
              {o}
            </button>
          ))}
        </div>
      )}
      {!turn?.done && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px 14px' }}>
          <input
            className="input"
            placeholder="Type your answer…"
            value={text}
            disabled={busy || !turn}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(text)}
          />
          <button className="btn btn--primary" disabled={busy || !text.trim()} onClick={() => send(text)}>Send</button>
        </div>
      )}
    </div>
  )
}
