import { useEffect, useRef, useState } from 'react'

/**
 * Two-step destructive button: first click arms it ("Confirm?"), second click
 * fires. Disarms itself after 3s or on blur, so a stray click can't destroy
 * anything but a deliberate one is still only two clicks.
 */
export default function ConfirmButton({
  label,
  confirmLabel = 'Confirm?',
  onConfirm,
  className = 'btn btn--ghost btn--sm',
  title,
  disabled,
}: {
  label: string
  confirmLabel?: string
  onConfirm: () => void
  className?: string
  title?: string
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function click() {
    if (!armed) {
      setArmed(true)
      timer.current = setTimeout(() => setArmed(false), 3000)
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setArmed(false)
    onConfirm()
  }

  return (
    <button
      type="button"
      className={className}
      title={title}
      disabled={disabled}
      onClick={click}
      onBlur={() => setArmed(false)}
      style={armed ? { color: 'var(--bofa-red)', fontWeight: 600 } : undefined}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
