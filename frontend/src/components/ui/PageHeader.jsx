export default function PageHeader({ section, title, subtitle, badge }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {section && (
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">{section}</p>
        )}
        <h1 className="text-2xl font-bold text-card-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {badge && (
        <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          {badge}
        </div>
      )}
    </div>
  )
}
