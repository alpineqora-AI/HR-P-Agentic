import { useEffect, useMemo, useState } from 'react'
import type { Page } from './SurveyEditor'

// Configuration (logic) tab — exact port of Teammate Voices' LogicTab and the
// components/config flow view: Flow View + Rules List sub-tabs, a rule editor
// with AND/OR condition groups (survey answers or participant attributes),
// and visible_if / required_if / skip_to / pipe_text rules.

// ── Types (exact from types/logic.ts) ───────────────────────────────────────
export type LogicOperator =
  | 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between'
  | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' | 'any_of'

export type ConditionType = 'question' | 'participant'

export interface LogicCondition {
  conditionType?: ConditionType
  questionId?: string
  participantField?: string
  operator: LogicOperator
  value: string | number | string[]
}

export interface LogicAction {
  type: 'show' | 'hide' | 'require' | 'skip_to' | 'pipe'
  targetQuestionId?: string
  targetPageId?: string
  pipeField?: string
}

export interface LogicRule {
  id: string
  type: 'visible_if' | 'required_if' | 'skip_to' | 'pipe_text'
  conditions: { operator: 'AND' | 'OR'; items: LogicCondition[] }
  action: LogicAction
}

export const RULE_TYPE_LABELS: Record<LogicRule['type'], string> = {
  visible_if: 'Show/Hide',
  required_if: 'Make Required',
  skip_to: 'Skip To',
  pipe_text: 'Pipe Text',
}

const ACTION_TYPE_LABELS: Record<LogicAction['type'], string> = {
  show: 'Show', hide: 'Hide', require: 'Require', skip_to: 'Skip to', pipe: 'Pipe',
}

const OPERATOR_LABELS: Record<LogicOperator, string> = {
  equals: 'Equals', not_equals: 'Does not equal', greater_than: 'Greater than',
  less_than: 'Less than', between: 'Between', contains: 'Contains',
  not_contains: 'Does not contain', is_empty: 'Is empty', is_not_empty: 'Is not empty',
  any_of: 'Is any of',
}

const CHOICE_OPERATORS: LogicOperator[] = ['equals', 'not_equals', 'is_empty', 'is_not_empty']
const RATING_OPERATORS: LogicOperator[] = ['equals', 'not_equals', 'greater_than', 'less_than', 'between']
const TEXT_OPERATORS: LogicOperator[] = ['contains', 'not_contains', 'is_empty', 'is_not_empty', 'equals', 'not_equals']
const MULTI_CHOICE_OPERATORS: LogicOperator[] = ['any_of', 'equals', 'is_empty', 'is_not_empty']

const PARTICIPANT_FIELDS: { value: string; label: string }[] = [
  { value: 'region', label: 'Region' },
  { value: 'lineOfBusiness', label: 'Line of Business' },
  { value: 'cohort', label: 'Cohort' },
  { value: 'participantType', label: 'Participant Type' },
  { value: 'hierarchyCode', label: 'Hierarchy Code' },
]

const PARTICIPANT_FIELD_PRESETS: Record<string, string[]> = {
  participantType: ['NEW_HIRE', 'EXISTING_RESOURCE'],
  region: ['North America', 'APAC', 'EMEA', 'LATAM'],
  lineOfBusiness: ['Retail Banking', 'Corporate Banking', 'Wealth Management', 'Insurance', 'Capital Markets'],
}

// ── Flattened question info (config/types.ts) ───────────────────────────────
interface QuestionInfo {
  id: string
  label: string
  text: string
  type: string
  options: string[]
  pageId: string
  pageLabel: string
  pageIdx: number
  questionIdx: number
}

function buildQuestionList(pages: Page[]): QuestionInfo[] {
  return pages.flatMap((page, pageIdx) =>
    page.questions.map((q, qIdx) => ({
      id: q.id,
      label: `P${pageIdx + 1} Q${qIdx + 1}: ${q.text || 'Untitled'}`,
      text: q.text || 'Untitled',
      type: q.type,
      options: (q.options ?? []).map((o) => o.text),
      pageId: page.id,
      pageLabel: page.title || `Page ${pageIdx + 1}`,
      pageIdx,
      questionIdx: qIdx,
    })),
  )
}

const getRuleCountForQuestion = (questionId: string, rules: LogicRule[]) =>
  rules.filter((r) => r.conditions.items.some((c) => c.questionId === questionId) || r.action.targetQuestionId === questionId).length

const getRulesSourcedFrom = (questionId: string, rules: LogicRule[]) =>
  rules.filter((r) => r.conditions.items.some((c) => c.questionId === questionId))

const getRulesTargeting = (questionId: string, rules: LogicRule[]) =>
  rules.filter((r) => r.action.targetQuestionId === questionId)

const generateRuleId = () => 'lr_' + Math.random().toString(36).substring(2, 11)

function createEmptyRule(sourceQuestionId?: string): LogicRule {
  return {
    id: generateRuleId(),
    type: 'visible_if',
    conditions: {
      operator: 'AND',
      items: sourceQuestionId ? [{ questionId: sourceQuestionId, operator: 'equals', value: '' }] : [],
    },
    action: { type: 'show' },
  }
}

function getOperatorsForType(questionType: string): LogicOperator[] {
  const t = questionType?.toLowerCase() || 'text'
  if (t.includes('multi') || t.includes('checkbox')) return MULTI_CHOICE_OPERATORS
  if (t.includes('rating') || t.includes('scale') || t.includes('nps')) return RATING_OPERATORS
  if (t.includes('choice') || t.includes('radio') || t.includes('dropdown') || t.includes('yes_no') || t.includes('select')) return CHOICE_OPERATORS
  return TEXT_OPERATORS
}

const needsValueInput = (op: LogicOperator) => op !== 'is_empty' && op !== 'is_not_empty'

// ── Condition row ───────────────────────────────────────────────────────────
function LogicConditionRow({ condition, questions, onChange, onRemove, showConjunction }: {
  condition: LogicCondition
  questions: QuestionInfo[]
  onChange: (c: LogicCondition) => void
  onRemove: () => void
  showConjunction?: 'AND' | 'OR' | null
}) {
  const conditionType: ConditionType = condition.conditionType || 'question'
  const isParticipant = conditionType === 'participant'
  const selectedQuestion = questions.find((q) => q.id === condition.questionId)
  const operators = isParticipant ? TEXT_OPERATORS : selectedQuestion ? getOperatorsForType(selectedQuestion.type) : TEXT_OPERATORS
  const hasChoiceOptions = !isParticipant && !!selectedQuestion?.options?.length
  const participantPresets = isParticipant && condition.participantField ? PARTICIPANT_FIELD_PRESETS[condition.participantField] ?? null : null

  return (
    <div style={{ marginBottom: 8 }}>
      {showConjunction && (
        <span className="badge badge--info" style={{ marginBottom: 6, display: 'inline-block' }}>{showConjunction}</span>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="select"
          style={{ width: 160 }}
          value={conditionType}
          onChange={(e) => {
            const newType = e.target.value as ConditionType
            onChange({
              conditionType: newType,
              questionId: newType === 'question' ? condition.questionId || '' : undefined,
              participantField: newType === 'participant' ? condition.participantField || PARTICIPANT_FIELDS[0].value : undefined,
              operator: 'equals',
              value: '',
            })
          }}
        >
          <option value="question">Survey Answer</option>
          <option value="participant">Participant Attribute</option>
        </select>

        {isParticipant ? (
          <select
            className="select"
            style={{ flex: 1, minWidth: 150 }}
            value={condition.participantField || ''}
            onChange={(e) => onChange({ ...condition, conditionType: 'participant', participantField: e.target.value, operator: 'equals', value: '' })}
          >
            <option value="">Select attribute</option>
            {PARTICIPANT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        ) : (
          <select
            className="select"
            style={{ flex: 1, minWidth: 170 }}
            value={condition.questionId || ''}
            onChange={(e) => onChange({ ...condition, conditionType: 'question', questionId: e.target.value, operator: 'equals', value: '' })}
          >
            <option value="">Select question</option>
            {questions.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
        )}

        <select
          className="select"
          style={{ width: 150 }}
          value={condition.operator}
          onChange={(e) => onChange({ ...condition, operator: e.target.value as LogicOperator })}
        >
          {operators.map((op) => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
        </select>

        {needsValueInput(condition.operator) && (
          hasChoiceOptions ? (
            <select className="select" style={{ width: 170 }} value={String(condition.value || '')} onChange={(e) => onChange({ ...condition, value: e.target.value })}>
              <option value="">Select value</option>
              {selectedQuestion!.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : participantPresets ? (
            <select className="select" style={{ width: 170 }} value={String(condition.value || '')} onChange={(e) => onChange({ ...condition, value: e.target.value })}>
              <option value="">Select value</option>
              {participantPresets.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ) : (
            <input className="input" style={{ width: 170 }} value={String(condition.value || '')} placeholder="Enter value" onChange={(e) => onChange({ ...condition, value: e.target.value })} />
          )
        )}

        <button className="btn btn--ghost btn--sm" onClick={onRemove} aria-label="Remove condition">×</button>
      </div>
    </div>
  )
}

// ── Rule editor ─────────────────────────────────────────────────────────────
const RULE_TYPES: { value: LogicRule['type']; label: string }[] = [
  { value: 'visible_if', label: 'Show / Hide' },
  { value: 'required_if', label: 'Make Required' },
  { value: 'skip_to', label: 'Skip To' },
  { value: 'pipe_text', label: 'Pipe Text' },
]

function LogicRuleEditor({ rule, questions, pages, onSave, onCancel, onDelete, onChange }: {
  rule: LogicRule
  questions: QuestionInfo[]
  pages: { id: string; label: string }[]
  onSave: (r: LogicRule) => void
  onCancel: () => void
  onDelete: () => void
  onChange: (r: LogicRule) => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const actionTypeOptions = rule.type === 'visible_if'
    ? [{ value: 'show', label: 'Show question' }, { value: 'hide', label: 'Hide question' }]
    : rule.type === 'required_if' ? [{ value: 'require', label: 'Make required' }]
    : rule.type === 'skip_to' ? [{ value: 'skip_to', label: 'Skip to' }]
    : [{ value: 'pipe', label: 'Pipe answer' }]

  function handleTypeChange(newType: LogicRule['type']) {
    const actionMap: Record<LogicRule['type'], LogicAction['type']> = {
      visible_if: 'show', required_if: 'require', skip_to: 'skip_to', pipe_text: 'pipe',
    }
    onChange({ ...rule, type: newType, action: { type: actionMap[newType] } })
  }

  const isValid =
    rule.conditions.items.length > 0 &&
    rule.conditions.items.every((c) => (c.conditionType === 'participant' ? !!c.participantField : !!c.questionId)) &&
    (rule.type !== 'visible_if' || !!rule.action.targetQuestionId) &&
    (rule.type !== 'required_if' || !!rule.action.targetQuestionId) &&
    (rule.type !== 'skip_to' || !!rule.action.targetQuestionId || !!rule.action.targetPageId)

  return (
    <div className="card">
      <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, margin: 0 }}>{RULE_TYPE_LABELS[rule.type]} Rule</h3>
          <button className="btn btn--ghost btn--sm" onClick={() => setShowDeleteConfirm(true)} aria-label="Delete rule">🗑</button>
        </div>

        <label>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Rule Type</div>
          <select className="select" value={rule.type} onChange={(e) => handleTypeChange(e.target.value as LogicRule['type'])}>
            {RULE_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
          </select>
        </label>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="eyebrow">IF conditions are met</div>
            {rule.conditions.items.length > 1 && (
              <button
                className="badge"
                style={{ cursor: 'pointer', border: '1px solid var(--line)' }}
                onClick={() => onChange({ ...rule, conditions: { ...rule.conditions, operator: rule.conditions.operator === 'AND' ? 'OR' : 'AND' } })}
              >
                Match <strong style={{ marginLeft: 4 }}>{rule.conditions.operator === 'AND' ? 'ALL' : 'ANY'}</strong>
              </button>
            )}
          </div>
          {rule.conditions.items.map((cond, idx) => (
            <LogicConditionRow
              key={idx}
              condition={cond}
              questions={questions}
              onChange={(updated) => {
                const items = [...rule.conditions.items]
                items[idx] = updated
                onChange({ ...rule, conditions: { ...rule.conditions, items } })
              }}
              onRemove={() => onChange({ ...rule, conditions: { ...rule.conditions, items: rule.conditions.items.filter((_, i) => i !== idx) } })}
              showConjunction={idx > 0 ? rule.conditions.operator : null}
            />
          ))}
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => onChange({ ...rule, conditions: { ...rule.conditions, items: [...rule.conditions.items, { questionId: '', operator: 'equals', value: '' }] } })}
          >
            + Add Condition
          </button>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>THEN</div>
          {actionTypeOptions.length > 1 && (
            <select
              className="select"
              style={{ marginBottom: 8 }}
              value={rule.action.type}
              onChange={(e) => onChange({ ...rule, action: { ...rule.action, type: e.target.value as LogicAction['type'] } })}
            >
              {actionTypeOptions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          )}

          {(rule.type === 'visible_if' || rule.type === 'required_if') && (
            <select
              className="select"
              value={rule.action.targetQuestionId || ''}
              onChange={(e) => onChange({ ...rule, action: { ...rule.action, targetQuestionId: e.target.value } })}
            >
              <option value="">Select target question</option>
              {questions.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
            </select>
          )}

          {rule.type === 'skip_to' && (
            <select
              className="select"
              value={rule.action.targetQuestionId || rule.action.targetPageId || ''}
              onChange={(e) => {
                const val = e.target.value
                const isPage = pages.some((p) => p.id === val)
                onChange({ ...rule, action: { ...rule.action, targetQuestionId: isPage ? undefined : val, targetPageId: isPage ? val : undefined } })
              }}
            >
              <option value="">Skip to question or page</option>
              {questions.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
              {pages.map((p) => <option key={p.id} value={p.id}>📄 {p.label}</option>)}
            </select>
          )}

          {rule.type === 'pipe_text' && (
            <select
              className="select"
              value={rule.action.targetQuestionId || ''}
              onChange={(e) => onChange({ ...rule, action: { ...rule.action, targetQuestionId: e.target.value, pipeField: e.target.value } })}
            >
              <option value="">Pipe answer from question</option>
              {questions.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
            </select>
          )}
        </div>

        {showDeleteConfirm && (
          <div style={{ border: '1px solid #fde68a', background: '#fefce8', borderRadius: 'var(--ra-2)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, flex: 1 }}>Delete this rule?</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn--sm" style={{ background: 'var(--bofa-red)', color: '#fff', border: 0 }} onClick={onDelete}>Delete</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary btn--sm" onClick={() => onSave(rule)} disabled={!isValid}>Save Rule</button>
        </div>
      </div>
    </div>
  )
}

// ── Rule card (IF … THEN … sentence) ────────────────────────────────────────
function getQuestionLabel(questionId: string | undefined, questions: QuestionInfo[]): string {
  const q = questions.find((x) => x.id === questionId)
  return q ? q.label : `Q(${questionId})`
}

function buildRuleSentence(rule: LogicRule, questions: QuestionInfo[]): string {
  const conditions = rule.conditions.items.map((cond, i) => {
    const qLabel = cond.conditionType === 'participant'
      ? (PARTICIPANT_FIELDS.find((f) => f.value === cond.participantField)?.label ?? cond.participantField ?? '')
      : getQuestionLabel(cond.questionId, questions)
    const opLabel = OPERATOR_LABELS[cond.operator] || cond.operator
    const valueStr = cond.operator === 'is_empty' || cond.operator === 'is_not_empty'
      ? '' : ` "${Array.isArray(cond.value) ? cond.value.join(', ') : cond.value}"`
    const prefix = i > 0 ? ` ${rule.conditions.operator} ` : ''
    return `${prefix}${qLabel} ${opLabel}${valueStr}`
  })
  const condStr = conditions.length > 0 ? conditions.join('') : 'no conditions'
  const actionLabel = ACTION_TYPE_LABELS[rule.action.type] || rule.action.type
  let targetStr = ''
  if (rule.action.targetQuestionId) targetStr = getQuestionLabel(rule.action.targetQuestionId, questions)
  else if (rule.action.targetPageId) targetStr = `Page ${rule.action.targetPageId}`
  else if (rule.action.pipeField) targetStr = rule.action.pipeField
  return `IF ${condStr} THEN ${actionLabel} ${targetStr}`.trim()
}

const RULE_BADGE_CLASS: Record<LogicRule['type'], string> = {
  visible_if: 'badge--ok', required_if: 'badge--warn', skip_to: 'badge--info', pipe_text: 'badge--purple',
}

function LogicRuleCard({ rule, questions, isSelected, onSelect, onDelete }: {
  rule: LogicRule
  questions: QuestionInfo[]
  isSelected: boolean
  onSelect?: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className="card"
      onClick={onSelect}
      style={{ cursor: onSelect ? 'pointer' : 'default', marginBottom: 8, border: isSelected ? '1.5px solid var(--bofa-navy)' : undefined }}
    >
      <div className="card__body" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
        <span className={`badge ${RULE_BADGE_CLASS[rule.type]}`} style={{ flexShrink: 0 }}>{RULE_TYPE_LABELS[rule.type]}</span>
        <p style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.5 }}>
          {buildRuleSentence(rule, questions)}
        </p>
        {onDelete && (
          <button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); onDelete() }} aria-label="Delete rule">🗑</button>
        )}
      </div>
    </div>
  )
}

// ── Flow view ───────────────────────────────────────────────────────────────
function QuestionSidebar({ questions, logicRules, focusedQuestionId, onSelectQuestion }: {
  questions: QuestionInfo[]
  logicRules: LogicRule[]
  focusedQuestionId: string | null
  onSelectQuestion: (id: string) => void
}) {
  return (
    <div className="card" style={{ padding: 10, position: 'sticky', top: 12 }}>
      <div className="eyebrow" style={{ padding: '4px 6px 8px' }}>Questions</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 460, overflowY: 'auto' }}>
        {questions.map((q) => {
          const count = getRuleCountForQuestion(q.id, logicRules)
          const isActive = q.id === focusedQuestionId
          return (
            <button
              key={q.id}
              onClick={() => onSelectQuestion(q.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: 0, cursor: 'pointer',
                borderRadius: 'var(--ra-2)', padding: '8px 10px', font: 'inherit',
                background: isActive ? 'var(--navy-050)' : 'transparent',
                color: isActive ? 'var(--bofa-navy)' : 'var(--ink-1)',
              }}
            >
              <span className="t-num" style={{ fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Q{q.questionIdx + 1}</span>
              <span style={{ flex: 1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.text}</span>
              {count > 0 && <span className="badge badge--info" style={{ flexShrink: 0 }}>{count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FocusedQuestionCard({ question, ruleCount, onOpenRules }: {
  question: QuestionInfo
  ruleCount: number
  onOpenRules: () => void
}) {
  return (
    <div className="card" style={{ border: '1.5px solid var(--bofa-navy)' }}>
      <div className="card__body" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="t-num" style={{ width: 30, height: 22, borderRadius: 999, background: 'var(--bofa-navy)', color: '#fff', fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            Q{question.questionIdx + 1}
          </span>
          <span className="badge badge--info">{question.type}</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn--outline btn--sm" onClick={onOpenRules} title="Edit rules">
            ⚙{ruleCount > 0 ? ` ${ruleCount}` : ''}
          </button>
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-0)', margin: '10px 0 6px' }}>{question.text}</p>
        <div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: 'var(--ink-4)' }}>
          <span>{question.pageLabel}</span>
          {question.options.length > 0 && <span>{question.options.length} options</span>}
        </div>
      </div>
    </div>
  )
}

function TargetQuestionCard({ question, pageLabel, actionLabel, onClick }: {
  question: QuestionInfo | null
  pageLabel?: string
  actionLabel: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{ textAlign: 'left', cursor: question ? 'pointer' : 'default', font: 'inherit', border: '1px solid var(--line)', padding: 0, minWidth: 180, flex: 1 }}
    >
      <div className="card__body" style={{ padding: '10px 12px' }}>
        <span className="badge badge--info" style={{ marginBottom: 6, display: 'inline-block' }}>{actionLabel}</span>
        <div style={{ fontSize: 12.5, color: 'var(--ink-1)' }}>
          {question ? `Q${question.questionIdx + 1}: ${question.text}` : pageLabel ?? 'Unknown target'}
        </div>
      </div>
    </button>
  )
}

function getBranchLabel(rule: LogicRule, questions: QuestionInfo[]): { text: string; variant: 'yes' | 'no' | 'compound' } {
  const items = rule.conditions.items
  if (items.length === 1) {
    const c = items[0]
    const opLabel = OPERATOR_LABELS[c.operator] || c.operator
    const valStr = c.operator === 'is_empty' || c.operator === 'is_not_empty'
      ? '' : ` "${Array.isArray(c.value) ? c.value.join(', ') : c.value}"`
    const isPositive = !c.operator.startsWith('not_') && c.operator !== 'is_empty'
    return { text: `${opLabel}${valStr}`, variant: isPositive ? 'yes' : 'no' }
  }
  const parts = items.map((c) => {
    const q = questions.find((x) => x.id === c.questionId)
    const qLabel = q ? `Q${q.questionIdx + 1}` : c.questionId
    return `${qLabel} ${OPERATOR_LABELS[c.operator] || c.operator}`
  })
  return { text: parts.join(` ${rule.conditions.operator} `), variant: 'compound' }
}

const BRANCH_COLORS = { yes: '#007840', no: '#B4530A', compound: '#584EA8' }

function BranchPath({ rule, questions, onFocusQuestion }: {
  rule: LogicRule
  questions: QuestionInfo[]
  onFocusQuestion: (id: string) => void
}) {
  const { text, variant } = getBranchLabel(rule, questions)
  const actionLabel = ACTION_TYPE_LABELS[rule.action.type] || rule.action.type
  const targetQuestion = rule.action.targetQuestionId ? questions.find((q) => q.id === rule.action.targetQuestionId) ?? null : null
  const targetPageLabel = rule.action.targetPageId ? `Page ${rule.action.targetPageId}` : undefined

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: BRANCH_COLORS[variant], flexShrink: 0 }} />
      <span style={{ width: 26, borderTop: `2px solid ${BRANCH_COLORS[variant]}`, flexShrink: 0 }} />
      <span className="badge" style={{ background: 'var(--app-panel)', border: `1px solid ${BRANCH_COLORS[variant]}`, color: BRANCH_COLORS[variant], flexShrink: 0, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {text}
      </span>
      <span style={{ width: 26, borderTop: `2px solid ${BRANCH_COLORS[variant]}`, flexShrink: 0 }} />
      <TargetQuestionCard
        question={targetQuestion}
        pageLabel={targetPageLabel}
        actionLabel={actionLabel}
        onClick={() => { if (targetQuestion) onFocusQuestion(targetQuestion.id) }}
      />
    </div>
  )
}

function FocusedFlowPanel({ focusedQuestion, questions, logicRules, onFocusQuestion, onOpenRules }: {
  focusedQuestion: QuestionInfo | null
  questions: QuestionInfo[]
  logicRules: LogicRule[]
  onFocusQuestion: (id: string) => void
  onOpenRules: (questionId: string) => void
}) {
  if (!focusedQuestion) {
    return (
      <div className="card">
        <div className="card__body" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>
          Select a question from the sidebar to view its logic flow
        </div>
      </div>
    )
  }

  const sourcedRules = getRulesSourcedFrom(focusedQuestion.id, logicRules)
  const targetRules = getRulesTargeting(focusedQuestion.id, logicRules)
  const ruleCount = getRuleCountForQuestion(focusedQuestion.id, logicRules)

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Always visible</div>
      <FocusedQuestionCard question={focusedQuestion} ruleCount={ruleCount} onOpenRules={() => onOpenRules(focusedQuestion.id)} />

      {sourcedRules.length > 0 && (
        <div style={{ marginTop: 14, paddingLeft: 14, borderLeft: '2px solid var(--line)' }}>
          {sourcedRules.map((rule) => (
            <BranchPath key={rule.id} rule={rule} questions={questions} onFocusQuestion={onFocusQuestion} />
          ))}
        </div>
      )}

      {sourcedRules.length === 0 && targetRules.length === 0 && (
        <div style={{ marginTop: 14, textAlign: 'center', padding: '20px 0', color: 'var(--ink-4)', fontSize: 13 }}>
          <p style={{ margin: '0 0 10px' }}>No logic rules for this question.</p>
          <button className="btn btn--outline btn--sm" onClick={() => onOpenRules(focusedQuestion.id)}>+ Add a rule</button>
        </div>
      )}

      {targetRules.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Incoming rules (targeting this question)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {targetRules.map((rule) => {
              const sourceQ = questions.find((q) => rule.conditions.items.some((c) => c.questionId === q.id))
              return (
                <button
                  key={rule.id}
                  className="btn btn--ghost btn--sm"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => sourceQ && onFocusQuestion(sourceQ.id)}
                >
                  {sourceQ ? `From Q${sourceQ.questionIdx + 1}: ${sourceQ.text}` : 'Unknown source'}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Rules popup (flow view gear) ────────────────────────────────────────────
function LogicRulesPopup({ question, rules, targetRules, allQuestions, pages, onClose, onSaveRule, onDeleteRule }: {
  question: QuestionInfo
  rules: LogicRule[]
  targetRules: LogicRule[]
  allQuestions: QuestionInfo[]
  pages: { id: string; label: string }[]
  onClose: () => void
  onSaveRule: (r: LogicRule) => void
  onDeleteRule: (id: string) => void
}) {
  const [editingRule, setEditingRule] = useState<LogicRule | null>(null)

  return (
    <div
      role="dialog"
      aria-label="Logic rules"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,26,51,0.4)', zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ width: 680, maxWidth: '96vw', maxHeight: '86vh', overflowY: 'auto', background: 'var(--app-panel)', borderRadius: 'var(--ra-3)', boxShadow: '0 18px 50px rgba(14,26,51,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-0)' }}>Rules — Q{question.questionIdx + 1}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{question.text}</div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {editingRule ? (
            <LogicRuleEditor
              rule={editingRule}
              questions={allQuestions}
              pages={pages}
              onChange={setEditingRule}
              onSave={(r) => { onSaveRule(r); setEditingRule(null) }}
              onCancel={() => setEditingRule(null)}
              onDelete={() => { onDeleteRule(editingRule.id); setEditingRule(null) }}
            />
          ) : (
            <>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="eyebrow">Rules from this question</div>
                  <button className="btn btn--primary btn--sm" onClick={() => setEditingRule(createEmptyRule(question.id))}>+ Add Rule</button>
                </div>
                {rules.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>None yet.</div>
                ) : (
                  rules.map((r) => (
                    <LogicRuleCard key={r.id} rule={r} questions={allQuestions} isSelected={false} onSelect={() => setEditingRule({ ...r })} onDelete={() => onDeleteRule(r.id)} />
                  ))
                )}
              </div>
              {targetRules.length > 0 && (
                <div>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Rules targeting this question</div>
                  {targetRules.map((r) => (
                    <LogicRuleCard key={r.id} rule={r} questions={allQuestions} isSelected={false} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── LogicTab (exact structure) ──────────────────────────────────────────────
export default function LogicTab({ pages, logicRules, onRulesChange, readOnly = false }: {
  pages: Page[]
  logicRules: LogicRule[]
  onRulesChange: (rules: LogicRule[]) => void
  readOnly?: boolean
}) {
  const [subTab, setSubTab] = useState<'flow' | 'rules'>('flow')
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<LogicRule | null>(null)
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null)
  const [popupQuestionId, setPopupQuestionId] = useState<string | null>(null)

  const flowQuestions = useMemo(() => buildQuestionList(pages), [pages])
  const focusedQuestion = flowQuestions.find((q) => q.id === focusedQuestionId) ?? null
  const popupQuestion = flowQuestions.find((q) => q.id === popupQuestionId) ?? null
  const pagesMeta = useMemo(() => pages.map((p, i) => ({ id: p.id, label: p.title || `Page ${i + 1}` })), [pages])

  useEffect(() => {
    if (subTab === 'flow' && !focusedQuestionId && flowQuestions.length > 0) {
      setFocusedQuestionId(flowQuestions[0].id)
    }
  }, [subTab, focusedQuestionId, flowQuestions])

  function handleAddRule() {
    const newRule = createEmptyRule()
    setEditingRule(newRule)
    setSelectedRuleId(newRule.id)
    setSubTab('rules')
  }

  function handleSaveRule(rule: LogicRule) {
    const exists = logicRules.some((r) => r.id === rule.id)
    onRulesChange(exists ? logicRules.map((r) => (r.id === rule.id ? rule : r)) : [...logicRules, rule])
    setEditingRule(null)
    setSelectedRuleId(null)
  }

  function handleDeleteRule(ruleId: string) {
    onRulesChange(logicRules.filter((r) => r.id !== ruleId))
    if (selectedRuleId === ruleId) { setEditingRule(null); setSelectedRuleId(null) }
  }

  return (
    <div>
      {/* Sub-tab header */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className="tab" aria-selected={subTab === 'flow'} onClick={() => setSubTab('flow')}>Flow View</button>
        <button className="tab" aria-selected={subTab === 'rules'} onClick={() => setSubTab('rules')}>Rules List</button>
      </div>

      {/* Rules List — editor on LEFT, rules list on RIGHT */}
      {subTab === 'rules' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <div>
            {readOnly ? (
              <div className="card"><div className="card__body" style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
                Rules are read-only because this survey is published. Clone the survey to make changes.
              </div></div>
            ) : editingRule ? (
              <LogicRuleEditor
                rule={editingRule}
                questions={flowQuestions}
                pages={pagesMeta}
                onSave={handleSaveRule}
                onCancel={() => { setEditingRule(null); setSelectedRuleId(null) }}
                onDelete={() => handleDeleteRule(editingRule.id)}
                onChange={setEditingRule}
              />
            ) : (
              <div className="card"><div className="card__body" style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
                Select a rule to edit, or click "+ Add Rule" to create one.
              </div></div>
            )}
          </div>

          <div>
            {logicRules.length === 0 && !editingRule ? (
              <div className="card">
                <div className="card__body" style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>⚡</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, color: 'var(--ink-0)' }}>No logic rules yet</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-4)', margin: '6px 0 14px' }}>
                    {readOnly
                      ? 'No conditional logic rules configured for this survey.'
                      : 'Add conditional logic to control question visibility, requirements, and skip patterns.'}
                  </div>
                  {!readOnly && <button className="btn btn--primary btn--sm" onClick={handleAddRule}>+ Add Rule</button>}
                </div>
              </div>
            ) : (
              <div>
                {!readOnly && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button className="btn btn--outline btn--sm" onClick={handleAddRule}>+ Add Rule</button>
                  </div>
                )}
                {logicRules.map((rule) => (
                  <LogicRuleCard
                    key={rule.id}
                    rule={rule}
                    questions={flowQuestions}
                    isSelected={selectedRuleId === rule.id}
                    onSelect={readOnly ? undefined : () => { setEditingRule({ ...rule }); setSelectedRuleId(rule.id) }}
                    onDelete={readOnly ? undefined : () => handleDeleteRule(rule.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flow View */}
      {subTab === 'flow' && (
        <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <QuestionSidebar
            questions={flowQuestions}
            logicRules={logicRules}
            focusedQuestionId={focusedQuestionId}
            onSelectQuestion={setFocusedQuestionId}
          />
          <FocusedFlowPanel
            focusedQuestion={focusedQuestion}
            questions={flowQuestions}
            logicRules={logicRules}
            onFocusQuestion={setFocusedQuestionId}
            onOpenRules={setPopupQuestionId}
          />
        </div>
      )}

      {popupQuestion && !readOnly && (
        <LogicRulesPopup
          question={popupQuestion}
          rules={getRulesSourcedFrom(popupQuestion.id, logicRules)}
          targetRules={getRulesTargeting(popupQuestion.id, logicRules)}
          allQuestions={flowQuestions}
          pages={pagesMeta}
          onClose={() => setPopupQuestionId(null)}
          onSaveRule={(rule) => {
            const exists = logicRules.some((r) => r.id === rule.id)
            onRulesChange(exists ? logicRules.map((r) => (r.id === rule.id ? rule : r)) : [...logicRules, rule])
          }}
          onDeleteRule={(id) => onRulesChange(logicRules.filter((r) => r.id !== id))}
        />
      )}
    </div>
  )
}
