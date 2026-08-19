import { useEffect, useState } from 'react'
import ConfirmButton from '@/components/ConfirmButton'
import { useCreateForm, useDeleteForm, useFormDefById, useFormsList, useMakeDefaultForm, useSaveAsTemplate, useUpdateFormDef } from '@/api/hooks'
import type { FormMeta } from '@/api/types'
import { uid } from './builderStore'
import { IntakeInput, answerText, type Answer } from './IntakeInput'

// Event-intake form builder — drag & drop redesign.
// LEFT: a palette of field types (dropdown, type-ahead, single/multiple
// choice, free text, short text, number, date, yes/no) plus layout blocks
// (single long field · two fields side by side).
// RIGHT: the canvas — rows of one or two slots. Drag a layout block in to
// create a row, drag a field type into a slot (or straight onto the canvas
// for a full-width row), drag rows by their handle to reorder.

// ── Model ───────────────────────────────────────────────────────────────────
export type IntakeFieldType =
  | 'date' | 'email' | 'fullname' | 'header' | 'phone'
  | 'short' | 'long' | 'dropdown' | 'single' | 'multi'
  | 'number' | 'image' | 'file' | 'typeahead' | 'yesno'

export interface IntakeField {
  id: string
  type: IntakeFieldType
  label: string
  help?: string
  required: boolean
  options?: string[]
  src?: string // image URL (Image display block)
}

/** Display-only blocks: render content, collect no answer. */
export const DISPLAY_TYPES: IntakeFieldType[] = ['header', 'image']

/** A canvas row: one full-width slot or two side-by-side slots. */
export interface IntakeRow {
  id: string
  slots: (IntakeField | null)[] // length 1 or 2
}

/** Conditional logic: show/hide a question based on another question's answer. */
export interface FormRule {
  id: string
  action: 'show' | 'hide'
  targetId: string
  sourceId: string
  op: 'equals' | 'not_equals' | 'contains'
  value: string
}

export interface IntakeForm {
  title: string
  rows: IntakeRow[]
  rules?: FormRule[]
  updatedAt: string
}

export const INTAKE_KEY = 'taportal.eventIntakeForm'

export const SYSTEM_FIELDS: { label: string; hint: string }[] = [
  { label: 'Event name', hint: 'Short text' },
  { label: 'Event type', hint: 'Career fair · Campus drive · Info session · Hiring event · Webinar' },
  { label: 'Date & time', hint: 'Date + start time' },
  { label: 'Location / link', hint: 'Campus & room, or meeting URL' },
]

const FIELD_PALETTE: { type: IntakeFieldType; label: string; hint: string }[] = [
  { type: 'date', label: 'Date picker', hint: 'Calendar date' },
  { type: 'email', label: 'Email', hint: 'Validated email address' },
  { type: 'fullname', label: 'Full Name', hint: 'First + last name' },
  { type: 'header', label: 'Header', hint: 'Section heading (display)' },
  { type: 'phone', label: 'Phone', hint: 'Phone number' },
  { type: 'short', label: 'Short Text', hint: 'One line' },
  { type: 'long', label: 'Long Text', hint: 'Paragraph answer' },
  { type: 'dropdown', label: 'Dropdown', hint: 'Pick one from a list' },
  { type: 'single', label: 'Single choice', hint: 'Radio buttons' },
  { type: 'multi', label: 'Multiple choice', hint: 'Checkboxes' },
  { type: 'number', label: 'Number', hint: 'Capacity, headcount…' },
  { type: 'image', label: 'Image', hint: 'Show an image (display)' },
  { type: 'file', label: 'File upload', hint: 'Attach a document' },
  { type: 'typeahead', label: 'Type ahead', hint: 'Search-as-you-type' },
  { type: 'yesno', label: 'Yes / No', hint: 'Waitlist, approval…' },
]

/** Monochrome line icons for the palette — one visual language, no emoji. */
const FIELD_ICON_PATHS: Record<string, React.ReactNode> = {
  date: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>),
  email: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>),
  fullname: (<><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.7-3.6 3.3-5.5 6.5-5.5s5.8 1.9 6.5 5.5" /></>),
  header: (<path d="M6 5v14M18 5v14M6 12h12" />),
  phone: (<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />),
  short: (<path d="M4 12h16" />),
  long: (<path d="M4 7h16M4 12h16M4 17h10" />),
  dropdown: (<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="m14 11 2.5 2.5L19 11" /></>),
  single: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></>),
  multi: (<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12.5 2.5 2.5 5-5.5" /></>),
  number: (<path d="M9 4 7 20M17 4l-2 16M5 9h15M4 15h15" />),
  image: (<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m3 17 5-4 4 3 4-4 5 5" /></>),
  file: (<path d="m16.5 6.5-6.8 6.8a2.1 2.1 0 0 0 3 3l6.8-6.8a4.2 4.2 0 1 0-6-6L6.7 10.3a6.3 6.3 0 0 0 9 9l6-6" />),
  typeahead: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  yesno: (<><rect x="3" y="8" width="18" height="8" rx="4" /><circle cx="16" cy="12" r="2.5" /></>),
  'layout-single': (<rect x="3" y="8" width="18" height="8" rx="2" />),
  'layout-double': (<><rect x="3" y="8" width="8" height="8" rx="2" /><rect x="13" y="8" width="8" height="8" rx="2" /></>),
  chevron: (<path d="m9 6 6 6-6 6" />),
}

function FieldIcon({ kind, size = 15 }: { kind: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {FIELD_ICON_PATHS[kind]}
    </svg>
  )
}

/** Palette accordion groups — click a header to expand downward. */
const FIELD_GROUPS: { name: string; types: IntakeFieldType[] }[] = [
  { name: 'Basics', types: ['short', 'long', 'number', 'date'] },
  { name: 'Contact', types: ['fullname', 'email', 'phone'] },
  { name: 'Choices', types: ['dropdown', 'single', 'multi', 'yesno', 'typeahead'] },
  { name: 'Content & uploads', types: ['header', 'image', 'file'] },
]

const LAYOUT_PALETTE: { kind: 'single' | 'double'; label: string; hint: string }[] = [
  { kind: 'single', label: 'Single field', hint: 'One long field per row' },
  { kind: 'double', label: 'Side by side', hint: 'Two fields in one row' },
]

const TYPE_LABEL: Record<IntakeFieldType, string> = {
  date: 'Date picker', email: 'Email', fullname: 'Full Name', header: 'Header', phone: 'Phone',
  short: 'Short Text', long: 'Long Text', dropdown: 'Dropdown', single: 'Single choice',
  multi: 'Multiple choice', number: 'Number', image: 'Image', file: 'File upload',
  typeahead: 'Type ahead', yesno: 'Yes / No',
}

const optionTypes: IntakeFieldType[] = ['dropdown', 'typeahead', 'single', 'multi']

function newField(t: IntakeFieldType): IntakeField {
  const f: IntakeField = { id: uid(), type: t, label: '', required: false }
  if (optionTypes.includes(t)) f.options = ['Option 1', 'Option 2']
  if (t === 'header') f.label = 'Section title'
  return f
}

/** Research-backed starter intake (capacity/deadline side by side, etc.). */
export function defaultIntakeForm(): IntakeForm {
  return {
    title: 'Event intake',
    updatedAt: new Date().toISOString(),
    rows: [
      {
        id: uid(),
        slots: [
          { id: uid(), type: 'number', label: 'Registration capacity', help: 'Maximum sign-ups before the waitlist kicks in', required: true },
          { id: uid(), type: 'date', label: 'Registration deadline', required: false },
        ],
      },
      { id: uid(), slots: [{ id: uid(), type: 'yesno', label: 'Enable waitlist when full?', required: false }] },
      { id: uid(), slots: [{ id: uid(), type: 'multi', label: 'Target audience', help: 'Who should this event reach?', required: false, options: ['Engineering & CS', 'Finance & Banking', 'Risk & Compliance', 'Early career / interns', 'MBA', 'All majors'] }] },
      {
        id: uid(),
        slots: [
          { id: uid(), type: 'number', label: 'Expected attendance', required: false },
          { id: uid(), type: 'typeahead', label: 'Budget code', help: 'Cost center for expenses & ROI reporting', required: false, options: ['CC-4100 Campus', 'CC-4200 Events', 'CC-4300 Brand', 'CC-5100 Talent Acquisition'] },
        ],
      },
    ],
  }
}

/** Starter student-registration form (the QR/Aria flow renders this later). */
export function defaultRegistrationForm(): IntakeForm {
  return {
    title: 'Register for this event',
    updatedAt: new Date().toISOString(),
    rows: [
      { id: uid(), slots: [{ id: uid(), type: 'fullname', label: 'Full name', required: true }] },
      {
        id: uid(),
        slots: [
          { id: uid(), type: 'email', label: 'School email', required: true },
          { id: uid(), type: 'phone', label: 'Mobile', help: 'For event-day updates', required: false },
        ],
      },
      {
        id: uid(),
        slots: [
          { id: uid(), type: 'dropdown', label: 'School', required: true, options: ['UNC Chapel Hill', 'NC State University', 'Duke University', 'Georgia Tech', 'Howard University', 'Other'] },
          { id: uid(), type: 'number', label: 'Graduation year', required: true },
        ],
      },
      { id: uid(), slots: [{ id: uid(), type: 'short', label: 'Major', required: false }] },
      { id: uid(), slots: [{ id: uid(), type: 'multi', label: 'Areas of interest', required: false, options: ['Software Engineering', 'Consumer Banking', 'Global Markets', 'Risk & Compliance', 'Operations', 'Wealth Management'] }] },
    ],
  }
}

/** Old flat-fields shape → row shape (one field per row). */
export function normalizeIntake(raw: Partial<IntakeForm> & { fields?: IntakeField[] }): IntakeForm {
  if (Array.isArray(raw.rows)) {
    return { title: raw.title ?? 'Event intake', rows: raw.rows, rules: raw.rules ?? [], updatedAt: raw.updatedAt ?? new Date().toISOString() }
  }
  if (Array.isArray(raw.fields)) {
    return {
      title: raw.title ?? 'Event intake',
      rows: raw.fields.map((f) => ({ id: uid(), slots: [f] })),
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
    }
  }
  return defaultIntakeForm()
}

export const flattenIntake = (form: IntakeForm): IntakeField[] =>
  form.rows.flatMap((r) => r.slots.filter((s): s is IntakeField => s !== null))

/**
 * Evaluate the form's if/then rules for one field. `val` returns the current
 * answer text of a field id. Semantics: a field with show-rules starts hidden
 * until one matches; any matching hide-rule hides it.
 */
export function fieldVisible(form: IntakeForm, fieldId: string, val: (id: string) => string): boolean {
  // Rules referencing deleted questions are ignored (same guard as the server's
  // FormLogicService) — a stale show-rule must not hide its target forever.
  const known = new Set(flattenIntake(form).map((f) => f.id))
  const rules = (form.rules ?? []).filter((r) => known.has(r.targetId) && known.has(r.sourceId))
  const mine = rules.filter((r) => r.targetId === fieldId && r.sourceId && r.value !== '')
  if (mine.length === 0) return true
  const matches = (r: FormRule) => {
    const v = (val(r.sourceId) ?? '').trim().toLowerCase()
    const want = r.value.trim().toLowerCase()
    if (r.op === 'equals') return v === want || v.split(', ').includes(want)
    if (r.op === 'not_equals') return v !== want && !v.split(', ').includes(want)
    return v.includes(want)
  }
  const showRules = mine.filter((r) => r.action === 'show')
  const hideRules = mine.filter((r) => r.action === 'hide')
  if (showRules.length > 0 && !showRules.some(matches)) return false
  if (hideRules.some(matches)) return false
  return true
}

// ── Drag payload helpers (native HTML5 DnD) ─────────────────────────────────
type DragPayload =
  | { kind: 'palette-field'; type: IntakeFieldType }
  | { kind: 'palette-layout'; layout: 'single' | 'double' }
  | { kind: 'row'; rowId: string }

const DND_MIME = 'application/x-taportal-intake'

function setPayload(e: React.DragEvent, p: DragPayload) {
  e.dataTransfer.setData(DND_MIME, JSON.stringify(p))
  e.dataTransfer.effectAllowed = 'move'
}

function getPayload(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(DND_MIME)
    return raw ? (JSON.parse(raw) as DragPayload) : null
  } catch {
    return null
  }
}

// ── Canvas field (WYSIWYG, click to select) ─────────────────────────────────
function CanvasField({ f, selected, onSelect, onDuplicate, onRemove }: {
  f: IntakeField
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const missingOptions = optionTypes.includes(f.type) && (f.options ?? []).length === 0
  const act = {
    border: '1px solid var(--line)', background: 'var(--app-panel)', borderRadius: 6,
    width: 24, height: 24, cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as const
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      style={{
        position: 'relative',
        cursor: 'pointer',
        border: selected ? '1.5px solid var(--bofa-navy)' : missingOptions ? '1.5px solid var(--bofa-red, #c41230)' : '1px solid var(--line)',
        boxShadow: selected ? '0 0 0 3px rgba(1, 33, 105, 0.14)' : 'none',
        borderRadius: 'var(--ra-2)',
        background: 'var(--app-panel)',
        padding: '12px 14px 8px',
      }}
    >
      {/* Render exactly what the filler will see; clicks select, not focus. */}
      <div style={{ pointerEvents: 'none' }}>
        <IntakePreviewField f={f} />
      </div>
      {selected && (
        <span className="badge badge--info" style={{ position: 'absolute', top: -10, left: 10, fontSize: 9.5 }}>
          {TYPE_LABEL[f.type]}
        </span>
      )}
      {missingOptions && (
        <span className="badge badge--danger" style={{ position: 'absolute', top: -10, right: selected ? 66 : 10, fontSize: 9.5 }}>
          No options
        </span>
      )}
      {selected && (
        <span style={{ position: 'absolute', top: -12, right: 8, display: 'flex', gap: 4 }}>
          <button title="Duplicate" aria-label="Duplicate field" style={act}
            onClick={(e) => { e.stopPropagation(); onDuplicate() }}>⧉</button>
          <button title="Delete (Del)" aria-label="Delete field" style={{ ...act, color: 'var(--bofa-red, #c41230)' }}
            onClick={(e) => { e.stopPropagation(); onRemove() }}>×</button>
        </span>
      )}
    </div>
  )
}

// ── Properties panel (right column, edits the selected field) ───────────────
function PropertiesPanel({ field, onPatch, onDuplicate, onDelete }: {
  field: IntakeField | null
  onPatch: (patch: Partial<IntakeField>) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  if (!field) {
    return (
      <div className="card" style={{ padding: '18px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Field properties</div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          Select a field on the canvas to edit its label, help text, options and rules.
        </p>
      </div>
    )
  }
  const hasOpts = optionTypes.includes(field.type)
  const isDisplay = DISPLAY_TYPES.includes(field.type)
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="eyebrow">Field properties</span>
        <span className="badge badge--info">{TYPE_LABEL[field.type]}</span>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: 'var(--ink-4)' }}>
        {field.type === 'header' ? 'Heading' : field.type === 'image' ? 'Caption' : 'Label'}
        <input className="input" value={field.label} style={{ fontSize: 13 }}
          placeholder={field.type === 'header' ? 'Section title' : 'Field label'}
          onChange={(e) => onPatch({ label: e.target.value })} />
      </label>

      {field.type === 'image' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: 'var(--ink-4)' }}>
          Image URL
          <input className="input" value={field.src ?? ''} style={{ fontSize: 12.5 }} placeholder="https://…"
            onChange={(e) => onPatch({ src: e.target.value || undefined })} />
        </label>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: 'var(--ink-4)' }}>
        {field.type === 'header' ? 'Subheading' : 'Help text'}
        <input className="input" value={field.help ?? ''} style={{ fontSize: 12.5 }} placeholder="Optional"
          onChange={(e) => onPatch({ help: e.target.value || undefined })} />
      </label>

      {!isDisplay && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={field.required} onChange={(e) => onPatch({ required: e.target.checked })} />
          Required
        </label>
      )}

      {hasOpts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="eyebrow">{field.type === 'typeahead' ? 'Suggestions' : 'Options'}</div>
          {(field.options ?? []).map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="input" value={o} style={{ flex: 1, fontSize: 12.5 }}
                onChange={(e) => onPatch({ options: (field.options ?? []).map((x, j) => (j === i ? e.target.value : x)) })} />
              <button className="btn btn--ghost btn--sm" disabled={(field.options ?? []).length <= 1} aria-label="Remove option"
                onClick={() => onPatch({ options: (field.options ?? []).filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <button className="btn btn--outline btn--sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => onPatch({ options: [...(field.options ?? []), `Option ${(field.options ?? []).length + 1}`] })}>
            + Add option
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <button className="btn btn--outline btn--sm" onClick={onDuplicate}>Duplicate</button>
        <span style={{ flex: 1 }} />
        <button className="btn btn--outline btn--sm" style={{ color: 'var(--bofa-red, #c41230)' }} onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

// ── Preview rendering (toolbar toggle + used by the wizard docs) ────────────
export function IntakePreviewField({ f }: { f: IntakeField }) {
  if (f.type === 'header') {
    return (
      <div style={{ margin: '6px 0 2px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-0)' }}>{f.label || 'Section title'}</div>
        {f.help ? <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{f.help}</div> : null}
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 8 }} />
      </div>
    )
  }
  if (f.type === 'image') {
    return (
      <div style={{ marginBottom: 4 }}>
        {f.src
          ? <img src={f.src} alt={f.label || 'Form image'} style={{ maxWidth: '100%', borderRadius: 'var(--ra-2)', border: '1px solid var(--line)' }} />
          : <div style={{ border: '1px dashed var(--line)', borderRadius: 'var(--ra-2)', padding: '26px 12px', textAlign: 'center', fontSize: 12, color: 'var(--ink-5)' }}>🖼 Image — set a URL in the builder</div>}
        {f.label ? <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 4 }}>{f.label}</div> : null}
      </div>
    )
  }
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500, marginBottom: 6 }}>
        {f.label || <span style={{ color: 'var(--ink-5)' }}>Untitled field</span>}
        {f.required ? <span style={{ color: 'var(--bofa-red)', marginLeft: 4 }}>*</span> : null}
      </div>
      {f.help ? <div style={{ fontSize: 11.5, color: 'var(--ink-5)', margin: '-2px 0 6px' }}>{f.help}</div> : null}
      {f.type === 'short' && <input className="input" placeholder="Your answer" />}
      {f.type === 'long' && <textarea className="input" rows={3} placeholder="Your answer" style={{ resize: 'vertical' }} />}
      {f.type === 'number' && <input className="input" type="number" placeholder="0" style={{ width: 140 }} />}
      {f.type === 'date' && <input className="input" type="date" style={{ width: 180 }} />}
      {f.type === 'email' && <input className="input" type="email" placeholder="name@example.com" />}
      {f.type === 'phone' && <input className="input" type="tel" placeholder="(555) 000-0000" />}
      {f.type === 'fullname' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="input" placeholder="First name" />
          <input className="input" placeholder="Last name" />
        </div>
      )}
      {f.type === 'file' && <input className="input" type="file" style={{ padding: 7 }} />}
      {f.type === 'dropdown' && (
        <select className="select">
          <option value="">Select…</option>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {f.type === 'typeahead' && (
        <>
          <input className="input" list={`ta-${f.id}`} placeholder="Start typing…" />
          <datalist id={`ta-${f.id}`}>
            {(f.options ?? []).map((o) => <option key={o} value={o} />)}
          </datalist>
        </>
      )}
      {f.type === 'yesno' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="badge" style={{ cursor: 'pointer' }}><input type="radio" name={f.id} style={{ marginRight: 6 }} />Yes</label>
          <label className="badge" style={{ cursor: 'pointer' }}><input type="radio" name={f.id} style={{ marginRight: 6 }} />No</label>
        </div>
      )}
      {(f.type === 'single' || f.type === 'multi') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(f.options ?? []).map((o, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
              <input type={f.type === 'single' ? 'radio' : 'checkbox'} name={f.id} />
              {o || `Option ${i + 1}`}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Drop zones ──────────────────────────────────────────────────────────────
function InsertZone({ onDropPayload, hint }: { onDropPayload: (p: DragPayload) => void; hint?: string }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        const p = getPayload(e)
        if (p) onDropPayload(p)
      }}
      style={{
        height: over ? 44 : 10,
        margin: '2px 0',
        borderRadius: 'var(--ra-2)',
        border: over ? '2px dashed var(--bofa-navy)' : '2px dashed transparent',
        background: over ? 'var(--navy-050)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'height .12s ease, background .12s ease',
        fontSize: 11.5, color: 'var(--bofa-navy)',
      }}
    >
      {over ? hint ?? 'Drop here' : ''}
    </div>
  )
}

function EmptySlot({ onDropField, wide }: { onDropField: (t: IntakeFieldType) => void; wide?: boolean }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        const p = getPayload(e)
        if (p?.kind === 'palette-field') onDropField(p.type)
      }}
      style={{
        border: `2px dashed ${over ? 'var(--bofa-navy)' : 'var(--line)'}`,
        background: over ? 'var(--navy-050)' : 'var(--app-sunken)',
        borderRadius: 'var(--ra-2)', minHeight: 92,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: over ? 'var(--bofa-navy)' : 'var(--ink-5)',
      }}
    >
      {wide ? 'Drag a field type here' : 'Drop field'}
    </div>
  )
}

// ── Configuration: if/then rules per question ───────────────────────────────
function RulesEditor({ form, onRules }: { form: IntakeForm; onRules: (rules: FormRule[]) => void }) {
  const fields = flattenIntake(form)
  const answerable = fields.filter((f) => !DISPLAY_TYPES.includes(f.type))
  const rules = form.rules ?? []
  const label = (f: IntakeField) => f.label || TYPE_LABEL[f.type]

  const addRule = () =>
    onRules([
      ...rules,
      { id: uid(), action: 'show', targetId: fields[0]?.id ?? '', sourceId: answerable[0]?.id ?? '', op: 'equals', value: '' },
    ])
  const patch = (id: string, p: Partial<FormRule>) => onRules(rules.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const remove = (id: string) => onRules(rules.filter((r) => r.id !== id))

  const sel = { fontSize: 12.5, width: 'auto', minWidth: 130 } as const

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span className="eyebrow">If / then rules</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn--outline btn--sm" onClick={addRule} disabled={answerable.length === 0}>+ Add rule</button>
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: '0 0 14px' }}>
        Show or hide a question based on another answer — the form adapts as people fill it. Tip: for
        regional or school-specific questions, condition on the School (or region) question.
      </p>

      {rules.length === 0 && (
        <div style={{ border: '2px dashed var(--line)', borderRadius: 'var(--ra-2)', padding: '26px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-4)' }}>
          No rules yet — every question always shows. Add a rule to make the form dynamic.
        </div>
      )}

      {rules.map((r) => {
        const source = fields.find((f) => f.id === r.sourceId)
        const target = fields.find((f) => f.id === r.targetId)
        const broken = !source || !target
        const sourceOptions = source?.options ?? (source?.type === 'yesno' ? ['Yes', 'No'] : null)
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 12px', border: broken ? '1.5px solid var(--bofa-red, #c41230)' : '1px solid var(--line)', borderRadius: 'var(--ra-2)', marginBottom: 8, background: 'var(--app-panel)' }}>
            {broken && (
              <span className="badge badge--danger" style={{ fontSize: 10 }}>
                References a deleted question — this rule is ignored
              </span>
            )}
            <select className="select" style={sel} value={r.action} onChange={(e) => patch(r.id, { action: e.target.value as FormRule['action'] })}>
              <option value="show">Show</option>
              <option value="hide">Hide</option>
            </select>
            <select className="select" style={{ ...sel, minWidth: 170 }} value={r.targetId} onChange={(e) => patch(r.id, { targetId: e.target.value })}>
              {fields.map((f) => <option key={f.id} value={f.id}>{label(f)}</option>)}
            </select>
            <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>when</span>
            <select className="select" style={{ ...sel, minWidth: 170 }} value={r.sourceId} onChange={(e) => patch(r.id, { sourceId: e.target.value, value: '' })}>
              {answerable.map((f) => <option key={f.id} value={f.id}>{label(f)}</option>)}
            </select>
            <select className="select" style={sel} value={r.op} onChange={(e) => patch(r.id, { op: e.target.value as FormRule['op'] })}>
              <option value="equals">is</option>
              <option value="not_equals">is not</option>
              <option value="contains">contains</option>
            </select>
            {sourceOptions ? (
              <select className="select" style={{ ...sel, minWidth: 150 }} value={r.value} onChange={(e) => patch(r.id, { value: e.target.value })}>
                <option value="">Choose value…</option>
                {sourceOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className="input" style={{ fontSize: 12.5, width: 150 }} placeholder="Value" value={r.value}
                onChange={(e) => patch(r.id, { value: e.target.value })} />
            )}
            <span style={{ flex: 1 }} />
            <button className="btn btn--ghost btn--sm" aria-label="Delete rule" onClick={() => remove(r.id)}>×</button>
          </div>
        )
      })}
    </div>
  )
}

// ── Live preview: interactive, rules evaluated as you answer ────────────────
function LivePreview({ form }: { form: IntakeForm }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const val = (id: string) => answerText(answers[id])
  const ruleCount = (form.rules ?? []).length
  return (
    <div className="card" style={{ maxWidth: 680, margin: '0 auto', overflow: 'hidden' }}>
      <div style={{ background: 'var(--bofa-navy)', color: '#fff', padding: '14px 18px' }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Preview{ruleCount > 0 ? ` · ${ruleCount} rule${ruleCount === 1 ? '' : 's'} active` : ''}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginTop: 2 }}>
          Form preview
        </div>
      </div>
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {form.rows.map((r) => {
          const shown = r.slots.filter((sl): sl is IntakeField => sl !== null && fieldVisible(form, sl.id, val))
          if (r.slots.some((sl) => sl !== null) && shown.length === 0) return null
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(shown.length, 1)}, minmax(0, 1fr))`, gap: 14 }}>
              {shown.map((sl) => (
                <IntakeInput key={sl.id} f={sl} value={answers[sl.id]} onChange={(v) => setAnswers((prev) => ({ ...prev, [sl.id]: v }))} />
              ))}
            </div>
          )
        })}
        {form.rows.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-5)', textAlign: 'center', padding: '18px 0' }}>No fields yet.</div>}
      </div>
    </div>
  )
}

// ── Main builder ────────────────────────────────────────────────────────────
const KINDS = [
  { key: 'EVENT_INTAKE', label: 'Event intake', hint: 'Used by Campus · New event', fallback: defaultIntakeForm },
  { key: 'EVENT_REGISTRATION', label: 'Student registration', hint: 'What students fill in (and Aria asks) to register', fallback: defaultRegistrationForm },
] as const

export default function FormBuilder() {
  // The form LIBRARY: many named forms per kind + reusable templates. The
  // active form is id-addressed; kind determines fallbacks and hints.
  const { data: library } = useFormsList()
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  useEffect(() => {
    if (!activeFormId && library && library.length > 0) {
      const preferred =
        library.find((f) => f.purpose === 'EVENT_INTAKE' && f.defaultForKind && !f.template) ??
        library.find((f) => !f.template) ?? library[0]
      setActiveFormId(preferred.id)
    }
  }, [library, activeFormId])

  const { data: serverForm, isLoading } = useFormDefById(activeFormId ?? undefined)
  const updateForm = useUpdateFormDef()
  const createForm = useCreateForm()
  const saveTemplate = useSaveAsTemplate()
  const makeDefault = useMakeDefaultForm()
  const deleteForm = useDeleteForm()
  const meta = KINDS.find((k) => k.key === serverForm?.purpose) ?? KINDS[0]
  const [draft, setForm] = useState<IntakeForm | null>(null)
  const [dirty, setDirty] = useState(false)
  const [mode, setMode] = useState<'builder' | 'preview' | 'config'>('builder')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<string[]>(['Basics'])

  // Load the server schema whenever the purpose (or server copy) changes.
  useEffect(() => {
    if (serverForm) {
      try {
        setForm(normalizeIntake(JSON.parse(serverForm.schema)))
      } catch {
        setForm(meta.fallback())
      }
      setDirty(false)
      setSelectedId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverForm?.id, serverForm?.updatedAt])

  // Warn before the tab closes with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  const form = draft ?? meta.fallback()

  // Keyboard: Delete/Backspace removes the selected field (unless typing),
  // Escape deselects, Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty) save()
        return
      }
      if (typing) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        removeField(selectedId)
      }
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, selectedId, draft, activeFormId])

  const save = () => {
    if (!activeFormId || !serverForm) return
    updateForm.mutate(
      { id: activeFormId, name: serverForm.name, schema: JSON.stringify(form) },
      { onSuccess: () => setDirty(false) },
    )
  }

  const switchForm = (id: string) => {
    if (id === activeFormId) return
    if (dirty && !window.confirm('Discard unsaved changes to this form?')) return
    setActiveFormId(id)
  }

  // Action panel: create a new form, or snapshot the current one as a template.
  const [panel, setPanel] = useState<null | 'new' | 'template'>(null)
  const [panelName, setPanelName] = useState('')
  const [panelKind, setPanelKind] = useState<(typeof KINDS)[number]['key']>('EVENT_INTAKE')
  const [panelSource, setPanelSource] = useState<string>('blank')

  function patchRows(fn: (rows: IntakeRow[]) => IntakeRow[]) {
    setForm((prev) => {
      const f = normalizeIntake(prev ?? meta.fallback())
      return { ...f, rows: fn(f.rows), updatedAt: new Date().toISOString() }
    })
    setDirty(true)
  }

  function makeRow(p: DragPayload): IntakeRow | null {
    if (p.kind === 'palette-field') {
      const f = newField(p.type)
      setSelectedId(f.id)
      return { id: uid(), slots: [f] }
    }
    if (p.kind === 'palette-layout') return { id: uid(), slots: p.layout === 'double' ? [null, null] : [null] }
    return null
  }

  const selectedField = flattenIntake(form).find((f) => f.id === selectedId) ?? null

  function patchField(id: string, patch: Partial<IntakeField>) {
    patchRows((rows) => rows.map((r) => ({ ...r, slots: r.slots.map((sl) => (sl && sl.id === id ? { ...sl, ...patch } : sl)) })))
  }

  function removeField(id: string) {
    // Deleting a question also deletes the rules that reference it — leaving
    // them would silently break the logic (see fieldVisible's stale-rule guard).
    setForm((prev) => {
      const f = normalizeIntake(prev ?? meta.fallback())
      return {
        ...f,
        rows: f.rows.map((r) => ({ ...r, slots: r.slots.map((sl) => (sl && sl.id === id ? null : sl)) })),
        rules: (f.rules ?? []).filter((r) => r.targetId !== id && r.sourceId !== id),
        updatedAt: new Date().toISOString(),
      }
    })
    setDirty(true)
    if (selectedId === id) setSelectedId(null)
  }

  function duplicateField(id: string) {
    const src = flattenIntake(form).find((f) => f.id === id)
    if (!src) return
    const copy: IntakeField = { ...src, id: uid() }
    patchRows((rows) => [...rows, { id: uid(), slots: [copy] }])
    setSelectedId(copy.id)
  }

  /** Insert (palette drops) or move (row drags) at index. */
  function dropAt(index: number, p: DragPayload) {
    if (p.kind === 'row') {
      patchRows((rows) => {
        const from = rows.findIndex((r) => r.id === p.rowId)
        if (from === -1) return rows
        const next = [...rows]
        const [moved] = next.splice(from, 1)
        next.splice(from < index ? index - 1 : index, 0, moved)
        return next
      })
      return
    }
    const row = makeRow(p)
    if (row) patchRows((rows) => [...rows.slice(0, index), row, ...rows.slice(index)])
  }

  function setSlot(rowId: string, slotIdx: number, value: IntakeField | null) {
    patchRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, slots: r.slots.map((s, i) => (i === slotIdx ? value : s)) } : r)))
  }

  const fieldCount = flattenIntake(form).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', flexWrap: 'wrap' }}>
          <select
            className="select"
            style={{ width: 250 }}
            value={activeFormId ?? ''}
            onChange={(e) => switchForm(e.target.value)}
          >
            {KINDS.map((k) => {
              const forms = (library ?? []).filter((f) => f.purpose === k.key && !f.template)
              return forms.length === 0 ? null : (
                <optgroup key={k.key} label={k.label}>
                  {forms.map((f: FormMeta) => (
                    <option key={f.id} value={f.id}>{f.name}{f.defaultForKind ? ' (default)' : ''}</option>
                  ))}
                </optgroup>
              )
            })}
            {(library ?? []).some((f) => f.template) && (
              <optgroup label="Templates">
                {(library ?? []).filter((f) => f.template).map((f: FormMeta) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <span className="eyebrow">{serverForm?.template ? `Template · ${meta.label}` : meta.hint}</span>
          <div style={{ flex: 1 }} />
          <span className="eyebrow">{fieldCount} fields · {form.rows.length} rows</span>
          {isLoading ? (
            <span className="badge">Loading…</span>
          ) : dirty ? (
            <span className="badge badge--warn">Unsaved changes</span>
          ) : (
            <span className="badge badge--ok">Saved</span>
          )}
          <button className="btn btn--primary btn--sm" disabled={!dirty || updateForm.isPending} onClick={save}>
            {updateForm.isPending ? 'Saving…' : 'Save'}
          </button>
          <ConfirmButton label="Reset to defaults" confirmLabel="Replace all fields?" onConfirm={() => { setForm(meta.fallback()); setDirty(true) }} />
        </div>

        {/* Library actions: create forms, snapshot templates, manage defaults. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 12px', flexWrap: 'wrap' }}>
          <button className="btn btn--outline btn--sm" onClick={() => { setPanel('new'); setPanelName(''); setPanelKind(meta.key); setPanelSource(activeFormId ?? 'blank') }}>
            + New form
          </button>
          <button className="btn btn--outline btn--sm" disabled={!serverForm}
            onClick={() => { setPanel('template'); setPanelName(`${serverForm?.name ?? 'Form'} template`) }}>
            Save as template
          </button>
          {serverForm && !serverForm.template && !serverForm.defaultForKind && (
            <button className="btn btn--outline btn--sm" disabled={makeDefault.isPending}
              onClick={() => activeFormId && makeDefault.mutate(activeFormId)}>
              Make default
            </button>
          )}
          {serverForm?.defaultForKind && <span className="badge badge--ok">Default for {meta.label}</span>}
          <span style={{ flex: 1 }} />
          {serverForm && !serverForm.defaultForKind && (
            <button className="btn btn--outline btn--sm" style={{ color: 'var(--bofa-red, #c41230)' }} disabled={deleteForm.isPending}
              onClick={() => {
                if (!activeFormId) return
                if (!window.confirm(`Delete "${serverForm.name}"? This cannot be undone.`)) return
                deleteForm.mutate(activeFormId, { onSuccess: () => setActiveFormId(null) })
              }}>
              Delete
            </button>
          )}
        </div>

        {panel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 14px 12px', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--ra-2)', background: 'var(--app-sunken)' }}>
            {panel === 'new' ? (
              <>
                <span className="eyebrow">New form</span>
                <input className="input" style={{ width: 200, fontSize: 13 }} placeholder="Form name" value={panelName}
                  onChange={(e) => setPanelName(e.target.value)} />
                <select className="select" style={{ width: 180, fontSize: 13 }} value={panelKind}
                  onChange={(e) => { setPanelKind(e.target.value as typeof panelKind); setPanelSource('blank') }}>
                  {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
                <select className="select" style={{ width: 220, fontSize: 13 }} value={panelSource}
                  onChange={(e) => setPanelSource(e.target.value)}>
                  <option value="blank">Start blank</option>
                  {(library ?? []).filter((f) => f.purpose === panelKind).map((f) => (
                    <option key={f.id} value={f.id}>Copy of: {f.name}{f.template ? ' (template)' : ''}</option>
                  ))}
                </select>
                <button className="btn btn--primary btn--sm" disabled={!panelName.trim() || createForm.isPending}
                  onClick={() =>
                    createForm.mutate(
                      { purpose: panelKind, name: panelName.trim(), fromFormId: panelSource === 'blank' ? undefined : panelSource },
                      { onSuccess: (d) => { setActiveFormId((d as { id: string }).id); setPanel(null) } },
                    )
                  }>
                  {createForm.isPending ? 'Creating…' : 'Create'}
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">Save as template</span>
                <input className="input" style={{ width: 260, fontSize: 13 }} placeholder="Template name" value={panelName}
                  onChange={(e) => setPanelName(e.target.value)} />
                <button className="btn btn--primary btn--sm" disabled={!panelName.trim() || saveTemplate.isPending}
                  onClick={() =>
                    activeFormId && saveTemplate.mutate(
                      { id: activeFormId, name: panelName.trim() },
                      { onSuccess: () => setPanel(null) },
                    )
                  }>
                  {saveTemplate.isPending ? 'Saving…' : 'Save template'}
                </button>
              </>
            )}
            <button className="btn btn--ghost btn--sm" onClick={() => setPanel(null)}>Cancel</button>
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: 2 }}>
        <button className="tab" aria-selected={mode === 'builder'} onClick={() => setMode('builder')}>Builder</button>
        <button className="tab" aria-selected={mode === 'preview'} onClick={() => setMode('preview')}>Preview</button>
        <button className="tab" aria-selected={mode === 'config'} onClick={() => setMode('config')}>Configuration</button>
      </div>

      {mode === 'preview' && <LivePreview form={form} />}
      {mode === 'config' && (
        <RulesEditor
          form={form}
          onRules={(rules) => {
            setForm((prev) => ({ ...normalizeIntake(prev ?? meta.fallback()), rules, updatedAt: new Date().toISOString() }))
            setDirty(true)
          }}
        />
      )}

      {mode === 'builder' && (
      <div style={{ display: 'grid', gridTemplateColumns: '210px minmax(0, 1fr) 280px', gap: 16, alignItems: 'start' }}>
        {/* LEFT: palette */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 12 }}>
          <div className="card" style={{ padding: 10 }}>
            <div className="eyebrow" style={{ padding: '4px 6px 8px' }}>Layout</div>
            {LAYOUT_PALETTE.map((l) => (
              <div
                key={l.kind}
                draggable
                onDragStart={(e) => setPayload(e, { kind: 'palette-layout', layout: l.kind })}
                onClick={() => patchRows((rows) => [...rows, { id: uid(), slots: l.kind === 'double' ? [null, null] : [null] }])}
                title="Drag onto the canvas (or click to append)"
                style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', background: 'var(--app-panel)', cursor: 'grab', borderRadius: 'var(--ra-2)', padding: '8px 10px', marginBottom: 6 }}
              >
                <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: 'var(--ink-3)' }}><FieldIcon kind={`layout-${l.kind}`} /></span>
                <span>
                  <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{l.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{l.hint}</div>
                </span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 10 }}>
            <div className="eyebrow" style={{ padding: '4px 6px 8px' }}>Field types</div>
            {FIELD_GROUPS.map((g) => {
              const open = openGroups.includes(g.name)
              return (
                <div key={g.name} style={{ marginBottom: 6 }}>
                  <button
                    onClick={() => setOpenGroups((cur) => (open ? cur.filter((n) => n !== g.name) : [...cur, g.name]))}
                    aria-expanded={open}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      border: '1px solid var(--line)', background: open ? 'var(--app-sunken)' : 'var(--app-panel)',
                      borderRadius: 'var(--ra-2)', padding: '8px 10px', cursor: 'pointer',
                      font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', transition: 'transform .12s ease',
                      transform: open ? 'rotate(90deg)' : 'none', color: 'var(--ink-4)',
                    }}><FieldIcon kind="chevron" size={12} /></span>
                    <span style={{ flex: 1 }}>{g.name}</span>
                    <span className="muted" style={{ fontSize: 10.5 }}>{g.types.length}</span>
                  </button>
                  {open && (
                    <div style={{ padding: '6px 0 2px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {g.types.map((t) => {
                        const p = FIELD_PALETTE.find((x) => x.type === t)!
                        return (
                          <div
                            key={p.type}
                            draggable
                            onDragStart={(e) => setPayload(e, { kind: 'palette-field', type: p.type })}
                            onClick={() => {
                              const f = newField(p.type)
                              patchRows((rows) => [...rows, { id: uid(), slots: [f] }])
                              setSelectedId(f.id)
                            }}
                            title="Drag into a slot or onto the canvas (or click to append)"
                            style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', background: 'var(--app-panel)', cursor: 'grab', borderRadius: 'var(--ra-2)', padding: '7px 10px' }}
                          >
                            <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: 'var(--ink-3)' }}><FieldIcon kind={p.type} /></span>
                            <span>
                              <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{p.label}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{p.hint}</div>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: canvas */}
        <div>
          {/* System fields — locked; they describe the EVENT record itself, so
              they only apply to the intake form. */}
          {meta.key === 'EVENT_INTAKE' && (
          <div className="card" style={{ marginBottom: 12, background: 'var(--app-sunken)' }}>
            <div className="card__body" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="eyebrow">System fields</span>
                <span className="badge" style={{ gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  Always collected
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
                {SYSTEM_FIELDS.map((sf) => (
                  <div key={sf.label} style={{ background: 'var(--app-panel)', border: '1px solid var(--line)', borderRadius: 'var(--ra-2)', padding: '8px 12px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>{sf.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>{sf.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}

          {(
            /* Editable canvas */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                // Drop on the canvas background = append at the end.
                e.preventDefault()
                const p = getPayload(e)
                if (p) dropAt(form.rows.length, p)
              }}
              onClick={() => setSelectedId(null)}
              style={{ minHeight: 220 }}
            >
              <InsertZone onDropPayload={(p) => dropAt(0, p)} hint="Drop to insert row" />
              {form.rows.map((row, ri) => (
                <div key={row.id}>
                  <div
                    style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <span
                      draggable
                      onDragStart={(e) => setPayload(e, { kind: 'row', rowId: row.id })}
                      title="Drag to reorder row"
                      style={{ cursor: 'grab', color: 'var(--ink-5)', fontSize: 15, userSelect: 'none', display: 'flex', alignItems: 'center', padding: '0 2px' }}
                    >
                      ⠿
                    </span>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${row.slots.length}, minmax(0, 1fr))`, gap: 10 }}>
                      {row.slots.map((slot, si) =>
                        slot ? (
                          <CanvasField
                            key={slot.id}
                            f={slot}
                            selected={slot.id === selectedId}
                            onSelect={() => setSelectedId(slot.id)}
                            onDuplicate={() => duplicateField(slot.id)}
                            onRemove={() => removeField(slot.id)}
                          />
                        ) : (
                          <EmptySlot key={`empty-${si}`} wide={row.slots.length === 1}
                            onDropField={(t) => {
                              const f = newField(t)
                              setSlot(row.id, si, f)
                              setSelectedId(f.id)
                            }} />
                        ),
                      )}
                    </div>
                    <button
                      className="btn btn--ghost btn--sm"
                      aria-label="Delete row"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => patchRows((rows) => rows.filter((r) => r.id !== row.id))}
                    >
                      ×
                    </button>
                  </div>
                  <InsertZone onDropPayload={(p) => dropAt(ri + 1, p)} hint="Drop to insert row" />
                </div>
              ))}
              {form.rows.length === 0 && (
                <div style={{ border: '2px dashed var(--line)', borderRadius: 'var(--ra-3)', padding: '44px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                  Drag a layout block or field type from the left to start building.
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: properties for the selected field */}
        <div style={{ position: 'sticky', top: 12 }}>
            <PropertiesPanel
              field={selectedField}
              onPatch={(patch) => selectedField && patchField(selectedField.id, patch)}
              onDuplicate={() => selectedField && duplicateField(selectedField.id)}
              onDelete={() => selectedField && removeField(selectedField.id)}
            />

        </div>
      </div>
      )}
    </div>
  )
}
