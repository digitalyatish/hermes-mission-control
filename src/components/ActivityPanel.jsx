import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SOURCE_COLORS = {
  meeting_analyzer: '#00BFFF',
  daily_briefing: '#F59E0B',
  weekly_skills: '#A855F7',
  feedback_responder: '#00E676',
  skills_sync: '#14B8A6',
  memory_sync: '#EC4899',
  nurture_personalizer: '#FF6B35',
  nurture_sender: '#EF4444',
  cal_webhook: '#06B6D4',
  manual: '#9CA3AF',
}

const STATUS_ICONS = { success: '\u2705', silent: '\uD83D\uDE34', error: '\u274C', partial: '\u26A0\uFE0F', running: '\u23F3' }

function timeAgo(d) {
  if (!d) return 'never'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ActivityPanel() {
  const [activities, setActivities] = useState([])
  const [stats, setStats] = useState(null)
  const [expanded, setExpanded] = useState(true)
  const [expandedItem, setExpandedItem] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [actRes, statRes] = await Promise.all([
      supabase.from('agent_activity_log').select('*').order('created_at', { ascending: false }).limit(20),
      // Compute stats from recent activities
      supabase.from('agent_activity_log').select('activity_type, source, status, created_at').order('created_at', { ascending: false }).limit(500),
    ])
    setActivities(actRes.data || [])

    // Compute stats
    const all = statRes.data || []
    const today = new Date().toISOString().slice(0, 10)
    const bySource = {}
    const sources = [...new Set(all.map(a => a.source))]
    for (const src of sources) {
      const srcActs = all.filter(a => a.source === src)
      const todaySrc = srcActs.filter(a => a.created_at?.startsWith(today))
      const latest = srcActs[0]
      bySource[src] = { last_run: latest?.created_at, runs_today: todaySrc.length, status: latest?.status || 'unknown' }
    }
    setStats({ total: all.length, today: all.filter(a => a.created_at?.startsWith(today)).length, by_source: bySource })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return null

  return (
    <div className="glass-static overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-white/[0.01] transition-all duration-150"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
            <Activity size={16} className="text-[#00E676]" strokeWidth={1.5} />
          </div>
          <div className="text-left">
            <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase">Agent Activity</h3>
          </div>
          {stats && <span className="text-[13px] font-mono text-white/30 ml-3">{stats.today} today</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); load() }} className="p-1.5 rounded-lg text-white/20 hover:text-white/50 transition-colors">
            <RefreshCw size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          {/* Cron Status Grid */}
          {stats?.by_source && Object.keys(stats.by_source).length > 0 && (
            <div className="px-6 py-4 border-b border-white/[0.04]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(stats.by_source).map(([src, data]) => (
                  <div key={src} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02]">
                    <span className="text-[12px]">{STATUS_ICONS[data.status] || '\u2753'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono truncate" style={{ color: SOURCE_COLORS[src] || '#9CA3AF' }}>{src.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] font-mono text-white/25">{timeAgo(data.last_run)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="px-6 py-4 space-y-1 max-h-[400px] overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-sm font-mono text-white/30 text-center py-6">No activity logged yet</p>
            ) : (
              activities.map(a => {
                const color = SOURCE_COLORS[a.source] || '#9CA3AF'
                return (
                  <div key={a.id}>
                    <button
                      onClick={() => setExpandedItem(expandedItem === a.id ? null : a.id)}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-all text-left"
                    >
                      <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono tracking-wider uppercase" style={{ color }}>{a.source.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] font-mono text-white/20">{timeAgo(a.created_at)}</span>
                          {a.duration_seconds && <span className="text-[10px] font-mono text-white/15">{a.duration_seconds}s</span>}
                        </div>
                        <p className="text-sm font-body text-white/60 leading-relaxed">{a.summary}</p>
                      </div>
                      <span className="text-[12px] flex-shrink-0 mt-1">{STATUS_ICONS[a.status] || ''}</span>
                    </button>
                    {expandedItem === a.id && a.details && Object.keys(a.details).length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-6 mb-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <pre className="text-[11px] font-mono text-white/40 whitespace-pre-wrap">{JSON.stringify(a.details, null, 2)}</pre>
                      </motion.div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
