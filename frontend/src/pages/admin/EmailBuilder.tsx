import { useRef, useState } from 'react'
import ConfirmButton from '@/components/ConfirmButton'
import { usePersistentState, uid } from './builderStore'

// ── Email model ─────────────────────────────────────────────────────────────
type BlockType = 'heading' | 'text' | 'button' | 'divider' | 'spacer'

interface Block {
  id: string
  type: BlockType
  text?: string
  url?: string
  align?: 'left' | 'center'
}

interface Template {
  id: string
  name: string
  subject: string
  preheader: string
  blocks: Block[]
  updatedAt: string
}

const PALETTE: { type: BlockType; label: string; glyph: string }[] = [
  { type: 'heading', label: 'Heading', glyph: 'H' },
  { type: 'text', label: 'Text', glyph: '¶' },
  { type: 'button', label: 'Button', glyph: '▭' },
  { type: 'divider', label: 'Divider', glyph: '—' },
  { type: 'spacer', label: 'Spacer', glyph: '⇕' },
]

const MERGE_TAGS = [
  '{{candidate.firstName}}',
  '{{candidate.fullName}}',
  '{{job.title}}',
  '{{job.location}}',
  '{{recruiter.name}}',
  '{{company}}',
  '{{interview.date}}',
  '{{apply.link}}',
]

const SAMPLE: Record<string, string> = {
  '{{candidate.firstName}}': 'Jordan',
  '{{candidate.fullName}}': 'Jordan Rivera',
  '{{job.title}}': 'Senior Software Engineer',
  '{{job.location}}': 'Charlotte, NC',
  '{{recruiter.name}}': 'Alex Chen',
  '{{company}}': 'Bank of America',
  '{{interview.date}}': 'Tuesday, July 7 at 2:00 PM',
  '{{apply.link}}': 'careers.bankofamerica.com/apply',
}

function render(text: string): string {
  let out = text
  for (const [tag, val] of Object.entries(SAMPLE)) out = out.split(tag).join(val)
  return out
}

function newBlock(t: BlockType): Block {
  switch (t) {
    case 'heading': return { id: uid(), type: 'heading', text: 'Great news, {{candidate.firstName}}', align: 'left' }
    case 'text': return { id: uid(), type: 'text', text: 'We were impressed by your background and would love to move forward.', align: 'left' }
    case 'button': return { id: uid(), type: 'button', text: 'Schedule your interview', url: '{{apply.link}}', align: 'left' }
    case 'divider': return { id: uid(), type: 'divider' }
    case 'spacer': return { id: uid(), type: 'spacer' }
  }
}

// Starter templates seeded on first load.
function starters(): Template[] {
  const now = new Date().toISOString()
  return [
    {
      id: uid(), name: 'Interview invite', subject: "You're invited to interview for {{job.title}}", preheader: 'Pick a time that works for you',
      blocks: [
        { id: uid(), type: 'heading', text: "Hi {{candidate.firstName}}, let's talk", align: 'left' },
        { id: uid(), type: 'text', text: "Thanks for applying to {{job.title}} at {{company}}. We'd love to learn more about you. Use the link below to grab a time that suits your schedule.", align: 'left' },
        { id: uid(), type: 'button', text: 'Schedule interview', url: '{{apply.link}}', align: 'left' },
        { id: uid(), type: 'text', text: 'Looking forward to it,\n{{recruiter.name}}', align: 'left' },
      ],
      updatedAt: now,
    },
    {
      id: uid(), name: 'Offer', subject: 'Your offer from {{company}}', preheader: "We'd love for you to join the team",
      blocks: [
        { id: uid(), type: 'heading', text: 'Welcome aboard, {{candidate.firstName}}', align: 'left' },
        { id: uid(), type: 'text', text: "We're delighted to extend an offer for the {{job.title}} role in {{job.location}}. The full details are attached — reach out with any questions.", align: 'left' },
        { id: uid(), type: 'button', text: 'Review your offer', url: '{{apply.link}}', align: 'left' },
      ],
      updatedAt: now,
    },
    {
      id: uid(), name: 'Talent nurture', subject: 'A role at {{company}} you might like', preheader: 'Based on your background',
      blocks: [
        { id: uid(), type: 'text', text: 'Hi {{candidate.firstName}}, a new {{job.title}} opening just came up that lines up well with your experience.', align: 'left' },
        { id: uid(), type: 'button', text: 'See the role', url: '{{apply.link}}', align: 'left' },
      ],
      updatedAt: now,
    },
  ]
}

// ── Block editor ────────────────────────────────────────────────────────────
function BlockCard({
  b, index, total, onChange, onRemove, onMove, onFocusField, dragProps,
}: {
  b: Block
  index: number
  total: number
  onChange: (b: Block) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onFocusField: (id: string) => void
  dragProps: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean }
}) {
  const isText = b.type === 'heading' || b.type === 'text' || b.type === 'button'
  return (
    <div className="card" {...dragProps}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
        <span title="Drag to reorder" style={{ cursor: 'grab', color: 'var(--ink-5)', fontSize: 15, userSelect: 'none' }}>⠿</span>
        <span className="badge badge--info" style={{ textTransform: 'capitalize' }}>{b.type}</span>
        <div style={{ flex: 1 }} />
        {isText && (
          <select className="select" style={{ width: 96, height: 28, padding: '2px 8px', fontSize: 12 }} value={b.align ?? 'left'} onChange={(e) => onChange({ ...b, align: e.target.value as 'left' | 'center' })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
          </select>
        )}
        <button className="btn btn--ghost btn--sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
        <button className="btn btn--ghost btn--sm" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">↓</button>
        <button className="btn btn--ghost btn--sm" onClick={onRemove} aria-label="Remove">×</button>
      </div>
      {isText && (
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {b.type === 'heading' || b.type === 'button' ? (
            <input className="input" value={b.text ?? ''} onFocus={() => onFocusField(b.id)} onChange={(e) => onChange({ ...b, text: e.target.value })} placeholder={b.type === 'button' ? 'Button label' : 'Heading'} />
          ) : (
            <textarea className="input" rows={3} value={b.text ?? ''} onFocus={() => onFocusField(b.id)} onChange={(e) => onChange({ ...b, text: e.target.value })} style={{ resize: 'vertical' }} placeholder="Body text" />
          )}
          {b.type === 'button' && (
            <input className="input" value={b.url ?? ''} onChange={(e) => onChange({ ...b, url: e.target.value })} placeholder="Link URL or {{apply.link}}" style={{ fontSize: 12.5 }} />
          )}
        </div>
      )}
      {b.type === 'divider' && <div className="card__body"><div style={{ borderTop: '1px solid var(--line)' }} /></div>}
      {b.type === 'spacer' && <div className="card__body" style={{ color: 'var(--ink-5)', fontSize: 12 }}>Vertical space</div>}
    </div>
  )
}

// ── Preview rendering of a block ────────────────────────────────────────────
function PreviewBlock({ b }: { b: Block }) {
  const align = b.align ?? 'left'
  if (b.type === 'divider') return <hr style={{ border: 0, borderTop: '1px solid #e6e8eb', margin: '18px 0' }} />
  if (b.type === 'spacer') return <div style={{ height: 22 }} />
  if (b.type === 'heading') return <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#0a0e14', margin: '0 0 10px', textAlign: align }}>{render(b.text ?? '')}</h2>
  if (b.type === 'button') return (
    <div style={{ textAlign: align, margin: '6px 0 4px' }}>
      <span style={{ display: 'inline-block', background: 'var(--bofa-red)', color: '#fff', padding: '11px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{render(b.text ?? '')}</span>
    </div>
  )
  return <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#33373d', margin: '0 0 12px', textAlign: align, whiteSpace: 'pre-line' }}>{render(b.text ?? '')}</p>
}

// ── Main builder ────────────────────────────────────────────────────────────
export default function EmailBuilder() {
  const [templates, setTemplates] = usePersistentState<Template[]>('taportal.emailTemplates', starters())
  const [activeId, setActiveId] = useState<string>(() => templates[0]?.id ?? '')
  const dragFrom = useRef<number | null>(null)
  // Which field last had focus, so a merge-tag click knows where to insert.
  const focused = useRef<{ kind: 'subject' | 'preheader' | 'block'; id?: string }>({ kind: 'subject' })

  const active = templates.find((t) => t.id === activeId) ?? templates[0]

  function patch(p: Partial<Template>) {
    if (!active) return
    setTemplates((prev) => prev.map((t) => (t.id === active.id ? { ...t, ...p, updatedAt: new Date().toISOString() } : t)))
  }
  function patchBlocks(fn: (bs: Block[]) => Block[]) {
    if (!active) return
    patch({ blocks: fn(active.blocks) })
  }
  function move(index: number, dir: -1 | 1) {
    patchBlocks((bs) => {
      const next = [...bs]
      const j = index + dir
      if (j < 0 || j >= next.length) return bs
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }
  function reorder(from: number, to: number) {
    if (from === to) return
    patchBlocks((bs) => {
      const next = [...bs]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  function insertTag(tag: string) {
    if (!active) return
    const f = focused.current
    if (f.kind === 'subject') patch({ subject: `${active.subject} ${tag}`.trim() })
    else if (f.kind === 'preheader') patch({ preheader: `${active.preheader} ${tag}`.trim() })
    else if (f.kind === 'block' && f.id) {
      patchBlocks((bs) => bs.map((b) => (b.id === f.id ? { ...b, text: `${b.text ?? ''} ${tag}`.trim() } : b)))
    }
  }

  function newTemplate() {
    const t: Template = { id: uid(), name: 'Untitled email', subject: '', preheader: '', blocks: [newBlock('heading'), newBlock('text'), newBlock('button')], updatedAt: new Date().toISOString() }
    setTemplates((prev) => [...prev, t])
    setActiveId(t.id)
  }
  function deleteTemplate() {
    if (!active) return
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== active.id)
      const fallback = next[0] ?? starters()[0]
      setActiveId(fallback.id)
      return next.length ? next : [fallback]
    })
  }
  function duplicateTemplate() {
    if (!active) return
    const copy: Template = { ...active, id: uid(), name: `${active.name} (copy)`, blocks: active.blocks.map((b) => ({ ...b, id: uid() })), updatedAt: new Date().toISOString() }
    setTemplates((prev) => [...prev, copy])
    setActiveId(copy.id)
  }

  if (!active) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', flexWrap: 'wrap' }}>
          <select className="select" style={{ width: 220 }} value={active.id} onChange={(e) => setActiveId(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn--outline btn--sm" onClick={newTemplate}>+ New</button>
          <button className="btn btn--ghost btn--sm" onClick={duplicateTemplate}>Duplicate</button>
          <div style={{ flex: 1 }} />
          <span className="eyebrow">{active.blocks.length} blocks</span>
          <span className="badge badge--ok" title="Saved automatically">Saved</span>
          <ConfirmButton label="Delete" confirmLabel="Delete template?" onConfirm={deleteTemplate} disabled={templates.length <= 1} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 360px', gap: 16, alignItems: 'start' }}>
        {/* Palette + merge tags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 12 }}>
          <div className="card" style={{ padding: 10 }}>
            <div className="eyebrow" style={{ padding: '4px 6px 8px' }}>Add block</div>
            {PALETTE.map((p) => (
              <button key={p.type} onClick={() => patchBlocks((bs) => [...bs, newBlock(p.type)])}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: '1px solid var(--line)', background: 'var(--app-panel)', cursor: 'pointer', borderRadius: 'var(--ra-2)', padding: '8px 10px', marginBottom: 6, font: 'inherit' }}>
                <span style={{ width: 20, textAlign: 'center', color: 'var(--bofa-navy)', fontSize: 14 }}>{p.glyph}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{p.label}</span>
              </button>
            ))}
          </div>
          <div className="card" style={{ padding: 10 }}>
            <div className="eyebrow" style={{ padding: '4px 6px 8px' }}>Merge tags</div>
            <div style={{ fontSize: 11, color: 'var(--ink-5)', padding: '0 6px 8px' }}>Click to insert at the cursor field.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 4px 4px' }}>
              {MERGE_TAGS.map((tag) => (
                <button key={tag} onClick={() => insertTag(tag)} className="badge" style={{ cursor: 'pointer', border: '1px solid var(--line)' }} title={`Inserts ${tag}`}>
                  {tag.replace(/[{}]/g, '')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Template name</div>
                <input className="input" value={active.name} onChange={(e) => patch({ name: e.target.value })} />
              </label>
              <label>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Subject line</div>
                <input className="input" value={active.subject} onFocus={() => { focused.current = { kind: 'subject' } }} onChange={(e) => patch({ subject: e.target.value })} placeholder="You're invited to interview…" />
              </label>
              <label>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Preheader</div>
                <input className="input" value={active.preheader} onFocus={() => { focused.current = { kind: 'preheader' } }} onChange={(e) => patch({ preheader: e.target.value })} placeholder="Short summary shown in the inbox" />
              </label>
            </div>
          </div>

          {active.blocks.length === 0 ? (
            <div className="card">
              <div className="card__body" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-0)' }}>Empty email</div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>Add blocks from the palette to compose your message.</div>
              </div>
            </div>
          ) : (
            active.blocks.map((b, i) => (
              <BlockCard
                key={b.id}
                b={b}
                index={i}
                total={active.blocks.length}
                onChange={(nb) => patchBlocks((bs) => bs.map((x) => (x.id === b.id ? nb : x)))}
                onRemove={() => patchBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                onMove={(dir) => move(i, dir)}
                onFocusField={(id) => { focused.current = { kind: 'block', id } }}
                dragProps={{
                  draggable: true,
                  onDragStart: () => { dragFrom.current = i },
                  onDragOver: (e) => e.preventDefault(),
                  onDrop: () => { if (dragFrom.current !== null) reorder(dragFrom.current, i); dragFrom.current = null },
                }}
              />
            ))
          )}
        </div>

        {/* Email preview */}
        <div style={{ position: 'sticky', top: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Inbox preview</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--ra-3)', overflow: 'hidden', background: '#f4f5f7' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e6e8eb', background: '#fff' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0a0e14' }}>{render(active.subject) || <span style={{ color: '#9aa0a6' }}>No subject</span>}</div>
              <div style={{ fontSize: 12, color: '#6b7178', marginTop: 2 }}>{render(active.preheader)}</div>
              <div style={{ fontSize: 11.5, color: '#9aa0a6', marginTop: 6 }}>{SAMPLE['{{company}}']} Careers · to {SAMPLE['{{candidate.fullName}}']}</div>
            </div>
            <div style={{ padding: 22, maxHeight: 520, overflowY: 'auto' }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: '26px 24px', maxWidth: 600, margin: '0 auto', boxShadow: '0 1px 3px rgba(10,14,20,0.06)' }}>
                {active.blocks.length === 0
                  ? <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: 13, padding: '20px 0' }}>Your email renders here.</div>
                  : active.blocks.map((b) => <PreviewBlock key={b.id} b={b} />)}
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: '#9aa0a6', marginTop: 16 }}>{SAMPLE['{{company}}']} · You're receiving this because you applied.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
