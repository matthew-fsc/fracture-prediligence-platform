import { NavLink } from 'react-router-dom'
import { DemoDashboardExitLink } from '../demo/DemoDashboardExit'
import {
  Zap, House, Building, Workflow, Grid3x3, BarChart2,
  Eye, TrendingUp, Target, Activity, LineChart, GitCompare,
  FileText, BookOpen, MonitorPlay,
  Plug, ArrowRightLeft, NotebookPen,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useDemoData } from '../../context/DemoContext'

// Mirror the auth sidebar groups exactly — same labels, same order, same icons.
// Omissions vs auth: Data Quality (requires ingestion pipeline), Admin (internal only).
const groups = [
  {
    label: 'Workspace',
    items: [
      { label: 'Home',                 href: '',                  icon: House },
      { label: 'Company Workspace',    href: 'company',           icon: Building },
      { label: 'Client Profile',       href: 'engagement-intake', icon: NotebookPen },
      { label: 'Advisory Workflow',    href: 'workflow',          icon: Workflow },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Readiness Score',      href: 'readiness',         icon: Grid3x3 },
      { label: 'Business Quality',     href: 'business-quality',  icon: BarChart2 },
      { label: 'Buyer Risk Profile',   href: 'buyer-lens',        icon: Eye },
      { label: 'Valuation',            href: 'valuation',         icon: TrendingUp },
      { label: 'Market Comps',         href: 'market-comps',      icon: GitCompare },
    ],
  },
  {
    label: 'Value Creation',
    items: [
      { label: 'Value Gap',            href: 'value-gap',          icon: Target },
      { label: 'EBITDA & EV Timeline', href: 'ebitda-timeline',    icon: LineChart },
      { label: 'Initiative Impact',    href: 'initiative-impact',  icon: Zap },
      { label: 'Scenario Simulator',   href: 'scenario-simulator', icon: Activity },
    ],
  },
  {
    label: 'Data Pipeline',
    items: [
      { label: 'Data Sources',         href: 'data-sources',  icon: Plug },
      { label: 'Field Mapping',        href: 'field-mapping', icon: ArrowRightLeft },
    ],
  },
  {
    label: 'Output',
    items: [
      { label: 'Reports',              href: 'reports',          icon: FileText },
      { label: 'Advisory Library',     href: 'advisory-library', icon: BookOpen },
    ],
  },
]

export default function DemoSidebar({ basePrefix = '/demo' }) {
  const { openConversionModal } = useDemoData()

  return (
    <aside className="fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50 w-56">
      {/* Brand */}
      <div className="h-14 flex items-center px-3 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo.png" alt="Exit Blueprint" className="w-10 h-10 flex-shrink-0 object-contain rounded-md" />
          <div className="min-w-0">
            <h1 className="text-[12px] font-semibold text-sidebar-accent-foreground truncate leading-tight">
              Pre-Diligence Platform
            </h1>
            <p className="text-[11px] text-sidebar-foreground tracking-widest uppercase leading-tight">
              Exit Blueprint
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
              {group.items.map(({ label, href, icon: Icon }) => {
                const to = href === '' ? basePrefix : `${basePrefix}/${href}`
                return (
                  <NavLink
                    key={href}
                    to={to}
                    end={href === ''}
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
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Demo CTA + back link */}
      <div className="px-3 pb-2 border-t border-sidebar-border pt-2 space-y-1 flex-shrink-0">
        <button
          type="button"
          onClick={openConversionModal}
          className="w-full rounded-lg bg-primary/10 border border-primary/30 text-primary text-[11px] font-semibold py-2.5 px-2 hover:bg-primary/20 text-center"
        >
          Request Founding license
        </button>
        <DemoDashboardExitLink className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40 transition-colors duration-100 text-left">
          <MonitorPlay className="w-3.5 h-3.5 flex-shrink-0" />
          Back to Dashboard
        </DemoDashboardExitLink>
      </div>
    </aside>
  )
}
