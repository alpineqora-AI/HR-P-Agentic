import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApplicationConversation } from '@/api/hooks'

// Shared Aria transcript rendering: every conversation a candidate had with
// the external chat agent, one block per application. Used by the candidate
// record page and the Candidates drawer so transcripts look identical
// everywhere.

export function TranscriptBubbles({ messages }: { messages: { id: string; sender: string; body: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 320, overflowY: 'auto', padding: '2px 2px 2px 0' }}>
      {messages.map((m) => {
        const me = m.sender === 'CANDIDATE'
        return (
          <div
            key={m.id}
            style={{
              alignSelf: me ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              fontSize: 12.5,
              lineHeight: 1.45,
              padding: '7px 10px',
              borderRadius: 10,
              background: me ? 'var(--bofa-navy)' : 'var(--app-sunken)',
              color: me ? '#fff' : 'var(--ink-1)',
            }}
          >
            {m.body}
          </div>
        )
      })}
    </div>
  )
}

/** Transcript for one application, labeled with its role. Renders nothing when empty. */
function AppTranscript({ appId, jobTitle, onLoaded }: {
  appId: string
  jobTitle: string
  onLoaded: (appId: string, count: number) => void
}) {
  const { data: convo, isLoading } = useApplicationConversation(appId, true)
  const msgs = useMemo(() => convo?.messages ?? [], [convo])
  useEffect(() => {
    if (!isLoading) onLoaded(appId, msgs.length)
  }, [isLoading, msgs.length, appId, onLoaded])
  if (isLoading || msgs.length === 0) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{jobTitle} · {msgs.length} messages</div>
      <TranscriptBubbles messages={msgs} />
    </div>
  )
}

/** All of a candidate's Aria conversations, with an honest empty state. */
export default function AriaConversations({ apps, emptyText }: {
  apps: { id: string; jobTitle: string }[]
  emptyText?: string
}) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const onLoaded = useCallback((appId: string, count: number) => {
    setCounts((prev) => (prev[appId] === count ? prev : { ...prev, [appId]: count }))
  }, [])
  const allLoaded = apps.every((a) => counts[a.id] !== undefined)
  const total = Object.values(counts).reduce((n, c) => n + c, 0)

  if (apps.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--ink-4)', textAlign: 'center', padding: '24px 0' }}>
        No applications yet — Aria conversations appear once they apply.
      </div>
    )
  }
  return (
    <>
      {apps.map((a) => <AppTranscript key={a.id} appId={a.id} jobTitle={a.jobTitle} onLoaded={onLoaded} />)}
      {allLoaded && total === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-4)', textAlign: 'center', padding: '24px 0' }}>
          {emptyText ?? 'No Aria conversations for this candidate — transcripts appear here when they apply through the career-site chat.'}
        </div>
      )}
    </>
  )
}
