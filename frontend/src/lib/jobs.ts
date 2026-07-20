import type { JobSummary } from '@/api/types'

const isOpen = (s: string) => s.toUpperCase() === 'OPEN'

/**
 * The job a job-scoped page should land on: the open requisition with the most
 * applicants (tie-break: most openings), so first paint shows a live pipeline
 * instead of whichever row happens to sort first.
 */
export function defaultJobId(jobs: JobSummary[] | undefined): string | undefined {
  if (!jobs || jobs.length === 0) return undefined
  const pool = jobs.filter((j) => isOpen(j.status))
  const ranked = (pool.length ? pool : jobs)
    .slice()
    .sort((a, b) => b.applicants - a.applicants || b.openings - a.openings)
  return ranked[0]?.id
}
