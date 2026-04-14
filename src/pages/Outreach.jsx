import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Mail, Users, BarChart3, Lightbulb, Settings, Target,
  Plus, Play, Pause, ChevronRight, TrendingUp, Send,
  UserPlus, Globe, Zap, Eye, MousePointer, Reply, Calendar, Heart, Clock
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import CampaignWizard from '../components/CampaignWizard'
import ICPCampaignWizard from '../components/ICPCampaignWizard'

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'campaigns', label: 'Campaigns', icon: Send },
  { key: 'nurture', label: 'Nurture', icon: Heart },
  { key: 'leads', label: 'Leads', icon: Users },
  { key: 'icps', label: 'ICPs', icon: Target },
  { key: 'insights', label: 'Insights', icon: Lightbulb },
]

const STATUS_COLORS = {
  draft: { bg: 'bg-white/[0.06]', text: 'text-white/50', label: 'Draft' },
  ai_processing: { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', label: 'AI Processing' },
  ready_for_review: { bg: 'bg-[#00BFFF]/10', text: 'text-[#00BFFF]', label: 'Ready for Review' },
  active: { bg: 'bg-[#00E676]/10', text: 'text-[#00E676]', label: 'Active' },
  paused: { bg: 'bg-[#FF6B35]/10', text: 'text-[#FF6B35]', label: 'Paused' },
  completed: { bg: 'bg-[#A855F7]/10', text: 'text-[#A855F7]', label: 'Completed' },
  cancelled: { bg: 'bg-[#FF3D00]/10', text: 'text-[#FF3D00]', label: 'Cancelled' },
}

export default function Outreach() {
  const [tab, setTab] = useState('dashboard')
  const [campaigns, setCampaigns] = useState([])
  const [leads, setLeads] = useState([])
  const [icps, setIcps] = useState([])
  const [insights, setInsights] = useState([])
  const [nurtureSeqs, setNurtureSeqs] = useState([])
  const [nurtureEmails, setNurtureEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [showICPWizard, setShowICPWizard] = useState(false)

  useEffect(() => {
    async function load() {
      const [campRes, leadRes, icpRes, insightRes, nurtureRes, nurtureEmailRes] = await Promise.all([
        supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
        supabase.from('leads').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(50),
        supabase.from('icps').select('*').order('created_at', { ascending: false }),
        supabase.from('outreach_insights').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('nurture_sequences').select('*').order('meeting_time', { ascending: true }),
        supabase.from('nurture_emails').select('*').order('scheduled_at', { ascending: true }),
      ])
      setCampaigns(campRes.data || [])
      setLeads(leadRes.data || [])
      setIcps(icpRes.data || [])
      setInsights(insightRes.data || [])
      setNurtureSeqs(nurtureRes.data || [])
      setNurtureEmails(nurtureEmailRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const activeCampaigns = campaigns.filter(c => c.status === 'active')
  const totalSent = campaigns.reduce((s, c) => s + (c.total_sent || 0), 0)
  const totalOpened = campaigns.reduce((s, c) => s + (c.total_opened || 0), 0)
  const totalReplied = campaigns.reduce((s, c) => s + (c.total_replied || 0), 0)
  const totalBooked = campaigns.reduce((s, c) => s + (c.total_booked || 0), 0)
  const openRate = totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(1) : '0'
  const replyRate = totalSent > 0 ? (totalReplied / totalSent * 100).toFixed(1) : '0'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-12 h-12 border-2 border-[#00BFFF]/30 border-t-[#00BFFF] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-5xl font-heading font-bold tracking-wide text-white leading-tight neon-text">Outreach</h1>
        <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#00E676] to-transparent" />
        <p className="mt-4 text-[15px] font-body text-white/50">AI-powered outreach engine</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-mono font-medium transition-all duration-150 border ${
              tab === t.key
                ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20'
                : 'text-white/50 border-white/[0.08] hover:text-white/70 bg-white/[0.02]'
            }`}
          >
            <t.icon size={16} strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Leads', value: leads.length, icon: Users, color: '#00BFFF' },
              { label: 'Campaigns', value: campaigns.length, icon: Send, color: '#A855F7' },
              { label: 'Active', value: activeCampaigns.length, icon: Play, color: '#00E676' },
              { label: 'Sent', value: totalSent, icon: Mail, color: '#FF6B35' },
              { label: 'Open %', value: `${openRate}%`, icon: Eye, color: '#F59E0B' },
              { label: 'Reply %', value: `${replyRate}%`, icon: Reply, color: '#14B8A6' },
            ].map(s => (
              <div key={s.label} className="glass-static p-5">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon size={14} style={{ color: s.color }} strokeWidth={1.5} />
                  <span className="text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase">{s.label}</span>
                </div>
                <p className="text-3xl font-heading font-bold text-white" style={{ textShadow: `0 0 20px ${s.color}30` }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Active Campaigns */}
          <div className="glass-static" style={{ padding: 32 }}>
            <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-6">Active Campaigns</h3>
            {activeCampaigns.length === 0 ? (
              <p className="text-sm font-body text-white/40 text-center py-8">No active campaigns. Create one in the Campaigns tab.</p>
            ) : (
              <div className="space-y-3">
                {activeCampaigns.map(c => {
                  const sent = c.total_sent || 0
                  const total = c.total_leads || 1
                  const pct = Math.round(sent / total * 100)
                  return (
                    <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-body font-semibold text-white/90">{c.name}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-[13px] font-mono text-white/40">{sent}/{total} sent</span>
                          {sent > 0 && <span className="text-[13px] font-mono text-[#00E676]/60">{((c.total_opened || 0)/sent*100).toFixed(0)}% open</span>}
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#00E676] to-[#00BFFF]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Insights */}
          {insights.length > 0 && (
            <div className="glass-static" style={{ padding: 32 }}>
              <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-6">Agent Insights</h3>
              <div className="space-y-3">
                {insights.slice(0, 5).map(i => (
                  <div key={i.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20">{i.insight_type}</span>
                      {i.confidence && <span className="text-[11px] font-mono text-white/30">{i.confidence}% confidence</span>}
                    </div>
                    <p className="text-sm font-body text-white/70 leading-relaxed">{i.finding}</p>
                    {i.action_taken && <p className="text-sm font-mono text-[#00E676]/50 mt-1">Action: {i.action_taken}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CAMPAIGNS TAB ── */}
      {tab === 'campaigns' && (
        <div className="space-y-6">
          {/* Pipeline view */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {['draft', 'ai_processing', 'ready_for_review', 'active', 'paused', 'completed'].map(status => {
              const count = campaigns.filter(c => c.status === status).length
              const colors = { draft: '#9CA3AF', ai_processing: '#F59E0B', ready_for_review: '#00BFFF', active: '#00E676', paused: '#FF6B35', completed: '#A855F7' }
              return (
                <div key={status} className="flex-shrink-0 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] min-w-[140px]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: colors[status] }} />
                    <span className="text-[11px] font-mono text-white/40 uppercase">{status.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-2xl font-heading font-bold text-white">{count}</span>
                </div>
              )
            })}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => setShowWizard(true)}
              className="flex items-center justify-center gap-3 py-5 rounded-xl bg-[#00BFFF]/10 text-[#00BFFF] border border-[#00BFFF]/20 text-base font-mono font-semibold hover:bg-[#00BFFF]/20 transition-all">
              <Plus size={20} /> Create Campaign
            </button>
            <button onClick={() => setShowICPWizard(true)}
              className="flex items-center justify-center gap-3 py-5 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-base font-mono font-semibold hover:bg-[#00E676]/20 transition-all">
              <Target size={20} /> Find Leads + Auto Campaign
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="text-center py-12 glass-static rounded-xl">
              <Send size={40} className="text-white/15 mx-auto mb-4" strokeWidth={1} />
              <p className="font-mono text-base text-white/40 mb-2">No campaigns yet</p>
              <p className="font-body text-sm text-white/25">Click "Create New Campaign" to get started</p>
            </div>
          ) : (
            campaigns.map((c, i) => {
              const st = STATUS_COLORS[c.status] || STATUS_COLORS.draft
              return (
                <Link to={`/outreach/campaign/${c.id}`} key={c.id}>
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="flex items-center gap-5 p-6 glass-static hover:bg-white/[0.01] cursor-pointer transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-[17px] font-body font-semibold text-white">{c.name}</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase border ${st.bg} ${st.text}`}>{st.label}</span>
                      <span className="text-[11px] font-mono text-white/30">{c.ai_level} AI</span>
                    </div>
                    {c.description && <p className="text-sm font-body text-white/50 mb-2">{c.description}</p>}
                    <div className="flex items-center gap-6 text-[13px] font-mono text-white/40">
                      <span>{c.total_leads || 0} leads</span>
                      <span>{c.total_sent || 0} sent</span>
                      <span>{c.sequence_steps || 1} steps</span>
                      {c.total_sent > 0 && <span className="text-[#00E676]/60">{((c.total_opened || 0) / c.total_sent * 100).toFixed(0)}% open</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-mono text-white/30">
                      {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </motion.div>
                </Link>
              )
            })
          )}
        </div>
      )}

      {/* ── LEADS TAB ── */}
      {/* ── NURTURE TAB ── */}
      {tab === 'nurture' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Active', value: nurtureSeqs.filter(s => s.status === 'active').length, color: '#00E676' },
              { label: 'Completed', value: nurtureSeqs.filter(s => s.status === 'completed').length, color: '#00BFFF' },
              { label: 'Emails Sent', value: nurtureEmails.filter(e => e.status === 'sent').length, color: '#FF6B35' },
              { label: 'Queued', value: nurtureEmails.filter(e => e.status === 'scheduled').length, color: '#A855F7' },
              { label: 'Open Rate', value: (() => { const sent = nurtureEmails.filter(e => e.status === 'sent'); const opened = sent.filter(e => e.open_count > 0); return sent.length > 0 ? `${(opened.length / sent.length * 100).toFixed(0)}%` : '0%' })(), color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} className="glass-static p-5">
                <span className="text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase">{s.label}</span>
                <p className="text-3xl font-heading font-bold text-white mt-1" style={{ textShadow: `0 0 20px ${s.color}30` }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Active Sequences */}
          <div className="glass-static" style={{ padding: 32 }}>
            <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-6">Active Sequences</h3>
            {nurtureSeqs.filter(s => s.status === 'active').length === 0 ? (
              <p className="text-sm font-body text-white/40 text-center py-8">No active nurture sequences. Sequences are created automatically when someone books a discovery call via Cal.com.</p>
            ) : (
              <div className="space-y-3">
                {nurtureSeqs.filter(s => s.status === 'active').map(seq => {
                  const seqEmails = nurtureEmails.filter(e => e.sequence_id === seq.id)
                  const sent = seqEmails.filter(e => e.status === 'sent').length
                  const total = seq.emails_planned || seqEmails.length
                  const pct = total > 0 ? Math.round(sent / total * 100) : 0
                  const mtg = new Date(seq.meeting_time)
                  const hoursUntil = Math.max(0, (mtg.getTime() - Date.now()) / 3600000)
                  const countdown = hoursUntil > 48 ? `in ${Math.round(hoursUntil / 24)}d` : hoursUntil > 2 ? `in ${Math.round(hoursUntil)}h` : 'soon'

                  return (
                    <div key={seq.id} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-base font-body font-semibold text-white/90">{seq.prospect_name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {seq.prospect_company && <span className="text-[13px] font-mono text-white/50">{seq.prospect_company}</span>}
                            <span className="text-[13px] font-mono text-white/40">{seq.prospect_email}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-[#00BFFF]">
                            <Calendar size={14} />
                            <span className="text-sm font-mono">{countdown}</span>
                          </div>
                          <span className="text-[11px] font-mono text-white/30">{mtg.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#00E676] to-[#00BFFF]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-mono text-white/30">{sent}/{total} sent</span>
                      </div>

                      {/* Email type badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {seqEmails.map(e => (
                          <span key={e.id} className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider ${
                            e.status === 'sent' ? 'text-[#00E676] bg-[#00E676]/10' :
                            e.status === 'scheduled' ? 'text-white/40 bg-white/[0.04]' :
                            'text-white/20 bg-white/[0.02] line-through'
                          }`}>
                            {e.email_type}
                          </span>
                        ))}
                      </div>

                      {seq.prospect_notes && (
                        <p className="text-[13px] font-body text-white/30 mt-2 italic">"{seq.prospect_notes}"</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upcoming Emails */}
          {nurtureEmails.filter(e => e.status === 'scheduled').length > 0 && (
            <div className="glass-static" style={{ padding: 32 }}>
              <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-6">Upcoming Emails</h3>
              <div className="space-y-2">
                {nurtureEmails.filter(e => e.status === 'scheduled').slice(0, 10).map(e => {
                  const seq = nurtureSeqs.find(s => s.id === e.sequence_id)
                  return (
                    <div key={e.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                      <div className="w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-body text-white/70">{seq?.prospect_name || 'Unknown'}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/40 bg-white/[0.04]">{e.email_type}</span>
                        </div>
                        {e.subject && <p className="text-[13px] font-mono text-white/30 mt-0.5 truncate">{e.subject}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 text-[13px] font-mono text-white/30 flex-shrink-0">
                        <Clock size={12} />
                        {new Date(e.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Completed */}
          {nurtureSeqs.filter(s => s.status === 'completed').length > 0 && (
            <div className="glass-static" style={{ padding: 32 }}>
              <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-6">Completed Sequences</h3>
              <div className="space-y-2">
                {nurtureSeqs.filter(s => s.status === 'completed').map(seq => (
                  <div key={seq.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.01]">
                    <div className="w-2 h-2 rounded-full bg-[#00E676] flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-body text-white/60">{seq.prospect_name}</span>
                      {seq.prospect_company && <span className="text-[13px] font-mono text-white/30 ml-2">{seq.prospect_company}</span>}
                    </div>
                    <span className="text-[13px] font-mono text-white/30">{seq.emails_sent}/{seq.emails_planned} emails</span>
                    <span className="text-[13px] font-mono text-white/20">{new Date(seq.meeting_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'leads' && (
        <div className="space-y-4">
          {leads.length === 0 ? (
            <div className="text-center py-20 glass-static rounded-xl">
              <Users size={40} className="text-white/15 mx-auto mb-4" strokeWidth={1} />
              <p className="font-mono text-base text-white/40 mb-2">No leads yet</p>
              <p className="font-body text-sm text-white/25">Import via CSV, scraper, or API</p>
            </div>
          ) : (
            <div className="glass-static overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Name', 'Email', 'Company', 'Title', 'Source', 'Status'].map(h => (
                        <th key={h} className="text-left px-5 py-4 text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(l => (
                      <tr key={l.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4 text-sm font-body text-white/80">{l.first_name} {l.last_name}</td>
                        <td className="px-5 py-4 text-sm font-mono text-white/50">{l.email}</td>
                        <td className="px-5 py-4 text-sm font-body text-white/60">{l.company_name || '—'}</td>
                        <td className="px-5 py-4 text-sm font-body text-white/50">{l.job_title || '—'}</td>
                        <td className="px-5 py-4"><span className="text-[11px] font-mono text-white/40 bg-white/[0.04] px-2 py-0.5 rounded">{l.source}</span></td>
                        <td className="px-5 py-4"><span className={`text-[11px] font-mono tracking-wider uppercase px-2 py-0.5 rounded ${
                          l.status === 'new' ? 'text-[#00BFFF] bg-[#00BFFF]/10' :
                          l.status === 'contacted' ? 'text-[#FF6B35] bg-[#FF6B35]/10' :
                          l.status === 'opened' ? 'text-[#F59E0B] bg-[#F59E0B]/10' :
                          l.status === 'replied' ? 'text-[#00E676] bg-[#00E676]/10' :
                          'text-white/40 bg-white/[0.04]'
                        }`}>{l.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ICPS TAB ── */}
      {tab === 'icps' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {icps.length === 0 ? (
            <div className="col-span-full text-center py-20 glass-static rounded-xl">
              <Target size={40} className="text-white/15 mx-auto mb-4" strokeWidth={1} />
              <p className="font-mono text-base text-white/40 mb-2">No ICPs defined yet</p>
              <p className="font-body text-sm text-white/25">Create ideal customer profiles via the API</p>
            </div>
          ) : (
            icps.map(icp => (
              <div key={icp.id} className="glass-static p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-body font-semibold text-white/90">{icp.name}</h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${icp.is_active ? 'text-[#00E676] bg-[#00E676]/10' : 'text-white/30 bg-white/[0.04]'}`}>
                    {icp.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {icp.description && <p className="text-sm font-body text-white/50 mb-3">{icp.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {(icp.industry_verticals || []).map(v => (
                    <span key={v} className="px-2 py-0.5 rounded text-[10px] font-mono text-[#00BFFF]/70 bg-[#00BFFF]/10">{v}</span>
                  ))}
                  {(icp.geographies || []).map(g => (
                    <span key={g} className="px-2 py-0.5 rounded text-[10px] font-mono text-[#A855F7]/70 bg-[#A855F7]/10">{g}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── INSIGHTS TAB ── */}
      {tab === 'insights' && (
        <div className="space-y-3">
          {insights.length === 0 ? (
            <div className="text-center py-20 glass-static rounded-xl">
              <Lightbulb size={40} className="text-white/15 mx-auto mb-4" strokeWidth={1} />
              <p className="font-mono text-base text-white/40 mb-2">No insights yet</p>
              <p className="font-body text-sm text-white/25">The agent will log learnings as campaigns run</p>
            </div>
          ) : (
            insights.map((i, idx) => (
              <motion.div
                key={i.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}
                className="glass-static p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20">{i.insight_type}</span>
                  {i.confidence && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${i.confidence}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-white/30">{i.confidence}%</span>
                    </div>
                  )}
                  <span className="text-[11px] font-mono text-white/20 ml-auto">
                    {new Date(i.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-base font-body text-white/70 leading-relaxed">{i.finding}</p>
                {i.action_taken && (
                  <p className="text-sm font-mono text-[#00E676]/60 mt-2 flex items-center gap-2">
                    <Zap size={12} /> {i.action_taken}
                  </p>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}
      {/* Campaign Wizard Modal */}
      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); window.location.reload() }}
        />
      )}

      {/* ICP + Scrape + Campaign Wizard */}
      {showICPWizard && (
        <ICPCampaignWizard
          onClose={() => setShowICPWizard(false)}
          onCreated={() => { setShowICPWizard(false); window.location.reload() }}
        />
      )}
    </motion.div>
  )
}
