import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCandidates, useJobs } from '@/api/hooks'
import { initials } from '@/lib/format'

// ⌘K command palette: jump to any page, requisition, or candidate.
// Opened from the topbar search or Cmd/Ctrl+K; fully keyboard-driven.

interface Item {
  key: string
  group: 'Pages' | 'Jobs' | 'Candidates'
  label: string
  sub?: string
  to: string
}

const PAGES: { label: string; to: string }[] = [
  { label: 'Overview', to: '/' },
  { label: 'Jobs', to: '/jobs' },
  { label: 'Pipeline', to: '/pipeline' },
  { label: 'Candidates', to: '/candidates' },
  { label: 'Interviews', to: '/interviews' },
  { label: 'Assessments', to: '/assessments' },
  { label: 'Offers', to: '/offers' },
  { label: 'Onboarding', to: '/onboarding' },
  { label: 'AI Matching', to: '/matching' },
  { label: 'Sourcing', to: '/sourcing' },
  { label: 'Internal Mobility', to: '/mobility' },
  { label: 'Talent CRM', to: '/crm' },
  { label: 'Nurture', to: '/campaigns' },
  { label: 'Referrals', to: '/referrals' },
  { label: 'Events & Campus', to: '/events' },
  { label: 'Surveys', to: '/surveys' },
  { label: 'AI Copilot', to: '/copilot' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'Bias & Compliance', to: '/compliance' },
  { label: 'Integrations', to: '/integrations' },
  { label: 'Audit', to: '/audit' },
  { label: 'Admin', to: '/admin' },
]

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: jobs } = useJobs()
  const { data: candidates } = useCandidates()

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      // focus after the overlay paints
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase()
    const match = (s: string | null | undefined) => !needle || (s ?? '').toLowerCase().includes(needle)
    const pages: Item[] = PAGES.filter((p) => match(p.label)).map((p) => ({
      key: `p:${p.to}`, group: 'Pages', label: p.label, to: p.to,
    }))
    const jobItems: Item[] = (jobs ?? [])
      .filter((j) => match(j.title) || match(j.department) || match(j.location))
      .map((j) => ({
        key: `j:${j.id}`, group: 'Jobs' as const, label: j.title,
        sub: [j.department, j.location].filter(Boolean).join(' · '), to: `/jobs/${j.id}`,
      }))
    const candItems: Item[] = (candidates ?? [])
      .filter((c) => match(c.name) || match(c.headline) || match(c.location))
      .map((c) => ({
        key: `c:${c.id}`, group: 'Candidates' as const, label: c.name,
        sub: c.headline ?? undefined, to: `/candidates/${c.id}`,
      }))
    // Without a query, show pages only (a directory); with one, jobs+candidates first.
    if (!needle) return pages
    return [...jobItems.slice(0, 6), ...candItems.slice(0, 6), ...pages.slice(0, 5)]
  }, [q, jobs, candidates])

  useEffect(() => setCursor(0), [q])

  function pick(item: Item) {
    onClose()
    navigate(item.to)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && items[cursor]) { e.preventDefault(); pick(items[cursor]) }
    else if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  let lastGroup: string | null = null

  return (
    <div
      role="dialog"
      aria-label="Search"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,26,51,0.32)', zIndex: 90, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}
    >
      <div style={{ width: 560, maxWidth: '92vw', background: 'var(--app-panel)', borderRadius: 'var(--ra-3)', boxShadow: '0 18px 50px rgba(14,26,51,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--ink-4)', fontSize: 15 }}>⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a job, candidate, or page…"
            style={{ flex: 1, border: 0, outline: 'none', font: 'inherit', fontSize: 15, color: 'var(--ink-0)', background: 'transparent' }}
          />
          <span className="badge" style={{ fontSize: 10.5 }}>esc</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '6px 0 8px' }}>
          {items.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
              No matches for “{q}”.
            </div>
          ) : (
            items.map((item, i) => {
              const showHead = item.group !== lastGroup
              lastGroup = item.group
              const active = i === cursor
              return (
                <div key={item.key}>
                  {showHead && (
                    <div className="eyebrow" style={{ padding: '10px 16px 4px' }}>{item.group}</div>
                  )}
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => pick(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      border: 0, cursor: 'pointer', font: 'inherit', padding: '9px 16px',
                      background: active ? 'var(--navy-050)' : 'transparent',
                    }}
                  >
                    {item.group === 'Candidates' && <span className="avatar" style={{ width: 26, height: 26, fontSize: 10.5 }}>{initials(item.label)}</span>}
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, color: active ? 'var(--bofa-navy)' : 'var(--ink-0)', fontWeight: active ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                      {item.sub && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</span>}
                    </span>
                    {active && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-5)' }}>↵</span>}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
