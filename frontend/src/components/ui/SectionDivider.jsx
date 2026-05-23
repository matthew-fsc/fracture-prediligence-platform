export default function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
        {label}
      </p>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
