import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import KpiCard from '../components/ui/KpiCard'
import StatusBadge from '../components/ui/StatusBadge'
import ProgressBar from '../components/ui/ProgressBar'
import SectionDivider from '../components/ui/SectionDivider'
import { kpis, drsCategories } from '../lib/mockData'

function tierVariant(t) {
  return { Strong: 'adequate', Adequate: 'adequate', Watch: 'watch', 'High Risk': 'high', Critical: 'critical' }[t] ?? 'medium'
}

export default function Readiness() {
  const radarData = drsCategories.map(c => ({ subject: c.name.split(' ')[0], score: c.score, fullMark: 100 }))
  return (
    <div>
      <PageHeader
        section="Intelligence"
        title="Diligence Readiness Score"
        subtitle="Composite operational readiness index — weighted across 6 diligence categories"
        badge={`DRS ${kpis.drs}/100`}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="DRS Score"        value={`${kpis.drs}/100`}    sublabel="Base confidence" />
        <KpiCard label="Conservative DRS" value="68"                   sublabel="Low-confidence inputs excluded" />
        <KpiCard label="Optimistic DRS"   value="79"                   sublabel="All gaps resolved favorably" />
        <KpiCard label="Peer Percentile"  value={`${kpis.drsPercentile}th`} sublabel="vs $5M–$10M prof. services" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Radar */}
        <div className="bg-card border border-border rounded-lg p-4">
          <SectionDivider label="Category Radar" />
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(220 18% 16%)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(220 10% 46%)' }} />
              <Radar name="DRS" dataKey="score" stroke="hsl(160 84% 39%)" fill="hsl(160 84% 39% / 0.2)" />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="bg-card border border-border rounded-lg p-4">
          <SectionDivider label="Category Breakdown" />
          <div className="space-y-4">
            {drsCategories.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-card-foreground">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={tierVariant(c.tier)}>{c.tier}</StatusBadge>
                    <span className="text-xs font-bold text-card-foreground">{c.score}</span>
                    <span className="text-[10px] text-muted-foreground">({(c.weight * 100).toFixed(0)}%)</span>
                  </div>
                </div>
                <ProgressBar value={c.score} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
