import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { IconBell } from '@/components/icons'

/* The top-band bell: polls /v1/notifications, shows an unread count, and opens
   a popover feed. Clicking an item marks it read and follows its link. */

interface NotificationRow {
  id: string
  kind: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
}

interface Feed {
  items: NotificationRow[]
  unread: number
}

const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Feed>('/notifications').then((r) => r.data),
    refetchInterval: 30_000,
  })
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // click-away + Escape close
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = data?.unread ?? 0
  const items = data?.items ?? []

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        className="btn btn--ghost btn--icon"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        onClick={() => setOpen((o) => !o)}
      >
        <IconBell className="ic" />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16,
              padding: '0 4px', borderRadius: 999, background: 'var(--bofa-red)',
              color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: '16px',
              textAlign: 'center', pointerEvents: 'none',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 380,
            maxHeight: 480, display: 'flex', flexDirection: 'column',
            background: 'var(--app-panel)', border: '1px solid var(--line)',
            borderRadius: 14, boxShadow: '0 18px 48px rgba(16,22,38,0.18)', zIndex: 70,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-0)' }}>Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--bofa-navy)', fontWeight: 600 }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
                Nothing yet — approvals and registrations will show up here.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id)
                    setOpen(false)
                    if (n.link) navigate(n.link)
                  }}
                  style={{
                    display: 'flex', gap: 10, width: '100%', textAlign: 'left',
                    border: 0, cursor: 'pointer', font: 'inherit',
                    padding: '11px 16px', background: 'transparent',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: 999, marginTop: 6, flexShrink: 0,
                      background: n.read ? 'transparent' : 'var(--bofa-navy)',
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: n.read ? 500 : 650, color: 'var(--ink-0)' }}>
                      {n.title}
                    </span>
                    {n.body ? (
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.body}
                      </span>
                    ) : null}
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-5)', marginTop: 3 }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
