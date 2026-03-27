import { NavLink } from 'react-router-dom'
import {
  Zap, House, Building, Workflow, Grid3x3, BarChart2,
  Eye, TrendingUp, Target, Activity, Plug, ArrowRightLeft,
  Folder, FileText, Bot, Settings, ChevronLeft, ClipboardList,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useCompanyId } from '../../context/CompanyContext'
import { withCompanyQuery } from '../../lib/navLinks'

const groups = [
  {
    label: 'Workspace',
    items: [
      { label: 'Home',               href: '/Home',             icon: House },
      { label: 'Company Workspace',  href: '/CompanyWorkspace', icon: Building },
      { label: 'Advisory Workflow',  href: '/AdvisoryWorkflow', icon: Workflow },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Readiness Score',    href: '/Readiness',           icon: Grid3x3 },
      { label: 'Qualitative Inputs', href: '/QualitativeInputs',   icon: ClipboardList },
      { label: 'Business Quality',   href: '/BusinessQuality',     icon: BarChart2 },
      { label: 'Buyer Risk Profile', href: '/BuyerLens',        icon: Eye },
      { label: 'Valuation',          href: '/Valuation',        icon: TrendingUp },
    ],
  },
  {
    label: 'Value Creation',
    items: [
      { label: 'Value Gap',          href: '/ValueGap',         icon: Target },
      { label: 'Initiative Impact',  href: '/InitiativeImpact', icon: Zap },
      { label: 'Scenario Simulator', href: '/ScenarioSimulator',icon: Activity },
    ],
  },
  {
    label: 'Data Pipeline',
    items: [
      { label: 'Data Sources',       href: '/Connectors',       icon: Plug },
      { label: 'Field Mapping',      href: '/DataMapping',      icon: ArrowRightLeft },
      { label: 'Data Quality',       href: '/DataQuality',      icon: Folder },
      { label: 'Data Room (VDR)',    href: '/DataRoom',         icon: Folder },
    ],
  },
  {
    label: 'Output',
    items: [
      { label: 'Reports',            href: '/Reports',          icon: FileText },
      { label: 'AI Copilot',         href: '/AICopilot',        icon: Bot },
      { label: 'Admin',              href: '/Admin',            icon: Settings },
    ],
  },
]

export default function Sidebar() {
  const companyId = useCompanyId()

  return (
    <aside className="fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50 w-56">
      {/* Brand */}
      <div className="h-14 flex items-center px-3 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[12px] font-semibold text-sidebar-accent-foreground truncate leading-tight">
              Pre-Diligence Platform
            </h1>
            <p className="text-[9px] text-sidebar-foreground tracking-widest uppercase leading-tight">
              Fracture Systems
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="text-[9px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-4 py-1.5">
              {group.label}
            </p>
            <div className="px-2 space-y-0.5">
              {group.items.map(({ label, href, icon: Icon }) => (
                <NavLink
                  key={href}
                  to={withCompanyQuery(href, companyId)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-100',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                      <span className="truncate">{label}</span>
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse */}
      <div className="h-8 flex items-center px-4 border-t border-sidebar-border">
        <button className="text-[10px] text-sidebar-foreground/40 flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" /> Collapse
        </button>
      </div>
    </aside>
  )
}
