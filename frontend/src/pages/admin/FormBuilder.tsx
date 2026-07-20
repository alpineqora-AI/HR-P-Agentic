import { useState } from 'react'
import ConfirmButton from '@/components/ConfirmButton'
import { usePersistentState, uid } from './builderStore'

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

export interface IntakeForm {
  title: string
  rows: IntakeRow[]
  updatedAt: string
}

export const INTAKE_KEY = 'olivia.eventIntakeForm'

export const SYSTEM_FIELDS: { label: string; hint: string }[] = [
  { label: 'Event name', hint: 'Short text' },
  { label: 'Event type', hint: 'Career fair · Campus drive · Info session · Hiring event · Webinar' },
  { label: 'Date & time', hint: 'Date + start time' },
  { label: 'Location / link', hint: 'Campus & room, or meeting URL' },
]

const FIELD_PALETTE: { type: IntakeFieldType; label: string; hint: string; glyph: string }[] = [
  { type: 'date', label: 'Date picker', hint: 'Calendar date', glyph: '▦' },
  { type: 'email', label: 'Email', hint: 'Validated email address', glyph: '@' },
  { type: 'fullname', label: 'Full Name', hint: 'First + last name', glyph: '👤' },
  { type: 'header', label: 'Header', hint: 'Section heading (display)', glyph: 'H' },
  { type: 'phone', label: 'Phone', hint: 'Phone number', glyph: '☎' },
  { type: 'short', label: 'Short Text', hint: 'One line', glyph: '—' },
  { type: 'long', label: 'Long Text', hint: 'Paragraph answer', glyph: '¶' },
  { type: 'dropdown', label: 'Dropdown', hint: 'Pick one from a list', glyph: '▾' },
  { type: 'single', label: 'Single choice', hint: 'Radio buttons', glyph: '◉' },
  { type: 'multi', label: 'Multiple choice', hint: 'Checkboxes', glyph: '☑' },
  { type: 'number', label: 'Number', hint: 'Capacity, headcount…', glyph: '#' },
  { type: 'image', label: 'Image', hint: 'Show an image (display)', glyph: '🖼' },
  { type: 'file', label: 'File upload', hint: 'Attach a document', glyph: '📎' },
  { type: 'typeahead', label: 'Type ahead', hint: 'Search-as-you-type', glyph: '⌕' },
  { type: 'yesno', label: 'Yes / No', hint: 'Waitlist, approval…', glyph: '⇄' },
]

const LAYOUT_PALETTE: { kind: 'single' | 'double'; label: string; hint: string; glyph: string }[] = [
  { kind: 'single', label: 'Single field', hint: 'One long field per row', glyph: '▭' },
  { kind: 'double', label: 'Side by side', hint: 'Two fields in one row', glyph: '◫' },
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

/** Old flat-fields shape → row shape (one field per row). */
export function normalizeIntake(raw: Partial<IntakeForm> & { fields?: IntakeField[] }): IntakeForm {
  if (Array.isArray(raw.rows)) {
    return { title: raw.title ?? 'Event intake', rows: raw.rows, updatedAt: raw.updatedAt ?? new Date().toISOString() }
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

// ── Drag payload helpers (native HTML5 DnD) ─────────────────────────────────
type DragPayload =
  | { kind: 'palette-field'; type: IntakeFieldType }
  | { kind: 'palette-layout'; layout: 'single' | 'double' }
  | { kind: 'row'; rowId: string }

const DND_MIME = 'application/x-olivia-intake'

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

// ── Field editor card (inside a slot) ───────────────────────────────────────
function FieldCard({ f, locked, onChange, onRemove }: {
  f: IntakeField
  locked?: boolean
  onChange: (f: IntakeField) => void
  onRemove: () => void
}) {
  const hasOpts = optionTypes.includes(f.type)
  const isDisplay = DISPLAY_TYPES.includes(f.type)
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--ra-2)', background: 'var(--app-panel)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>
        <span className="badge badge--info">{TYPE_LABEL[f.type]}</span>
        <div style={{ flex: 1 }} />
        {!isDisplay && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-3)' }}>
            <input type="checkbox" checked={f.required} disabled={locked} onChange={(e) => onChange({ ...f, required: e.target.checked })} />
            Required
          </label>
        )}
        <button className="btn btn--ghost btn--sm" disabled={locked} onClick={onRemove} aria-label="Remove field">×</button>
      </div>
      <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input className="input" value={f.label} disabled={locked} placeholder={f.type === 'header' ? 'Heading text' : f.type === 'image' ? 'Caption (optional)' : 'Field label'} style={{ fontSize: 13, fontWeight: 500 }}
          onChange={(e) => onChange({ ...f, label: e.target.value })} />
        {f.type === 'image' && (
          <>
            <input className="input" value={f.src ?? ''} disabled={locked} placeholder="Image URL (https://…)" style={{ fontSize: 12 }}
              onChange={(e) => onChange({ ...f, src: e.target.value || undefined })} />
            {f.src ? <img src={f.src} alt={f.label || 'Form image'} style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 'var(--ra-2)', border: '1px solid var(--line)', objectFit: 'cover' }} /> : null}
          </>
        )}
        <input className="input" value={f.help ?? ''} disabled={locked} placeholder={f.type === 'header' ? 'Subheading (optional)' : 'Help text (optional)'} style={{ fontSize: 12 }}
          onChange={(e) => onChange({ ...f, help: e.target.value || undefined })} />
        {hasOpts && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="eyebrow">{f.type === 'typeahead' ? 'Suggestions' : 'Options'}</div>
            {(f.options ?? []).map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="input" value={o} disabled={locked} style={{ flex: 1, fontSize: 12.5 }}
                  onChange={(e) => onChange({ ...f, options: (f.options ?? []).map((x, j) => (j === i ? e.target.value : x)) })} />
                <button className="btn btn--ghost btn--sm" disabled={locked || (f.options ?? []).length <= 1} aria-label="Remove option"
                  onClick={() => onChange({ ...f, options: (f.options ?? []).filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button className="btn btn--outline btn--sm" style={{ alignSelf: 'flex-start' }} disabled={locked}
              onClick={() => onChange({ ...f, options: [...(f.options ?? []), `Option ${(f.options ?? []).length + 1}`] })}>
              + Add option
            </button>
          </div>
        )}
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

// ── Main builder ────────────────────────────────────────────────────────────
export default function FormBuilder() {
  const [raw, setForm] = usePersistentState<IntakeForm>(INTAKE_KEY, defaultIntakeForm())
  const form = normalizeIntake(raw)
  const [preview, setPreview] = useState(false)

  function patchRows(fn: (rows: IntakeRow[]) => IntakeRow[]) {
    setForm((prev) => {
      const f = normalizeIntake(prev)
      return { ...f, rows: fn(f.rows), updatedAt: new Date().toISOString() }
    })
  }

  function makeRow(p: DragPayload): IntakeRow | null {
    if (p.kind === 'palette-field') return { id: uid(), slots: [newField(p.type)] }
    if (p.kind === 'palette-layout') return { id: uid(), slots: p.layout === 'double' ? [null, null] : [null] }
    return null
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
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-0)' }}>Event intake form</div>
          <span className="eyebrow">Used by Events → New event</span>
          <div style={{ flex: 1 }} />
          <span className="eyebrow">{fieldCount} fields · {form.rows.length} rows</span>
          <span className="badge badge--ok" title="Saved automatically">Saved</span>
          <button className="btn btn--outline btn--sm" aria-pressed={preview} onClick={() => setPreview((v) => !v)}>
            {preview ? 'Edit' : 'Preview'}
          </button>
          <ConfirmButton label="Reset to defaults" confirmLabel="Replace all fields?" onConfirm={() => setForm(defaultIntakeForm())} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '210px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
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
                <span style={{ width: 20, textAlign: 'center', color: 'var(--bofa-navy)', fontSize: 14 }}>{l.glyph}</span>
                <span>
                  <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{l.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{l.hint}</div>
                </span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 10 }}>
            <div className="eyebrow" style={{ padding: '4px 6px 8px' }}>Field types</div>
            {FIELD_PALETTE.map((p) => (
              <div
                key={p.type}
                draggable
                onDragStart={(e) => setPayload(e, { kind: 'palette-field', type: p.type })}
                onClick={() => patchRows((rows) => [...rows, { id: uid(), slots: [newField(p.type)] }])}
                title="Drag into a slot or onto the canvas (or click to append)"
                style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', background: 'var(--app-panel)', cursor: 'grab', borderRadius: 'var(--ra-2)', padding: '8px 10px', marginBottom: 6 }}
              >
                <span style={{ width: 20, textAlign: 'center', color: 'var(--bofa-navy)', fontSize: 14 }}>{p.glyph}</span>
                <span>
                  <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{p.hint}</div>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: canvas */}
        <div>
          {/* System fields — locked */}
          <div className="card" style={{ marginBottom: 12, background: 'var(--app-sunken)' }}>
            <div className="card__body" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="eyebrow">System fields</span>
                <span className="badge">🔒 always collected</span>
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

          {preview ? (
            /* Rendered preview in the exact row layout */
            <div className="card">
              <div style={{ background: 'var(--bofa-navy)', color: '#fff', padding: '14px 18px' }}>
                <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Preview · New event</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginTop: 2 }}>What recruiters will fill</div>
              </div>
              <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {form.rows.map((r) => (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${r.slots.length}, minmax(0, 1fr))`, gap: 14 }}>
                    {r.slots.map((slot, i) => (
                      <div key={i}>{slot ? <IntakePreviewField f={slot} /> : <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>Empty slot</div>}</div>
                    ))}
                  </div>
                ))}
                {form.rows.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-5)', textAlign: 'center', padding: '18px 0' }}>No fields yet.</div>}
              </div>
            </div>
          ) : (
            /* Editable canvas */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                // Drop on the canvas background = append at the end.
                e.preventDefault()
                const p = getPayload(e)
                if (p) dropAt(form.rows.length, p)
              }}
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
                          <FieldCard
                            key={slot.id}
                            f={slot}
                            onChange={(nf) => setSlot(row.id, si, nf)}
                            onRemove={() => setSlot(row.id, si, null)}
                          />
                        ) : (
                          <EmptySlot key={`empty-${si}`} wide={row.slots.length === 1} onDropField={(t) => setSlot(row.id, si, newField(t))} />
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
      </div>
    </div>
  )
}
