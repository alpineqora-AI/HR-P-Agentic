// Lightweight inline SVG icons used across the Olivia app. Adapted from the VMS
// prototype set. Each accepts a className (defaults to "ic") so it inherits the
// design-system sizing/colour rules.
import type { CSSProperties, ReactNode } from 'react'

function Svg({
  children,
  className = 'ic',
  sw = 1.75,
  style,
}: {
  children: ReactNode
  className?: string
  sw?: number
  style?: CSSProperties
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

type P = { className?: string; style?: CSSProperties; sw?: number }

// ---- Chrome ----

export const IconAdmin = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
)

export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Svg>
)
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 01-3.4 0" />
  </Svg>
)
export const IconCheck = (p: P) => (
  <Svg sw={2} {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
)
export const IconChevronLeft = (p: P) => (
  <Svg sw={1.9} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)
export const IconChevronRight = (p: P) => (
  <Svg sw={1.9} {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)
export const IconChevronDown = (p: P) => (
  <Svg sw={1.9} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)
export const IconChevronUp = (p: P) => (
  <Svg sw={1.9} {...p}>
    <path d="M6 15l6-6 6 6" />
  </Svg>
)
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 003.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8a1.65 1.65 0 001.51 1H22a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
)
export const IconSend = (p: P) => (
  <Svg {...p}>
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </Svg>
)

// ---- Recruiting ----

export const IconOverview = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
  </Svg>
)
export const IconJobs = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
  </Svg>
)
export const IconPipeline = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="4" height="16" rx="1" />
    <rect x="10" y="4" width="4" height="11" rx="1" />
    <rect x="17" y="4" width="4" height="7" rx="1" />
  </Svg>
)
export const IconCandidates = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0111 0" />
    <path d="M16 5.5a3 3 0 010 5.6" />
    <path d="M20.5 20a5.5 5.5 0 00-3.5-5.1" />
  </Svg>
)

// ---- Interview ----

export const IconInterviews = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
    <path d="M9 14l2 2 4-4" />
  </Svg>
)
export const IconAssessments = (p: P) => (
  <Svg {...p}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12l1.5 1.5L13 11M9 17h5" />
  </Svg>
)

// ---- Offer & Hire ----

export const IconOffers = (p: P) => (
  <Svg {...p}>
    <path d="M4 4h12l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
    <path d="M15 4v4h4M8 13h8M8 17h5" />
  </Svg>
)
export const IconOnboard = (p: P) => (
  <Svg {...p}>
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
  </Svg>
)

// ---- Talent Intelligence ----

export const IconMatching = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
  </Svg>
)
export const IconSourcing = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
    <path d="M11 8v6M8 11h6" />
  </Svg>
)
export const IconMobility = (p: P) => (
  <Svg {...p}>
    <path d="M3 8h13l-3-3M21 16H8l3 3" />
  </Svg>
)

// ---- Engagement ----

export const IconCrm = (p: P) => (
  <Svg {...p}>
    <path d="M20 21a8 8 0 10-16 0" />
    <circle cx="12" cy="7" r="4" />
    <path d="M12 11v4M10 13h4" />
  </Svg>
)
export const IconCampaigns = (p: P) => (
  <Svg {...p}>
    <path d="M3 11l16-7-4 16-4-6-8-3z" />
    <path d="M11 14l8-10" />
  </Svg>
)
export const IconReferrals = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M8.6 10.6l6.8-3.2M8.6 13.4l6.8 3.2" />
  </Svg>
)
export const IconEvents = (p: P) => (
  <Svg {...p}>
    <path d="M12 2l9 5-9 5-9-5 9-5z" />
    <path d="M3 12l9 5 9-5M3 17l9 5 9-5" />
  </Svg>
)
export const IconSurveys = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h16v14H4z" />
    <path d="M8 10h8M8 14h5" />
    <path d="M8 6V4h8v2" />
  </Svg>
)
export const IconCopilot = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" />
    <path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z" />
  </Svg>
)

// ---- Platform ----

export const IconAnalytics = (p: P) => (
  <Svg {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 15l3-4 3 2 4-6" />
  </Svg>
)
export const IconCompliance = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
)
export const IconIntegrations = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M17.5 14v-2M14 17.5h-2M17.5 21v-3.5h3.5" />
  </Svg>
)
export const IconAudit = (p: P) => (
  <Svg {...p}>
    <path d="M4 4h12l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
    <path d="M15 4v4h4" />
    <path d="M8 12h8M8 16h6" />
  </Svg>
)

// ---- Conversational ----

export const IconChat = (p: P) => (
  <Svg {...p}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </Svg>
)
