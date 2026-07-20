// The stage-color language: every pipeline stage owns a hue, used consistently
// on the board, the drawer stepper, and the analytics funnel so a stage is
// recognizable at a glance anywhere in the app. Cool → warm → green as a
// candidate moves toward Hired.

export interface StageHue {
  fg: string
  bg: string
}

const HUES: Record<string, StageHue> = {
  APPLIED: { fg: '#5B6B8C', bg: '#EDF0F6' },
  SCREENED: { fg: '#007296', bg: '#E4F2F6' },
  MATCHED: { fg: '#584EA8', bg: '#ECEAF8' },
  INTERVIEW: { fg: '#0063B2', bg: '#E6F1FB' },
  ASSESSMENT: { fg: '#8F5E00', bg: '#FAF0DC' },
  OFFER: { fg: '#B4530A', bg: '#FBEEE3' },
  HIRED: { fg: '#007840', bg: '#E4F3EA' },
  REJECTED: { fg: '#6B7694', bg: '#EEF1F7' },
  WITHDRAWN: { fg: '#6B7694', bg: '#EEF1F7' },
}

const FALLBACK: StageHue = { fg: '#5B6B8C', bg: '#EDF0F6' }

export function stageHue(stage: string): StageHue {
  return HUES[stage.toUpperCase()] ?? FALLBACK
}
