import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Loader2, AlertTriangle, Zap, Copy, Check } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'

// ---------------------------------------------------------------------------
// Markdown renderer — bold, bullet lists, numbered lists, inline code
// ---------------------------------------------------------------------------
function renderMarkdown(text) {
  const lines = text.split('\n')
  const out = []
  let listItems = []
  let listType = null

  function flushList() {
    if (!listItems.length) return
    const El = listType === 'ol' ? 'ol' : 'ul'
    out.push(
      <El key={out.length} className={listType === 'ol' ? 'list-decimal list-inside space-y-0.5 my-1' : 'list-disc list-inside space-y-0.5 my-1'}>
        {listItems.map((item, i) => (
          <li key={i} className="text-xs leading-relaxed text-card-foreground/90">
            {renderInline(item)}
          </li>
        ))}
      </El>
    )
    listItems = []
    listType = null
  }

  lines.forEach((line, i) => {
    const olMatch = line.match(/^(\d+)\.\s+(.+)/)
    const ulMatch = line.match(/^[-•]\s+(.+)/)

    if (ulMatch) {
      if (listType === 'ol') flushList()
      listType = 'ul'
      listItems.push(ulMatch[1])
    } else if (olMatch) {
      if (listType === 'ul') flushList()
      listType = 'ol'
      listItems.push(olMatch[2])
    } else {
      flushList()
      if (line.trim() === '') {
        if (i > 0) out.push(<div key={out.length} className="h-1" />)
      } else {
        out.push(
          <p key={out.length} className="text-xs leading-relaxed text-card-foreground/90">
            {renderInline(line)}
          </p>
        )
      }
    }
  })
  flushList()
  return out
}

function renderInline(text) {
  // Bold + inline code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} className="font-semibold text-card-foreground">{p.slice(2, -2)}</strong>
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return <code key={i} className="font-mono text-[10px] bg-muted/60 px-1 py-0.5 rounded text-primary">{p.slice(1, -1)}</code>
    }
    return p
  })
}

// ---------------------------------------------------------------------------
// Token usage bar
// ---------------------------------------------------------------------------
function TokenMeter({ usage }) {
  if (!usage?.monthly_limit) return null
  const pct = usage.tokens_used_this_month / usage.monthly_limit
  const barColor = pct >= 0.9 ? 'bg-red-500' : pct >= 0.7 ? 'bg-amber-500' : 'bg-primary'
  const textColor = pct >= 0.9 ? 'text-red-400' : pct >= 0.7 ? 'text-amber-400' : 'text-muted-foreground'
  return (
    <div className="px-3 py-2 border-b border-border bg-muted/10 space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground/70">Monthly AI usage</span>
        <span className={`font-medium ${textColor}`}>
          {(usage.tokens_used_this_month / 1000).toFixed(0)}k / {(usage.monthly_limit / 1000).toFixed(0)}k tokens
        </span>
      </div>
      <div className="h-0.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, pct * 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------
function MessageBubble({ msg }) {
  const [copied, setCopied] = useState(false)
  const isAI = msg.role === 'assistant'

  function copy() {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className={`flex gap-2.5 group ${isAI ? '' : 'flex-row-reverse'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isAI ? 'bg-primary/15 border border-primary/20' : 'bg-muted border border-border'
      }`}>
        {isAI
          ? <Bot className="w-3 h-3 text-primary" />
          : <User className="w-3 h-3 text-muted-foreground" />}
      </div>
      <div className={`relative max-w-[82%] rounded-xl px-3.5 py-2.5 ${
        isAI
          ? 'bg-card border border-border/80'
          : 'bg-primary/10 border border-primary/20'
      }`}>
        <div className="space-y-0.5">
          {renderMarkdown(msg.content)}
        </div>
        {msg.cached && (
          <div className="flex items-center gap-1 mt-1.5 opacity-60">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-[9px] text-amber-400/80">cached</span>
          </div>
        )}
        {isAI && (
          <button
            onClick={copy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
            title="Copy"
          >
            {copied
              ? <Check className="w-3 h-3 text-emerald-400" />
              : <Copy className="w-3 h-3 text-muted-foreground" />}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * CopilotChat — reusable AI chat component.
 *
 * Props:
 *   companyId        number   — required
 *   suggestedQuestions  string[]  — chip suggestions shown above the thread
 *   contextHint      string   — optional phrase sent to API so AI knows user's current view
 *   scores           object   — optional analytics scores for offline fallback
 *   compact          boolean  — reduced chrome for embedded/drawer mode
 *   initialMessage   string   — pre-fills input (e.g. from "ask about this question" click)
 *   onInitialSent    fn       — callback after initial message fires (clears the pre-fill)
 */
export default function CopilotChat({
  companyId,
  suggestedQuestions = [],
  contextHint,
  scores,
  compact = false,
  initialMessage,
  onInitialSent,
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm your Pre-Diligence AI Copilot. I have access to this company's DRS scores, enterprise value, EBITDA breakdown, and diligence gaps. What would you like to understand?",
    },
  ])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [tokenUsage, setTokenUsage] = useState(null)
  const [error, setError]           = useState(null)
  const bottomRef                   = useRef(null)
  const inputRef                    = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Fire an initial pre-filled message (e.g. from BuyerLens "ask about this")
  useEffect(() => {
    if (initialMessage && !loading) {
      sendMessage(initialMessage)
      onInitialSent?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage])

  const sendMessage = useCallback(async (text) => {
    const userMsg = (text ?? input).trim()
    if (!userMsg || loading) return
    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))

      const data = await apiClient.post(`/api/copilot/chat/${companyId}`, {
        message: userMsg,
        history,
        context_hint: contextHint || undefined,
      })

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply, cached: data.usage?.cache_hit },
      ])
      if (data.usage) setTokenUsage(data.usage)
    } catch (e) {
      const fallback = buildOfflineFallback(userMsg, scores)
      if (fallback) {
        setMessages(prev => [...prev, { role: 'assistant', content: fallback }])
      } else {
        setError(e?.message || 'AI service unavailable — try again shortly.')
        setMessages(prev => prev.slice(0, -1))  // remove the user message on hard failure
      }
    }
    setLoading(false)
    inputRef.current?.focus()
  }, [input, loading, messages, companyId, contextHint, scores])

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const canSend = input.trim().length > 0 && !loading

  return (
    <div className={`flex flex-col h-full ${compact ? '' : 'min-h-0'}`}>
      {/* Token meter */}
      <TokenMeter usage={tokenUsage} />

      {/* Budget warning */}
      {tokenUsage?.budget_warning && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-[10px] text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {tokenUsage.budget_pct?.toFixed(0)}% of monthly limit used — limit resets 1st of next month.
        </div>
      )}

      {/* API error banner */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 text-[11px] text-red-400 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Suggested questions */}
      {suggestedQuestions.length > 0 && messages.length <= 1 && (
        <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
          {suggestedQuestions.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="text-[10px] px-2 py-1 bg-muted/60 border border-border rounded-full text-muted-foreground hover:text-card-foreground hover:border-primary/40 hover:bg-muted transition-colors disabled:opacity-50 text-left"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-3 h-3 text-primary" />
            </div>
            <div className="bg-card border border-border/80 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
              <span className="text-[10px] text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-border flex items-end gap-2">
        <label htmlFor="copilot-chat-input" className="sr-only">Message to AI Copilot</label>
        <textarea
          ref={inputRef}
          id="copilot-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about DRS, EV, gaps, buyers, EBITDA…"
          rows={2}
          className="flex-1 bg-muted/60 border border-border rounded-xl px-3 py-2 text-xs text-card-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60 min-h-[44px] max-h-[120px]"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!canSend}
          className="p-2.5 w-9 h-9 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Offline fallback answers from pre-loaded scores
// ---------------------------------------------------------------------------
function buildOfflineFallback(question, scores) {
  if (!scores) return null
  const drs  = scores?.drs
  const ev   = scores?.enterprise_value
  const cats = scores?.category_scores ?? {}
  const q    = question.toLowerCase()

  if ((q.includes('drs') || q.includes('diligence readiness') || q.includes('score')) && drs) {
    return `Your Diligence Readiness Score is **${drs.base}/100** (${drs.tier}). Conservative estimate: **${drs.conservative}**, Optimistic: **${drs.optimistic}**. The score reflects readiness for a formal buyer diligence process — scores below 70 typically result in deal renegotiation during QofE.`
  }

  if ((q.includes('value') || q.includes('ev') || q.includes('enterprise') || q.includes('valuation')) && ev) {
    return `Estimated enterprise value: **$${(ev.floor / 1e6).toFixed(2)}M – $${(ev.ceiling / 1e6).toFixed(2)}M**, midpoint **$${(ev.midpoint / 1e6).toFixed(2)}M**. This uses a **${ev.multiple_used}x** EBITDA multiple based on your ${drs?.tier ?? 'current'} DRS tier. Moving one tier up would expand the applicable multiple range by 1.5–2.0x.`
  }

  if ((q.includes('gap') || q.includes('improve') || q.includes('initiative')) && Object.keys(cats).length) {
    const sorted = Object.entries(cats).sort((a, b) => a[1].composite - b[1].composite).slice(0, 3)
    const list = sorted.map(([k, v]) => `**${k.replace(/_/g, ' ')}** (${v.composite}/100)`).join(', ')
    return `Lowest-scoring categories: ${list}. These represent your highest EV leverage — improving them to 80/100 unlocks the Value Gap EV uplift shown in your report. Revenue Quality and Financial Integrity have the most weight at 25% and 20% respectively.`
  }

  if (q.includes('customer') || q.includes('concentration')) {
    const cr = cats.customer_risk
    if (cr) return `Customer Risk score: **${cr.composite}/100**. ${cr.composite < 60 ? 'Concentration is a meaningful deal risk — PE buyers will flag top-customer dependency during diligence. Reducing reliance on any single customer below 20% of revenue materially improves this score.' : 'Customer base is reasonably diversified for this market.'}`
  }

  if (q.includes('buyer') || q.includes('pe') || q.includes('question') || q.includes('diligence')) {
    return 'Navigate to **Buyer Lens** to see all simulated buyer questions ranked by severity. The most critical questions center on contract documentation, key-person risk, and EBITDA normalization. Use the AI simulation there to generate PE-specific questions anchored to this company\'s actual metrics.'
  }

  return null
}
