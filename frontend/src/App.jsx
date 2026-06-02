import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ClientShell from './components/layout/ClientShell'
import DemoShell from './components/layout/DemoShell'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { CompanyProvider } from './context/CompanyContext'
import { UserRoleProvider } from './context/UserRoleContext'

// Public / marketing pages
import LandingPage from './pages/LandingPage'
import RequestDemoPage from './pages/RequestDemoPage'
import PricingPage from './pages/PricingPage'
import ROICalculatorPage from './pages/ROICalculatorPage'
import PartnerLandingPage from './pages/PartnerLandingPage'
import ClientPortal from './pages/ClientPortal'
import NotFoundPage from './pages/NotFoundPage'
import OnboardingPage from './pages/OnboardingPage'

// Auth pages
import SignInPage from './pages/auth/SignInPage'
import SignUpPage from './pages/auth/SignUpPage'

// Role selection, client invite & auth redirect
import RoleSelectPage from './pages/RoleSelectPage'
import ClientInvitePage from './pages/ClientInvitePage'
import AuthRedirectPage from './pages/AuthRedirectPage'

// Demo-accessible pages (same components, no auth required in demo shell)
import DemoHome2 from './pages/Home'
import DemoCompanyWorkspace from './pages/CompanyWorkspace'
import DemoAdvisoryWorkflow from './pages/AdvisoryWorkflow'
import DemoReadiness from './pages/Readiness'
import DemoBusinessQuality from './pages/BusinessQuality'
import DemoBuyerLens from './pages/BuyerLens'
import DemoValuation from './pages/Valuation'
import DemoValueGap from './pages/ValueGap'
import DemoInitiativeImpact from './pages/InitiativeImpact'
import DemoScenarioSimulator from './pages/ScenarioSimulator'
import DemoReports from './pages/Reports'
import DemoRiskHeatmap from './pages/RiskHeatmap'
import DemoConnectors from './pages/Connectors'
import DemoDataMapping from './pages/DataMapping'
import DemoEBITDATimeline from './pages/EBITDATimeline'
import DemoMarketComps from './pages/MarketComps'
import DemoEngagementIntake from './pages/EngagementIntake'
import DemoAdvisoryLibrary from './pages/AdvisoryLibrary'
import DemoDataRoom from './pages/DataRoom'
import DemoAICopilot from './pages/AICopilot'

// Advisor dashboard pages
import Home from './pages/Home'
import CompanyWorkspace from './pages/CompanyWorkspace'
import AdvisoryWorkflow from './pages/AdvisoryWorkflow'
import Readiness from './pages/Readiness'
import BusinessQuality from './pages/BusinessQuality'
import BuyerLens from './pages/BuyerLens'
import Valuation from './pages/Valuation'
import ValueGap from './pages/ValueGap'
import InitiativeImpact from './pages/InitiativeImpact'
import RiskHeatmap from './pages/RiskHeatmap'
import ScenarioSimulator from './pages/ScenarioSimulator'
import Connectors from './pages/Connectors'
import DataMapping from './pages/DataMapping'
import DataQuality from './pages/DataQuality'
import DataRoom from './pages/DataRoom'
import Reports from './pages/Reports'
import AICopilot from './pages/AICopilot'
import Admin from './pages/Admin'
import EBITDATimeline from './pages/EBITDATimeline'
import MarketComps from './pages/MarketComps'
import EngagementIntake from './pages/EngagementIntake'
import AdvisoryLibrary from './pages/AdvisoryLibrary'
import EngagementView from './pages/EngagementView'

// Owner onboarding
import OwnerOnboardingWizard from './pages/owner/OwnerOnboardingWizard'

// Client portal pages
import ClientDashboard from './pages/client/ClientDashboard'
import ClientReadiness from './pages/client/ClientReadiness'
import ClientValuation from './pages/client/ClientValuation'
import ClientValueGap from './pages/client/ClientValueGap'
import ClientEngagementProfile from './pages/client/ClientEngagementProfile'
import ClientDataRoom from './pages/client/ClientDataRoom'

// Admin pages
import AdminDemos from './pages/admin/AdminDemos'
import SettingsPage from './pages/SettingsPage'

// Wrapper that reads :slug from the URL and passes it to DemoShell
function DemoShellWithSlug() {
  const { slug } = useParams()
  return <DemoShell slug={slug} />
}

// Protected advisor AppShell (requires ADVISOR role)
function ProtectedAdvisorShell() {
  return (
    <ProtectedRoute requireAdvisor>
      <AppShell />
    </ProtectedRoute>
  )
}

// Protected client ClientShell (requires CLIENT role)
function ProtectedClientShell() {
  return (
    <ProtectedRoute requireClient>
      <ClientShell />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <CompanyProvider>
        <UserRoleProvider>
          <Routes>
            {/* ---------------------------------------------------------------- */}
            {/* Marketing / public routes                                         */}
            {/* ---------------------------------------------------------------- */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/request-demo" element={<RequestDemoPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/roi-calculator" element={<ROICalculatorPage />} />
            <Route path="/partners/:slug" element={<PartnerLandingPage />} />
            <Route path="/portal" element={<ClientPortal />} />
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />

            {/* ---------------------------------------------------------------- */}
            {/* Post-sign-in smart redirect                                        */}
            {/* ---------------------------------------------------------------- */}
            <Route
              path="/auth-redirect"
              element={
                <ProtectedRoute>
                  <AuthRedirectPage />
                </ProtectedRoute>
              }
            />

            {/* ---------------------------------------------------------------- */}
            {/* Role selection & client invite (require auth, no role check)      */}
            {/* ---------------------------------------------------------------- */}
            <Route
              path="/role-select"
              element={
                <ProtectedRoute>
                  <RoleSelectPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client-invite/:token"
              element={
                <ProtectedRoute>
                  <ClientInvitePage />
                </ProtectedRoute>
              }
            />

            {/* Lowercase aliases → dashboard routes. caseSensitive prevents these from
                shadow-matching the correctly-cased routes (React Router defaults to
                case-insensitive matching which caused an infinite redirect loop). */}
            <Route caseSensitive path="/home" element={<Navigate to="/auth-redirect" replace />} />
            <Route caseSensitive path="/companyworkspace" element={<Navigate to="/CompanyWorkspace" replace />} />
            <Route caseSensitive path="/connectors" element={<Navigate to="/Connectors" replace />} />
            <Route caseSensitive path="/datamapping" element={<Navigate to="/DataMapping" replace />} />
            <Route caseSensitive path="/dataquality" element={<Navigate to="/DataQuality" replace />} />
            <Route caseSensitive path="/valuation" element={<Navigate to="/Valuation" replace />} />
            <Route caseSensitive path="/valuegap" element={<Navigate to="/ValueGap" replace />} />
            <Route caseSensitive path="/buyerlens" element={<Navigate to="/BuyerLens" replace />} />
            <Route caseSensitive path="/engagement-intake" element={<Navigate to="/EngagementIntake" replace />} />
            <Route caseSensitive path="/engagementintake" element={<Navigate to="/EngagementIntake" replace />} />
            <Route caseSensitive path="/engagementview" element={<Navigate to="/EngagementView" replace />} />
            <Route caseSensitive path="/aicopilot" element={<Navigate to="/AICopilot" replace />} />
            <Route caseSensitive path="/advisorylibrary" element={<Navigate to="/AdvisoryLibrary" replace />} />
            <Route caseSensitive path="/advisory-library" element={<Navigate to="/AdvisoryLibrary" replace />} />
            <Route caseSensitive path="/QualitativeInputs" element={<Navigate to="/EngagementIntake" replace />} />
            <Route caseSensitive path="/qualitativeinputs" element={<Navigate to="/EngagementIntake" replace />} />

            {/* ---------------------------------------------------------------- */}
            {/* Post-payment onboarding (auth required, no role check)            */}
            {/* ---------------------------------------------------------------- */}
            <Route
              path="/dashboard/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/*"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* ---------------------------------------------------------------- */}
            {/* Demo routes (no auth, DemoShell)                                  */}
            {/* ---------------------------------------------------------------- */}
            <Route path="/demo" element={<DemoShell />}>
              <Route index element={<DemoHome2 />} />
              <Route path="home"               element={<DemoHome2 />} />
              <Route path="company"            element={<DemoCompanyWorkspace />} />
              <Route path="workflow"           element={<DemoAdvisoryWorkflow />} />
              <Route path="readiness"          element={<DemoReadiness />} />
              <Route path="business-quality"   element={<DemoBusinessQuality />} />
              <Route path="buyer-lens"         element={<DemoBuyerLens />} />
              <Route path="valuation"          element={<DemoValuation />} />
              <Route path="value-gap"          element={<DemoValueGap />} />
              <Route path="initiative-impact"  element={<DemoInitiativeImpact />} />
              <Route path="risk-heatmap"       element={<DemoRiskHeatmap />} />
              <Route path="scenario-simulator" element={<DemoScenarioSimulator />} />
              <Route path="data-room"          element={<DemoDataRoom />} />
              <Route path="reports"            element={<DemoReports />} />
              <Route path="data-sources"       element={<DemoConnectors />} />
              <Route path="field-mapping"      element={<DemoDataMapping />} />
              <Route path="qualitative-inputs" element={<Navigate to="engagement-intake" replace />} />
              <Route path="ebitda-timeline"    element={<DemoEBITDATimeline />} />
              <Route path="market-comps"       element={<DemoMarketComps />} />
              <Route path="engagement-intake"  element={<DemoEngagementIntake />} />
              <Route path="advisory-library"   element={<DemoAdvisoryLibrary />} />
              <Route path="ai-copilot"         element={<DemoAICopilot />} />
            </Route>
            <Route path="/demo/:slug" element={<DemoShellWithSlug />}>
              <Route index element={<DemoHome2 />} />
              <Route path="home"               element={<DemoHome2 />} />
              <Route path="company"            element={<DemoCompanyWorkspace />} />
              <Route path="workflow"           element={<DemoAdvisoryWorkflow />} />
              <Route path="readiness"          element={<DemoReadiness />} />
              <Route path="business-quality"   element={<DemoBusinessQuality />} />
              <Route path="buyer-lens"         element={<DemoBuyerLens />} />
              <Route path="valuation"          element={<DemoValuation />} />
              <Route path="value-gap"          element={<DemoValueGap />} />
              <Route path="initiative-impact"  element={<DemoInitiativeImpact />} />
              <Route path="risk-heatmap"       element={<DemoRiskHeatmap />} />
              <Route path="scenario-simulator" element={<DemoScenarioSimulator />} />
              <Route path="data-room"          element={<DemoDataRoom />} />
              <Route path="reports"            element={<DemoReports />} />
              <Route path="data-sources"       element={<DemoConnectors />} />
              <Route path="field-mapping"      element={<DemoDataMapping />} />
              <Route path="qualitative-inputs" element={<Navigate to="engagement-intake" replace />} />
              <Route path="ebitda-timeline"    element={<DemoEBITDATimeline />} />
              <Route path="market-comps"       element={<DemoMarketComps />} />
              <Route path="engagement-intake"  element={<DemoEngagementIntake />} />
              <Route path="advisory-library"   element={<DemoAdvisoryLibrary />} />
              <Route path="ai-copilot"         element={<DemoAICopilot />} />
            </Route>

            {/* ---------------------------------------------------------------- */}
            {/* Admin routes (auth required)                                      */}
            {/* ---------------------------------------------------------------- */}
            <Route
              path="/admin/demos"
              element={
                <ProtectedRoute>
                  <AdminDemos />
                </ProtectedRoute>
              }
            />

            {/* ---------------------------------------------------------------- */}
            {/* Owner onboarding wizard (require CLIENT role, standalone layout)  */}
            {/* ---------------------------------------------------------------- */}
            <Route
              path="/owner-onboarding"
              element={
                <ProtectedRoute requireClient>
                  <OwnerOnboardingWizard />
                </ProtectedRoute>
              }
            />

            {/* ---------------------------------------------------------------- */}
            {/* CLIENT portal routes (require CLIENT role, ClientShell)           */}
            {/* ---------------------------------------------------------------- */}
            <Route element={<ProtectedClientShell />}>
              <Route path="/client/dashboard"  element={<ClientDashboard />} />
              <Route path="/client/readiness"  element={<ClientReadiness />} />
              <Route path="/client/valuation"  element={<ClientValuation />} />
              <Route path="/client/value-gap"  element={<ClientValueGap />} />
              <Route path="/client/profile"    element={<ClientEngagementProfile />} />
              <Route path="/client/data-room"  element={<ClientDataRoom />} />
              {/* Fallback: /client → /client/dashboard */}
              <Route path="/client"            element={<Navigate to="/client/dashboard" replace />} />
            </Route>

            {/* ---------------------------------------------------------------- */}
            {/* ADVISOR dashboard routes (require ADVISOR role, AppShell)         */}
            {/* ---------------------------------------------------------------- */}
            <Route element={<ProtectedAdvisorShell />}>
              <Route path="/Home"              element={<Home />} />
              <Route path="/CompanyWorkspace"  element={<CompanyWorkspace />} />
              <Route path="/AdvisoryWorkflow"  element={<AdvisoryWorkflow />} />
              <Route path="/Readiness"         element={<Readiness />} />
              <Route path="/BusinessQuality"   element={<BusinessQuality />} />
              <Route path="/BuyerLens"         element={<BuyerLens />} />
              <Route path="/Valuation"         element={<Valuation />} />
              <Route path="/ValueGap"          element={<ValueGap />} />
              <Route path="/InitiativeImpact"  element={<InitiativeImpact />} />
              <Route path="/RiskHeatmap"       element={<RiskHeatmap />} />
              <Route path="/ScenarioSimulator" element={<ScenarioSimulator />} />
              <Route path="/Connectors"        element={<Connectors />} />
              <Route path="/DataMapping"       element={<DataMapping />} />
              <Route path="/DataQuality"       element={<DataQuality />} />
              <Route path="/DataRoom"          element={<DataRoom />} />
              <Route path="/Reports"           element={<Reports />} />
              <Route path="/AICopilot"         element={<AICopilot />} />
              <Route path="/Admin"             element={<Admin />} />
              <Route path="/EBITDATimeline"    element={<EBITDATimeline />} />
              <Route path="/MarketComps"       element={<MarketComps />} />
              <Route path="/EngagementIntake"  element={<EngagementIntake />} />
              <Route path="/AdvisoryLibrary"   element={<AdvisoryLibrary />} />
              <Route path="/EngagementView"    element={<EngagementView />} />
            </Route>

            {/* ---------------------------------------------------------------- */}
            {/* 404                                                               */}
            {/* ---------------------------------------------------------------- */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </UserRoleProvider>
      </CompanyProvider>
    </BrowserRouter>
  )
}
