import type { IntakeField } from './FormBuilder'

/* The interactive form runtime: one controlled input per field type. Shared by
   the New-event wizard, the builder's live Preview, and (later) the student
   registration surface. */

export type Answer = string | string[]

export function answerText(a: Answer | undefined): string {
  if (a === undefined) return ''
  return Array.isArray(a) ? a.join(', ') : a
}

export function IntakeInput({ f, value, onChange }: { f: IntakeField; value: Answer | undefined; onChange: (v: Answer) => void }) {
  const text = typeof value === 'string' ? value : ''
  const list = Array.isArray(value) ? value : []
  // Display blocks render content, no input.
  if (f.type === 'header') {
    return (
      <div style={{ margin: '4px 0 0' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, color: 'var(--ink-0)' }}>{f.label || 'Section title'}</div>
        {f.help ? <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{f.help}</div> : null}
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 8 }} />
      </div>
    )
  }
  if (f.type === 'image') {
    return f.src
      ? <img src={f.src} alt={f.label || 'Form image'} style={{ maxWidth: '100%', borderRadius: 'var(--ra-2)', border: '1px solid var(--line)' }} />
      : <div style={{ border: '1px dashed var(--line)', borderRadius: 'var(--ra-2)', padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--ink-5)' }}>🖼 Image</div>
  }
  const first = text.split(' ')[0] ?? ''
  const last = text.split(' ').slice(1).join(' ')
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {f.label}{f.required ? <span style={{ color: 'var(--bofa-red)' }}> *</span> : null}
      </div>
      {f.help ? <div style={{ fontSize: 11.5, color: 'var(--ink-5)', margin: '-2px 0 6px' }}>{f.help}</div> : null}
      {f.type === 'email' && <input className="input" type="email" value={text} placeholder="name@example.com" onChange={(e) => onChange(e.target.value)} />}
      {f.type === 'phone' && <input className="input" type="tel" value={text} placeholder="(555) 000-0000" onChange={(e) => onChange(e.target.value)} />}
      {f.type === 'fullname' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="input" placeholder="First name" value={first} onChange={(e) => onChange(`${e.target.value} ${last}`.trim())} />
          <input className="input" placeholder="Last name" value={last} onChange={(e) => onChange(`${first} ${e.target.value}`.trim())} />
        </div>
      )}
      {f.type === 'file' && (
        <input className="input" type="file" style={{ padding: 7 }} onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')} />
      )}
      {f.type === 'short' && <input className="input" value={text} onChange={(e) => onChange(e.target.value)} />}
      {f.type === 'long' && <textarea className="input" rows={3} value={text} onChange={(e) => onChange(e.target.value)} style={{ resize: 'vertical' }} />}
      {f.type === 'number' && <input className="input" type="number" value={text} onChange={(e) => onChange(e.target.value)} style={{ width: 160 }} />}
      {f.type === 'date' && <input className="input" type="date" value={text} onChange={(e) => onChange(e.target.value)} style={{ width: 190 }} />}
      {f.type === 'yesno' && (
        <div className="segmented" role="group" aria-label={f.label}>
          {(['Yes', 'No'] as const).map((v) => (
            <button key={v} aria-pressed={text === v} onClick={() => onChange(v)}>{v}</button>
          ))}
        </div>
      )}
      {(f.type === 'single' || f.type === 'dropdown') && (
        <select className="select" value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {f.type === 'typeahead' && (
        <>
          <input className="input" list={`wiz-ta-${f.id}`} value={text} placeholder="Start typing…" onChange={(e) => onChange(e.target.value)} />
          <datalist id={`wiz-ta-${f.id}`}>
            {(f.options ?? []).map((o) => <option key={o} value={o} />)}
          </datalist>
        </>
      )}
      {f.type === 'multi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(f.options ?? []).map((o) => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-1)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={list.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...list, o] : list.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
