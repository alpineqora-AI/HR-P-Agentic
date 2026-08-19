import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './styles/ds-foundation.css'
import './styles/ds-product.css'
import './styles/app.css'
// Delivery-only theme override: any styles/*.local.css is applied last so it
// wins the cascade. Gitignored — licensed design tokens live there only.
import.meta.glob('./styles/*.local.css', { eager: true })

import { AppShell } from './components/AppShell'
import { StoreProvider } from './state/store'
import { ConfigProvider, useConfig } from './state/config'
import EventRegisterPage from './pages/EventRegisterPage'
import SelfSchedulePage from './pages/SelfSchedulePage'
import CareersEventsPage from './pages/CareersEventsPage'

// Recruiter / ATS pages
import OverviewPage from './pages/OverviewPage'
import JobsPage from './pages/JobsPage'
import JobDetailPage from './pages/JobDetailPage'
import PipelinePage from './pages/PipelinePage'
import CandidatesPage from './pages/CandidatesPage'
import CandidateDetailPage from './pages/CandidateDetailPage'
import ApprovalsPage from './pages/ApprovalsPage'
import InterviewsPage from './pages/InterviewsPage'
import AvailabilityPage from './pages/AvailabilityPage'
import AssessmentsPage from './pages/AssessmentsPage'
import OffersPage from './pages/OffersPage'
import OnboardingPage from './pages/OnboardingPage'
import MatchingPage from './pages/MatchingPage'
import SourcingPage from './pages/SourcingPage'
import MobilityPage from './pages/MobilityPage'
import CrmPage from './pages/CrmPage'
import CampaignsPage from './pages/CampaignsPage'
import ReferralsPage from './pages/ReferralsPage'
import EventsPage from './pages/EventsPage'
import SurveysPage from './pages/SurveysPage'
import CopilotPage from './pages/CopilotPage'
import AnalyticsPage from './pages/AnalyticsPage'
import CompliancePage from './pages/CompliancePage'
import IntegrationsPage from './pages/IntegrationsPage'
import AuditPage from './pages/AuditPage'
import AdminPage from './pages/AdminPage'
import EmailTemplateList from './pages/admin/communications/EmailTemplateList'
import EmailTemplateEditor from './pages/admin/communications/EmailTemplateEditor'

/** Redirect to Overview if the route's module has been turned off in config. */
function RequireModule({ module, children }: { module: string; children: ReactNode }) {
  const { isModuleOn } = useConfig()
  return isModuleOn(module) ? <>{children}</> : <Navigate to="/" replace />
}

const m = (module: string, el: ReactNode) => <RequireModule module={module}>{el}</RequireModule>

/** The recruiter app: everything wrapped in the collapsible AppShell. */
function RecruiterApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/jobs" element={m('jobs', <JobsPage />)} />
        <Route path="/jobs/:id" element={m('jobs', <JobDetailPage />)} />
        <Route path="/pipeline" element={m('pipeline', <PipelinePage />)} />
        <Route path="/candidates" element={m('candidates', <CandidatesPage />)} />
        <Route path="/candidates/:id" element={m('candidates', <CandidateDetailPage />)} />
        <Route path="/approvals" element={m('approvals', <ApprovalsPage />)} />
        <Route path="/interviews" element={m('interviews', <InterviewsPage />)} />
        <Route path="/availability" element={m('availability', <AvailabilityPage />)} />
        <Route path="/assessments" element={m('assessments', <AssessmentsPage />)} />
        <Route path="/offers" element={m('offers', <OffersPage />)} />
        <Route path="/onboarding" element={m('onboarding', <OnboardingPage />)} />
        <Route path="/matching" element={m('matching', <MatchingPage />)} />
        <Route path="/sourcing" element={m('sourcing', <SourcingPage />)} />
        <Route path="/mobility" element={m('mobility', <MobilityPage />)} />
        <Route path="/crm" element={m('crm', <CrmPage />)} />
        <Route path="/campaigns" element={m('campaigns', <CampaignsPage />)} />
        <Route path="/referrals" element={m('referrals', <ReferralsPage />)} />
        <Route path="/events" element={m('events', <EventsPage />)} />
        <Route path="/surveys" element={m('surveys', <SurveysPage />)} />
        <Route path="/copilot" element={m('copilot', <CopilotPage />)} />
        <Route path="/analytics" element={m('analytics', <AnalyticsPage />)} />
        <Route path="/compliance" element={m('compliance', <CompliancePage />)} />
        <Route path="/integrations" element={m('integrations', <IntegrationsPage />)} />
        <Route path="/audit" element={m('audit', <AuditPage />)} />
        <Route path="/admin" element={m('admin', <AdminPage />)} />
        <Route path="/admin/communications" element={m('admin', <EmailTemplateList />)} />
        <Route path="/admin/communications/new" element={m('admin', <EmailTemplateEditor />)} />
        <Route path="/admin/communications/:templateId/edit" element={m('admin', <EmailTemplateEditor />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

// One-time migration: storage keys were renamed olivia.* -> taportal.* (the old
// internal code name is retired). Copy any legacy values so saved surveys,
// templates and settings survive; safe to delete once every browser has run it.
for (const key of Object.keys(localStorage)) {
  if (key.startsWith('olivia.')) {
    const renamed = `taportal.${key.slice('olivia.'.length)}`
    if (localStorage.getItem(renamed) === null) {
      localStorage.setItem(renamed, localStorage.getItem(key)!)
    }
    localStorage.removeItem(key)
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <StoreProvider>
          <BrowserRouter>
            <Routes>
              {/* Shell-less public surface: the campus career site we host
                  ourselves (replacing tal.net/Oleeo) — events board + registration. */}
              <Route path="/careers/events" element={<CareersEventsPage />} />
              <Route path="/register/:eventId" element={<EventRegisterPage />} />
              <Route path="/schedule/:interviewId" element={<SelfSchedulePage />} />
              {/* The recruiter console. The candidate-facing "Careers and Conv"
                  app is integrated separately. */}
              <Route path="/*" element={<RecruiterApp />} />
            </Routes>
          </BrowserRouter>
        </StoreProvider>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
)
