import { useMemo, useState } from 'react'
import ConfirmButton from '@/components/ConfirmButton'
import { useStore } from '@/state/store'
import { usePersistentState, uid } from './builderStore'
import LogicTab, { type LogicRule } from './SurveyLogic'

// Survey studio — an exact port of the Arya "Teammate Voices" survey editor
// (packages/teammate-voices/src/pages/SurveyEditor.tsx) onto Olivia's design
// system: survey library (Program · Name · Summary · Cycle · Status columns),
// six-tab editor (Details · Form Builder · Form Viewer · Configuration ·
// Participants · Distribute), dual status pills (survey + build), Program
// mapping with the exact fallback list, ✉️ Email Communications on Details,
// the 🚀 pre-flight publish modal, and the ACTIVE/CLOSED read-only lock.
// Configuration/Participants/Distribute panels are ported in later phases.

// ── Model ───────────────────────────────────────────────────────────────────
export type QuestionType =
  | 'SINGLE_SELECT' | 'MULTIPLE_SELECT' | 'RATING_SCALE' | 'GRID_RATING'
  | 'RADIO' | 'CHECKBOXES' | 'SINGLE_LINE' | 'TEXTAREA' | 'SLIDING_SCALE' | 'STATIC_TEXT'

export interface Option { text: string; value: number }

export interface Question {
  id: string
  text: string
  type: QuestionType
  label: string
  required: boolean
  options?: Option[]
  gridRows?: string[]
  min?: number
  max?: number
  step?: number
}

export interface Page {
  id: string // PG-XXX
  label: string
  title: string
  description: string
  showDescription: boolean
  questions: Question[]
}

export interface SurveyV2 {
  id: string
  name: string // Survey Name (Arya: title)
  summary: string // Summary (Arya: description)
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  buildStatus: 'DRAFT' | 'PUBLISHED'
  programId?: number
  cycle: string
  startDate: string
  endDate: string
  pages: Page[]
  logicRules?: LogicRule[]
  createdAt: string
  updatedAt: string
}

export const SURVEYS_V2_KEY = 'olivia.surveysV2'

// Exact fallback program list from Teammate Voices' SurveyEditor.
const FALLBACK_PROGRAMS = [
  { programId: 1, name: 'Teammate Voices' },
  { programId: 2, name: 'ESAT' },
  { programId: 3, name: 'Intern Program' },
  { programId: 4, name: 'NPS Survey' },
]

const programName = (id?: number) => FALLBACK_PROGRAMS.find((p) => p.programId === id)?.name ?? '—'

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'SINGLE_SELECT', label: 'Single Select' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple Select' },
  { value: 'RATING_SCALE', label: 'Rating Scale' },
  { value: 'GRID_RATING', label: 'Grid Rating Scale' },
  { value: 'RADIO', label: 'Radio Buttons' },
  { value: 'CHECKBOXES', label: 'Checkboxes' },
  { value: 'SINGLE_LINE', label: 'Single-line Input' },
  { value: 'TEXTAREA', label: 'Text Area' },
  { value: 'SLIDING_SCALE', label: 'Sliding Scale' },
  { value: 'STATIC_TEXT', label: 'Static Text' },
]

const RATING_DEFAULTS: Option[] = [
  { value: 1, text: 'Strongly Disagree' },
  { value: 2, text: 'Disagree' },
  { value: 3, text: 'Neutral' },
  { value: 4, text: 'Agree' },
  { value: 5, text: 'Strongly Agree' },
]

const hasOptions = (t: QuestionType) =>
  ['SINGLE_SELECT', 'MULTIPLE_SELECT', 'RATING_SCALE', 'GRID_RATING', 'RADIO', 'CHECKBOXES'].includes(t)

function newQuestion(type: QuestionType): Question {
  const q: Question = { id: uid(), text: '', type, label: '', required: false }
  if (type === 'RATING_SCALE' || type === 'GRID_RATING') q.options = RATING_DEFAULTS.map((o) => ({ ...o }))
  else if (hasOptions(type)) q.options = [{ text: 'Option 1', value: 1 }, { text: 'Option 2', value: 2 }]
  if (type === 'GRID_RATING') q.gridRows = ['Row 1', 'Row 2']
  if (type === 'SLIDING_SCALE') { q.min = 1; q.max = 10; q.step = 1 }
  return q
}

function pageIdFrom(label: string): string {
  const slug = label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8)
  return `PG-${slug || 'PAGE'}`
}

function newPage(label: string): Page {
  return { id: pageIdFrom(label), label, title: label, description: '', showDescription: false, questions: [] }
}

function freshSurvey(): SurveyV2 {
  const page = newPage('Welcome')
  page.questions = [{ ...newQuestion('RATING_SCALE'), text: 'How would you rate your experience so far?', label: 'overall' }]
  const now = new Date().toISOString()
  return {
    id: uid(), name: '', summary: '', status: 'DRAFT', buildStatus: 'DRAFT',
    programId: undefined, cycle: '', startDate: '', endDate: '',
    pages: [page], createdAt: now, updatedAt: now,
  }
}

// Older stored shapes (touchpoint-era) normalize into the exact Arya model.
function normalize(s: Partial<SurveyV2> & { touchpoint?: string }): SurveyV2 {
  const now = new Date().toISOString()
  return {
    id: s.id ?? uid(),
    name: s.name ?? '',
    summary: s.summary ?? '',
    status: s.status ?? 'DRAFT',
    buildStatus: s.buildStatus ?? (s.status === 'ACTIVE' ? 'PUBLISHED' : 'DRAFT'),
    programId: s.programId,
    cycle: s.cycle ?? '',
    startDate: s.startDate ?? '',
    endDate: s.endDate ?? '',
    pages: s.pages ?? [],
    logicRules: s.logicRules ?? [],
    createdAt: s.createdAt ?? s.updatedAt ?? now,
    updatedAt: s.updatedAt ?? now,
  }
}

// One-time migration: old single-page builder surveys → V2 shape.
function migrateOld(): SurveyV2[] {
  try {
    const raw = localStorage.getItem('olivia.surveys')
    if (!raw) return [freshSurvey()]
    const olds = JSON.parse(raw)
    if (!Array.isArray(olds) || olds.length === 0) return [freshSurvey()]
    const mapType = (t: string): QuestionType =>
      t === 'rating' ? 'RATING_SCALE' : t === 'nps' ? 'SLIDING_SCALE' : t === 'single' ? 'SINGLE_SELECT'
      : t === 'multi' ? 'MULTIPLE_SELECT' : t === 'yesno' ? 'RADIO' : t === 'long' ? 'TEXTAREA' : 'SINGLE_LINE'
    return olds.map((o: { id?: string; name?: string; stage?: string; intro?: string; questions?: { type: string; title: string; required?: boolean; options?: string[] }[] }) => {
      const page = newPage('Main')
      page.description = o.intro ?? ''
      page.showDescription = !!o.intro
      page.questions = (o.questions ?? []).map((q) => {
        const nq = newQuestion(mapType(q.type))
        nq.text = q.title
        nq.required = !!q.required
        if (q.type === 'nps') { nq.min = 0; nq.max = 10; nq.step = 1 }
        if (q.options && hasOptions(nq.type)) nq.options = q.options.map((t: string, i: number) => ({ text: t, value: i + 1 }))
        if (q.type === 'yesno') nq.options = [{ text: 'Yes', value: 1 }, { text: 'No', value: 0 }]
        return nq
      })
      const now = new Date().toISOString()
      return normalize({ id: o.id ?? uid(), name: o.name ?? 'Untitled survey', pages: [page], createdAt: now, updatedAt: now })
    })
  } catch {
    return [freshSurvey()]
  }
}

const questionCount = (s: SurveyV2) => s.pages.reduce((n, p) => n + p.questions.length, 0)

function StatusPill({ status }: { status: SurveyV2['status'] }) {
  const cls = status === 'ACTIVE' ? 'badge--ok' : status === 'DRAFT' ? 'badge--warn' : 'badge--neutral'
  const label = status === 'ACTIVE' ? 'Active' : status === 'DRAFT' ? 'Draft' : 'Closed'
  return <span className={`badge ${cls}`}>{label}</span>
}

function BuildPill({ buildStatus }: { buildStatus: SurveyV2['buildStatus'] }) {
  return (
    <span className={`badge ${buildStatus === 'PUBLISHED' ? 'badge--ok' : 'badge--warn'}`}>
      {buildStatus === 'PUBLISHED' ? 'Published' : 'Draft'}
    </span>
  )
}

// Exact amber read-only chip from the Teammate Voices header.
function ReadOnlyChip({ text }: { text: string }) {
  return (
    <span style={{ fontSize: 12, color: '#d97706', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '3px 10px' }}>
      🔒 {text}
    </span>
  )
}

// ── Library ─────────────────────────────────────────────────────────────────
function Library({ surveys, onEdit, onNew, onClone, onDelete }: {
  surveys: SurveyV2[]
  onEdit: (id: string) => void
  onNew: () => void
  onClone: (id: string) => void
  onDelete: (id: string) => void
}) {
  const d = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
  return (
    <div className="card">
      <div className="card__head">
        <h3 style={{ fontSize: 15 }}>Survey</h3>
        <button className="btn btn--primary btn--sm" onClick={onNew}>Create survey</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Survey Name</th>
              <th>Summary</th>
              <th>Cycle</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th>Date Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {surveys.map((s) => (
              <tr key={s.id}>
                <td className="t-muted">{programName(s.programId)}</td>
                <td className="t-strong">{s.name || 'Untitled survey'}</td>
                <td className="t-muted">{s.summary || '—'}</td>
                <td className="t-muted">{s.cycle || '—'}</td>
                <td><StatusPill status={s.status} /></td>
                <td className="t-muted">{d(s.updatedAt)}</td>
                <td className="t-muted">{d(s.createdAt)}</td>
                <td>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <button className="btn btn--outline btn--sm" onClick={() => onEdit(s.id)}>{s.status === 'DRAFT' ? 'Edit' : 'Open'}</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => onClone(s.id)}>Clone</button>
                    {s.status === 'DRAFT' && (
                      <ConfirmButton label="Delete" confirmLabel="Delete survey?" onConfirm={() => onDelete(s.id)} disabled={surveys.length <= 1} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Details tab ─────────────────────────────────────────────────────────────
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>{children}</div>
}

function L({ label, help, required, children }: { label: string; help?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}{required ? <span style={{ color: 'var(--bofa-red)' }}> *</span> : null}</div>
      {children}
      {help ? <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 4 }}>{help}</div> : null}
    </label>
  )
}

function Toggle({ on, onChange, disabled, labels = ['On', 'Off'] }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; labels?: [string, string] | string[] }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)',
        background: 'var(--app-panel)', borderRadius: 999, padding: '5px 10px 5px 6px', cursor: disabled ? 'default' : 'pointer', font: 'inherit', fontSize: 12.5,
      }}
    >
      <span style={{ width: 30, height: 16, borderRadius: 999, background: on ? 'var(--c-green)' : 'var(--ink-5)', position: 'relative', transition: 'background .15s ease' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left .15s ease' }} />
      </span>
      {on ? labels[0] : labels[1]}
    </button>
  )
}

function DetailsTab({ s, patch, locked, onSaved, onNext }: {
  s: SurveyV2
  patch: (p: Partial<SurveyV2>) => void
  locked: boolean
  onSaved: () => void
  onNext: () => void
}) {
  const [saveMessage, setSaveMessage] = useState('')

  function save() {
    if (!s.name.trim()) return
    onSaved()
    setSaveMessage('Survey saved successfully')
    setTimeout(() => setSaveMessage(''), 3000)
  }

  return (
    <div className="card">
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>Survey information</h3>

        <Row>
          <L label="Survey Name" help="Create a name for the survey." required>
            <input className="input" placeholder="Add name" value={s.name} disabled={locked} onChange={(e) => patch({ name: e.target.value })} />
          </L>
          <L label="Summary" help="Add a short description of the survey.">
            <input className="input" placeholder="Add description" value={s.summary} disabled={locked} onChange={(e) => patch({ summary: e.target.value })} />
          </L>
          <L label="Survey status">
            <Toggle
              on={s.status === 'ACTIVE'}
              labels={['Active', 'Inactive']}
              onChange={(v) => patch({ status: v ? 'ACTIVE' : 'DRAFT' })}
            />
          </L>
        </Row>

        <Row>
          <L label="Program" help="Map the survey to a program." required>
            <select
              className="select"
              value={s.programId ? String(s.programId) : ''}
              disabled={locked}
              onChange={(e) => patch({ programId: Number(e.target.value) || undefined })}
            >
              <option value="">Select</option>
              {FALLBACK_PROGRAMS.map((prog) => (
                <option key={prog.programId} value={String(prog.programId)}>{prog.name}</option>
              ))}
            </select>
          </L>
          <L label="Start Date">
            <input className="input" type="date" value={s.startDate} disabled={locked} onChange={(e) => patch({ startDate: e.target.value })} />
          </L>
          <L label="End Date">
            <input className="input" type="date" value={s.endDate} disabled={locked} onChange={(e) => patch({ endDate: e.target.value })} />
          </L>
        </Row>

        <div style={{ borderTop: '1px solid var(--line)' }} />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {saveMessage && <span style={{ fontSize: 12.5, color: 'var(--c-green)' }}>{saveMessage}</span>}
          {locked && <ReadOnlyChip text={`This survey is ${s.status.toLowerCase()} — clone it to make changes`} />}
          <button className="btn btn--outline btn--sm" onClick={save} disabled={locked}>Save</button>
          <button className="btn btn--primary btn--sm" onClick={onNext}>Next</button>
        </div>
      </div>
    </div>
  )
}

// ── Form Builder tab ────────────────────────────────────────────────────────
function OptionsEditor({ q, onChange, locked }: { q: Question; onChange: (q: Question) => void; locked: boolean }) {
  const options = q.options ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="eyebrow">Options</div>
      {options.map((o, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" value={o.text} disabled={locked} style={{ flex: 1 }}
            onChange={(e) => onChange({ ...q, options: options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
          <input className="input t-num" type="number" value={o.value} disabled={locked} style={{ width: 74 }} aria-label="Option value"
            onChange={(e) => onChange({ ...q, options: options.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)) })} />
          <button className="btn btn--ghost btn--sm" disabled={locked || options.length <= 1} aria-label="Remove option"
            onClick={() => onChange({ ...q, options: options.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button className="btn btn--outline btn--sm" style={{ alignSelf: 'flex-start' }} disabled={locked}
        onClick={() => onChange({ ...q, options: [...options, { text: `Option ${options.length + 1}`, value: options.length + 1 }] })}>
        + Add option
      </button>
    </div>
  )
}

function GridRowsEditor({ q, onChange, locked }: { q: Question; onChange: (q: Question) => void; locked: boolean }) {
  const rows = q.gridRows ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="eyebrow">Rows (sub-questions)</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" value={r} disabled={locked} style={{ flex: 1 }}
            onChange={(e) => onChange({ ...q, gridRows: rows.map((x, j) => (j === i ? e.target.value : x)) })} />
          <button className="btn btn--ghost btn--sm" disabled={locked || rows.length <= 1} aria-label="Remove row"
            onClick={() => onChange({ ...q, gridRows: rows.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button className="btn btn--outline btn--sm" style={{ alignSelf: 'flex-start' }} disabled={locked}
        onClick={() => onChange({ ...q, gridRows: [...rows, `Row ${rows.length + 1}`] })}>
        + Add row
      </button>
    </div>
  )
}

function QuestionCard({ q, index, locked, onChange, onRemove }: {
  q: Question
  index: number
  locked: boolean
  onChange: (q: Question) => void
  onRemove: () => void
}) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--line)' }}>
        <span className="t-num" style={{ width: 30, height: 22, borderRadius: 999, background: 'var(--navy-050)', color: 'var(--bofa-navy)', fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          Q{index + 1}
        </span>
        <select className="select" value={q.type} disabled={locked} style={{ width: 190, height: 30, padding: '2px 8px', fontSize: 12.5 }}
          onChange={(e) => {
            const t = e.target.value as QuestionType
            const base = newQuestion(t)
            onChange({ ...base, id: q.id, text: q.text, label: q.label, required: q.required })
          }}>
          {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="badge"
          aria-pressed={q.required}
          disabled={locked}
          onClick={() => onChange({ ...q, required: !q.required })}
          style={{ cursor: locked ? 'default' : 'pointer', border: '1px solid var(--line)', background: q.required ? 'var(--navy-050)' : 'var(--app-panel)', color: q.required ? 'var(--bofa-navy)' : 'var(--ink-4)', fontWeight: 600 }}
        >
          Required
        </button>
        <button className="btn btn--ghost btn--sm" disabled={locked} onClick={onRemove} aria-label="Delete question">×</button>
      </div>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {q.type === 'STATIC_TEXT' ? (
          <textarea className="input" rows={2} value={q.text} disabled={locked} placeholder="Instructional text shown to respondents"
            onChange={(e) => onChange({ ...q, text: e.target.value })} style={{ resize: 'vertical' }} />
        ) : (
          <input className="input" value={q.text} disabled={locked} placeholder="Question text"
            onChange={(e) => onChange({ ...q, text: e.target.value })} style={{ fontSize: 14, fontWeight: 500 }} />
        )}
        {q.type !== 'STATIC_TEXT' && (
          <input className="input" value={q.label} disabled={locked} placeholder="Question label (short identifier, e.g. mgr_support)"
            onChange={(e) => onChange({ ...q, label: e.target.value })} style={{ fontSize: 12.5, width: 320 }} />
        )}
        {q.type === 'GRID_RATING' && <GridRowsEditor q={q} onChange={onChange} locked={locked} />}
        {hasOptions(q.type) && <OptionsEditor q={q} onChange={onChange} locked={locked} />}
        {q.type === 'SLIDING_SCALE' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <L label="Min"><input className="input t-num" type="number" value={q.min ?? 1} disabled={locked} style={{ width: 90 }} onChange={(e) => onChange({ ...q, min: Number(e.target.value) })} /></L>
            <L label="Max"><input className="input t-num" type="number" value={q.max ?? 10} disabled={locked} style={{ width: 90 }} onChange={(e) => onChange({ ...q, max: Number(e.target.value) })} /></L>
            <L label="Step"><input className="input t-num" type="number" value={q.step ?? 1} disabled={locked} style={{ width: 90 }} onChange={(e) => onChange({ ...q, step: Number(e.target.value) })} /></L>
          </div>
        )}
      </div>
    </div>
  )
}

function BuilderTab({ s, patch, locked }: { s: SurveyV2; patch: (p: Partial<SurveyV2>) => void; locked: boolean }) {
  const [pageIdx, setPageIdx] = useState(0)
  const [addType, setAddType] = useState<QuestionType>('RATING_SCALE')
  const page = s.pages[Math.min(pageIdx, s.pages.length - 1)]

  function patchPage(p: Partial<Page>) {
    patch({ pages: s.pages.map((x, i) => (i === pageIdx ? { ...x, ...p } : x)) })
  }
  function movePage(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= s.pages.length) return
    const pages = [...s.pages]
    ;[pages[i], pages[j]] = [pages[j], pages[i]]
    patch({ pages })
    setPageIdx(j)
  }

  if (!page) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 16, alignItems: 'start' }}>
      {/* Page rail */}
      <div className="card" style={{ padding: 8, position: 'sticky', top: 12 }}>
        <div className="eyebrow" style={{ padding: '6px 8px' }}>Pages</div>
        {s.pages.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <button
              onClick={() => setPageIdx(i)}
              style={{
                flex: 1, textAlign: 'left', border: 0, cursor: 'pointer', borderRadius: 'var(--ra-2)',
                padding: '8px 10px', font: 'inherit',
                background: i === pageIdx ? 'var(--navy-050)' : 'transparent',
                color: i === pageIdx ? 'var(--bofa-navy)' : 'var(--ink-1)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: i === pageIdx ? 600 : 500 }}>{p.label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-5)' }}>{p.id} · {p.questions.length} q</div>
            </button>
            {!locked && i === pageIdx && (
              <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
                <button className="btn btn--ghost btn--sm" style={{ padding: '0 6px', height: 16, fontSize: 10 }} disabled={i === 0} onClick={() => movePage(i, -1)} aria-label="Move page up">↑</button>
                <button className="btn btn--ghost btn--sm" style={{ padding: '0 6px', height: 16, fontSize: 10 }} disabled={i === s.pages.length - 1} onClick={() => movePage(i, 1)} aria-label="Move page down">↓</button>
              </span>
            )}
          </div>
        ))}
        {!locked && (
          <button className="btn btn--outline btn--sm" style={{ width: '100%', marginTop: 8 }}
            onClick={() => { patch({ pages: [...s.pages, newPage(`Page ${s.pages.length + 1}`)] }); setPageIdx(s.pages.length) }}>
            + Add page
          </button>
        )}
      </div>

      {/* Page editor */}
      <div>
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <L label="Page label"><input className="input" value={page.label} disabled={locked} style={{ width: 200 }} onChange={(e) => patchPage({ label: e.target.value })} /></L>
              <L label="Page title"><input className="input" value={page.title} disabled={locked} style={{ width: 280 }} onChange={(e) => patchPage({ title: e.target.value })} /></L>
              <div style={{ flex: 1 }} />
              {!locked && s.pages.length > 1 && (
                <ConfirmButton label="Delete page" confirmLabel="Delete page + questions?" onConfirm={() => { patch({ pages: s.pages.filter((_, i) => i !== pageIdx) }); setPageIdx(0) }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <L label="Page description">
                <input className="input" value={page.description} disabled={locked} style={{ width: 420, maxWidth: '100%' }} onChange={(e) => patchPage({ description: e.target.value })} />
              </L>
              <L label="Show description">
                <Toggle on={page.showDescription} disabled={locked} onChange={(v) => patchPage({ showDescription: v })} />
              </L>
            </div>
          </div>
        </div>

        {page.questions.length === 0 ? (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card__body" style={{ padding: '34px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              No questions on this page yet — add one below.
            </div>
          </div>
        ) : (
          page.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={i}
              locked={locked}
              onChange={(nq) => patchPage({ questions: page.questions.map((x) => (x.id === q.id ? nq : x)) })}
              onRemove={() => patchPage({ questions: page.questions.filter((x) => x.id !== q.id) })}
            />
          ))
        )}

        {!locked && (
          <div className="card">
            <div className="card__body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="eyebrow">Add question</span>
              <select className="select" value={addType} style={{ width: 210 }} onChange={(e) => setAddType(e.target.value as QuestionType)}>
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button className="btn btn--primary btn--sm" onClick={() => patchPage({ questions: [...page.questions, newQuestion(addType)] })}>
                Add question
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Form Viewer tab ─────────────────────────────────────────────────────────
function RatingTiles({ options }: { options: Option[] }) {
  const [sel, setSel] = useState<number | null>(null)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, 1fr)`, gap: 8 }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setSel(o.value)}
          style={{
            border: sel === o.value ? '2px solid var(--c-blue)' : '1px solid var(--line)',
            background: sel === o.value ? 'var(--tint-blue)' : 'var(--app-panel)',
            borderRadius: 'var(--ra-2)', padding: '12px 8px', cursor: 'pointer', font: 'inherit',
            // padding compensates the border delta so tiles never change size
            paddingTop: sel === o.value ? 11 : 12, paddingBottom: sel === o.value ? 11 : 12,
          }}
        >
          <div className="t-num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-0)' }}>{o.value}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>{o.text}</div>
        </button>
      ))}
    </div>
  )
}

function Slider({ q }: { q: Question }) {
  const [v, setV] = useState(q.min ?? 1)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input type="range" min={q.min ?? 1} max={q.max ?? 10} step={q.step ?? 1} value={v} onChange={(e) => setV(Number(e.target.value))} style={{ flex: 1 }} />
      <span className="t-num badge badge--info">{v}</span>
    </div>
  )
}

function ViewerQuestion({ q, n }: { q: Question; n: number | null }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      {n !== null ? (
        <span className="t-num" style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bofa-navy)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          {n}
        </span>
      ) : <span style={{ width: 26, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {q.type === 'STATIC_TEXT' ? (
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{q.text || 'Static text'}</div>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-0)', marginBottom: 10 }}>
              {q.text || <span style={{ color: 'var(--ink-5)' }}>Untitled question</span>}
              {q.required ? <span style={{ color: 'var(--bofa-red)' }}> *</span> : null}
            </div>
            {q.type === 'RATING_SCALE' && <RatingTiles options={q.options ?? []} />}
            {q.type === 'GRID_RATING' && (
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th />
                      {(q.options ?? []).map((o) => <th key={o.value} style={{ textAlign: 'center' }}>{o.text}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(q.gridRows ?? []).map((r) => (
                      <tr key={r}>
                        <td className="t-strong">{r}</td>
                        {(q.options ?? []).map((o) => (
                          <td key={o.value} style={{ textAlign: 'center' }}><input type="radio" name={`${q.id}-${r}`} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(q.type === 'SINGLE_SELECT' || q.type === 'RADIO') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(q.options ?? []).map((o) => (
                  <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-1)', cursor: 'pointer' }}>
                    <input type="radio" name={q.id} />{o.text}
                  </label>
                ))}
              </div>
            )}
            {(q.type === 'MULTIPLE_SELECT' || q.type === 'CHECKBOXES') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(q.options ?? []).map((o) => (
                  <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-1)', cursor: 'pointer' }}>
                    <input type="checkbox" />{o.text}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'SINGLE_LINE' && <input className="input" placeholder="Your answer" style={{ maxWidth: 420 }} />}
            {q.type === 'TEXTAREA' && <textarea className="input" rows={3} placeholder="Your answer" style={{ resize: 'vertical' }} />}
            {q.type === 'SLIDING_SCALE' && <Slider q={q} />}
          </>
        )}
      </div>
    </div>
  )
}

function ViewerTab({ s }: { s: SurveyV2 }) {
  let n = 0
  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <div style={{ background: 'var(--bofa-navy)', color: '#fff', padding: '16px 22px' }}>
        <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Preview · {programName(s.programId)}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 2 }}>{s.name}</div>
        {s.summary ? <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>{s.summary}</div> : null}
      </div>
      <div className="card__body" style={{ padding: '20px 22px' }}>
        {s.pages.map((p) => (
          <section key={p.id} style={{ marginBottom: 26 }}>
            <h3 style={{ fontSize: 17, margin: '0 0 4px' }}>{p.title || p.label}</h3>
            {p.showDescription && p.description ? (
              <p style={{ fontSize: 12.5, color: 'var(--ink-4)', margin: '0 0 14px', lineHeight: 1.5 }}>{p.description}</p>
            ) : <div style={{ height: 10 }} />}
            {p.questions.map((q) => {
              const num = q.type === 'STATIC_TEXT' ? null : ++n
              return <ViewerQuestion key={q.id} q={q} n={num} />
            })}
            {p.questions.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-5)' }}>No questions on this page.</div>}
          </section>
        ))}
      </div>
    </div>
  )
}

// ── Phase 2/3 placeholders ──────────────────────────────────────────────────
function ComingSoon({ title, line }: { title: string; line: string }) {
  return (
    <div className="card">
      <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-4)', margin: '8px auto 0', maxWidth: 460, lineHeight: 1.6 }}>{line}</div>
      </div>
    </div>
  )
}

// ── Email Communications (exact Teammate Voices EMAIL_STEPS) ────────────────
const EMAIL_STEPS = [
  { trigger: 'PROGRAM_WELCOME', label: 'Program Welcome', icon: '👋', color: '#5856d6', bg: '#f0f0ff', border: '#c7c6f5', description: 'Sent when a participant is added to the program', delayLabel: null as string | null, defaultDelay: 0 },
  { trigger: 'INITIAL_INVITE', label: 'Survey Invitation', icon: '📧', color: '#007aff', bg: '#eff6ff', border: '#bfdbfe', description: 'Sent immediately when the survey is dispatched to participants', delayLabel: null as string | null, defaultDelay: 0 },
  { trigger: 'REMINDER_1', label: 'Reminder 1', icon: '🔔', color: '#ff9500', bg: '#fffbeb', border: '#fde68a', description: "First nudge to participants who haven't responded yet", delayLabel: 'Days after dispatch' as string | null, defaultDelay: 3 },
  { trigger: 'REMINDER_2', label: 'Reminder 2', icon: '⏰', color: '#ff6b00', bg: '#fff7f0', border: '#fed7aa', description: 'Final nudge before the survey closes', delayLabel: 'Days after dispatch' as string | null, defaultDelay: 7 },
  { trigger: 'THANK_YOU', label: 'Thank You', icon: '🎉', color: '#34c759', bg: '#f0fdf4', border: '#bbf7d0', description: 'Sent automatically when a participant submits their response', delayLabel: null as string | null, defaultDelay: 0 },
]

interface StepConfig { templateId: string; delayDays: number }

function readCommTemplates(): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem('olivia.emailTemplates')
    if (!raw) return []
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : []
  } catch {
    return []
  }
}

function SurveyEmailConfig({ surveyId }: { surveyId: string }) {
  const [templates] = useState(readCommTemplates)
  const [configs, setConfigs] = usePersistentState<Record<string, StepConfig>>(
    `olivia.surveyEmail.${surveyId}`,
    Object.fromEntries(EMAIL_STEPS.map((st) => [st.trigger, { templateId: '', delayDays: st.defaultDelay }])),
  )

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card__head">
        <h3 style={{ fontSize: 15 }}>✉️ Email Communications</h3>
        <span className="eyebrow">Templates from Communication</span>
      </div>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {EMAIL_STEPS.map((st) => {
          const cfg = configs[st.trigger] ?? { templateId: '', delayDays: st.defaultDelay }
          return (
            <div key={st.trigger} style={{ display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${st.border}`, background: st.bg, borderRadius: 'var(--ra-2)', padding: '12px 14px', flexWrap: 'wrap' }}>
              <span style={{ width: 34, height: 34, borderRadius: 'var(--ra-2)', background: '#fff', border: `1px solid ${st.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {st.icon}
              </span>
              <span style={{ flex: 1, minWidth: 200 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: st.color }}>{st.label}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-4)' }}>{st.description}</span>
              </span>
              <label style={{ minWidth: 220 }}>
                <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Email Template</span>
                <select
                  className="select"
                  value={cfg.templateId}
                  onChange={(e) => setConfigs((prev) => ({ ...prev, [st.trigger]: { ...cfg, templateId: e.target.value } }))}
                >
                  <option value="">Select</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              {st.delayLabel && (
                <label style={{ width: 130 }}>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>{st.delayLabel}</span>
                  <input
                    className="input t-num"
                    type="number"
                    min={0}
                    value={cfg.delayDays}
                    onChange={(e) => setConfigs((prev) => ({ ...prev, [st.trigger]: { ...cfg, delayDays: Number(e.target.value) } }))}
                  />
                </label>
              )}
            </div>
          )
        })}
        {templates.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
            No templates yet — create them under Admin → Communication.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Publish pre-flight modal (exact Teammate Voices flow) ───────────────────
interface Check { key: string; label: string; passed: boolean; detail: string }

function runChecks(s: SurveyV2): Check[] {
  const email = (() => {
    try {
      const raw = localStorage.getItem(`olivia.surveyEmail.${s.id}`)
      return raw ? (JSON.parse(raw) as Record<string, StepConfig>) : {}
    } catch { return {} }
  })()
  return [
    { key: 'name', label: 'Survey is named', passed: !!s.name.trim(), detail: s.name.trim() ? `"${s.name}"` : 'Give the survey a name on the Details tab.' },
    { key: 'program', label: 'Survey is mapped to a program', passed: !!s.programId, detail: s.programId ? programName(s.programId) : 'Pick a program on the Details tab.' },
    { key: 'pages', label: 'Has at least one page', passed: s.pages.length > 0, detail: `${s.pages.length} page${s.pages.length === 1 ? '' : 's'}` },
    { key: 'questions', label: 'Has at least one question', passed: questionCount(s) > 0, detail: `${questionCount(s)} question${questionCount(s) === 1 ? '' : 's'}` },
    { key: 'invite', label: 'Survey Invitation template assigned', passed: !!email['INITIAL_INVITE']?.templateId, detail: email['INITIAL_INVITE']?.templateId ? 'Assigned' : 'Assign one under Email Communications.' },
  ]
}

function PublishPreflightModal({ s, onClose, onConfirm }: { s: SurveyV2; onClose: () => void; onConfirm: () => void }) {
  const checks = useMemo(() => runChecks(s), [s])
  const passedCount = checks.filter((c) => c.passed).length
  const allPassed = passedCount === checks.length

  return (
    <div
      role="dialog"
      aria-label="Pre-flight Checklist"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,26,51,0.4)', zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ width: 540, maxWidth: '94vw', background: 'var(--app-panel)', borderRadius: 'var(--ra-3)', boxShadow: '0 18px 50px rgba(14,26,51,0.3)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🚀</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>Pre-flight Checklist</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>Review these checks before publishing your survey.</div>
            </div>
          </div>
          <span className={`badge ${allPassed ? 'badge--ok' : 'badge--warn'}`}>{passedCount} / {checks.length} passed</span>
        </div>
        <div style={{ padding: '16px 22px', maxHeight: 380, overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checks.map((c) => (
              <li key={c.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14 }}>{c.passed ? '✅' : '❌'}</span>
                <span>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-0)' }}>{c.label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)' }}>{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {!allPassed && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: '#d97706', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 'var(--ra-2)', padding: '10px 12px' }}>
              ⚠️ Some checks failed. You can still publish, but emails may not send correctly until all issues are resolved.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary btn--sm" onClick={() => { onConfirm(); onClose() }}>
            {allPassed ? '✓ Publish' : 'Publish Anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Editor shell (exact Teammate Voices header + six tabs) ──────────────────
type EditorTab = 'details' | 'formBuilder' | 'formViewer' | 'logic' | 'participants' | 'distribute'

const EDITOR_TABS: { key: EditorTab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'formBuilder', label: 'Form Builder' },
  { key: 'formViewer', label: 'Form Viewer' },
  { key: 'logic', label: 'Configuration' },
  { key: 'participants', label: 'Participants' },
  { key: 'distribute', label: 'Distribute' },
]

function Editor({ s, patch, onBack, onClone, onDelete }: {
  s: SurveyV2
  patch: (p: Partial<SurveyV2>) => void
  onBack: () => void
  onClone: () => void
  onDelete: () => void
}) {
  const { toastMsg } = useStore()
  const [tab, setTab] = useState<EditorTab>('details')
  const [showPreflight, setShowPreflight] = useState(false)
  const isLocked = s.status === 'ACTIVE' || s.status === 'CLOSED'

  function confirmPublish() {
    patch({ status: 'ACTIVE', buildStatus: 'PUBLISHED' })
    toastMsg(`"${s.name || 'Untitled survey'}" published`)
  }

  function next() {
    const idx = EDITOR_TABS.findIndex((t) => t.key === tab)
    if (idx < EDITOR_TABS.length - 1) setTab(EDITOR_TABS[idx + 1].key)
  }

  return (
    <div>
      {/* Breadcrumb + header (exact structure) */}
      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 6 }}>
        <button className="link" onClick={onBack} style={{ border: 0, background: 'none', padding: 0 }}>Survey</button>
        {' '}/ {s.name || 'Edit survey'}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 22, margin: 0 }}>{s.name || 'Edit survey'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Survey status:</span>
            <StatusPill status={s.status} />
            <span style={{ fontSize: 12, color: 'var(--ink-4)', marginLeft: 12 }}>Build:</span>
            <BuildPill buildStatus={s.buildStatus} />
            {isLocked && <span style={{ marginLeft: 12 }}><ReadOnlyChip text="Read-only — clone to edit" /></span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!isLocked && (
            <ConfirmButton label="Delete" confirmLabel="Delete this survey?" onConfirm={onDelete} className="btn btn--outline btn--sm" />
          )}
          <button className="btn btn--ghost btn--sm" onClick={onBack}>Cancel</button>
          {isLocked ? (
            <button className="btn btn--primary btn--sm" onClick={onClone}>Clone</button>
          ) : (
            <button className="btn btn--outline btn--sm" onClick={() => setShowPreflight(true)}>Publish</button>
          )}
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        {EDITOR_TABS.map((t) => (
          <button key={t.key} className="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <>
          <DetailsTab s={s} patch={patch} locked={isLocked} onSaved={() => undefined} onNext={next} />
          <SurveyEmailConfig surveyId={s.id} />
        </>
      )}
      {tab === 'formBuilder' && <BuilderTab s={s} patch={patch} locked={isLocked} />}
      {tab === 'formViewer' && <ViewerTab s={s} />}
      {tab === 'logic' && (
        <LogicTab
          pages={s.pages}
          logicRules={s.logicRules ?? []}
          onRulesChange={(rules) => patch({ logicRules: rules })}
          readOnly={isLocked}
        />
      )}
      {tab === 'participants' && (
        <ComingSoon title="Participants" line="Participant roster with CSV import (total rows, uploaded, already-exists, and error counts) — ported from Teammate Voices in a later phase." />
      )}
      {tab === 'distribute' && (
        <ComingSoon title="Distribute" line="Dispatch the survey to participants and track delivery — ported from Teammate Voices in a later phase." />
      )}

      {showPreflight && (
        <PublishPreflightModal s={s} onClose={() => setShowPreflight(false)} onConfirm={confirmPublish} />
      )}
    </div>
  )
}

// ── Studio root ─────────────────────────────────────────────────────────────
export default function SurveyStudio() {
  const [stored, setSurveys] = usePersistentState<SurveyV2[]>(SURVEYS_V2_KEY, migrateOld())
  // Surveys saved by earlier builds may miss newer fields — normalize on read.
  const surveys = useMemo(() => stored.map(normalize), [stored])
  const [editingId, setEditingId] = useState<string | null>(null)
  const { toastMsg } = useStore()

  const editing = useMemo(() => surveys.find((x) => x.id === editingId) ?? null, [surveys, editingId])

  function patch(id: string, p: Partial<SurveyV2>) {
    setSurveys((prev) => prev.map((x) => (x.id === id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x)))
  }
  function clone(id: string) {
    const src = surveys.find((x) => x.id === id)
    if (!src) return
    const copy: SurveyV2 = {
      ...src,
      id: uid(),
      name: `${src.name} Copy`,
      status: 'DRAFT',
      pages: src.pages.map((p) => ({ ...p, questions: p.questions.map((q) => ({ ...q, id: uid(), options: q.options?.map((o) => ({ ...o })), gridRows: q.gridRows ? [...q.gridRows] : undefined })) })),
      updatedAt: new Date().toISOString(),
    }
    setSurveys((prev) => [...prev, copy])
    setEditingId(copy.id)
    toastMsg(`Cloned as "${copy.name}"`)
  }
  function remove(id: string) {
    setSurveys((prev) => {
      const next = prev.filter((x) => x.id !== id)
      return next.length ? next : [freshSurvey()]
    })
    setEditingId(null)
  }

  if (editing) {
    return (
      <Editor
        s={editing}
        patch={(p) => patch(editing.id, p)}
        onBack={() => setEditingId(null)}
        onClone={() => clone(editing.id)}
        onDelete={() => remove(editing.id)}
      />
    )
  }

  return (
    <Library
      surveys={surveys}
      onEdit={setEditingId}
      onNew={() => { const s = freshSurvey(); setSurveys((prev) => [...prev, s]); setEditingId(s.id) }}
      onClone={clone}
      onDelete={remove}
    />
  )
}
