import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
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

export default function App() {
  return (
    <div className="dark">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/Home" replace />} />
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
    </div>
  )
}
