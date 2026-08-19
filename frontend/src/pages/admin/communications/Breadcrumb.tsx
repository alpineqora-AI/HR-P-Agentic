import { Link } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <span key={item.label} className="breadcrumb__item">
          {idx > 0 && <span className="breadcrumb__separator">&rsaquo;</span>}
          {item.path ? (
            <Link to={item.path} className="breadcrumb__link">{item.label}</Link>
          ) : (
            <span className="breadcrumb__current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
