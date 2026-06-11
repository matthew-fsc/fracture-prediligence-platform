import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import CopilotChat from '@/components/copilot/CopilotChat'
import { useCompanyId } from '@/context/CompanyContext'
import { apiClient } from '@/lib/apiClient'

const SUGGESTED_QUESTIONS = [
  'What is our DRS score and what does it mean for valuation?',
  'Which diligence gaps have the highest EV impact?',
  'Walk me through our EBITDA normalization and defensible addbacks.',
  'What questions will a PE buyer ask about our revenue quality?',
  'How does our customer concentration compare to what PE firms expect?',
  'What is our estimated enterprise value range and how is the multiple set?',
  'What are the top 3 initiatives to move us to the next DRS tier?',
  'What deal structure would make sense given our DRS tier?',
]

export default function AICopilot() {
  const companyId = useCompanyId()
  const companyReady = companyId != null && companyId > 0

  const scoresQuery = useQuery({
    queryKey: ['analytics-scores', companyId],
    queryFn: () => apiClient.get(`/api/analytics/scores/${companyId}`),
    enabled: companyReady,
    staleTime: 60_000,
  })

  if (!companyReady) {
    return (
      <div className="flex flex-col h-[calc(100dvh-120px)]">
        <PageHeader
          section="Intelligence"
          title="AI Copilot"
          subtitle="Ask questions about your diligence data, scores, gaps, and buyer risks"
          badge="No client selected"
        />
        <p className="text-sm text-muted-foreground mt-4">
          Select or create a client in the header to load company-specific analytics.
        </p>
      </div>
    )
  }

  const scores = scoresQuery.data
  const drsLabel = scores?.drs?.base != null ? `DRS ${scores.drs.base}/100 loaded` : null
  const badge = scoresQuery.isPending ? 'Loading scores…' : scoresQuery.isError ? 'Scores unavailable' : drsLabel ?? 'No analytics yet'

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)]">
      <PageHeader
        section="Intelligence"
        title="AI Copilot"
        subtitle="Ask questions about your diligence data, scores, enterprise value, and buyer readiness"
        badge={badge}
      />

      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
        <CopilotChat
          companyId={companyId}
          suggestedQuestions={SUGGESTED_QUESTIONS}
          contextHint="User is on the AI Copilot full-page view"
          scores={scores}
        />
      </div>
    </div>
  )
}
