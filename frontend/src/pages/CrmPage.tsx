import { useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import SlideOver from '@/components/SlideOver'
import { useAddPoolMember, useCandidates, useCreatePool, usePools } from '@/api/hooks'
import { initials } from '@/lib/format'
import type { Pool } from '@/api/types'

// Phenom-inspired talent CRM: organise prospects into nurtured talent pools.

function NewPoolForm({ onClose }: { onClose: () => void }) {
  const create = useCreatePool()
  const { toastMsg } = useStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  return (
    <SlideOver label="New talent pool" onClose={onClose} width={420}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)' }}>New talent pool</div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'block' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Name</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="2026 New-grad engineers" />
        </label>
        <label style={{ display: 'block' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Description</div>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who belongs in this pool and why…" style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name: name.trim(), description: description.trim() || undefined }, { onSuccess: (p) => { toastMsg(`Pool "${p.name}" created`); onClose() } })}>
          {create.isPending ? 'Creating…' : 'Create pool'}
        </button>
      </div>
    </SlideOver>
  )
}

function AddCandidatePanel({ pool, onClose }: { pool: Pool; onClose: () => void }) {
  const { data: candidates } = useCandidates()
  const add = useAddPoolMember()
  const [q, setQ] = useState('')
  const [addedId, setAddedId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const list = candidates ?? []
    const query = q.trim().toLowerCase()
    if (!query) return list.slice(0, 50)
    return list.filter((c) => [c.name, c.headline, c.location].some((v) => v?.toLowerCase().includes(query))).slice(0, 50)
  }, [candidates, q])

  return (
    <SlideOver label={`Add to ${pool.name}`} onClose={onClose} width={440}>
      <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>Add to “{pool.name}”</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
        </div>
        <input className="input" style={{ marginTop: 12 }} placeholder="Search candidates…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', padding: '16px' }}>No candidates match.</div>
        ) : (
          rows.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderBottom: '1px solid var(--line)' }}>
              <span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{initials(c.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ink-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                {c.headline ? <div style={{ fontSize: 11.5, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.headline}</div> : null}
              </div>
              <button
                className="btn btn--outline btn--sm"
                disabled={add.isPending && addedId === c.id}
                onClick={() => { setAddedId(c.id); add.mutate({ poolId: pool.id, candidateId: c.id }) }}
              >
                {addedId === c.id && !add.isPending ? 'Added ✓' : add.isPending && addedId === c.id ? 'Adding…' : 'Add'}
              </button>
            </div>
          ))
        )}
      </div>
    </SlideOver>
  )
}

export default function CrmPage() {
  const { data, isLoading } = usePools()
  const [creating, setCreating] = useState(false)
  const [addTo, setAddTo] = useState<Pool | null>(null)

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <span className="dot" />
          Engagement · Talent CRM
        </div>
        <div className="page-head__row">
          <div>
            <h1>Talent CRM</h1>
            <p className="sub">
              Segment prospects into living talent pools — pipelines you nurture over time so the right people are warm
              before the req opens.
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>New pool</button>
        </div>
      </div>

      {isLoading ? (
        <div className="card">
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>Loading talent pools…</div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card">
          <div style={{ padding: '44px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-0)' }}>No talent pools yet</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', margin: '6px 0 16px' }}>Create one to start nurturing prospects.</div>
            <button className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>New pool</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {data.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 168 }}>
              <div style={{ padding: '20px 20px 0' }}>
                <div className="eyebrow" style={{ fontSize: 9.5 }}>Talent pool</div>
                <h3 style={{ margin: '8px 0 0', fontSize: 18 }}>{p.name}</h3>
                <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  {p.description}
                </p>
              </div>
              <div
                style={{
                  marginTop: 'auto',
                  padding: '14px 20px',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  <span className="t-num t-strong" style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{p.memberCount}</span>
                  <span className="muted" style={{ margin: '0 0 0 6px' }}>members</span>
                </span>
                <button className="btn btn--outline btn--sm" onClick={() => setAddTo(p)}>Add candidate</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <NewPoolForm onClose={() => setCreating(false)} />}
      {addTo && <AddCandidatePanel pool={addTo} onClose={() => setAddTo(null)} />}
    </div>
  )
}
