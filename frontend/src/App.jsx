import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import DemoShell from './components/layout/DemoShell'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { CompanyProvider } from './context/CompanyContext'

// Public / marketing pages
import LandingPage from './pages/LandingPage'
import PricingPage from './pages/PricingPage'
import NotFoundPage from './pages/NotFoundPage'
import OnboardingPage from './pages/OnboardingPage'

// Auth pages
import SignInPage from './pages/auth/SignInPage'
import SignUpPage from './pages/auth/SignUpPage'

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

// Dashboard pages
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

// Admin pages
import AdminDemos from './pages/admin/AdminDemos'
import SettingsPage from './pages/SettingsPage'

// Wrapper that reads :slug from the URL and passes it to DemoShell
function DemoShellWithSlug() {
  const { slug } = useParams()
  return <DemoShell slug={slug} />
}

// Protected AppShell wrapper
function ProtectedAppShell() {
  return (
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <CompanyProvider>
      <Routes>
        {/* ---------------------------------------------------------------- */}
        {/* Marketing / public routes                                         */}
        {/* ---------------------------------------------------------------- */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        {/* Lowercase aliases ? dashboard routes (bookmarks, external redirects) */}
        <Route path="/home" element={<Navigate to="/Home" replace />} />
        <Route path="/companyworkspace" element={<Navigate to="/CompanyWorkspace" replace />} />
        <Route path="/connectors" element={<Navigate to="/Connectors" replace />} />
        <Route path="/datamapping" element={<Navigate to="/DataMapping" replace />} />
        <Route path="/dataquality" element={<Navigate to="/DataQuality" replace />} />
        <Route path="/valuation" element={<Navigate to="/Valuation" replace />} />
        <Route path="/valuegap" element={<Navigate to="/ValueGap" replace />} />
        <Route path="/buyerlens" element={<Navigate to="/BuyerLens" replace />} />
        <Route path="/engagement-intake" element={<Navigate to="/EngagementIntake" replace />} />
        <Route path="/engagementintake" element={<Navigate to="/EngagementIntake" replace />} />
        <Route path="/aicopilot" element={<Navigate to="/AICopilot" replace />} />
        <Route path="/advisorylibrary" element={<Navigate to="/AdvisoryLibrary" replace />} />
        <Route path="/advisory-library" element={<Navigate to="/AdvisoryLibrary" replace />} />
        <Route path="/QualitativeInputs" element={<Navigate to="/EngagementIntake" replace />} />
        <Route path="/qualitativeinputs" element={<Navigate to="/EngagementIntake" replace />} />

        {/* ---------------------------------------------------------------- */}
        {/* Post-payment onboarding (auth required)                           */}
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
          <Route path="data-room"          element={<Navigate to="home" replace />} />
          <Route path="reports"            element={<DemoReports />} />
          <Route path="data-sources"       element={<DemoConnectors />} />
          <Route path="field-mapping"      element={<DemoDataMapping />} />
          <Route path="qualitative-inputs" element={<Navigate to="engagement-intake" replace />} />
          <Route path="ebitda-timeline"    element={<DemoEBITDATimeline />} />
          <Route path="market-comps"       element={<DemoMarketComps />} />
          <Route path="engagement-intake"  element={<DemoEngagementIntake />} />
          <Route path="advisory-library"  element={<DemoAdvisoryLibrary />} />
          <Route path="ai-copilot"        element={<Navigate to="home" replace />} />
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
          <Route path="data-room"          element={<Navigate to="home" replace />} />
          <Route path="reports"            element={<DemoReports />} />
          <Route path="data-sources"       element={<DemoConnectors />} />
          <Route path="field-mapping"      element={<DemoDataMapping />} />
          <Route path="qualitative-inputs" element={<Navigate to="engagement-intake" replace />} />
          <Route path="ebitda-timeline"    element={<DemoEBITDATimeline />} />
          <Route path="market-comps"       element={<DemoMarketComps />} />
          <Route path="engagement-intake"  element={<DemoEngagementIntake />} />
          <Route path="advisory-library"  element={<DemoAdvisoryLibrary />} />
          <Route path="ai-copilot"        element={<Navigate to="home" replace />} />
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
        {/* Dashboard routes (auth required, AppShell) — pathless layout */}
        {/* avoids duplicate parent path="/" with the landing route.          */}
        {/* ---------------------------------------------------------------- */}
        <Route element={<ProtectedAppShell />}>
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
          <Route path="/AdvisoryLibrary"  element={<AdvisoryLibrary />} />
        </Route>

        {/* ---------------------------------------------------------------- */}
        {/* 404                                                               */}
        {/* ---------------------------------------------------------------- */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </CompanyProvider>
    </BrowserRouter>
  )
}
