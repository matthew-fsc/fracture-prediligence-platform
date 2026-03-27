import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useCompanyId } from '../context/CompanyContext'
import { apiUrl } from '../lib/apiClient'

const SUGGESTED_QUESTIONS = [
  'What is our DRS score and what does it mean for valuation?',
  'Which diligence gaps have the highest EV impact?',
  'What questions will a PE buyer ask about our revenue quality?',
  'How does our customer concentration compare to peers?',
  'What is our estimated enterprise value range?',
  'What are the top 3 initiatives to increase our score?',
]

// Local answers from pre-loaded analytics data (offline mode)
function buildLocalAnswer(question, scores) {
  const drs  = scores?.drs
  const ev   = scores?.enterprise_value
  const cats = scores?.category_scores ?? {}

  const q = question.toLowerCase()

  if (q.includes('drs') || q.includes('diligence readiness') || q.includes('score')) {
    if (!drs) return "I don't have DRS data yet — please upload financial data in Data Sources first."
    return `Your Diligence Readiness Score is **${drs.base}/100** (${drs.tier}). Conservative: ${drs.conservative}, Optimistic: ${drs.optimistic}. The score reflects your readiness for a formal buyer diligence process.`
  }

  if (q.includes('value') || q.includes('ev') || q.includes('enterprise') || q.includes('valuation')) {
    if (!ev) return "No enterprise value data yet — upload P&L and revenue data to compute EV."
    return `Your estimated enterprise value range is **$${(ev.floor / 1e6).toFixed(2)}M – $${(ev.ceiling / 1e6).toFixed(2)}M**, with a midpoint of **$${(ev.midpoint / 1e6).toFixed(2)}M**. This uses a **${ev.multiple_used}x** EBITDA multiple based on your ${drs?.tier} DRS tier.`
  }

  if (q.includes('gap') || q.includes('initiative') || q.includes('improve')) {
    const weakest = Object.entries(cats)
      .sort((a, b) => a[1].composite - b[1].composite)
      .slice(0, 3)
    if (!weakest.length) return "Upload financial data to identify gaps."
    const list = weakest.map(([k, v]) => `${v.sub_scores ? Object.keys(v.sub_scores)[0] : k}: ${v.composite}/100`).join(', ')
    return `Your lowest-scoring categories are: ${list}. Focus on the operational independence and revenue quality gaps first — these have the highest EV leverage given their DRS weights (20% and 25%).`
  }

  if (q.includes('customer') || q.includes('concentration')) {
    const cr = cats.customer_risk
    if (!cr) return "No customer data ingested yet."
    return `Customer Risk score: **${cr.composite}/100**. Top customer revenue share: ${cr.sub_scores?.concentration?.label ?? 'unknown'}. Active customers: ${cr.sub_scores?.diversification?.value ?? '—'}. ${cr.composite < 60 ? 'Concentration is a meaningful risk — reducing top-customer dependency should be a priority.' : 'Customer base is reasonably diversified.'}`
  }

  if (q.includes('question') || q.includes('buyer') || q.includes('pe') || q.includes('due diligence')) {
    return "Navigate to **Buyer Lens** to see all simulated buyer questions ranked by severity. The most critical questions center on contract documentation, key-person risk, and EBITDA normalization."
  }

  return `I can help with: DRS scores, enterprise value, diligence gaps, buyer questions, and initiative planning. For real-time analysis, ensure you've uploaded your financial data in Data Sources.\n\nYou asked: "${question}" — try rephrasing with keywords like 'score', 'value', 'gap', 'customers', or 'buyers'.`
}

export default function AICopilot() {
  const companyId = useCompanyId()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm your Pre-Diligence AI Copilot. I have access to your company's diligence data and can answer questions about your DRS score, enterprise value, gaps, buyer risks, and initiatives. What would you like to know?",
    }
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [scores, setScores]   = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    fetch(apiUrl(`/api/analytics/scores/${companyId}`))
      .then(r => r.ok ? r.json() : null)
      .then(d => setScores(d))
      .catch(() => {})
  }, [companyId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text) {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    // In Phase 2 this calls /api/copilot/chat with Anthropic API
    await new Promise(r => setTimeout(r, 600))
    const answer = buildLocalAnswer(userMsg, scores)
    setMessages(prev => [...prev, { role: 'assistant', content: answer }])
    setLoading(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Simple markdown-ish renderer for bold
  function renderContent(text) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i} className="text-card-foreground">{p.slice(2, -2)}</strong>
        : p
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <PageHeader
        section="Intelligence"
        title="AI Copilot"
        subtitle="Ask questions about your diligence data, scores, gaps, and buyer risks"
        badge={scores ? `DRS ${scores.drs?.base}/100 loaded` : 'No data loaded'}
      />

      {/* Suggested questions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SUGGESTED_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            className="text-[11px] px-2.5 py-1 bg-muted border border-border rounded-full text-muted-foreground hover:text-card-foreground hover:border-primary/40 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-primary/10' : 'bg-muted'}`}>
              {msg.role === 'assistant'
                ? <Bot className="w-3.5 h-3.5 text-primary" />
                : <User className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
            <div className={`max-w-[75%] rounded-lg px-4 py-2.5 ${msg.role === 'assistant' ? 'bg-card border border-border' : 'bg-primary/10 border border-primary/20'}`}>
              <p className="text-xs text-card-foreground leading-relaxed whitespace-pre-wrap">
                {renderContent(msg.content)}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-lg px-4 py-2.5">
              <Loader className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your DRS, EV, gaps, buyers…"
          rows={2}
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-card-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
