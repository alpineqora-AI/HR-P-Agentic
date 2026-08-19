import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useStore } from '@/state/store'
import ConfirmButton from '@/components/ConfirmButton'
import SlideOver from '@/components/SlideOver'
import { MODULES, PERMISSIONS, useConfig } from '@/state/config'
import { usePersistentState } from './admin/builderStore'
import FormBuilder from './admin/FormBuilder'
import AdminWorkflows from './admin/approvals/AdminWorkflows'
import { commsApi } from './admin/communications/commsApi'

type Tab = 'users' | 'forms' | 'workflow' | 'config'

const TABS: { key: Tab; label: string; blurb: string }[] = [
  { key: 'users', label: 'Users & Access', blurb: 'People, roles, and what each role can do' },
  { key: 'forms', label: 'Forms', blurb: 'Intake forms that feed event creation' },
  { key: 'workflow', label: 'Workflow', blurb: 'Approval workflows — the visual builder + rules engine' },
  { key: 'config', label: 'Configuration', blurb: 'Workspace settings and module access' },
]

function StatTile({ label, value, meta }: { label: string; value: string | number; meta?: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {meta ? <div className="stat__meta">{meta}</div> : null}
    </div>
  )
}

function InviteUser({ onClose }: { onClose: () => void }) {
  const { roles, addUser } = useConfig()
  const { toastMsg } = useStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleKey, setRoleKey] = useState(roles.find((r) => r.key === 'recruiter')?.key ?? roles[0]?.key ?? '')
  const valid = email.trim().includes('@') && roleKey

  return (
    <SlideOver label="Invite teammate" onClose={onClose} width={420}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-0)' }}>Invite teammate</div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-4)' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'block' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Full name</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Rivera" />
        </label>
        <label style={{ display: 'block' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Work email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@bofa.com" />
        </label>
        <label style={{ display: 'block' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Role</div>
          <select className="select" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
        </label>
        <div style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>
          {roles.find((r) => r.key === roleKey)?.description}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" disabled={!valid} onClick={() => { addUser(name, email, roleKey); toastMsg(`Invite sent to ${email.trim()}`); onClose() }}>
          Send invite
        </button>
      </div>
    </SlideOver>
  )
}

function UsersAndAccess() {
  const { users, roles, currentUser, setUserRole, removeUser, setCurrentUser, setRolePermission } = useConfig()
  const [inviting, setInviting] = useState(false)

  const kpis = useMemo(() => {
    const admins = users.filter((u) => u.roleKey === 'admin').length
    return { users: users.length, roles: roles.length, admins }
  }, [users, roles])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatTile label="Team members" value={kpis.users} />
        <StatTile label="Roles" value={kpis.roles} />
        <StatTile label="Admins" value={kpis.admins} />
        <StatTile label="Permissions" value={PERMISSIONS.length} />
      </div>

      {/* Team */}
      <div className="card">
        <div className="card__head">
          <h3 style={{ fontSize: 15 }}>Team</h3>
          <button className="btn btn--primary btn--sm" onClick={() => setInviting(true)}>Invite</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="who">
                      <div className="avatar">{u.initials}</div>
                      <div>
                        <div className="who__name">
                          {u.name}
                          {currentUser?.id === u.id ? <span className="badge badge--info" style={{ marginLeft: 8 }}>You</span> : null}
                        </div>
                        <div className="who__sub">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select className="select" style={{ width: 200 }} value={u.roleKey} onChange={(e) => setUserRole(u.id, e.target.value)}>
                      {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="t-right">
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      {currentUser?.id !== u.id && (
                        <button className="btn btn--outline btn--sm" onClick={() => setCurrentUser(u.id)} title="View the app as this user">Act as</button>
                      )}
                      <ConfirmButton label="Remove" confirmLabel="Remove user?" onConfirm={() => removeUser(u.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Roles & permissions matrix */}
      <div className="card">
        <div className="card__head">
          <h3 style={{ fontSize: 15 }}>Roles &amp; permissions</h3>
          <span className="eyebrow">What each role can do</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Permission</th>
                {roles.map((r) => (
                  <th key={r.key} className="t-center" style={{ textAlign: 'center' }}>{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm) => (
                <tr key={perm.key}>
                  <td className="t-strong">{perm.label}</td>
                  {roles.map((r) => {
                    const locked = r.key === 'admin'
                    return (
                      <td key={r.key} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!r.permissions[perm.key]}
                          disabled={locked}
                          onChange={(e) => setRolePermission(r.key, perm.key, e.target.checked)}
                          aria-label={`${r.name} — ${perm.label}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {inviting && <InviteUser onClose={() => setInviting(false)} />}
    </div>
  )
}

function Configuration() {
  const { toggleModule, isModuleOn } = useConfig()
  const [workspace, setWorkspace] = usePersistentState('taportal.workspace', {
    name: 'Bank of America Careers',
    careerSiteUrl: 'http://localhost:5173',
  })

  const groups: { group: string; keys: string[] }[] = []
  for (const m of MODULES) {
    const g = groups.find((x) => x.group === m.group)
    if (g) g.keys.push(m.key)
    else groups.push({ group: m.group, keys: [m.key] })
  }
  const activeModules = MODULES.filter((m) => isModuleOn(m.key)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card__head">
          <h3 style={{ fontSize: 15 }}>Workspace</h3>
          <span className="eyebrow">Identity used across the console</span>
        </div>
        <div className="card__body" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Workspace name</div>
            <input className="input" value={workspace.name} onChange={(e) => setWorkspace({ ...workspace, name: e.target.value })} />
          </label>
          <label style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Career site URL</div>
            <input className="input" value={workspace.careerSiteUrl} onChange={(e) => setWorkspace({ ...workspace, careerSiteUrl: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h3 style={{ fontSize: 15 }}>Module access</h3>
          <span className="eyebrow">{activeModules}/{MODULES.length} sections on</span>
        </div>
        <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((g) => (
            <div key={g.group}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>{g.group}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {g.keys.map((k) => {
                  const mod = MODULES.find((m) => m.key === k)!
                  const on = isModuleOn(k)
                  return (
                    <label key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 'var(--ra-2)', fontSize: 13, cursor: mod.locked ? 'default' : 'pointer', opacity: mod.locked ? 0.6 : 1 }}>
                      <span>{mod.label}{mod.locked ? <span className="muted" style={{ marginLeft: 6 }}>· always on</span> : ''}</span>
                      <input type="checkbox" checked={on} disabled={mod.locked} onChange={() => toggleModule(k)} />
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Count of items in a localStorage-persisted builder store (POC persistence).
function storedCount(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return 0
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.length : 0
  } catch {
    return 0
  }
}

// The intake form persists as { rows: [{ slots: [...] }] } (older: { fields }).
function intakeFieldCount(): number {
  try {
    const raw = localStorage.getItem('taportal.eventIntakeForm')
    if (!raw) return 6 // default form ships with 6 fields
    const v = JSON.parse(raw)
    if (Array.isArray(v?.rows)) return v.rows.reduce((n: number, r: { slots?: unknown[] }) => n + (r.slots ?? []).filter(Boolean).length, 0)
    return Array.isArray(v?.fields) ? v.fields.length : 0
  } catch {
    return 0
  }
}

/** Hub landing: one tile per Admin component. Adding a component = adding a tile. */
function AdminHub({ onOpen }: { onOpen: (t: Tab) => void }) {
  const { users, roles, isModuleOn } = useConfig()
  const navigate = useNavigate()
  const admins = users.filter((u) => u.roleKey === 'admin').length
  const activeModules = MODULES.filter((m) => isModuleOn(m.key)).length

  // Email templates live in the backend now (Communications component).
  const [templateCount, setTemplateCount] = useState<number | null>(null)
  useEffect(() => {
    commsApi.getEmailTemplates().then((t) => setTemplateCount(t.length)).catch(() => setTemplateCount(null))
  }, [])

  // A tile either opens a ?tab= section (key) or routes to a sub-page (path).
  const tiles: { key: Tab; glyph: string; title: string; blurb: string; stat: string; path?: string }[] = [
    {
      key: 'users', glyph: '👥', title: 'Users & Access',
      blurb: 'Invite teammates, assign roles, and control what each role is allowed to do.',
      stat: `${users.length} members · ${roles.length} roles · ${admins} admin${admins === 1 ? '' : 's'}`,
    },
    {
      key: 'users', glyph: '✉', title: 'Communication', path: '/admin/communications',
      blurb: 'Design branded email templates with merge fields, rich formatting, and a live preview.',
      stat: templateCount === null ? 'Email templates' : `${templateCount} template${templateCount === 1 ? '' : 's'}`,
    },
    {
      key: 'forms', glyph: '▤', title: 'Forms',
      blurb: 'Design the intake recruiters fill when creating events — registration rules, targeting, ops.',
      stat: `${intakeFieldCount()} intake field${intakeFieldCount() === 1 ? '' : 's'}`,
    },
    {
      key: 'workflow', glyph: '⑃', title: 'Workflow',
      blurb: 'Design approval workflows on a visual canvas — triggers, conditions, approval levels, and a live simulator.',
      stat: 'Approval workflows',
    },
    {
      key: 'config', glyph: '⚙', title: 'Configuration',
      blurb: 'Workspace identity and which console modules are switched on.',
      stat: `${activeModules}/${MODULES.length} modules on`,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {tiles.map((t) => (
        <button
          key={t.title}
          className="card"
          onClick={() => (t.path ? navigate(t.path) : onOpen(t.key))}
          style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', border: '1px solid var(--line)', padding: 0 }}
        >
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 20px 16px', minHeight: 150 }}>
            <div style={{ width: 38, height: 38, borderRadius: 'var(--ra-2)', background: 'var(--navy-050)', color: 'var(--bofa-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
              {t.glyph}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17.5, color: 'var(--ink-0)' }}>{t.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5, flex: 1 }}>{t.blurb}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span className="eyebrow">{t.stat}</span>
              <span style={{ color: 'var(--bofa-navy)', fontSize: 14 }}>→</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

export default function AdminPage() {
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab')
  // No ?tab → the hub of component tiles; a tab value → that component.
  const tab: Tab | null =
    rawTab === 'users' || rawTab === 'forms' || rawTab === 'workflow' || rawTab === 'config' ? rawTab : null
  const openTab = (t: Tab) => setParams({ tab: t })

  const active = TABS.find((t) => t.key === tab)

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div className="crumb">
          <span className="dot" />
          Platform · Admin{active ? ` · ${active.label}` : ''}
        </div>
        <h1 style={{ fontSize: 28 }}>{active ? active.label : 'Admin'}</h1>
        <p className="sub">
          {active ? active.blurb : 'Everything for running the platform — pick a component to configure.'}
        </p>
      </div>

      {tab === null ? (
        <AdminHub onOpen={openTab} />
      ) : (
        <>
          {/* Section switching lives in the left rail (contextual nav), not in-page tabs. */}
          {tab === 'users' && <UsersAndAccess />}
          {tab === 'forms' && <FormBuilder />}
          {tab === 'workflow' && <AdminWorkflows />}
          {tab === 'config' && <Configuration />}
        </>
      )}
    </div>
  )
}
