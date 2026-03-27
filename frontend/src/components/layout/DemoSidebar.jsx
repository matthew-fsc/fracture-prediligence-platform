import { NavLink } from 'react-router-dom'
import { DemoDashboardExitLink } from '../demo/DemoDashboardExit'
import {
  Zap, House, Building, Workflow, Grid3x3, BarChart2,
  Eye, TrendingUp, Target, Activity,
  Folder, FileText, ChevronLeft, ShieldAlert,
  UploadCloud, GitMerge, ClipboardList, LayoutDashboard,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useDemoData } from '../../context/DemoContext'

const groups = [
  {
    label: 'Ingestion',
    items: [
      { label: 'Data Upload',    path: 'data-sources',  icon: UploadCloud },
      { label: 'Field Mapping',  path: 'field-mapping', icon: GitMerge },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Home',               path: '',                  icon: House },
      { label: 'Company Workspace',  path: 'company',           icon: Building },
      { label: 'Advisory Workflow',  path: 'workflow',          icon: Workflow },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Readiness Score',    path: 'readiness',           icon: Grid3x3 },
      { label: 'Qualitative Inputs', path: 'qualitative-inputs', icon: ClipboardList },
      { label: 'Business Quality',   path: 'business-quality',   icon: BarChart2 },
      { label: 'Buyer Risk Profile', path: 'buyer-lens',        icon: Eye },
      { label: 'Valuation',          path: 'valuation',         icon: TrendingUp },
      { label: 'Risk Heatmap',       path: 'risk-heatmap',      icon: ShieldAlert },
    ],
  },
  {
    label: 'Value Creation',
    items: [
      { label: 'Value Gap',          path: 'value-gap',         icon: Target },
      { label: 'Initiative Impact',  path: 'initiative-impact', icon: Zap },
      { label: 'Scenario Simulator', path: 'scenario-simulator',icon: Activity },
    ],
  },
  {
    label: 'Output',
    items: [
      { label: 'Data Room (VDR)',    path: 'data-room',         icon: Folder },
      { label: 'Reports',            path: 'reports',           icon: FileText },
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
              {group.items.map(({ label, path, icon: Icon }) => {
                const href = path === '' ? basePrefix : `${basePrefix}/${path}`
                return (
                  <NavLink
                    key={path}
                    to={href}
                    end={path === ''}
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

      {/* Founding CTA + back to dashboard */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-2 flex-shrink-0">
        <button
          type="button"
          onClick={openConversionModal}
          className="w-full rounded-lg bg-primary/10 border border-primary/30 text-primary text-[11px] font-semibold py-2.5 px-2 hover:bg-primary/20 text-center"
        >
          Request Founding license
        </button>
        <DemoDashboardExitLink className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40 transition-colors duration-100 disabled:opacity-60 disabled:pointer-events-none text-left">
          <LayoutDashboard className="w-3.5 h-3.5 flex-shrink-0" />
          Back to Dashboard
        </DemoDashboardExitLink>
      </div>
    </aside>
  )
}
