/* Small formatting helpers. Prefer the design-system classes in ds-product.css
   for visuals — these only normalise data into display strings. */

/** Money, e.g. money(125000) → "$125,000". */
export function money(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

/** Compact money for KPIs: $2.5M, $480K. */
export function moneyShort(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

/** ISO date (or datetime) → "02 Jun 2026". Accepts bare yyyy-MM-dd too. */
export function date(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = iso.length <= 10 ? new Date(`${iso}T00:00:00`) : new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Fraction (0..1) → "73%". Pass already-scaled values with scaled=false → e.g. percent(73, false). */
export function percent(value: number | null | undefined, fraction = true) {
  if (value == null || Number.isNaN(value)) return '—'
  const pct = fraction ? value * 100 : value
  return `${Math.round(pct)}%`
}

/** Coarse relative time, e.g. "3d ago", "just now". */
export function relativeTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Date.now() - then
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(mo / 12)}y ago`
}

/** Initials for an avatar, e.g. "Priya Sharma" → "PS". */
export function initials(name: string | null | undefined) {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase()
}

/** Human label for a backend enum, e.g. "EARLY_CAREER" → "Early career". */
export function humanize(value: string | null | undefined) {
  if (!value) return '—'
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
