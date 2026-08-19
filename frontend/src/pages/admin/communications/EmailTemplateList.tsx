import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Button } from './TvButton'
import Breadcrumb from './Breadcrumb'
import { commsApi as api } from './commsApi'
import type { EmailTemplate } from './emailTemplate'
import '@/styles/tv-comms.css'
import { EMAIL_CATEGORIES } from './emailTemplate'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, SizeColumnsToFitGridStrategy } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule])

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}

const CATEGORY_MAP = Object.fromEntries(EMAIL_CATEGORIES.map(c => [c.value, c]))

const categoryFilters: Record<string, string> = {
  all: 'All',
  INVITATION: 'Invitation',
  REMINDER: 'Reminder',
  THANK_YOU: 'Thank You',
  WELCOME: 'Welcome',
  COMPLETION: 'Completion',
  ANNOUNCEMENT: 'Announcement',
  CUSTOM: 'Custom',
}

const paginationPageSizeSelector = [5, 10, 20]

/* ===== Actions cell renderer ===== */
function ActionsCellRenderer({ data, onEdit, onClone, onDelete }: {
  data: EmailTemplate
  onEdit: (id: string) => void
  onClone: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.right - 120 })
    }
    setOpen(!open)
  }

  if (!data) return null
  return (
    <div className="ag-actions-wrap">
      <button ref={triggerRef} className="ag-actions-trigger" onClick={handleToggle} title="Actions">⋮</button>
      {open && createPortal(
        <div ref={menuRef} className="ag-actions-dropdown" style={{ top: pos.top, left: pos.left }}>
          <button className="ag-actions-dropdown__item" onClick={() => { setOpen(false); onEdit(data.templateId) }}>Edit</button>
          <button className="ag-actions-dropdown__item" onClick={() => { setOpen(false); onClone(data.templateId) }}>Clone</button>
          <button className="ag-actions-dropdown__item ag-actions-dropdown__item--danger" onClick={() => { setOpen(false); onDelete(data.templateId) }}>Delete</button>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ===== Status pill renderer ===== */
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active', DRAFT: 'Draft', ARCHIVED: 'Archived',
}

function StatusCellRenderer({ value }: { value: string }) {
  return <span>{STATUS_LABELS[value] || 'Draft'}</span>
}

/* ===== Category pill renderer ===== */
function CategoryCellRenderer({ value }: { value: string }) {
  const cat = CATEGORY_MAP[value]
  return <span>{cat ? cat.label : value}</span>
}

/* ===== Main component ===== */
export default function EmailTemplateList() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [quickFilterText, setQuickFilterText] = useState<string>()
  const [activeTab, setActiveTab] = useState('all')
  const gridRef = useRef<AgGridReact>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.getEmailTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  const handleClone = useCallback(async (id: string) => {
    try {
      const cloned = await api.duplicateEmailTemplate(id)
      setTemplates(prev => [...prev, cloned])
    } catch { alert('Failed to clone template') }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const t = templates.find(t => t.templateId === id)
    if (!t || !confirm(`Delete "${t.name}"? This cannot be undone.`)) return
    try {
      await api.deleteEmailTemplate(id)
      setTemplates(prev => prev.filter(t => t.templateId !== id))
    } catch { alert('Failed to delete template') }
  }, [templates])

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'name',
      headerName: 'Template Name',
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: { data: EmailTemplate }) => params.data?.name || '',
      onCellClicked: (params) => {
        if (params.data) navigate(`/admin/communications/${(params.data as EmailTemplate).templateId}/edit`)
      },
      cellStyle: { color: '#007aff', cursor: 'pointer', fontWeight: 500 },
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 140,
      cellRenderer: CategoryCellRenderer,
    },
    {
      field: 'subject',
      headerName: 'Subject Line',
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'updatedAt',
      headerName: 'Last Updated',
      width: 140,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'createdAt',
      headerName: 'Date Created',
      width: 140,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      cellRenderer: StatusCellRenderer,
    },
    {
      headerName: 'Actions',
      colId: 'actions',
      width: 100,
      sortable: false,
      filter: false,
      resizable: false,
      cellRendererParams: {
        onEdit: (id: string) => navigate(`/admin/communications/${id}/edit`),
        onClone: handleClone,
        onDelete: handleDelete,
      },
      cellRenderer: ActionsCellRenderer,
    },
  ], [navigate, handleClone, handleDelete])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: false,
    resizable: true,
  }), [])

  const autoSizeStrategy = useMemo<SizeColumnsToFitGridStrategy>(() => ({
    type: 'fitGridWidth',
  }), [])

  const onFilterTextBoxChanged = useCallback(
    ({ target: { value } }: ChangeEvent<HTMLInputElement>) => setQuickFilterText(value),
    [],
  )

  const handleTabClick = useCallback((category: string) => {
    setActiveTab(category)
  }, [])

  const filteredTemplates = useMemo(() => {
    if (activeTab === 'all') return templates
    return templates.filter(t => t.category === activeTab)
  }, [templates, activeTab])

  return (
    <div className="comms-library">
      <Breadcrumb items={[
        { label: 'Administration', path: '/admin' },
        { label: 'Email Templates' },
      ]} />

      <h1 className="comms-library__title">Email Templates</h1>

      <div className="comms-library__table-card">
        <div className="comms-library__toolbar">
          <div className="comms-library__tabs">
            {Object.entries(categoryFilters).map(([key, label]) => (
              <button
                key={key}
                className={`comms-library__tab-btn${activeTab === key ? ' comms-library__tab-btn--active' : ''}`}
                onClick={() => handleTabClick(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="comms-library__toolbar-right">
            <div className="comms-library__search-wrap">
              <svg className="comms-library__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm-.82 4.74a6 6 0 1 1 1.06-1.06l2.79 2.79a.75.75 0 1 1-1.06 1.06l-2.79-2.79Z" fill="currentColor"/>
              </svg>
              <input
                type="text"
                placeholder="Search templates..."
                onInput={onFilterTextBoxChanged}
                className="comms-library__search-input"
              />
            </div>

            <Button variant="primary" size="sm" onClick={() => navigate('/admin/communications/new')}>
              + Create Template
            </Button>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: 60, color: '#86868b' }}>Loading templates...</p>
        ) : (
          <div className="ag-theme-quartz comms-library__grid">
            <AgGridReact
              ref={gridRef}
              rowData={filteredTemplates}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              autoSizeStrategy={autoSizeStrategy}
              pagination
              paginationPageSize={10}
              paginationPageSizeSelector={paginationPageSizeSelector}
              quickFilterText={quickFilterText}
              domLayout="autoHeight"
              rowHeight={40}
              getRowId={(params) => String(params.data.templateId)}
              overlayNoRowsTemplate="<span style='padding:40px;color:#86868b;font-size:14px'>No email templates found</span>"
            />
          </div>
        )}
      </div>
    </div>
  )
}
