import { createContext, useContext, useEffect, useRef, useState } from 'react'

// Right-side slide-over chrome: dimmed backdrop, floating rounded panel, Esc +
// click-outside to close. True drawer motion: slides in from off-screen right
// and slides back out on close (the close is deferred until the exit animation
// finishes). Callers render their own header / body / footer inside.
const EXIT_MS = 240

/* Children close through this so every path (×, Cancel, success) gets the
   slide-out animation — not just Esc and the backdrop. */
const SlideOverCloseContext = createContext<(() => void) | null>(null)
export function useSlideOverClose() {
  return useContext(SlideOverCloseContext)
}

export default function SlideOver({
  label,
  onClose,
  width = 440,
  children,
}: {
  label: string
  onClose: () => void
  width?: number
  children: React.ReactNode
}) {
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  const close = () => {
    setClosing((already) => {
      if (!already) closeTimer.current = window.setTimeout(onClose, EXIT_MS)
      return true
    })
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <style>{`
        @keyframes slideOverIn{from{transform:translateX(calc(100% + 24px))}to{transform:translateX(0)}}
        @keyframes slideOverOut{from{transform:translateX(0)}to{transform:translateX(calc(100% + 24px))}}
        @keyframes slideOverDim{from{opacity:0}to{opacity:1}}
      `}</style>
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(16,22,38,0.32)', zIndex: 60,
          animation: closing
            ? `slideOverDim ${EXIT_MS}ms ease-out reverse forwards`
            : 'slideOverDim 240ms ease-out',
        }}
      />
      {/* Floating drawer: inset from the viewport edges with rounded corners all
          around, so it reads as a card hovering over the app rather than a wall
          sliding in. overflow:hidden keeps scrolling content inside the radius. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{
          position: 'fixed',
          top: 'calc(var(--shell-chrome-h, 0px) + 12px)',
          right: 12,
          bottom: 12,
          width,
          maxWidth: 'calc(92vw - 12px)',
          background: 'var(--app-panel)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '-24px 0 64px rgba(16,22,38,0.22), 0 8px 28px rgba(16,22,38,0.14)',
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
          animation: closing
            ? `slideOverOut ${EXIT_MS}ms cubic-bezier(0.55, 0, 0.55, 0.2) forwards`
            : 'slideOverIn 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <SlideOverCloseContext.Provider value={close}>{children}</SlideOverCloseContext.Provider>
      </aside>
    </>
  )
}
