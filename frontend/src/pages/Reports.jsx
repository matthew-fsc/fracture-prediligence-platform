import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Download, RefreshCw, CheckCircle, Upload, Trash2, AlertTriangle } from 'lucide-react'
import SectionHeader from '../components/ui/SectionHeader'
import { cn, fmtM } from '../lib/utils'
import { useCompanyId } from '../context/CompanyContext'
import { apiClient } from '../lib/apiClient'
import { toast } from '../lib/notify'

const REPORT_TEMPLATES = [
  {
    id: 'drs_summary',
    title: 'Diligence Readiness Summary',
    description: '2-page executive-ready assessment with DRS score, category breakdown, and top risks.',
    sections: ['DRS Score & Tier', 'Category Scores', 'Top 5 Risks', 'Immediate Action Items'],
    status: 'ready',
    color: 'primary',
    requiresFinancialData: false,
  },
  {
    id: 'buyer_prep',
    title: 'Buyer Preparation Package',
    description: 'Anticipated due diligence questions with data needed for each response.',
    sections: ['Critical Questions', 'Financial Data Checklist', 'Operational Documentation', 'Management Bios'],
    status: 'ready',
    color: 'blue',
    requiresFinancialData: false,
  },
  {
    id: 'value_gap',
    title: 'Value Gap Report',
    description: 'Current vs. potential enterprise value with ranked value-creation initiatives.',
    sections: ['EV Range', 'Gap Analysis by Category', 'Initiative Roadmap', 'DRS Sensitivity'],
    status: 'ready',
    color: 'emerald',
    requiresFinancialData: true,
  },
  {
    id: 'ebitda_recast',
    title: 'EBITDA Recast Schedule',
    description: 'PDF export of reported EBITDA bridge, scenario columns, and addback schedule.',
    sections: ['KPI Summary', 'Data Notes', 'Addback Schedule'],
    status: 'ready',
    color: 'amber',
    requiresFinancialData: true,
  },
  {
    id: 'company_profile',
    title: 'Company Profile Teaser',
    description: 'One-page teaser with firm branding, highlights, and indicative EV.',
    sections: ['Cover Blurb', 'Financial Highlights', 'DRS & EV', 'Disclaimer'],
    status: 'ready',
    color: 'purple',
    requiresFinancialData: true,
  },
]

const colorMap = {
  primary: {
    border: 'border-primary/20',
    bg: 'bg-primary/5',
    icon: 'bg-primary/10 text-primary',
    cta: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/25',
  },
  emerald: {
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    icon: 'bg-emerald-500/10 text-emerald-400',
    cta: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-900/20',
  },
  blue: {
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    icon: 'bg-blue-500/10 text-blue-400',
    cta: 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-900/25',
  },
  amber: {
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    icon: 'bg-amber-500/10 text-amber-400',
    cta: 'bg-amber-600 text-white hover:bg-amber-500 shadow-sm shadow-amber-900/20',
  },
  purple: {
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
    icon: 'bg-purple-500/10 text-purple-400',
    cta: 'bg-purple-600 text-white hover:bg-purple-500 shadow-sm shadow-purple-900/25',
  },
}

export default function Reports() {
  const companyId = useCompanyId()
  const [generating, setGenerating] = useState(null)
  const [generated, setGenerated]   = useState({})
  const [scoreData, setScoreData]   = useState(null)
  const [history, setHistory]       = useState([])
  const [firmName, setFirmName]     = useState('')
  const [blurb, setBlurb]           = useState('')
  const [hasUploadedLogo, setHasUploadedLogo] = useState(false)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null)
  const [logoNonce, setLogoNonce] = useState(0)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingBrand, setSavingBrand] = useState(false)
  const logoFileRef = useRef(null)

  const companyReady = companyId != null && companyId > 0

  const loadHistory = useCallback(() => {
    if (!companyReady) return
    apiClient.get(`/api/reports/${companyId}/history`)
      .then(d => setHistory(d.reports ?? []))
      .catch(() => setHistory([]))
  }, [companyId, companyReady])

  useEffect(() => {
    if (!companyReady) return
    apiClient.get(`/api/analytics/scores/${companyId}`)
      .then(d => setScoreData(d))
      .catch(() => {})
  }, [companyId, companyReady])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!companyReady) return
    apiClient.get(`/api/analytics/company-financial/${companyId}`)
      .then(d => {
        setFirmName(d.report_firm_name ?? '')
        setBlurb(d.report_cover_blurb ?? '')
        setHasUploadedLogo(!!d.has_uploaded_logo)
      })
      .catch(() => {})
  }, [companyId, companyReady])

  useEffect(() => {
    if (!companyReady || !hasUploadedLogo) {
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return undefined
    }
    let objectUrl = null
    let cancelled = false
    ;(async () => {
      try {
        const blob = await apiClient.getBlob(`/api/analytics/company-financial/${companyId}/logo`)
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setLogoPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return objectUrl
        })
      } catch {
        if (!cancelled) {
          setLogoPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return null
          })
        }
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [companyId, companyReady, hasUploadedLogo, logoNonce])

  async function generateReport(templateId) {
    setGenerating(templateId)
    try {
      const blob = await apiClient.getBlob(`/api/reports/${companyId}/generate/${templateId}`)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${templateId}_report.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setGenerated(prev => ({ ...prev, [templateId]: true }))
      loadHistory()
    } catch (err) {
      console.error('Report generation failed:', err)
      toast.error(err?.message || 'Report generation failed')
    } finally {
      setGenerating(null)
    }
  }

  async function saveBranding() {
    if (!companyReady) return
    setSavingBrand(true)
    try {
      await apiClient.patch(`/api/analytics/company-financial/${companyId}`, {
        report_firm_name: firmName.trim() || null,
        report_cover_blurb: blurb.trim() || null,
      })
      toast.success('Report branding saved')
    } catch (e) {
      toast.error(e?.message || 'Could not save branding')
    }
    setSavingBrand(false)
  }

  async function onLogoFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !companyReady) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file (PNG, JPEG, WebP, or GIF).')
      e.target.value = ''
      return
    }
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await apiClient.postMultipart(`/api/analytics/company-financial/${companyId}/logo`, fd)
      setHasUploadedLogo(true)
      setLogoNonce((n) => n + 1)
      toast.success('Logo uploaded')
    } catch (err) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  async function removeLogo() {
    if (!companyReady) return
    try {
      await apiClient.del(`/api/analytics/company-financial/${companyId}/logo`)
      setHasUploadedLogo(false)
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      toast.success('Logo removed')
    } catch (e) {
      toast.error(e?.message || 'Could not remove logo')
    }
  }

  const readyReports = REPORT_TEMPLATES.filter(t => t.status === 'ready')
  const hasFinancialData = scoreData?.has_data === true

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Reports"
        subtitle="Generate assessment reports and advisory deliverables from qualitative and financial inputs"
        action={scoreData ? (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            DRS {scoreData.drs?.base}/100
          </span>
        ) : null}
      />

      {scoreData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'DRS Score',     value: `${scoreData.drs?.base}/100`,                                            color: 'emerald' },
            { label: 'EV Midpoint',   value: scoreData.enterprise_value ? fmtM(scoreData.enterprise_value.midpoint) : '—', color: 'blue' },
            { label: 'DRS Tier',      value: scoreData.drs?.tier ?? '—',                                              color: 'primary' },
            { label: 'Reports Ready', value: `${Object.keys(generated).length}/${REPORT_TEMPLATES.length}`,           color: 'amber'  },
          ].map(k => (
            <div key={k.label} className={cn('rounded-xl border p-3',
              k.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/5' :
              k.color === 'blue' ? 'border-blue-500/20 bg-blue-500/5' :
              k.color === 'amber' ? 'border-amber-500/20 bg-amber-500/5' :
              'border-primary/20 bg-primary/5')}>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
              <p className={cn('text-sm font-bold truncate',
                k.color === 'emerald' ? 'text-emerald-400' : k.color === 'blue' ? 'text-blue-400' :
                k.color === 'amber' ? 'text-amber-400' : 'text-primary')}>
                {k.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {companyReady && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-card-foreground">PDF branding</h3>
          <p className="text-xs text-muted-foreground">
            Firm name appears in the PDF header (defaults to Exit Blueprint). Upload your firm logo for the report header (PNG, JPEG, WebP, or GIF, up to 2&nbsp;MB). Cover blurb is used on the company profile teaser.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Firm name (header)</label>
              <input
                value={firmName}
                onChange={e => setFirmName(e.target.value)}
                placeholder="Your advisory firm"
                className="mt-1 w-full bg-muted border border-border rounded px-2 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Firm logo</label>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                className="hidden"
                onChange={onLogoFileChange}
              />
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => logoFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingLogo ? 'Uploading…' : hasUploadedLogo ? 'Replace logo' : 'Upload logo'}
                </button>
                {hasUploadedLogo && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>
              {logoPreviewUrl && (
                <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 inline-block max-w-full">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
                  <img
                    src={logoPreviewUrl}
                    alt="Firm logo preview"
                    className="max-h-16 max-w-[200px] w-auto object-contain object-left"
                  />
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Teaser cover blurb</label>
            <textarea
              value={blurb}
              onChange={e => setBlurb(e.target.value)}
              rows={3}
              placeholder="Short narrative for the one-pager…"
              className="mt-1 w-full bg-muted border border-border rounded px-2 py-1.5 text-xs resize-none text-muted-foreground placeholder:text-muted-foreground/45 focus:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <button
            type="button"
            onClick={saveBranding}
            disabled={savingBrand}
            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50"
          >
            {savingBrand ? 'Saving…' : 'Save branding'}
          </button>
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Available Reports</p>
        {!hasFinancialData && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-400">Assessment reports are ready to generate</p>
              <p className="text-xs text-blue-300/70 mt-0.5">
                The Readiness Summary and Buyer Prep reports run from qualitative inputs alone.
                Financial reports (Value Gap, EBITDA Recast, Teaser) additionally require{' '}
                <a href="/Connectors" className="underline hover:text-blue-300">uploaded data sources</a>.
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {readyReports.map(t => {
            const cl = colorMap[t.color] || colorMap.primary
            return (
              <div key={t.id} className={cn('rounded-xl border p-4', cl.border, cl.bg)}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', cl.icon)}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-semibold text-card-foreground">{t.title}</p>
                      {generated[t.id] && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.sections.map(s => (
                    <span key={s} className="text-[11px] px-1.5 py-0.5 bg-muted/50 rounded text-muted-foreground border border-border/50">{s}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => generateReport(t.id)}
                  disabled={generating === t.id || (t.requiresFinancialData && !hasFinancialData)}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 disabled:shadow-none',
                    cl.cta,
                  )}
                >
                  {generating === t.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {generating === t.id ? 'Generating…' : 'Generate PDF'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {companyReady && history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent exports</p>
          <div className="divide-y divide-border">
            {history.slice(0, 12).map((r) => (
              <div key={r.id} className="flex items-center gap-4 py-2 text-xs">
                <span className="text-card-foreground font-medium flex-1 truncate">{r.template_id.replace(/_/g, ' ')}</span>
                {r.drs_at_generation != null && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary flex-shrink-0">
                    DRS {r.drs_at_generation.toFixed(1)}
                  </span>
                )}
                {r.ev_at_generation != null && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex-shrink-0">
                    EV ~{r.ev_at_generation >= 1_000_000 ? `$${(r.ev_at_generation / 1_000_000).toFixed(1)}M` : `$${(r.ev_at_generation / 1_000).toFixed(0)}K`}
                  </span>
                )}
                <span className="text-muted-foreground font-mono text-[11px] flex-shrink-0">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
