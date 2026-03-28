import { NavLink, Link } from 'react-router-dom'
import {
  Zap, House, Building, Workflow, Grid3x3, BarChart2,
  Eye, TrendingUp, Target, Activity, Plug, ArrowRightLeft,
  Folder, FileText, Bot, Settings, ChevronLeft, MonitorPlay,
  LineChart, GitCompare, NotebookPen, BookOpen,
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
      { label: 'Engagement Intake',  href: '/EngagementIntake', icon: NotebookPen },
      { label: 'Advisory Workflow',  href: '/AdvisoryWorkflow', icon: Workflow },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Readiness Score',    href: '/Readiness',           icon: Grid3x3 },
      { label: 'Business Quality',   href: '/BusinessQuality',     icon: BarChart2 },
      { label: 'Buyer Risk Profile', href: '/BuyerLens',        icon: Eye },
      { label: 'Valuation',          href: '/Valuation',        icon: TrendingUp },
      { label: 'Market Comps',       href: '/MarketComps',      icon: GitCompare },
    ],
  },
  {
    label: 'Value Creation',
    items: [
      { label: 'Value Gap',          href: '/ValueGap',         icon: Target },
      { label: 'EBITDA & EV Timeline', href: '/EBITDATimeline', icon: LineChart },
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
      { label: 'Advisory Library',   href: '/AdvisoryLibrary',  icon: BookOpen },
      { label: 'AI Copilot',         href: '/AICopilot',        icon: Bot },
      { label: 'Admin',              href: '/Admin',            icon: Settings },
    ],
  },
]

export default function Sidebar({ mobileOpen = false, onNavigate }) {
  const companyId = useCompanyId()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-[70] w-56 max-w-[85vw]',
        'transition-transform duration-200 ease-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
    >
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
            <p className="text-[11px] text-sidebar-foreground tracking-widest uppercase leading-tight">
              Fracture Systems
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-4 py-1.5">
              {group.label}
            </p>
            <div className="px-2 space-y-0.5">
              {group.items.map(({ label, href, icon: Icon }) => (
                <NavLink
                  key={href}
                  to={withCompanyQuery(href, companyId)}
                  onClick={() => onNavigate?.()}
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

      {/* Demo link */}
      <div className="px-3 pb-2 border-t border-sidebar-border pt-2">
        <Link
          to="/demo"
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-amber-400/80 hover:text-amber-400 hover:bg-amber-400/10 transition-colors duration-100 w-full"
        >
          <MonitorPlay className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
          <span>View Demo</span>
        </Link>
      </div>

      {/* Collapse / close (mobile drawer) */}
      <div className="h-10 flex items-center px-4 border-t border-sidebar-border">
        <button
          type="button"
          onClick={() => onNavigate?.()}
          className="text-[11px] text-sidebar-foreground/40 flex items-center gap-1 min-h-[44px] py-2 md:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded"
        >
          <ChevronLeft className="w-3 h-3" />
          <span className="md:hidden">Close menu</span>
          <span className="hidden md:inline">Collapse</span>
        </button>
      </div>
    </aside>
  )
}
