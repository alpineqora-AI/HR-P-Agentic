import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/* ------------------------------------------------------------------ *
 * Admin-configurable app state: module toggles + roles/permissions.
 * Persisted to localStorage for the POC — the shape a `/config`
 * endpoint would later own. Adapted (trimmed) from the VMS project.
 * ------------------------------------------------------------------ */

export interface ModuleDef {
  key: string
  label: string
  group: string
  locked?: boolean // always-on (cannot be turned off)
}

// Order here also drives the sidebar nav order.
export const MODULES: ModuleDef[] = [
  // Recruiting
  { key: 'overview', label: 'Overview', group: 'Recruiting', locked: true },
  { key: 'jobs', label: 'Jobs', group: 'Recruiting' },
  { key: 'pipeline', label: 'Pipeline', group: 'Recruiting' },
  { key: 'candidates', label: 'Candidates', group: 'Recruiting' },
  { key: 'approvals', label: 'Approvals', group: 'Recruiting' },
  // Interview
  { key: 'interviews', label: 'Interviews', group: 'Interview' },
  { key: 'availability', label: 'Availability', group: 'Interview' },
  { key: 'assessments', label: 'Assessments', group: 'Interview' },
  // Offer & Hire
  { key: 'offers', label: 'Offers', group: 'Offer & Hire' },
  { key: 'onboarding', label: 'Onboarding', group: 'Offer & Hire' },
  // Talent Intelligence
  { key: 'matching', label: 'AI Matching', group: 'Talent Intelligence' },
  { key: 'sourcing', label: 'Sourcing', group: 'Talent Intelligence' },
  { key: 'mobility', label: 'Internal Mobility', group: 'Talent Intelligence' },
  // Engagement
  { key: 'crm', label: 'Talent CRM', group: 'Engagement' },
  { key: 'campaigns', label: 'Nurture', group: 'Engagement' },
  { key: 'referrals', label: 'Referrals', group: 'Engagement' },
  { key: 'events', label: 'Campus', group: 'Engagement' },
  { key: 'surveys', label: 'Surveys', group: 'Engagement' },
  { key: 'copilot', label: 'AI Copilot', group: 'Engagement' },
  // Platform
  { key: 'analytics', label: 'Analytics', group: 'Platform' },
  { key: 'compliance', label: 'Bias & Compliance', group: 'Platform' },
  { key: 'integrations', label: 'Integrations', group: 'Platform' },
  { key: 'audit', label: 'Audit', group: 'Platform' },
  // Admin
  // Locked: hiding Admin would lock you out of the module toggles themselves.
  { key: 'admin', label: 'Admin', group: 'Admin', locked: true },
]

export const PERMISSIONS = [
  { key: 'dashboard.view', label: 'View dashboards' },
  { key: 'jobs.manage', label: 'Manage jobs & requisitions' },
  { key: 'candidates.manage', label: 'Manage candidates & pipeline' },
  { key: 'interviews.manage', label: 'Schedule & score interviews' },
  { key: 'offers.manage', label: 'Create & send offers' },
  { key: 'admin.config', label: 'Configure modules' },
  { key: 'admin.roles', label: 'Manage roles & permissions' },
  { key: 'admin.builders', label: 'Build surveys & emails' },
] as const

export type PermKey = (typeof PERMISSIONS)[number]['key']

export interface Role {
  key: string
  name: string
  description: string
  permissions: Record<string, boolean>
}

export interface User {
  id: string
  name: string
  initials: string
  email: string
  roleKey: string
}

interface ConfigShape {
  modules: Record<string, boolean>
  roles: Role[]
  users: User[]
  currentUserId: string
}

const all = (v: boolean): Record<string, boolean> => Object.fromEntries(PERMISSIONS.map((p) => [p.key, v]))

const defaultConfig: ConfigShape = {
  modules: Object.fromEntries(MODULES.map((m) => [m.key, true])),
  roles: [
    {
      key: 'admin',
      name: 'Admin',
      description: 'Full access, including configuration and role management.',
      permissions: all(true),
    },
    {
      key: 'recruiter',
      name: 'Recruiter',
      description: 'Runs req-to-hire day to day.',
      permissions: {
        ...all(false),
        'dashboard.view': true,
        'jobs.manage': true,
        'candidates.manage': true,
        'interviews.manage': true,
        'offers.manage': true,
      },
    },
    {
      key: 'hiring_manager',
      name: 'Hiring Manager',
      description: 'Reviews candidates and scores interviews.',
      permissions: {
        ...all(false),
        'dashboard.view': true,
        'candidates.manage': true,
        'interviews.manage': true,
      },
    },
    {
      key: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to dashboards.',
      permissions: { ...all(false), 'dashboard.view': true },
    },
  ],
  users: [
    { id: 'u1', name: 'Avery Stone', initials: 'AS', email: 'avery.stone@bofa.com', roleKey: 'admin' },
    { id: 'u2', name: 'Maya Chen', initials: 'MC', email: 'maya.chen@bofa.com', roleKey: 'recruiter' },
    { id: 'u3', name: 'Daniel Ruiz', initials: 'DR', email: 'daniel.ruiz@bofa.com', roleKey: 'hiring_manager' },
    { id: 'u4', name: 'Sam Okafor', initials: 'SO', email: 'sam.okafor@bofa.com', roleKey: 'viewer' },
  ],
  currentUserId: 'u1',
}

const STORAGE_KEY = 'taportal.config.v1'

function load(): ConfigShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultConfig
    const parsed = JSON.parse(raw) as Partial<ConfigShape>
    // Persist real configuration (modules, role permissions). Identity —
    // who you're acting as — is session-only and resets to the default Admin
    // on reload, so acting as a non-admin can never lock you out.
    return {
      modules: { ...defaultConfig.modules, ...(parsed.modules ?? {}) },
      roles: parsed.roles ?? defaultConfig.roles,
      users: defaultConfig.users,
      currentUserId: defaultConfig.currentUserId,
    }
  } catch {
    return defaultConfig
  }
}

interface ConfigCtx extends ConfigShape {
  isModuleOn: (key: string) => boolean
  toggleModule: (key: string) => void
  setRolePermission: (roleKey: string, perm: string, value: boolean) => void
  setUserRole: (userId: string, roleKey: string) => void
  addUser: (name: string, email: string, roleKey: string) => void
  removeUser: (userId: string) => void
  setCurrentUser: (userId: string) => void
  can: (perm: PermKey) => boolean
  currentUser: User | undefined
  resetConfig: () => void
}

const Ctx = createContext<ConfigCtx | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<ConfigShape>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
    } catch {
      /* ignore */
    }
  }, [cfg])

  const isModuleOn = useCallback(
    // Locked modules are always on, even if an older stored config disabled them.
    (key: string) => MODULES.find((m) => m.key === key)?.locked === true || cfg.modules[key] !== false,
    [cfg.modules],
  )

  const toggleModule = useCallback((key: string) => {
    const mod = MODULES.find((m) => m.key === key)
    if (mod?.locked) return
    setCfg((c) => ({ ...c, modules: { ...c.modules, [key]: c.modules[key] === false } }))
  }, [])

  const setRolePermission = useCallback((roleKey: string, perm: string, value: boolean) => {
    setCfg((c) => ({
      ...c,
      roles: c.roles.map((r) => (r.key === roleKey ? { ...r, permissions: { ...r.permissions, [perm]: value } } : r)),
    }))
  }, [])

  const setUserRole = useCallback((userId: string, roleKey: string) => {
    setCfg((c) => ({ ...c, users: c.users.map((u) => (u.id === userId ? { ...u, roleKey } : u)) }))
  }, [])

  const addUser = useCallback((name: string, email: string, roleKey: string) => {
    const trimmed = name.trim() || email.trim().split('@')[0]
    const initials =
      trimmed
        .split(/\s+/)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .slice(0, 2)
        .join('') || 'U'
    const id = 'u' + Math.random().toString(36).slice(2, 9)
    setCfg((c) => ({ ...c, users: [...c.users, { id, name: trimmed, initials, email: email.trim(), roleKey }] }))
  }, [])

  const removeUser = useCallback((userId: string) => {
    setCfg((c) => ({ ...c, users: c.users.filter((u) => u.id !== userId) }))
  }, [])

  const setCurrentUser = useCallback((userId: string) => setCfg((c) => ({ ...c, currentUserId: userId })), [])

  const currentUser = useMemo(
    () => cfg.users.find((x) => x.id === cfg.currentUserId),
    [cfg.users, cfg.currentUserId],
  )

  const currentRole = useMemo(
    () => cfg.roles.find((r) => r.key === currentUser?.roleKey),
    [cfg.roles, currentUser],
  )

  const can = useCallback((perm: PermKey) => !!currentRole?.permissions[perm], [currentRole])

  const resetConfig = useCallback(() => setCfg(defaultConfig), [])

  const value: ConfigCtx = {
    ...cfg,
    isModuleOn,
    toggleModule,
    setRolePermission,
    setUserRole,
    addUser,
    removeUser,
    setCurrentUser,
    can,
    currentUser,
    resetConfig,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useConfig() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider')
  return ctx
}
