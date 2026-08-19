interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export default function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <label className="toggle-switch">
      <span className="toggle-switch__label">{label}</span>
      <button
        role="switch"
        type="button"
        aria-checked={checked}
        className={`toggle-switch__track ${checked ? 'toggle-switch__track--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-switch__thumb" />
      </button>
      <span className="toggle-switch__state">{checked ? 'On' : 'Off'}</span>
    </label>
  )
}
