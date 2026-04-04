/**
 * ClientSidebar — navigation for the business-owner (CLIENT) portal.
 *
 * Shows only client-relevant pages. Read-only access; no data upload,
 * field mapping, or advisor tools.
 */

import { NavLink } from 'react-router-dom'
import {
  House, Grid3x3, TrendingUp, Target, NotebookPen,
  Folder, ChevronLeft,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useUserRole } from '../../context/UserRoleContext'

const groups = [
  {
    label: 'My Company',
    items: [
      { label: 'Dashboard',          href: '/client/dashboard',   icon: House },
      { label: 'My Readiness Score', href: '/client/readiness',   icon: Grid3x3 },
      { label: 'My Valuation',       href: '/client/valuation',   icon: TrendingUp },
      { label: 'Value Roadmap',      href: '/client/value-gap',   icon: Target },
    ],
  },
  {
    label: 'My Profile',
    items: [
      { label: 'Goals & Exit Prefs', href: '/client/profile',    icon: NotebookPen },
      { label: 'Documents',          href: '/client/data-room',  icon: Folder },
    ],
  },
]

export default function ClientSidebar({ mobileOpen = false, onNavigate }) {
  const { clientCompany } = useUserRole()

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
          <img src="/logo.png" alt="Fracture Systems" className="w-10 h-10 flex-shrink-0 object-contain rounded-md" />
          <div className="min-w-0">
            <h1 className="text-[12px] font-semibold text-sidebar-accent-foreground truncate leading-tight">
              Owner Portal
            </h1>
            <p className="text-[11px] text-sidebar-foreground tracking-widest uppercase leading-tight">
              Fracture Systems
            </p>
          </div>
        </div>
      </div>

      {/* Company name badge */}
      {clientCompany && (
        <div className="px-3 py-2 border-b border-sidebar-border flex-shrink-0">
          <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest mb-0.5">
            Company
          </p>
          <p className="text-[12px] font-medium text-sidebar-accent-foreground truncate">
            {clientCompany.name}
          </p>
        </div>
      )}

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
                  to={href}
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

      {/* Bottom */}
      <div className="px-3 pb-2 border-t border-sidebar-border pt-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => onNavigate?.()}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-sidebar-foreground/40 min-h-[44px] md:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded w-full"
        >
          <ChevronLeft className="w-3 h-3" />
          <span className="md:hidden">Close menu</span>
          <span className="hidden md:inline">Collapse</span>
        </button>
      </div>
    </aside>
  )
}
