export interface Tab {
  key: string
  label: string
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onChange: (key: string) => void
}

export default function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <div className="dashboard__tabs">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`dashboard__tab${activeTab === tab.key ? ' dashboard__tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
