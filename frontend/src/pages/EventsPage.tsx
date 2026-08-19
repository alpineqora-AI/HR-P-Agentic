import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import SlideOver from '@/components/SlideOver'
import { useCreateEvent, useEvents, useEventRoster, useRegisterAttendee, useRegistrationTransition, useSchools, useFormResponses, useSubmitFormResponse, useFormDefById, useFormsList } from '@/api/hooks'
import { date } from '@/lib/format'
import type { EventRow, EventRegistration } from '@/api/types'
import { DISPLAY_TYPES, fieldVisible, INTAKE_KEY, defaultIntakeForm, flattenIntake, normalizeIntake, type IntakeField, type IntakeForm } from './admin/FormBuilder'
import { IntakeInput, answerText, type Answer } from './admin/IntakeInput'

// Campus & hiring events, modeled on how Handshake / Yello / RippleMatch run them:
// a conversion funnel (registered → attended → hires), event formats, and a
// stepped creation flow whose Details step renders the admin-designed intake
// form (Admin → Forms), so orgs control what gets asked at event creation.

const TYPE_OPTIONS = [
  { value: 'CAMPUS', label: 'Campus drive' },
  { value: 'CAREER_FAIR', label: 'Career fair' },
  { value: 'HIRING_EVENT', label: 'Hiring event' },
  { value: 'WEBINAR', label: 'Webinar / info session' },
]

function typeBadge(_type: string) {
  // Event type is a category, not a state — no color.
  return ''
}

function typeLabel(type: string) {
  return TYPE_OPTIONS.find((t) => t.value === type.toUpperCase())?.label ?? type
}

function formatOf(e: EventRow) {
  const t = e.type.toUpperCase()
  const loc = (e.location || '').toLowerCase()
  if (t === 'WEBINAR' || loc.includes('virtual') || loc.includes('online') || loc.includes('zoom')) return 'Virtual'
  return 'In-person'
}

const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0)
const isUpcoming = (iso: string) => new Date(iso).getTime() >= Date.now()

/** "2:00–4:00 PM EST" in the event's own timezone. */
const timeRange = (e: Pick<EventRow, 'startsAt' | 'endsAt' | 'timezone'>) => {
  const tz = e.timezone || 'America/New_York'
  const fmt = (iso: string, withZone: boolean) =>
    new Date(iso).toLocaleTimeString('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', ...(withZone ? { timeZoneName: 'short' } : {}),
    })
  return e.endsAt ? `${fmt(e.startsAt, false)}–${fmt(e.endsAt, true)}` : fmt(e.startsAt, true)
}

const approvalBadge = (s: string | null) =>
  s === 'PENDING' ? (
    <span className="badge badge--warn">Pending approval</span>
  ) : s === 'REJECTED' ? (
    <span className="badge badge--danger">Rejected</span>
  ) : null

function StatTile({ label, value, meta }: { label: string; value: string | number; meta?: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {meta ? <div className="stat__meta">{meta}</div> : null}
    </div>
  )
}

// Registered → Attended → Hires conversion bar.
function FunnelBar({ e }: { e: EventRow }) {
  const att = rate(e.attended, e.registrations)
  const hire = rate(e.hires, e.registrations)
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Registered', value: e.registrations },
          { label: 'Attended', value: e.attended },
          { label: 'Hires', value: e.hires },
        ].map((m) => (
          <div key={m.label}>
            <div className="t-num" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, color: 'var(--ink-0)' }}>
              {m.value}
            </div>
            <div className="eyebrow" style={{ fontSize: 9, marginTop: 4 }}>{m.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Meter label="Attendance" pct={att} color="var(--bofa-navy)" />
        <Meter label="Hire rate" pct={hire} color="#1D9E75" />
      </div>
    </div>
  )
}

function Meter({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink-4)', marginBottom: 3 }}>
        <span>{label}</span>
        <span className="t-num" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: 'var(--app-sunken)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  )
}

function EventDetail({ e, onClose }: { e: EventRow; onClose: () => void }) {
  const { data: serverResponses } = useFormResponses('EVENT', e.id)
  const intakeDetails = useMemo(() => {
    const fromServer = (serverResponses ?? []).flatMap((r) => {
      try {
        return JSON.parse(r.answers) as { label: string; value: string }[]
      } catch {
        return []
      }
    })
    return fromServer.length > 0 ? fromServer : readResponses(e.id)
  }, [serverResponses, e.id])
  return (
    <SlideOver label={`${e.name} details`} onClose={onClose} width={440}>
      <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)', lineHeight: 1.2 }}>{e.name}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <span className={`badge ${typeBadge(e.type)}`}>{typeLabel(e.type)}</span>
          <span className="badge">{formatOf(e)}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <Fact label="When">{`${date(e.startsAt)} · ${timeRange(e)}`}</Fact>
        <Fact label={formatOf(e) === 'Virtual' ? 'Link' : 'Location'}>{e.location || '—'}</Fact>
        <Fact label="Status">
          {isUpcoming(e.startsAt) ? 'Upcoming' : 'Past'}
          {e.approvalStatus === 'PENDING' ? ' · awaiting approval' : e.approvalStatus === 'REJECTED' ? ' · rejected' : ''}
        </Fact>

        <div style={{ marginTop: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Conversion funnel</div>
          <FunnelStep label="Registered" value={e.registrations} pct={100} />
          <FunnelStep label="Attended" value={e.attended} pct={rate(e.attended, e.registrations)} />
          <FunnelStep label="Hires" value={e.hires} pct={rate(e.hires, e.registrations)} />
        </div>

        {intakeDetails.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Intake details</div>
            {intakeDetails.map((r) => (
              <Fact key={r.label} label={r.label}>{r.value}</Fact>
            ))}
          </div>
        )}

        <RegistrationQr eventId={e.id} />

        <Roster eventId={e.id} />
      </div>
    </SlideOver>
  )
}

/* The QR block recruiters print for the booth banner: scanning opens the
   shell-less registration page (form or Aria chat — student's choice).
   QR image comes from api.qrserver.com for the POC; swap for a local
   generator at delivery if offline rendering is required. */
function RegistrationQr({ eventId }: { eventId: string }) {
  const url = `${window.location.origin}/register/${eventId}`
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(url)}`
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ marginTop: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Registration QR · booth banner</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--ra-2)' }}>
        <img src={qr} alt="Registration QR code" width={96} height={96} style={{ borderRadius: 6, border: '1px solid var(--line)' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', wordBreak: 'break-all' }}>{url}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn--outline btn--sm" style={{ fontSize: 11.5 }}
              onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <a className="btn btn--outline btn--sm" style={{ fontSize: 11.5 }} href={url} target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>
      </div>
    </div>
  )
}

/* The live roster: every student as a real row (and a real candidate) —
   register/walk-in at the booth, check in, mark no-shows. The funnel above is
   computed from these rows. */
function Roster({ eventId }: { eventId: string }) {
  const { data: roster, isLoading } = useEventRoster(eventId)
  const { data: schools } = useSchools()
  const transition = useRegistrationTransition()
  const register = useRegisterAttendee()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', schoolId: '', major: '', gradYear: '' })
  const btn = { fontSize: 11.5, padding: '2px 8px' } as const

  const statusBadge = (s: string) =>
    s === 'CHECKED_IN' ? 'badge--ok' : s === 'NO_SHOW' ? 'badge--danger' : 'badge--info'

  const submit = () =>
    register.mutate(
      {
        eventId,
        input: {
          name: form.name,
          email: form.email,
          schoolId: form.schoolId || undefined,
          major: form.major || undefined,
          gradYear: form.gradYear ? Number(form.gradYear) : undefined,
          walkIn: true,
        },
      },
      { onSuccess: () => { setAdding(false); setForm({ name: '', email: '', schoolId: '', major: '', gradYear: '' }) } },
    )

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="eyebrow">Roster{roster ? ` · ${roster.length}` : ''}</span>
        <button className="btn btn--outline btn--sm" style={btn} onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add walk-in'}
        </button>
      </div>

      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--ra-2)', marginBottom: 10 }}>
          <input className="input" placeholder="Full name" value={form.name}
            onChange={(ev) => setForm({ ...form, name: ev.target.value })} />
          <input className="input" placeholder="Email" value={form.email}
            onChange={(ev) => setForm({ ...form, email: ev.target.value })} />
          <select className="select" value={form.schoolId}
            onChange={(ev) => setForm({ ...form, schoolId: ev.target.value })}>
            <option value="">School…</option>
            {(schools ?? []).map((sc) => (
              <option key={sc.id} value={sc.id}>{sc.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Major" value={form.major}
              onChange={(ev) => setForm({ ...form, major: ev.target.value })} />
            <input className="input" placeholder="Grad year" style={{ width: 110 }} value={form.gradYear}
              onChange={(ev) => setForm({ ...form, gradYear: ev.target.value })} />
          </div>
          <button className="btn btn--primary btn--sm" disabled={register.isPending || !form.name || !form.email} onClick={submit}>
            {register.isPending ? 'Adding…' : 'Add & check in'}
          </button>
          {register.isError && (
            <span style={{ fontSize: 12, color: 'var(--c-red, #c41230)' }}>
              {(register.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not add — already registered?'}
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="muted" style={{ fontSize: 12.5 }}>Loading roster…</div>
      ) : !roster || roster.length === 0 ? (
        <div className="muted" style={{ fontSize: 12.5 }}>
          No registrations yet — they'll appear here as students sign up (or add walk-ins at the booth).
        </div>
      ) : (
        roster.map((r: EventRegistration) => (
          <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span className="t-strong" style={{ fontSize: 13 }}>{r.name}</span>
              <span className={`badge ${statusBadge(r.status)}`} style={{ flexShrink: 0 }}>
                {r.status === 'CHECKED_IN' ? 'Checked in' : r.status === 'NO_SHOW' ? 'No-show' : 'Registered'}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 11.5, margin: '2px 0 6px' }}>
              {[r.schoolName, r.major, r.gradYear ? `'${String(r.gradYear).slice(-2)}` : null].filter(Boolean).join(' · ') || r.email}
              {r.source === 'WALK_IN' && <span> · walk-in</span>}
            </div>
            {r.status === 'REGISTERED' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn--outline btn--sm" style={btn} disabled={transition.isPending}
                  onClick={() => transition.mutate({ registrationId: r.id, status: 'CHECKED_IN' })}>
                  Check in
                </button>
                <button className="btn btn--outline btn--sm" style={btn} disabled={transition.isPending}
                  onClick={() => transition.mutate({ registrationId: r.id, status: 'NO_SHOW' })}>
                  No-show
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function FunnelStep({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
        <span style={{ color: 'var(--ink-2)' }}>{label}</span>
        <span className="t-num" style={{ color: 'var(--ink-4)' }}>
          <span style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{value}</span> · {pct}%
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--app-sunken)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: 'var(--bofa-navy)' }} />
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

// ── Create wizard ─────────────────────────────────────────────────────────────

type Draft = {
  name: string
  type: string
  format: 'In-person' | 'Virtual' | 'Hybrid'
  location: string
  day: string
  time: string
  endTime: string
  timezone: string
  flagged: boolean
}

/** Event timezones offered in the wizard (IANA zone → label). */
const TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'Europe/London', label: 'UK (GMT/BST)' },
  { value: 'UTC', label: 'UTC' },
]

/** "day + hh:mm in IANA zone" → absolute ISO instant (offset derived per-date, DST-safe). */
function zonedToIso(day: string, time: string, tz: string): string {
  const naive = new Date(`${day}T${time}:00Z`)
  const inTz = new Date(naive.toLocaleString('en-US', { timeZone: tz }))
  const inUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(naive.getTime() + (inUtc.getTime() - inTz.getTime())).toISOString()
}

const EMPTY_DRAFT: Draft = {
  name: '',
  type: 'CAMPUS',
  format: 'In-person',
  location: '',
  day: '',
  time: '09:00',
  endTime: '11:00',
  timezone: 'America/New_York',
  flagged: false,
}

const STEPS = ['Basics', 'Details', 'Review']

const RESPONSES_KEY = 'taportal.eventIntakeResponses'

function readIntakeForm(): IntakeForm {
  try {
    const raw = localStorage.getItem(INTAKE_KEY)
    if (raw) return normalizeIntake(JSON.parse(raw))
  } catch { /* fall through */ }
  return defaultIntakeForm()
}


/** Persist a created event's intake answers so the detail panel can show them. */
function saveResponses(eventId: string, form: IntakeForm, answers: Record<string, Answer>) {
  try {
    const raw = localStorage.getItem(RESPONSES_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[eventId] = flattenIntake(form)
      .filter((f) => !DISPLAY_TYPES.includes(f.type))
      .filter((f) => answerText(answers[f.id]).trim() !== '')
      .map((f) => ({ label: f.label, value: answerText(answers[f.id]) }))
    localStorage.setItem(RESPONSES_KEY, JSON.stringify(all))
  } catch { /* POC persistence — ignore quota errors */ }
}

function readResponses(eventId: string): { label: string; value: string }[] {
  try {
    const raw = localStorage.getItem(RESPONSES_KEY)
    if (!raw) return []
    return JSON.parse(raw)[eventId] ?? []
  } catch {
    return []
  }
}

/** One intake field as a live wizard input. */
function CreateEventWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useCreateEvent()
  const { toastMsg } = useStore()
  const [step, setStep] = useState(0)
  const [d, setD] = useState<Draft>(EMPTY_DRAFT)
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }))
  // The recruiter picks WHICH intake form this event uses (form library);
  // the kind's default form is preselected. localStorage remains only an
  // offline-demo fallback.
  const { data: formLibrary } = useFormsList()
  const intakeForms = useMemo(
    () => (formLibrary ?? []).filter((f) => f.purpose === 'EVENT_INTAKE' && !f.template),
    [formLibrary],
  )
  const [intakeFormId, setIntakeFormId] = useState<string | null>(null)
  useEffect(() => {
    if (!intakeFormId && intakeForms.length > 0) {
      setIntakeFormId((intakeForms.find((f) => f.defaultForKind) ?? intakeForms[0]).id)
    }
  }, [intakeForms, intakeFormId])
  const { data: intakeDef } = useFormDefById(intakeFormId ?? undefined)
  const intake = useMemo<IntakeForm>(() => {
    if (intakeDef) {
      try {
        return normalizeIntake(JSON.parse(intakeDef.schema))
      } catch {
        /* fall through */
      }
    }
    return readIntakeForm()
  }, [intakeDef])
  const submitResponse = useSubmitFormResponse()
  const [answers, setAnswers] = useState<Record<string, Answer>>({})

  const endAfterStart = !d.endTime || !d.time || d.endTime > d.time
  const basicsValid = d.name.trim().length > 0 && d.day.length > 0 && endAfterStart
  // If/then rules (Admin -> Forms -> Configuration): hidden questions are
  // neither rendered, required, nor submitted.
  const isVisible = (f: IntakeField) => fieldVisible(intake, f.id, (id) => answerText(answers[id]))
  const intakeFields = flattenIntake(intake).filter(isVisible)
  const detailsValid = intakeFields.every((f) => DISPLAY_TYPES.includes(f.type) || !f.required || answerText(answers[f.id]).trim() !== '')
  const isLast = step === STEPS.length - 1

  function submit() {
    const startsAt = zonedToIso(d.day, d.time || '09:00', d.timezone)
    const endsAt = d.endTime ? zonedToIso(d.day, d.endTime, d.timezone) : undefined
    create.mutate(
      {
        name: d.name.trim(), type: d.type, location: d.location.trim(),
        startsAt, endsAt, timezone: d.timezone, intakeFormId: intakeFormId ?? undefined,
        flaggedCritical: d.flagged,
      },
      {
        onSuccess: (ev) => {
          const filled = intakeFields
            .filter((f) => !DISPLAY_TYPES.includes(f.type))
            .map((f) => ({ fieldId: f.id, label: f.label || 'Untitled', value: answerText(answers[f.id]) }))
            .filter((r) => r.value.trim() !== '')
          if (filled.length > 0) {
            submitResponse.mutate({ purpose: 'EVENT_INTAKE', formId: intakeFormId ?? undefined, subjectType: 'EVENT', subjectId: ev.id, answers: JSON.stringify(filled) })
          }
          saveResponses(ev.id, intake, answers)
          toastMsg(`Event "${d.name.trim()}" created`)
          onCreated()
          onClose()
        },
      },
    )
  }

  return (
    <SlideOver label="New event" onClose={onClose} width={460}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)' }}>New event</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 2, background: i <= step ? 'var(--bofa-navy)' : 'var(--app-sunken)' }} />
              <div style={{ fontSize: 10.5, marginTop: 4, color: i === step ? 'var(--ink-1)' : 'var(--ink-4)', fontWeight: i === step ? 600 : 400 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Event name">
              <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="MIT Fall Career Fair" />
            </Field>
            <Field label="Type">
              <select className="select" value={d.type} onChange={(e) => set({ type: e.target.value })}>
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Format">
              <div className="segmented" role="group" aria-label="Format">
                {(['In-person', 'Virtual', 'Hybrid'] as const).map((f) => (
                  <button key={f} aria-pressed={d.format === f} onClick={() => set({ format: f })}>{f}</button>
                ))}
              </div>
            </Field>
            <Field label={d.format === 'Virtual' ? 'Meeting link' : 'Location / campus'}>
              <input className="input" value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder={d.format === 'Virtual' ? 'https://…' : 'Cambridge, MA'} />
            </Field>
            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="Date" style={{ flex: 1 }}>
                <input className="input" type="date" value={d.day} onChange={(e) => set({ day: e.target.value })} />
              </Field>
              <Field label="Start time" style={{ flex: 1 }}>
                <input className="input" type="time" value={d.time} onChange={(e) => set({ time: e.target.value })} />
              </Field>
              <Field label="End time" style={{ flex: 1 }}>
                <input className="input" type="time" value={d.endTime} onChange={(e) => set({ endTime: e.target.value })} />
                {!endAfterStart && (
                  <div style={{ fontSize: 11.5, color: 'var(--danger-fg, #b3261e)', marginTop: 4 }}>Must be after the start time</div>
                )}
              </Field>
              <Field label="Timezone" style={{ flex: 1 }}>
                <select className="select" value={d.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                  {TIMEZONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
                <input type="checkbox" checked={d.flagged} onChange={(e) => set({ flagged: e.target.checked })} />
                Flag for compliance review — routes this event down the workflow's exception path
              </label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {intakeFields.length === 0 ? (
              <p className="sub" style={{ fontSize: 12.5, margin: 0 }}>
                No custom intake fields are configured. Admins can design this step under Admin → Forms.
              </p>
            ) : (
              <>
              {intakeForms.length > 1 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: 'var(--ink-4)', marginBottom: 4 }}>
                  Intake form
                  <select className="select" value={intakeFormId ?? ''}
                    onChange={(ev2) => { setIntakeFormId(ev2.target.value); setAnswers({}) }}>
                    {intakeForms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}{f.defaultForKind ? ' ★' : ''}</option>
                    ))}
                  </select>
                </label>
              )}
              {intake.rows.map((row) => {
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
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <Fact label="Name">{d.name || '—'}</Fact>
            <Fact label="Type">{typeLabel(d.type)}</Fact>
            <Fact label="Format">{d.format}</Fact>
            <Fact label={d.format === 'Virtual' ? 'Link' : 'Location'}>{d.location || '—'}</Fact>
            <Fact label="When">
              {d.day
                ? `${d.day} · ${d.time}${d.endTime ? `–${d.endTime}` : ''} ${TIMEZONES.find((t) => t.value === d.timezone)?.label ?? ''}`
                : '—'}
            </Fact>
            {intakeFields
              .filter((f) => !DISPLAY_TYPES.includes(f.type))
              .filter((f) => answerText(answers[f.id]).trim() !== '')
              .map((f) => (
                <Fact key={f.id} label={f.label}>{answerText(answers[f.id])}</Fact>
              ))}
            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 12, lineHeight: 1.5 }}>
              The event is created with its basics; intake details are kept with the event record for planning and reporting.
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
        {step > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setStep((s) => s - 1)}>Back</button>
        )}
        <div style={{ flex: 1 }} />
        {!isLast ? (
          <button
            className="btn btn--primary btn--sm"
            disabled={(step === 0 && !basicsValid) || (step === 1 && !detailsValid)}
            onClick={() => setStep((s) => s + 1)}
          >
            Next
          </button>
        ) : (
          <button className="btn btn--primary btn--sm" disabled={!basicsValid || create.isPending} onClick={submit}>
            {create.isPending ? 'Creating…' : 'Create event'}
          </button>
        )}
      </div>
    </SlideOver>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Filter = 'upcoming' | 'past' | 'all'

export default function EventsPage() {
  const { data, isLoading } = useEvents()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [selected, setSelected] = useState<EventRow | null>(null)
  const [creating, setCreating] = useState(false)

  const kpis = useMemo(() => {
    const list = data ?? []
    const upcoming = list.filter((e) => isUpcoming(e.startsAt)).length
    const reg = list.reduce((n, e) => n + e.registrations, 0)
    const att = list.reduce((n, e) => n + e.attended, 0)
    const hires = list.reduce((n, e) => n + e.hires, 0)
    return { upcoming, reg, attRate: rate(att, reg), hires }
  }, [data])

  const rows = useMemo(() => {
    const list = data ?? []
    const f = list.filter((e) =>
      filter === 'all' ? true : filter === 'upcoming' ? isUpcoming(e.startsAt) : !isUpcoming(e.startsAt),
    )
    return [...f].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [data, filter])

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Engagement · Campus
        </div>
        <div className="page-head__row">
          <div>
            <h1>Campus</h1>
            <p className="sub">
              Run campus drives and hiring events end to end — registration through attendance to offers, with the conversion
              funnel in one view.
            </p>
          </div>
          <a className="btn btn--ghost" href="/careers/events" target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>View public page →</a>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>New event</button>
        </div>
      </div>

      <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
        <StatTile label="Upcoming events" value={kpis.upcoming} meta="Scheduled ahead" />
        <StatTile label="Total registrations" value={kpis.reg.toLocaleString()} meta="Across all events" />
        <StatTile label="Avg attendance" value={`${kpis.attRate}%`} meta="Registered → attended" />
        <StatTile label="Hires from events" value={kpis.hires} meta="Event-sourced" />
      </div>

      <div className="segmented" role="group" aria-label="Filter" style={{ marginBottom: 16 }}>
        <button aria-pressed={filter === 'upcoming'} onClick={() => setFilter('upcoming')}>Upcoming</button>
        <button aria-pressed={filter === 'past'} onClick={() => setFilter('past')}>Past</button>
        <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
      </div>

      {isLoading ? (
        <div className="card"><div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>Loading events…</div></div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div style={{ padding: '44px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>
              {filter === 'upcoming' ? 'No upcoming events' : filter === 'past' ? 'No past events' : 'No events yet'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', margin: '6px 0 16px' }}>Schedule a campus drive, career fair, or hiring event.</div>
            <button className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>New event</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {rows.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className="card"
              style={{ padding: 20, display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--app-panel)', font: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 17 }}>{e.name}</h3>
                <span className={`badge ${typeBadge(e.type)}`}>{typeLabel(e.type)}</span>
              </div>
              <div className="muted" style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{e.location || 'TBD'}</span>
                <span style={{ color: 'var(--ink-5)' }}>·</span>
                <span>{date(e.startsAt)} · {timeRange(e)}</span>
                {approvalBadge(e.approvalStatus)}
                <span className="badge" style={{ marginLeft: 'auto' }}>{formatOf(e)}</span>
              </div>
              <FunnelBar e={e} />
            </button>
          ))}
        </div>
      )}

      {selected && <EventDetail e={selected} onClose={() => setSelected(null)} />}
      {creating && <CreateEventWizard onClose={() => setCreating(false)} onCreated={() => setFilter('all')} />}
    </div>
  )
}
