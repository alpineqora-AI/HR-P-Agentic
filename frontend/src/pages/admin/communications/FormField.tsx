interface FormFieldProps {
  label: string
  required?: boolean
  helper?: string
  htmlFor?: string
  children: React.ReactNode
}

export default function FormField({ label, required, helper, htmlFor, children }: FormFieldProps) {
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={htmlFor}>
        {label}{required && '*'}
      </label>
      {children}
      {helper && <span className="form-field__helper">{helper}</span>}
    </div>
  )
}
