export interface EmailTemplate {
  templateId: string
  name: string
  description: string
  category: EmailCategory
  subject: string
  fromName: string
  bodyHtml: string
  bodyJson?: string
  mergeFields?: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  isDefault: boolean
  createdBy?: number
  createdAt: string
  updatedAt: string
}

export type EmailCategory =
  | 'INVITATION'
  | 'REMINDER'
  | 'THANK_YOU'
  | 'WELCOME'
  | 'COMPLETION'
  | 'ANNOUNCEMENT'
  | 'CUSTOM'

export const EMAIL_CATEGORIES: { value: EmailCategory; label: string; color: string }[] = [
  { value: 'INVITATION', label: 'Invitation', color: '#007aff' },
  { value: 'REMINDER', label: 'Reminder', color: '#ff9500' },
  { value: 'THANK_YOU', label: 'Thank You', color: '#34c759' },
  { value: 'WELCOME', label: 'Welcome', color: '#5856d6' },
  { value: 'COMPLETION', label: 'Completion', color: '#30b0c7' },
  { value: 'ANNOUNCEMENT', label: 'Announcement', color: '#ff2d55' },
  { value: 'CUSTOM', label: 'Custom', color: '#8e8e93' },
]

export interface MergeField {
  field: string
  label: string
}

export interface MergeFieldGroup {
  [category: string]: MergeField[]
}

