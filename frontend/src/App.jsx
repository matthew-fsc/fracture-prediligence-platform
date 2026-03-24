import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import DemoShell from './components/layout/DemoShell'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import DemoHome from './pages/demo/DemoHome'
import Home from './pages/Home'
import CompanyWorkspace from './pages/CompanyWorkspace'
import AdvisoryWorkflow from './pages/AdvisoryWorkflow'
import Readiness from './pages/Readiness'
import BusinessQuality from './pages/BusinessQuality'
import BuyerLens from './pages/BuyerLens'
import Valuation from './pages/Valuation'
import ValueGap from './pages/ValueGap'
import InitiativeImpact from './pages/InitiativeImpact'
import ScenarioSimulator from './pages/ScenarioSimulator'
import Connectors from './pages/Connectors'
import DataMapping from './pages/DataMapping'
import DataQuality from './pages/DataQuality'
import DataRoom from './pages/DataRoom'
import Reports from './pages/Reports'
import AICopilot from './pages/AICopilot'
import Admin from './pages/Admin'

// Wrapper that reads :slug from the URL and passes it to DemoShell
function DemoShellWithSlug() {
  const { slug } = useParams()
  return <DemoShell slug={slug} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ---------------------------------------------------------------- */}
        {/* Marketing / public routes (no AppShell)                          */}
        {/* ---------------------------------------------------------------- */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard/onboarding" element={<OnboardingPage />} />

        {/* ---------------------------------------------------------------- */}
        {/* Demo routes (DemoShell — has Sidebar + DemoBanner, no real auth)  */}
        {/* ---------------------------------------------------------------- */}
        <Route path="/demo" element={<DemoShell />}>
          <Route index element={<DemoHome />} />
        </Route>
        <Route path="/demo/:slug" element={<DemoShellWithSlug />}>
          <Route index element={<DemoHome />} />
        </Route>

        {/* ---------------------------------------------------------------- */}
        {/* Dashboard routes (AppShell — existing pages, unchanged)           */}
        {/* ---------------------------------------------------------------- */}
        <Route path="/" element={<AppShell />}>
          <Route path="Home" element={<Home />} />
          <Route path="CompanyWorkspace" element={<CompanyWorkspace />} />
          <Route path="AdvisoryWorkflow" element={<AdvisoryWorkflow />} />
          <Route path="Readiness" element={<Readiness />} />
          <Route path="BusinessQuality" element={<BusinessQuality />} />
          <Route path="BuyerLens" element={<BuyerLens />} />
          <Route path="Valuation" element={<Valuation />} />
          <Route path="ValueGap" element={<ValueGap />} />
          <Route path="InitiativeImpact" element={<InitiativeImpact />} />
          <Route path="ScenarioSimulator" element={<ScenarioSimulator />} />
          <Route path="Connectors" element={<Connectors />} />
          <Route path="DataMapping" element={<DataMapping />} />
          <Route path="DataQuality" element={<DataQuality />} />
          <Route path="DataRoom" element={<DataRoom />} />
          <Route path="Reports" element={<Reports />} />
          <Route path="AICopilot" element={<AICopilot />} />
          <Route path="Admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
