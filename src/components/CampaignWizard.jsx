import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  X, ChevronRight, ChevronLeft, Upload, Download, FileText, Sparkles, Gift,
  Check, Loader2, Send, Clock, Globe, Users, Zap, Lock
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const STEPS = ['Name', 'Leads', 'Strategy', 'Schedule', 'Review']

const AI_LEVELS = [
  { key: 'none', icon: FileText, label: 'Template Only', desc: 'You write the emails. Simple variable substitution.', best: 'When you have a proven template', color: '#9CA3AF' },
  { key: 'full', icon: Sparkles, label: 'AI-Personalized', desc: 'AI writes personalized emails for each lead based on their website, industry, and notes.', best: 'Cold outreach to new prospects', color: '#00BFFF', recommended: true },
  { key: 'lead_magnet', icon: Gift, label: 'AI + Lead Magnet', desc: 'AI writes emails AND generates a custom AI Opportunity Brief for each lead.', best: 'High-value prospects worth extra effort', color: '#A855F7' },
]

const FRAMEWORKS = [
  { key: 'pas', label: 'Pain \u2192 Agitate \u2192 Solution', desc: 'Identify pain, amplify urgency, present solution', recommended: true },
  { key: 'case_study', label: 'Case Study Led', desc: 'Lead with results, explain how, show relevance' },
  { key: 'value_first', label: 'Value-First', desc: 'Share insight about their business, then offer help' },
]

export default function CampaignWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(0)
  const [creating, setCreating] = useState(false)

  // Step 1: Name
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Step 2: Leads
  const [leadSource, setLeadSource] = useState(null) // 'csv' | 'existing'
  const [csvFile, setCsvFile] = useState(null)
  const [csvData, setCsvData] = useState(null)
  const [csvMapping, setCsvMapping] = useState({})
  const [importedLeads, setImportedLeads] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)

  // Step 3: Strategy
  const [aiLevel, setAiLevel] = useState('full')
  const [framework, setFramework] = useState('pas')
  const [sequenceSteps, setSequenceSteps] = useState(3)
  const [stepDelays, setStepDelays] = useState(2)
  const [aiGuidance, setAiGuidance] = useState('')

  // Step 4: Schedule
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [sendStart, setSendStart] = useState(9)
  const [sendEnd, setSendEnd] = useState(17)
  const [dailyLimit, setDailyLimit] = useState(30)

  // CSV parsing
  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(l => {
        const vals = l.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row = {}
        headers.forEach((h, i) => { row[h] = vals[i] || '' })
        return row
      })

      // Auto-detect mapping
      const mapping = {}
      const fieldMap = { email: ['email', 'e-mail', 'email address'], first_name: ['first_name', 'first name', 'firstname', 'name'], last_name: ['last_name', 'last name', 'lastname', 'surname'], company_name: ['company_name', 'company', 'company name', 'organization'], job_title: ['job_title', 'title', 'job title', 'position', 'role'], website: ['website', 'url', 'web', 'site'], industry: ['industry', 'sector', 'vertical'], location: ['location', 'city', 'address'], phone: ['phone', 'telephone', 'tel', 'mobile'], notes: ['notes', 'note', 'comments'] }
      for (const [field, aliases] of Object.entries(fieldMap)) {
        const match = headers.find(h => aliases.includes(h.toLowerCase()))
        if (match) mapping[match] = field
      }

      setCsvData({ headers, rows })
      setCsvMapping(mapping)
    }
    reader.readAsText(file)
  }

  async function importCsvLeads() {
    if (!csvData) return
    setImporting(true)
    const leads = csvData.rows.map(row => {
      const lead = {}
      for (const [csvCol, field] of Object.entries(csvMapping)) {
        if (row[csvCol]) lead[field] = row[csvCol]
      }
      // Store unmapped columns in custom_data
      const custom = {}
      for (const [col, val] of Object.entries(row)) {
        if (!csvMapping[col] && val) custom[col] = val
      }
      if (Object.keys(custom).length) lead.custom_data = custom
      return lead
    }).filter(l => l.email)

    const { data, error } = await supabase.functions.invoke('hermes-api', {
      body: { action: 'leads.bulk_create', params: { leads, source: 'csv_import', source_detail: csvFile?.name, auto_enrich: aiLevel !== 'none' } },
      headers: { 'X-API-Key': localStorage.getItem('hermes_api_key') || import.meta.env.VITE_HERMES_API_KEY },
    })

    // Fallback: direct insert
    if (error) {
      for (const l of leads) {
        await supabase.from('leads').upsert(l, { onConflict: 'email' })
      }
    }

    setImportResult(data?.data || { created: leads.length, updated: 0, skipped: 0 })
    setImportedLeads(leads)
    setImporting(false)
  }

  async function downloadCsv(type) {
    const API_KEY = localStorage.getItem('hermes_api_key') || import.meta.env.VITE_HERMES_API_KEY
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hermes-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({ action: 'leads.example_csv' }),
    })
    const { data } = await resp.json()
    const content = type === 'blank' ? data.csv_blank : data.csv_example
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = type === 'blank' ? 'leads_template.csv' : 'leads_example.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCreate() {
    setCreating(true)

    // Create campaign
    const delays = Array(Math.max(sequenceSteps - 1, 0)).fill(stepDelays)
    const { data: camp, error } = await supabase.from('campaigns').insert({
      name, description, ai_level: aiLevel, campaign_type: aiLevel === 'none' ? 'manual' : 'automated',
      sequence_steps: sequenceSteps, step_delays: delays,
      from_name: fromName, from_email: fromEmail, reply_to: replyTo,
      send_window_start: sendStart, send_window_end: sendEnd, daily_send_limit: dailyLimit,
      status: aiLevel === 'none' ? 'draft' : 'ai_processing',
      agent_notes: aiGuidance ? `Framework: ${framework}. Guidance: ${aiGuidance}` : `Framework: ${framework}`,
      templates: [{ framework, guidance: aiGuidance }],
    }).select().single()

    if (!error && camp && importedLeads.length > 0) {
      // Add leads to campaign
      const { data: allLeads } = await supabase.from('leads').select('id, email').in('email', importedLeads.map(l => l.email))
      if (allLeads) {
        for (const l of allLeads) {
          await supabase.from('campaign_leads').insert({ campaign_id: camp.id, lead_id: l.id }).catch(() => {})
        }
        await supabase.from('campaigns').update({ total_leads: allLeads.length }).eq('id', camp.id)
      }
    }

    setCreating(false)
    onCreated?.()
  }

  const leadsReady = importedLeads.length > 0 || importResult
  const canNext = [
    name.trim().length > 0,
    leadsReady,
    true,
    true,
    true,
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative glass-static w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        style={{ padding: 32 }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"><X size={20} /></button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold ${
                i === step ? 'bg-[#00BFFF]/20 text-[#00BFFF] border border-[#00BFFF]/30' :
                i < step ? 'bg-[#00E676]/20 text-[#00E676]' :
                'bg-white/[0.04] text-white/30'
              }`}>{i < step ? <Check size={12} /> : i + 1}</div>
              <span className={`text-[12px] font-mono ${i === step ? 'text-white/70' : 'text-white/30'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Step 1: Name */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-heading font-bold text-white">Name Your Campaign</h2>
            <div>
              <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Campaign Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Q2 Dental Outreach — Vancouver"
                className="w-full px-4 py-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#00BFFF]/30 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Description (optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Cold outreach to mid-size dental practices in Vancouver"
                className="w-full h-20 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#00BFFF]/30 resize-none transition-all" />
            </div>
          </div>
        )}

        {/* Step 2: Leads */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-heading font-bold text-white">Add Your Leads</h2>

            {!leadSource ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => setLeadSource('csv')} className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-[#00BFFF]/20 hover:bg-[#00BFFF]/5 transition-all text-left group">
                  <Upload size={24} className="text-[#00BFFF] mb-3" />
                  <p className="text-base font-body font-semibold text-white/90">Upload CSV</p>
                  <p className="text-sm font-body text-white/40 mt-1">Import leads from a spreadsheet</p>
                </button>
                <button onClick={() => setLeadSource('existing')} className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-[#00E676]/20 hover:bg-[#00E676]/5 transition-all text-left group">
                  <Users size={24} className="text-[#00E676] mb-3" />
                  <p className="text-base font-body font-semibold text-white/90">Use Existing Leads</p>
                  <p className="text-sm font-body text-white/40 mt-1">Select from your lead database</p>
                </button>
              </div>
            ) : leadSource === 'csv' ? (
              <div className="space-y-4">
                {/* Download templates */}
                <div className="flex gap-2">
                  <button onClick={() => downloadCsv('blank')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm font-mono text-white/50 hover:text-white/70 transition-all">
                    <Download size={14} /> Blank Template
                  </button>
                  <button onClick={() => downloadCsv('example')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00BFFF]/10 border border-[#00BFFF]/20 text-sm font-mono text-[#00BFFF] hover:bg-[#00BFFF]/20 transition-all">
                    <Download size={14} /> Example with Data
                  </button>
                </div>

                {/* Upload zone */}
                {!csvData ? (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center cursor-pointer hover:border-[#00BFFF]/30 hover:bg-[#00BFFF]/5 transition-all"
                  >
                    <Upload size={32} className="text-white/20 mx-auto mb-3" />
                    <p className="text-base font-body text-white/50">Drop your CSV here or click to browse</p>
                    <p className="text-sm font-mono text-white/25 mt-1">Max 10MB, .csv format</p>
                    <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-mono text-[#00E676]">{csvFile?.name} — {csvData.rows.length} leads found</p>

                    {/* Column mapping */}
                    <div>
                      <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider mb-2">Column Mapping</p>
                      <div className="grid grid-cols-2 gap-2">
                        {csvData.headers.map(h => (
                          <div key={h} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
                            <span className="text-xs font-mono text-white/40 min-w-[80px] truncate">{h}</span>
                            <span className="text-white/20">\u2192</span>
                            <select
                              value={csvMapping[h] || ''}
                              onChange={e => setCsvMapping(prev => ({ ...prev, [h]: e.target.value || undefined }))}
                              className="flex-1 px-2 py-1 rounded bg-white/[0.03] border border-white/[0.06] text-xs font-mono text-white/60 focus:outline-none"
                            >
                              <option value="">Skip</option>
                              {['email', 'first_name', 'last_name', 'company_name', 'job_title', 'website', 'industry', 'location', 'phone', 'notes'].map(f => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                      <table className="w-full text-xs font-mono">
                        <thead><tr className="bg-white/[0.03]">
                          {Object.values(csvMapping).filter(Boolean).map(f => <th key={f} className="px-3 py-2 text-left text-white/40">{f}</th>)}
                        </tr></thead>
                        <tbody>
                          {csvData.rows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-t border-white/[0.04]">
                              {Object.entries(csvMapping).filter(([,f]) => f).map(([col]) => (
                                <td key={col} className="px-3 py-2 text-white/50 truncate max-w-[150px]">{row[col]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-sm font-mono">
                      <span className="text-white/50">{csvData.rows.filter(r => r[Object.keys(csvMapping).find(k => csvMapping[k] === 'email')]).length} with email</span>
                      <span className="text-[#00BFFF]/50">{csvData.rows.filter(r => r[Object.keys(csvMapping).find(k => csvMapping[k] === 'website')]).length} with website</span>
                    </div>

                    {/* Import button */}
                    {!importResult ? (
                      <button onClick={importCsvLeads} disabled={importing}
                        className="w-full py-4 rounded-xl bg-[#00BFFF]/10 text-[#00BFFF] border border-[#00BFFF]/20 text-base font-mono font-semibold hover:bg-[#00BFFF]/20 transition-all disabled:opacity-50">
                        {importing ? <Loader2 size={18} className="animate-spin inline mr-2" /> : <Upload size={18} className="inline mr-2" />}
                        {importing ? 'Importing...' : `Import ${csvData.rows.length} leads`}
                      </button>
                    ) : (
                      <div className="p-4 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20">
                        <p className="text-sm font-mono text-[#00E676]">
                          Imported: {importResult.created} new, {importResult.updated} updated, {importResult.skipped} skipped
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button onClick={() => { setLeadSource(null); setCsvData(null); setCsvFile(null) }} className="text-sm font-mono text-white/30 hover:text-white/50">\u2190 Back to options</button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm font-mono text-white/40">Existing lead selector coming soon. Use CSV upload for now.</p>
                <button onClick={() => setLeadSource(null)} className="text-sm font-mono text-[#00BFFF] mt-2">\u2190 Back</button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Strategy */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-heading font-bold text-white">Email Strategy</h2>

            {/* AI Level cards */}
            <div className="space-y-3">
              {AI_LEVELS.map(lvl => (
                <button key={lvl.key} onClick={() => setAiLevel(lvl.key)}
                  className={`w-full text-left p-5 rounded-xl border transition-all ${
                    aiLevel === lvl.key ? `bg-[${lvl.color}]/10 border-[${lvl.color}]/20` : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                  style={aiLevel === lvl.key ? { background: `${lvl.color}15`, borderColor: `${lvl.color}33` } : {}}>
                  <div className="flex items-center gap-3 mb-2">
                    <lvl.icon size={20} style={{ color: aiLevel === lvl.key ? lvl.color : 'rgba(255,255,255,0.3)' }} />
                    <span className="text-base font-body font-semibold text-white/90">{lvl.label}</span>
                    {lvl.recommended && <span className="px-2 py-0.5 rounded text-[10px] font-mono text-[#00BFFF] bg-[#00BFFF]/10 border border-[#00BFFF]/20">RECOMMENDED</span>}
                  </div>
                  <p className="text-sm font-body text-white/50 ml-8">{lvl.desc}</p>
                  <p className="text-[12px] font-mono text-white/25 ml-8 mt-1">Best for: {lvl.best}</p>
                </button>
              ))}
            </div>

            {aiLevel !== 'none' && (
              <>
                {/* Framework */}
                <div>
                  <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-3">Email Framework</label>
                  <div className="space-y-2">
                    {FRAMEWORKS.map(f => (
                      <button key={f.key} onClick={() => setFramework(f.key)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${framework === f.key ? 'bg-[#00BFFF]/5 border-[#00BFFF]/20' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${framework === f.key ? 'border-[#00BFFF]' : 'border-white/20'}`}>
                            {framework === f.key && <div className="w-2 h-2 rounded-full bg-[#00BFFF]" />}
                          </div>
                          <span className="text-sm font-body font-medium text-white/80">{f.label}</span>
                          {f.recommended && <span className="text-[10px] font-mono text-[#00BFFF]/50">recommended</span>}
                        </div>
                        <p className="text-[12px] font-body text-white/30 ml-6 mt-1">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Guidance */}
                <div>
                  <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">What should the emails focus on?</label>
                  <textarea value={aiGuidance} onChange={e => setAiGuidance(e.target.value)}
                    placeholder="Focus on how AI can reduce their customer service costs. Use the dental clinic and medical testing case studies. Emphasize 6-week delivery timeline."
                    className="w-full h-24 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm font-body text-white/70 placeholder:text-white/25 focus:outline-none focus:border-[#00BFFF]/30 resize-y transition-all leading-relaxed" />
                </div>
              </>
            )}

            {/* Sequence config */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Emails in sequence</label>
                <input type="number" min={1} max={5} value={sequenceSteps} onChange={e => setSequenceSteps(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-mono text-white/80 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Days between emails</label>
                <input type="number" min={1} max={7} value={stepDelays} onChange={e => setStepDelays(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-mono text-white/80 focus:outline-none" />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-heading font-bold text-white">Schedule & Send</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">From Name</label>
                <input value={fromName} onChange={e => setFromName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">From Email</label>
                <input value={fromEmail} onChange={e => setFromEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm font-mono text-white/60 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Reply To</label>
                <input value={replyTo} onChange={e => setReplyTo(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm font-mono text-white/60 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Daily Send Limit</label>
                <input type="number" value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-mono text-white/80 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Send Window Start</label>
                <select value={sendStart} onChange={e => setSendStart(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-mono text-white/80 focus:outline-none">
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Send Window End</label>
                <select value={sendEnd} onChange={e => setSendEnd(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-mono text-white/80 focus:outline-none">
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-heading font-bold text-white">Review & Create</h2>
            <div className="glass-static p-6 space-y-4">
              {[
                { label: 'Campaign', value: name },
                { label: 'Leads', value: `${importedLeads.length || importResult?.created || 0} leads` },
                { label: 'AI Level', value: AI_LEVELS.find(l => l.key === aiLevel)?.label },
                { label: 'Framework', value: FRAMEWORKS.find(f => f.key === framework)?.label },
                { label: 'Sequence', value: `${sequenceSteps} emails, ${stepDelays} days between` },
                { label: 'From', value: `${fromName} <${fromEmail}>` },
                { label: 'Send Window', value: `${sendStart}:00 - ${sendEnd}:00, max ${dailyLimit}/day` },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <span className="text-sm font-mono text-white/40">{r.label}</span>
                  <span className="text-sm font-body text-white/80">{r.value}</span>
                </div>
              ))}
            </div>

            {aiLevel !== 'none' && (
              <div className="p-4 rounded-xl bg-[#00BFFF]/5 border border-[#00BFFF]/20">
                <p className="text-sm font-body text-[#00BFFF]/80">
                  <Sparkles size={14} className="inline mr-1" />
                  After creation, the AI will prepare personalized emails for each lead. You'll be notified when they're ready for review (usually 15-30 minutes).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
          <button onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono text-white/50 hover:text-white/70 transition-colors">
            <ChevronLeft size={16} /> {step > 0 ? 'Back' : 'Cancel'}
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext[step]}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00BFFF]/10 text-[#00BFFF] border border-[#00BFFF]/20 text-sm font-mono font-semibold hover:bg-[#00BFFF]/20 transition-all disabled:opacity-30">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={creating}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-sm font-mono font-semibold hover:bg-[#00E676]/20 transition-all disabled:opacity-50">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {creating ? 'Creating...' : 'Create Campaign'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
