import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import SectionHeader from '../components/ui/SectionHeader'
import { cn } from '../lib/utils'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'
import { usePageTitle } from '../hooks/usePageTitle'
import { Skeleton } from '../components/ui/Skeleton'
import {
  BookOpen, Plus, Search, X, ChevronDown, ChevronRight,
  Zap, Filter, Edit2, Trash2, Check,
  MessageSquare, Sparkles, Shield,
} from 'lucide-react'
import { getDrsCategoryStyle } from '../lib/drsCategoryColors'

const ITEM_TYPE_META = {
  buyer_question: { label: 'Buyer Question', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  initiative:     { label: 'Initiative',      icon: Zap,            color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  risk_flag:      { label: 'Risk Flag',       icon: Shield,         color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
}

const CATEGORY_LABELS = {
  revenue_quality: 'Revenue Quality',
  financial_integrity: 'Financial Integrity',
  operational_independence: 'Operational Independence',
  customer_risk: 'Customer Risk',
  management_team: 'Management & Team',
  growth_drivers: 'Growth Drivers',
}

const SEV_COLORS = {
  CRITICAL: 'border-red-500/20 bg-red-500/10 text-red-400',
  HIGH:     'border-amber-500/20 bg-amber-500/10 text-amber-400',
  MEDIUM:   'border-border bg-muted/30 text-muted-foreground',
}

const EMPTY_FORM = {
  item_type: 'buyer_question',
  title: '',
  description: '',
  category: '',
  severity: '',
  buyer_type: '',
  tags: [],
  data_needed: '',
  score_trigger: '',
  effort: '',
  timeline: '',
  ev_impact: '',
}

function TagPill({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary">
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-red-400 transition-colors">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  )
}

function ItemCard({ item, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const meta = ITEM_TYPE_META[item.item_type] || ITEM_TYPE_META.buyer_question
  const Icon = meta.icon
  const catC = item.category ? getDrsCategoryStyle(item.category) : { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' }

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden transition-all', meta.border)}>
      <button className="w-full text-left p-4" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', meta.bg)}>
            <Icon className={cn('w-4 h-4', meta.color)} />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-card-foreground leading-snug">{item.title}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.source === 'advisor' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary uppercase">Custom</span>
                )}
                {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase', meta.border, meta.bg, meta.color)}>
                {meta.label}
              </span>
              {item.category && (
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', catC.border, catC.bg, catC.text)}>
                  {CATEGORY_LABELS[item.category] || item.category}
                </span>
              )}
              {item.severity && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase', SEV_COLORS[item.severity] || SEV_COLORS.MEDIUM)}>
                  {item.severity}
                </span>
              )}
              {item.buyer_type && item.buyer_type !== 'All' && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border bg-muted/20 text-muted-foreground">
                  {item.buyer_type}
                </span>
              )}
              {item.effort && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border bg-muted/20 text-muted-foreground">
                  {item.effort} effort
                </span>
              )}
              {item.ev_impact && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                  {item.ev_impact} EV impact
                </span>
              )}
              {(item.tags ?? []).map(t => (
                <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {item.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            {item.data_needed && (
              <div className="col-span-2 rounded-lg bg-secondary/20 p-2.5">
                <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Data Needed</p>
                <p className="text-card-foreground">{item.data_needed}</p>
              </div>
            )}
            {item.score_trigger != null && (
              <div className="rounded-lg bg-secondary/20 p-2.5">
                <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Score Trigger</p>
                <p className="text-card-foreground">≤ {item.score_trigger}</p>
              </div>
            )}
            {item.timeline && (
              <div className="rounded-lg bg-secondary/20 p-2.5">
                <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Timeline</p>
                <p className="text-card-foreground">{item.timeline}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-muted-foreground/50">
              {item.source === 'system' ? 'Built-in template' : 'Custom — added by advisor'} · ID {item.id}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(item)} className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <Edit2 className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => onDelete(item)} className="text-[11px] font-medium text-muted-foreground hover:text-red-400 flex items-center gap-1 transition-colors">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FormModal({ initial, meta, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    item_type: initial?.item_type || 'buyer_question',
    title: initial?.title || '',
    description: initial?.description || '',
    category: initial?.category || '',
    severity: initial?.severity || '',
    buyer_type: initial?.buyer_type || '',
    tags: initial?.tags ?? [],
    data_needed: initial?.data_needed || '',
    score_trigger: initial?.score_trigger != null ? String(initial.score_trigger) : '',
    effort: initial?.effort || '',
    timeline: initial?.timeline || '',
    ev_impact: initial?.ev_impact || '',
  }))
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial?.id

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      set('tags', [...form.tags, t])
    }
    setTagInput('')
  }

  const removeTag = (t) => set('tags', form.tags.filter(x => x !== t))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        category: form.category || null,
        severity: form.severity || null,
        buyer_type: form.buyer_type || null,
        data_needed: form.data_needed || null,
        score_trigger: form.score_trigger ? parseFloat(form.score_trigger) : null,
        effort: form.effort || null,
        timeline: form.timeline || null,
        ev_impact: form.ev_impact || null,
        tags: form.tags.length > 0 ? form.tags : null,
      }
      await onSave(payload, initial?.id)
      onClose()
    } catch (err) {
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full text-xs bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40'
  const labelCls = 'text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">{isEdit ? 'Edit Library Item' : 'Add Library Item'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Row 1: Type + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Item Type *</label>
              <select value={form.item_type} onChange={e => set('item_type', e.target.value)} className={inputCls}>
                {(meta?.item_types ?? ['buyer_question', 'initiative', 'risk_flag']).map(t => (
                  <option key={t} value={t}>{(ITEM_TYPE_META[t]?.label) || t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>DRS Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                {(meta?.categories ?? Object.keys(CATEGORY_LABELS)).map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Title / Question *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="e.g. What percentage of revenue is contractually recurring?" />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description / Context</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} placeholder="Optional additional context or guidance for advisors" />
          </div>

          {/* Row 3: Severity + Buyer Type */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Severity</label>
              <select value={form.severity} onChange={e => set('severity', e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                {(meta?.severities ?? ['CRITICAL', 'HIGH', 'MEDIUM']).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Buyer Type</label>
              <select value={form.buyer_type} onChange={e => set('buyer_type', e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                {(meta?.buyer_types ?? ['PE', 'Strategic', 'Financial', 'All']).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Score Trigger (≤)</label>
              <input type="number" value={form.score_trigger} onChange={e => set('score_trigger', e.target.value)} className={inputCls} placeholder="e.g. 65" min={0} max={100} step={1} />
            </div>
          </div>

          {/* Data needed (buyer questions) */}
          {form.item_type === 'buyer_question' && (
            <div>
              <label className={labelCls}>Data Needed</label>
              <textarea value={form.data_needed} onChange={e => set('data_needed', e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} placeholder="What data should the advisor prepare?" />
            </div>
          )}

          {/* Initiative fields */}
          {form.item_type === 'initiative' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Effort</label>
                <select value={form.effort} onChange={e => set('effort', e.target.value)} className={inputCls}>
                  <option value="">— None —</option>
                  {(meta?.efforts ?? ['Low', 'Medium', 'High']).map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Timeline</label>
                <input value={form.timeline} onChange={e => set('timeline', e.target.value)} className={inputCls} placeholder="e.g. 30–60 days" />
              </div>
              <div>
                <label className={labelCls}>EV Impact</label>
                <select value={form.ev_impact} onChange={e => set('ev_impact', e.target.value)} className={inputCls}>
                  <option value="">— None —</option>
                  {(meta?.ev_impacts ?? ['Low', 'Medium', 'High', 'Critical']).map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className={labelCls}>Custom Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map(t => <TagPill key={t} label={t} onRemove={() => removeTag(t)} />)}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                className={cn(inputCls, 'flex-1')}
                placeholder="Type a tag and press Enter"
              />
              <button type="button" onClick={addTag} className="text-xs font-medium px-3 py-2 rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-colors">
                Add
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="text-xs font-medium px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted/30 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.title.trim()} className="text-xs font-bold px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-opacity flex items-center gap-1.5">
              {saving ? 'Saving…' : isEdit ? <><Check className="w-3 h-3" /> Save Changes</> : <><Plus className="w-3 h-3" /> Add Item</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdvisoryLibrary() {
  usePageTitle('Advisory Library')
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const metaQuery = useQuery({
    queryKey: ['library-meta'],
    queryFn: () => apiClient.get('/api/library/meta'),
    staleTime: 300_000,
  })

  const listQuery = useQuery({
    queryKey: ['library-items'],
    queryFn: () => apiClient.get('/api/library/'),
  })

  const meta = metaQuery.data
  const allItems = listQuery.data?.items ?? []

  const filtered = useMemo(() => {
    let list = allItems
    if (filterType) list = list.filter(i => i.item_type === filterType)
    if (filterCategory) list = list.filter(i => i.category === filterCategory)
    if (filterSeverity) list = list.filter(i => i.severity === filterSeverity)
    if (filterSource) list = list.filter(i => i.source === filterSource)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.tags ?? []).some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [allItems, filterType, filterCategory, filterSeverity, filterSource, search])

  const counts = useMemo(() => {
    const c = { buyer_question: 0, initiative: 0, risk_flag: 0, total: allItems.length }
    allItems.forEach(i => { if (c[i.item_type] !== undefined) c[i.item_type]++ })
    return c
  }, [allItems])

  const handleSave = useCallback(async (payload, id) => {
    if (id) {
      await apiClient.patch(`/api/library/${id}`, payload)
      toast.success('Item updated')
    } else {
      await apiClient.post('/api/library/', payload)
      toast.success('Item added to library')
    }
    qc.invalidateQueries({ queryKey: ['library-items'] })
  }, [qc])

  const handleDelete = useCallback(async (item) => {
    if (!confirm(`Delete "${item.title.slice(0, 60)}…"?`)) return
    try {
      await apiClient.del(`/api/library/${item.id}`)
      toast.success('Item deleted')
      qc.invalidateQueries({ queryKey: ['library-items'] })
    } catch (err) {
      toast.error(err?.message || 'Delete failed')
    }
  }, [qc])

  const handleEdit = useCallback((item) => {
    setEditItem(item)
    setShowModal(true)
  }, [])

  const activeFilters = [filterType, filterCategory, filterSeverity, filterSource].filter(Boolean).length
  const clearFilters = () => { setFilterType(''); setFilterCategory(''); setFilterSeverity(''); setFilterSource(''); setSearch('') }

  if (listQuery.isPending) {
    return (
      <div className="space-y-5 max-w-[1400px]">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <SectionHeader
        title="Advisory Library"
        subtitle="Centralized catalog of buyer questions, value creation initiatives, and risk flags — tagged for automatic surfacing across the platform"
        action={
          <button
            onClick={() => { setEditItem(null); setShowModal(true) }}
            className="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground flex items-center gap-1.5 hover:brightness-110 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        }
      />

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: '',               label: 'Total Items',      count: counts.total,           icon: BookOpen, color: 'text-foreground',    bg: 'bg-muted/30',         border: 'border-border' },
          { key: 'buyer_question', label: 'Buyer Questions',  count: counts.buyer_question,  icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/5',       border: 'border-blue-500/20' },
          { key: 'initiative',     label: 'Initiatives',      count: counts.initiative,      icon: Zap,      color: 'text-emerald-400',   bg: 'bg-emerald-500/5',    border: 'border-emerald-500/20' },
          { key: 'risk_flag',      label: 'Risk Flags',       count: counts.risk_flag,       icon: Shield,   color: 'text-red-400',       bg: 'bg-red-500/5',        border: 'border-red-500/20' },
        ].map(s => (
          <button
            key={s.key ?? 'all'}
            onClick={() => setFilterType(filterType === s.key ? '' : s.key)}
            className={cn(
              'rounded-xl border p-4 text-left transition-all',
              filterType === s.key ? 'ring-1 ring-primary/40' : '',
              s.border, s.bg,
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.count}</p>
              </div>
              <s.icon className={cn('w-5 h-5', s.color, 'opacity-40')} />
            </div>
          </button>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Filters</span>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="text-[10px] text-primary hover:underline ml-auto">
              Clear all ({activeFilters})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search titles, descriptions, tags…"
              className="w-full text-xs bg-secondary border border-border rounded-lg pl-8 pr-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-xs bg-secondary border border-border rounded-lg px-3 py-2 text-muted-foreground focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            <option value="">All types</option>
            <option value="buyer_question">Buyer Questions</option>
            <option value="initiative">Initiatives</option>
            <option value="risk_flag">Risk Flags</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-xs bg-secondary border border-border rounded-lg px-3 py-2 text-muted-foreground focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="text-xs bg-secondary border border-border rounded-lg px-3 py-2 text-muted-foreground focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            <option value="">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="text-xs bg-secondary border border-border rounded-lg px-3 py-2 text-muted-foreground focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
            <option value="">All sources</option>
            <option value="system">Built-in</option>
            <option value="advisor">Custom</option>
          </select>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-bold text-foreground">{filtered.length}</span> of {allItems.length} items
          </p>
        </div>

        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {allItems.length === 0 ? 'The library is empty. Add your first item to get started.' : 'No items match the current filters.'}
            </p>
            {allItems.length > 0 && (
              <button onClick={clearFilters} className="text-xs font-medium text-primary hover:underline">Clear filters</button>
            )}
          </div>
        )}

        <div className="space-y-2">
          {filtered.map(item => (
            <ItemCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      {/* ── Footnote ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border/40 bg-muted/10 px-4 py-3 text-[10px] text-muted-foreground/60 space-y-1">
        <p>
          <span className="font-semibold text-muted-foreground">How tags work:</span> Items
          are surfaced across the platform based on their <strong>type</strong>, <strong>DRS category</strong>, <strong>severity</strong>,
          and <strong>buyer type</strong> tags. Buyer questions appear on the Buyer Risk Profile page when their
          score trigger is met. Initiatives appear on the Initiative Impact page. Risk flags surface on the Risk Heatmap.
        </p>
        <p>
          Custom tags can be used for your own organization — for example, tagging items by industry, deal stage,
          or specific engagement.
        </p>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {showModal && (
        <FormModal
          initial={editItem}
          meta={meta}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
