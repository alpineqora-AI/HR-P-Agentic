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

// Recruiter / ATS pages
import OverviewPage from './pages/OverviewPage'
import JobsPage from './pages/JobsPage'
import JobDetailPage from './pages/JobDetailPage'
import PipelinePage from './pages/PipelinePage'
import CandidatesPage from './pages/CandidatesPage'
import CandidateDetailPage from './pages/CandidateDetailPage'
import InterviewsPage from './pages/InterviewsPage'
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
        <Route path="/interviews" element={m('interviews', <InterviewsPage />)} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
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
