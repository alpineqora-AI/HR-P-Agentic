import { useMemo, useState } from 'react'
import SlideOver, { useSlideOverClose } from '@/components/SlideOver'
import { useProposeTimes, useSchedulingOverview, useTransitionInterview } from '@/api/hooks'
import type { AttentionItem, InterviewerLoad } from '@/api/types'
import { date } from '@/lib/format'

/* The scheduling attention bar — "what's stuck", across every job. A slim strip
   of counters keeps the calendar as the page's hero; clicking a counter opens a
   full-height panel that scales to any number of records. The panel picker
   doubles as the load-balancing assist (interviewers sorted lightest-first). */

type LaneKey = 'awaiting' | 'outcome' | 'noshow' | 'today' | 'load'

const timeShort = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const age = (hours: number) => (hours < 1 ? '<1h' : hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`)

const LANES: { key: LaneKey; label: string; tone: string; hint: string }[] = [
  { key: 'awaiting', label: 'Awaiting candidate', tone: 'var(--warn, #b45309)', hint: 'Offers out — the candidate hasn’t picked a time yet. Re-propose to retract and offer fresh times (optionally with a different panel).' },
  { key: 'outcome', label: 'Needs outcome', tone: 'var(--bofa-red, #c41230)', hint: 'The scheduled time has passed — record what happened so the pipeline keeps moving.' },
  { key: 'noshow', label: 'No-show recovery', tone: 'var(--info, #1d4ed8)', hint: 'Aria has already re-offered times in the candidate’s chat. No action needed unless you want to step in.' },
  { key: 'today', label: 'Today', tone: 'var(--ok, #047857)', hint: 'Interviews happening today (ET).' },
]

export function SchedulingRadar() {
  const { data } = useSchedulingOverview()
  const [open, setOpen] = useState<LaneKey | null>(null)
  const [panelFor, setPanelFor] = useState<AttentionItem | null>(null)

  if (!data) return null

  const itemsFor = (key: LaneKey): AttentionItem[] =>
    key === 'awaiting' ? data.awaitingCandidate
    : key === 'outcome' ? data.needsOutcome
    : key === 'noshow' ? data.noShows
    : key === 'today' ? data.today
    : []

  const busiest = [...data.load].sort((a, b) => b.next7Days - a.next7Days)[0]

  return (
    <>
      <div
        className="card"
        style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', flexWrap: 'wrap' }}
      >
        <span className="eyebrow" style={{ margin: '0 8px' }}>Scheduling</span>
        {LANES.map((lane) => {
          const n = itemsFor(lane.key).length
          return (
            <button
              key={lane.key}
              onClick={() => n > 0 && setOpen(lane.key)}
              disabled={n === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px',
                borderRadius: 999, border: '1px solid var(--line)', fontSize: 12.5,
                background: 'var(--app-panel)', color: n === 0 ? 'var(--ink-4)' : 'var(--ink-1)',
                cursor: n === 0 ? 'default' : 'pointer', opacity: n === 0 ? 0.6 : 1,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: n === 0 ? 'var(--line)' : lane.tone }} />
              {lane.label}
              <span className="t-strong" style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            </button>
          )
        })}
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setOpen('load')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px',
            borderRadius: 999, border: '1px solid var(--line)', fontSize: 12.5,
            background: 'var(--app-panel)', color: 'var(--ink-2)', cursor: 'pointer',
          }}
        >
          Interviewer load
          {busiest && busiest.next7Days > 0 && (
            <span className="muted" style={{ fontSize: 11.5 }}>
              busiest: {busiest.name.split(' ')[0]} · {busiest.next7Days}
            </span>
          )}
        </button>
      </div>

      {open && open !== 'load' && (
        <LanePanel
          lane={LANES.find((l) => l.key === open)!}
          items={itemsFor(open)}
          onClose={() => setOpen(null)}
          onPropose={(item) => {
            setOpen(null)
            setPanelFor(item)
          }}
        />
      )}
      {open === 'load' && <LoadPanel load={data.load} onClose={() => setOpen(null)} />}
      {panelFor && <PanelPicker item={panelFor} load={data.load} onClose={() => setPanelFor(null)} />}
    </>
  )
}

function PanelHeader({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  const animated = useSlideOverClose()
  const close = animated ?? onClose
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px 14px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>{title}</div>
        {sub && <div className="sub" style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.5 }}>{sub}</div>}
      </div>
      <button type="button" onClick={close} aria-label="Close"
        style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--ink-4)' }}>
        ×
      </button>
    </div>
  )
}

/* Full-height lane panel: every record, scrollable, inline actions. */
function LanePanel({
  lane,
  items,
  onClose,
  onPropose,
}: {
  lane: { key: LaneKey; label: string; hint: string }
  items: AttentionItem[]
  onClose: () => void
  onPropose: (item: AttentionItem) => void
}) {
  const transition = useTransitionInterview()
  const btn = { fontSize: 12, padding: '3px 9px' } as const

  return (
    <SlideOver label={lane.label} onClose={onClose} width={420}>
      <PanelHeader title={`${lane.label} · ${items.length}`} sub={lane.hint} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 16px' }}>
        {items.map((item) => (
          <div key={item.interviewId} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span className="t-strong" style={{ fontSize: 13.5 }}>{item.candidateName}</span>
              {lane.key === 'awaiting' && (
                <span className="muted" style={{ fontSize: 11.5 }}>waiting {age(item.waitingHours)}</span>
              )}
              {lane.key === 'outcome' && item.scheduledAt && (
                <span className="muted" style={{ fontSize: 11.5 }}>{date(item.scheduledAt)}</span>
              )}
              {lane.key === 'today' && (
                <span className="muted" style={{ fontSize: 11.5 }}>{timeShort(item.scheduledAt)}</span>
              )}
            </div>
            <div className="muted" style={{ fontSize: 12, margin: '2px 0 8px' }}>
              {item.jobTitle}
              {item.interviewers.length > 0 && <> · with {item.interviewers.join(', ')}</>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lane.key === 'awaiting' && (
                <button className="btn btn--outline btn--sm" style={btn} onClick={() => onPropose(item)}>
                  Re-propose…
                </button>
              )}
              {lane.key === 'outcome' && (
                <>
                  <button className="btn btn--outline btn--sm" style={btn} disabled={transition.isPending}
                    onClick={() => transition.mutate({ interviewId: item.interviewId, status: 'COMPLETED' })}>
                    Complete
                  </button>
                  <button className="btn btn--outline btn--sm" style={btn} disabled={transition.isPending}
                    onClick={() => transition.mutate({ interviewId: item.interviewId, status: 'NO_SHOW' })}>
                    No-show
                  </button>
                </>
              )}
              {lane.key === 'noshow' && (
                <span className="muted" style={{ fontSize: 12 }}>Aria is on it — new offers sent</span>
              )}
              {lane.key === 'today' && item.meetingLink && (
                <a href={item.meetingLink} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Join on Teams</a>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="muted" style={{ fontSize: 13, padding: '18px 0' }}>All clear.</div>
        )}
      </div>
    </SlideOver>
  )
}

/* Interviewer load: everyone's booked interviews over the next 7 days. */
function LoadPanel({ load, onClose }: { load: InterviewerLoad[]; onClose: () => void }) {
  const max = Math.max(1, ...load.map((l) => l.next7Days))
  return (
    <SlideOver label="Interviewer load" onClose={onClose} width={420}>
      <PanelHeader
        title="Interviewer load · next 7 days"
        sub="Booked interviews per person. The panel picker sorts lightest-first so new rounds spread the load."
        onClose={onClose}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 16px' }}>
        {load.map((l) => (
          <div key={l.userId} style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>
                <span className="t-strong">{l.name}</span>
                <span className="muted" style={{ fontSize: 11.5 }}> · {l.role.replace('_', ' ').toLowerCase()}</span>
              </span>
              <span className="muted">{l.next7Days} interview{l.next7Days === 1 ? '' : 's'}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--app-sunken)', marginTop: 5 }}>
              <div
                style={{
                  height: 5, borderRadius: 3,
                  width: `${(l.next7Days / max) * 100}%`,
                  background: l.next7Days >= max && max > 1 ? 'var(--bofa-red, #c41230)' : 'var(--bofa-navy, #012169)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </SlideOver>
  )
}

/* Panel picker + load-balancing assist: choose who sits on this round, lightest
   load first, then re-propose times that fit every panelist's calendar. */
function PanelPicker({ item, load, onClose }: { item: AttentionItem; load: InterviewerLoad[]; onClose: () => void }) {
  const propose = useProposeTimes()
  const animated = useSlideOverClose()
  const byLoad = useMemo(() => [...load].sort((a, b) => a.next7Days - b.next7Days), [load])
  const [selected, setSelected] = useState<string[]>(() =>
    load.filter((l) => item.interviewers.includes(l.name)).map((l) => l.userId))

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  return (
    <SlideOver label="Choose the panel and re-propose times" onClose={onClose} width={420}>
      <PanelHeader title="Propose times" sub={`${item.candidateName} · ${item.jobTitle}`} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Panel · lightest load first</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {byLoad.map((l) => {
            const on = selected.includes(l.userId)
            return (
              <button
                key={l.userId}
                onClick={() => toggle(l.userId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer',
                  borderRadius: 'var(--ra-2)', textAlign: 'left', fontSize: 13,
                  border: on ? '1.5px solid var(--bofa-navy, #012169)' : '1px solid var(--line)',
                  background: on ? 'var(--app-sunken)' : 'var(--app-panel)', color: 'var(--ink-1)',
                }}
              >
                <span className="t-strong" style={{ width: 30 }}>{l.initials}</span>
                <span style={{ flex: 1 }}>
                  {l.name}
                  <span className="muted" style={{ fontSize: 11.5 }}> · {l.role.replace('_', ' ').toLowerCase()}</span>
                </span>
                <span className={`badge ${l.next7Days >= 2 ? 'badge--warn' : 'badge--ok'}`}>
                  {l.next7Days}/7d
                </span>
              </button>
            )
          })}
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
          Proposed times will fit every selected panelist's calendar (9–5 ET, buffers and
          daily caps applied). Leave empty to use the job's default hiring team.
        </p>
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn--outline" onClick={() => (animated ?? onClose)()}>Cancel</button>
        <button
          className="btn"
          disabled={propose.isPending}
          onClick={() =>
            propose.mutate(
              { interviewId: item.interviewId, interviewerUserIds: selected.length ? selected : undefined },
              { onSuccess: () => (animated ?? onClose)() },
            )
          }
        >
          {propose.isPending ? 'Proposing…' : 'Propose times'}
        </button>
      </div>
    </SlideOver>
  )
}
