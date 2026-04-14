import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Send, Play, Pause, Users, Mail, Eye, MousePointer,
  Reply, AlertTriangle, CheckCircle, Clock, Zap, Sparkles, Edit3
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const STATUS_STYLES = {
  draft: { color: '#9CA3AF', label: 'Draft' },
  ai_processing: { color: '#F59E0B', label: 'AI Processing' },
  ready_for_review: { color: '#00BFFF', label: 'Ready for Review' },
  active: { color: '#00E676', label: 'Active' },
  paused: { color: '#FF6B35', label: 'Paused' },
  completed: { color: '#A855F7', label: 'Completed' },
  cancelled: { color: '#FF3D00', label: 'Cancelled' },
}

export default function CampaignDetail() {
  const { id } = useParams()
  const [campaign, setCampaign] = useState(null)
  const [leads, setLeads] = useState([])
  const [sends, setSends] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const [campRes, leadsRes, sendsRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).single(),
      supabase.from('campaign_leads').select('*, leads(first_name, last_name, email, company_name, status)').eq('campaign_id', id).limit(50),
      supabase.from('email_sends').select('*').eq('campaign_id', id).order('sent_at', { ascending: false }).limit(50),
    ])
    setCampaign(campRes.data)
    setLeads(leadsRes.data || [])
    setSends(sendsRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleLaunch() {
    await supabase.from('campaigns').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function handlePause() {
    await supabase.from('campaigns').update({ status: 'paused' }).eq('id', id)
    load()
  }

  async function handleResume() {
    await supabase.from('campaigns').update({ status: 'active' }).eq('id', id)
    load()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-12 h-12 border-2 border-[#00BFFF]/30 border-t-[#00BFFF] rounded-full animate-spin" /></div>
  }

  if (!campaign) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-base text-white/50">Campaign not found</p>
        <Link to="/outreach" className="text-[#00BFFF] text-sm mt-4 inline-block hover:underline">Back to outreach</Link>
      </div>
    )
  }

  const st = STATUS_STYLES[campaign.status] || STATUS_STYLES.draft
  const sent = campaign.total_sent || 0
  const rates = sent > 0 ? {
    open: ((campaign.total_opened || 0) / sent * 100).toFixed(1),
    click: ((campaign.total_clicked || 0) / sent * 100).toFixed(1),
    reply: ((campaign.total_replied || 0) / sent * 100).toFixed(1),
    bounce: ((campaign.total_bounced || 0) / sent * 100).toFixed(1),
  } : { open: '0', click: '0', reply: '0', bounce: '0' }

  const isReview = campaign.status === 'ready_for_review'
  const isActive = campaign.status === 'active'
  const isPaused = campaign.status === 'paused'
  const isProcessing = campaign.status === 'ai_processing'

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="max-w-[1200px] mx-auto space-y-8">
      <Link to="/outreach" className="inline-flex items-center gap-2 text-sm font-mono text-white/50 hover:text-[#00BFFF] transition-colors">
        <ArrowLeft size={16} /> Back to outreach
      </Link>

      {/* Header */}
      <div className="glass-static" style={{ padding: 40 }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-lg text-[11px] font-mono tracking-[0.2em] font-semibold border"
                style={{ color: st.color, background: `${st.color}15`, borderColor: `${st.color}33` }}>
                {st.label}
              </span>
              <span className="text-[11px] font-mono text-white/30">{campaign.ai_level} AI</span>
              <span className="text-[11px] font-mono text-white/30">{campaign.sequence_steps} steps</span>
            </div>
            <h1 className="text-3xl font-heading font-bold text-white leading-tight">{campaign.name}</h1>
            {campaign.description && <p className="text-base font-body text-white/50 mt-2">{campaign.description}</p>}
          </div>
          <div className="flex gap-2">
            {isReview && (
              <button onClick={handleLaunch} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-sm font-mono font-semibold hover:bg-[#00E676]/20 transition-all">
                <Play size={16} /> Approve & Launch
              </button>
            )}
            {isActive && (
              <button onClick={handlePause} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/20 text-sm font-mono font-semibold hover:bg-[#FF6B35]/20 transition-all">
                <Pause size={16} /> Pause
              </button>
            )}
            {isPaused && (
              <button onClick={handleResume} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-sm font-mono font-semibold hover:bg-[#00E676]/20 transition-all">
                <Play size={16} /> Resume
              </button>
            )}
          </div>
        </div>

        {/* Review banner */}
        {isReview && (
          <div className="p-5 rounded-xl bg-[#00BFFF]/5 border border-[#00BFFF]/20 mb-6">
            <div className="flex items-center gap-2 text-[#00BFFF] mb-2">
              <Sparkles size={18} />
              <span className="text-base font-body font-semibold">Your campaign is ready for review</span>
            </div>
            {campaign.agent_notes && <p className="text-sm font-body text-white/50 ml-7">{campaign.agent_notes}</p>}
          </div>
        )}

        {/* Processing banner */}
        {isProcessing && (
          <div className="p-5 rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/20 mb-6">
            <div className="flex items-center gap-2 text-[#F59E0B] mb-2">
              <Zap size={18} className="animate-pulse" />
              <span className="text-base font-body font-semibold">AI is preparing personalized emails...</span>
            </div>
            <p className="text-sm font-body text-white/40 ml-7">This usually takes 15-30 minutes. You'll be notified when it's ready.</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
          {[
            { label: 'Leads', value: campaign.total_leads || 0, icon: Users, color: '#00BFFF' },
            { label: 'Sent', value: sent, icon: Send, color: '#FF6B35' },
            { label: 'Delivered', value: campaign.total_delivered || 0, icon: CheckCircle, color: '#00E676' },
            { label: 'Opened', value: campaign.total_opened || 0, icon: Eye, color: '#F59E0B' },
            { label: 'Clicked', value: campaign.total_clicked || 0, icon: MousePointer, color: '#A855F7' },
            { label: 'Replied', value: campaign.total_replied || 0, icon: Reply, color: '#14B8A6' },
            { label: 'Bounced', value: campaign.total_bounced || 0, icon: AlertTriangle, color: '#FF3D00' },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
              <s.icon size={16} className="mx-auto mb-2" style={{ color: s.color }} strokeWidth={1.5} />
              <p className="text-xl font-heading font-bold text-white">{s.value}</p>
              <p className="text-[10px] font-mono text-white/30 uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rates */}
        {sent > 0 && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-white/[0.06]">
            {[
              { label: 'Open Rate', value: `${rates.open}%`, color: '#F59E0B' },
              { label: 'Click Rate', value: `${rates.click}%`, color: '#A855F7' },
              { label: 'Reply Rate', value: `${rates.reply}%`, color: '#14B8A6' },
              { label: 'Bounce Rate', value: `${rates.bounce}%`, color: '#FF3D00' },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold" style={{ color: r.color }}>{r.value}</span>
                <span className="text-[11px] font-mono text-white/30">{r.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Config details */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/[0.06] text-sm font-mono text-white/40">
          <span>From: {campaign.from_name} &lt;{campaign.from_email}&gt;</span>
          <span>Reply: {campaign.reply_to}</span>
          <span>Window: {campaign.send_window_start}:00–{campaign.send_window_end}:00</span>
          <span>Limit: {campaign.daily_send_limit}/day</span>
        </div>
      </div>

      {/* Agent Notes */}
      {campaign.agent_notes && (
        <div className="glass-static" style={{ padding: 32 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center">
              <Sparkles size={16} className="text-[#A855F7]" />
            </div>
            <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase">Agent Notes</h3>
          </div>
          <p className="text-base font-body text-white/60 leading-relaxed whitespace-pre-wrap">{campaign.agent_notes}</p>
        </div>
      )}

      {/* Leads */}
      <div className="glass-static" style={{ padding: 32 }}>
        <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-6">Campaign Leads ({leads.length})</h3>
        {leads.length === 0 ? (
          <p className="text-sm font-mono text-white/30 text-center py-8">No leads in this campaign</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Name', 'Email', 'Company', 'Step', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(cl => {
                  const lead = cl.leads || {}
                  return (
                    <tr key={cl.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-sm font-body text-white/70">{lead.first_name} {lead.last_name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-white/40">{lead.email}</td>
                      <td className="px-4 py-3 text-sm font-body text-white/50">{lead.company_name || '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-white/40">{cl.current_step || 0}/{campaign.sequence_steps}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-mono tracking-wider uppercase px-2 py-0.5 rounded ${
                          cl.status === 'active' ? 'text-[#00E676] bg-[#00E676]/10' :
                          cl.status === 'replied' ? 'text-[#14B8A6] bg-[#14B8A6]/10' :
                          cl.status === 'bounced' ? 'text-[#FF3D00] bg-[#FF3D00]/10' :
                          'text-white/40 bg-white/[0.04]'
                        }`}>{cl.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Sends */}
      {sends.length > 0 && (
        <div className="glass-static" style={{ padding: 32 }}>
          <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-6">Recent Emails ({sends.length})</h3>
          <div className="space-y-2">
            {sends.slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                <div className={`w-2 h-2 rounded-full ${
                  s.status === 'sent' || s.status === 'delivered' ? 'bg-[#00E676]' :
                  s.status === 'opened' ? 'bg-[#F59E0B]' :
                  s.status === 'clicked' ? 'bg-[#A855F7]' :
                  s.status === 'bounced' ? 'bg-[#FF3D00]' :
                  'bg-white/20'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body text-white/60 truncate">{s.subject}</p>
                  <span className="text-[12px] font-mono text-white/30">{s.to_email}</span>
                </div>
                <span className="text-[11px] font-mono text-white/25">Step {s.step_number}</span>
                <span className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded ${
                  s.status === 'opened' ? 'text-[#F59E0B] bg-[#F59E0B]/10' :
                  s.status === 'clicked' ? 'text-[#A855F7] bg-[#A855F7]/10' :
                  s.status === 'bounced' ? 'text-[#FF3D00] bg-[#FF3D00]/10' :
                  'text-white/30 bg-white/[0.03]'
                }`}>{s.status}</span>
                <span className="text-[12px] font-mono text-white/20">
                  {s.sent_at ? new Date(s.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
