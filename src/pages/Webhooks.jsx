import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Radio, Plus, Activity, Zap, Hash, ChevronRight, Copy, Check, Phone, Mail, Globe } from 'lucide-react'

const SERVICE_META = {
  fathom: { icon: Phone, color: '#00BFFF', label: 'Fathom' },
  resend: { icon: Mail, color: '#00E676', label: 'Resend' },
  custom: { icon: Globe, color: '#A855F7', label: 'Custom' },
}
import { getWebhooks, getWebhookStats } from '../lib/webhooks'
import AddWebhookModal from '../components/AddWebhookModal'

function StatCard({ icon: Icon, label, value, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="glass-static"
      style={{ padding: 28 }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={18} style={{ color }} strokeWidth={1.5} />
        </div>
        <span className="text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase">{label}</span>
      </div>
      <p className="text-4xl font-heading font-bold text-white" style={{ textShadow: `0 0 30px ${color}30` }}>{value}</p>
    </motion.div>
  )
}

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, totalEvents: 0, totalFunctions: 0 })
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  async function load() {
    const [{ data }, s] = await Promise.all([getWebhooks(), getWebhookStats()])
    setWebhooks(data || [])
    setStats(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function copyUrl(id, url) {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-heading font-bold tracking-wide text-white leading-tight neon-text">Webhooks</h1>
          <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#00BFFF] to-transparent" />
          <p className="mt-4 text-[15px] font-body text-white/50">Manage incoming data pipelines</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#00BFFF]/10 text-[#00BFFF] border border-[#00BFFF]/20 text-sm font-mono font-semibold hover:bg-[#00BFFF]/20 transition-all duration-150 shadow-[0_0_20px_-5px_rgba(0,191,255,0.25)]"
        >
          <Plus size={18} strokeWidth={2} />
          Register Webhook
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Radio} label="Total Webhooks" value={stats.total} color="#00BFFF" delay={0} />
        <StatCard icon={Activity} label="Active" value={stats.active} color="#00E676" delay={0.05} />
        <StatCard icon={Zap} label="Events Received" value={stats.totalEvents} color="#FF6B35" delay={0.1} />
        <StatCard icon={Hash} label="Functions" value={stats.totalFunctions} color="#A855F7" delay={0.15} />
      </div>

      {/* Webhook List */}
      <div className="space-y-2">
        {webhooks.length === 0 ? (
          <div className="text-center py-20 glass-static rounded-xl">
            <Radio size={40} className="text-white/20 mx-auto mb-4" strokeWidth={1} />
            <p className="font-mono text-base text-white/40 mb-2">No webhooks registered yet</p>
            <p className="font-body text-sm text-white/30">Click "Register Webhook" to connect Fathom or another service</p>
          </div>
        ) : (
          webhooks.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.2 }}
            >
              <Link
                to={`/webhooks/${w.id}`}
                className="flex items-center gap-6 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-transparent hover:border-white/[0.08] transition-all duration-150 group cursor-pointer"
                style={{ minHeight: 76, padding: '20px 24px' }}
              >
                {/* Service Icon */}
                {(() => {
                  const meta = SERVICE_META[w.service] || SERVICE_META.custom
                  const SvcIcon = meta.icon
                  return (
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border"
                      style={{ background: `${meta.color}15`, borderColor: `${meta.color}33` }}>
                      <SvcIcon size={20} style={{ color: meta.color }} strokeWidth={1.5} />
                    </div>
                  )
                })()}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-[17px] font-body font-semibold text-white truncate group-hover:text-white transition-colors duration-150">
                      {w.name}
                    </p>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono tracking-wider uppercase border ${
                      w.status === 'active' ? 'text-[#00E676] bg-[#00E676]/10 border-[#00E676]/20' :
                      w.status === 'paused' ? 'text-[#FF6B35] bg-[#FF6B35]/10 border-[#FF6B35]/20' :
                      'text-[#FF3D00] bg-[#FF3D00]/10 border-[#FF3D00]/20'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="text-[13px] font-mono text-white/40 truncate max-w-[300px]">{w.endpoint_url}</span>
                    <button
                      onClick={(e) => { e.preventDefault(); copyUrl(w.id, w.endpoint_url) }}
                      className="text-white/30 hover:text-[#00BFFF] transition-colors flex-shrink-0"
                    >
                      {copiedId === w.id ? <Check size={14} className="text-[#00E676]" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-mono text-white/60">{w.event_count || 0} events</p>
                    <p className="text-[13px] font-mono text-white/30 mt-0.5">
                      {w.last_received_at ? new Date(w.last_received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No events yet'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-white/20 group-hover:text-[#00BFFF]/60 transition-colors duration-150" />
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Webhook Modal */}
      {showAddModal && (
        <AddWebhookModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); load() }}
        />
      )}
    </motion.div>
  )
}
