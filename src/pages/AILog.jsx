import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Search, ChevronDown, RefreshCw, AlertTriangle, Pause, Play, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SOURCE_COLORS = {
  meeting_analyzer: '#00BFFF', daily_briefing: '#F59E0B', weekly_skills: '#A855F7',
  feedback_responder: '#00E676', skills_sync: '#14B8A6', memory_sync: '#EC4899',
  nurture_personalizer: '#FF6B35', nurture_sender: '#EF4444', cal_webhook: '#06B6D4',
  campaign_manager: '#8B5CF6', manual: '#9CA3AF',
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

export default function AILog() {
  const [activities, setActivities] = useState([])
  const [total, setTotal] = useState(0)
  const [cronStatus, setCronStatus] = useState({})
  const [cronPauses, setCronPauses] = useState([])
  const [todayStats, setTodayStats] = useState({})
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ source: '', status: '', type: '', search: '' })
  const [expandedId, setExpandedId] = useState(null)
  const [expandedCron, setExpandedCron] = useState(null)
  const [cronHistory, setCronHistory] = useState({})
  const [pausingCron, setPausingCron] = useState(null)
  const [confirmPause, setConfirmPause] = useState(null)
  const [pauseReason, setPauseReason] = useState('')

  async function load() {
    // Main activity list
    let q = supabase.from('agent_activity_log').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(50)
    if (filter.source) q = q.eq('source', filter.source)
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.type) q = q.eq('activity_type', filter.type)
    if (filter.search) q = q.ilike('summary', `%${filter.search}%`)
    const { data, count } = await q

    setActivities(data || [])
    setTotal(count || 0)

    // All activities for stats
    const { data: all } = await supabase.from('agent_activity_log').select('source, activity_type, status, created_at, summary, duration_seconds').order('created_at', { ascending: false }).limit(500)
    const allActs = all || []

    // Cron pause states
    const { data: pauses } = await supabase.from('cron_pauses').select('*').order('cron_name')
    setCronPauses(pauses || [])

    // Cron status — merge pause state with activity data
    const allCronNames = [...new Set([...allActs.map(a => a.source), ...(pauses || []).map(p => p.cron_name)])]
    const crons = {}
    const today = new Date().toISOString().slice(0, 10)
    for (const src of allCronNames) {
      const srcActs = allActs.filter(a => a.source === src)
      const todaySrc = srcActs.filter(a => a.created_at?.startsWith(today))
      const latest = srcActs[0]
      const pause = (pauses || []).find(p => p.cron_name === src)
      crons[src] = { last_run: latest?.created_at, status: latest?.status, summary: latest?.summary, runs_today: todaySrc.length, paused: pause?.paused || false, pause_reason: pause?.reason, paused_at: pause?.paused_at }
    }
    setCronStatus(crons)

    // Today stats by type
    const todayActs = allActs.filter(a => a.created_at?.startsWith(today))
    const byType = {}
    todayActs.forEach(a => { byType[a.activity_type] = (byType[a.activity_type] || 0) + 1 })
    const totalRuntime = todayActs.reduce((s, a) => s + (a.duration_seconds || 0), 0)
    setTodayStats({ count: todayActs.length, byType, totalRuntime })

    // Recent errors
    setErrors(allActs.filter(a => a.status === 'error').slice(0, 5))

    setLoading(false)
  }

  async function loadCronHistory(src) {
    if (expandedCron === src) { setExpandedCron(null); return }
    setExpandedCron(src)
    if (cronHistory[src]) return
    const { data } = await supabase.from('agent_activity_log').select('*').eq('source', src).order('created_at', { ascending: false }).limit(5)
    setCronHistory(prev => ({ ...prev, [src]: data || [] }))
  }

  const API_KEY = localStorage.getItem('hermes_api_key') || import.meta.env.VITE_HERMES_API_KEY
  const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hermes-api`

  async function callApi(action, params = {}) {
    const resp = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({ action, params }),
    })
    return resp.json()
  }

  async function handlePauseCron(name) {
    setPausingCron(name)
    setConfirmPause(null)
    await callApi('cron.pause', { name, reason: pauseReason || undefined })
    setPauseReason('')
    setPausingCron(null)
    load()
  }

  async function handleResumeCron(name) {
    setPausingCron(name)
    await callApi('cron.resume', { name })
    setPausingCron(null)
    load()
  }

  async function handleBulkPause(group) {
    setPausingCron(group)
    await callApi('cron.pause', { name: group, reason: 'Bulk paused via UI' })
    setPausingCron(null)
    load()
  }

  async function handleBulkResume(group) {
    setPausingCron(group)
    await callApi('cron.resume', { name: group })
    setPausingCron(null)
    load()
  }

  useEffect(() => { load() }, [filter.source, filter.status, filter.type])

  const lastCheckIn = activities[0]?.created_at
  const isOnline = lastCheckIn && (Date.now() - new Date(lastCheckIn).getTime()) < 4 * 3600000

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-12 h-12 border-2 border-[#00E676]/30 border-t-[#00E676] rounded-full animate-spin" /></div>

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-heading font-bold tracking-wide text-white leading-tight" style={{ textShadow: '0 0 30px rgba(0, 230, 118, 0.3)' }}>AI Log</h1>
          <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#00E676] to-transparent" />
          <p className="mt-4 text-[15px] font-body text-white/50">Everything Hermes is doing, has done, and will do</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-[#00E676]' : 'bg-[#FF3D00]'}`}
            animate={isOnline ? { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] } : {}} transition={{ duration: 2, repeat: Infinity }} />
          <span className={`text-sm font-mono ${isOnline ? 'text-[#00E676]' : 'text-[#FF3D00]'}`}>
            {isOnline ? 'Online' : 'Offline'} — last check-in {timeAgo(lastCheckIn)}
          </span>
          <button onClick={load} className="p-2 rounded-lg bg-white/[0.03] text-white/30 hover:text-white/60 transition-colors"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main content — 3 cols */}
        <div className="xl:col-span-3 space-y-6">
          {/* Cron Status Grid with Pause/Resume */}
          <div className="glass-static" style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase">Cron Status</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkPause('outreach')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/20 text-[11px] font-mono hover:bg-[#FF6B35]/20 transition-all"
                >
                  <Pause size={12} /> Pause Outreach
                </button>
                <button
                  onClick={() => handleBulkResume('outreach')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-[11px] font-mono hover:bg-[#00E676]/20 transition-all"
                >
                  <Play size={12} /> Resume Outreach
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {Object.entries(cronStatus).map(([src, data]) => (
                <div key={src}>
                  <div className={`flex items-center gap-4 p-3 rounded-lg hover:bg-white/[0.02] transition-all ${data.paused ? 'opacity-50' : ''}`}>
                    <button onClick={() => loadCronHistory(src)} className="flex items-center gap-4 flex-1 text-left min-w-0">
                      <span className="text-[14px] w-5">{data.paused ? '\u23F8\uFE0F' : STATUS_ICONS[data.status] || '\u2753'}</span>
                      <span className="text-sm font-mono w-40 truncate" style={{ color: data.paused ? '#9CA3AF' : SOURCE_COLORS[src] || '#9CA3AF' }}>{src.replace(/_/g, ' ')}</span>
                      <span className="text-[13px] font-mono text-white/30 w-24">{data.paused ? 'paused' : timeAgo(data.last_run)}</span>
                      <span className="text-[13px] font-body text-white/40 flex-1 truncate">
                        {data.paused ? (data.pause_reason || 'Paused') : (data.summary || '')}
                      </span>
                      <span className="text-[11px] font-mono text-white/20">{data.runs_today}x today</span>
                    </button>
                    {/* Toggle switch */}
                    <button
                      onClick={(e) => { e.stopPropagation(); data.paused ? handleResumeCron(src) : setConfirmPause(src) }}
                      disabled={pausingCron === src}
                      className={`flex-shrink-0 w-10 h-5 rounded-full relative transition-all ${data.paused ? 'bg-[#FF6B35]/30' : 'bg-[#00E676]/30'}`}
                    >
                      {pausingCron === src ? (
                        <Loader2 size={12} className="absolute top-1 left-4 animate-spin text-white/50" />
                      ) : (
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${data.paused ? 'left-0.5 bg-[#FF6B35]' : 'left-5 bg-[#00E676]'}`} />
                      )}
                    </button>
                  </div>
                  {expandedCron === src && cronHistory[src] && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-9 mb-2 space-y-1">
                      {cronHistory[src].map(h => (
                        <div key={h.id} className="flex items-center gap-3 px-3 py-2 rounded bg-white/[0.01] text-[12px]">
                          <span>{STATUS_ICONS[h.status] || ''}</span>
                          <span className="font-mono text-white/25 w-20">{timeAgo(h.created_at)}</span>
                          <span className="font-body text-white/40 flex-1 truncate">{h.summary}</span>
                          {h.duration_seconds && <span className="font-mono text-white/15">{h.duration_seconds}s</span>}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              ))}
              {Object.keys(cronStatus).length === 0 && <p className="text-sm font-mono text-white/30 text-center py-4">No activity logged yet</p>}
            </div>
          </div>

          {/* Pause Confirmation Dialog */}
          {confirmPause && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setConfirmPause(null)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative glass-static p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-heading font-bold text-white mb-2">Pause {confirmPause.replace(/_/g, ' ')}?</h3>
                <p className="text-sm font-body text-white/50 mb-4">This stops <span className="text-white/70 font-semibold">{confirmPause.replace(/_/g, ' ')}</span> from running until you resume it.</p>
                <input value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="Reason (optional)"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm font-body text-white/70 placeholder:text-white/25 focus:outline-none mb-4" />
                <div className="flex gap-2">
                  <button onClick={() => handlePauseCron(confirmPause)}
                    className="flex-1 py-2.5 rounded-lg bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/20 text-sm font-mono font-semibold hover:bg-[#FF6B35]/20 transition-all">
                    Pause
                  </button>
                  <button onClick={() => { setConfirmPause(null); setPauseReason('') }}
                    className="flex-1 py-2.5 rounded-lg bg-white/[0.03] text-white/50 border border-white/[0.06] text-sm font-mono hover:text-white/70 transition-all">
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Error Panel */}
          {errors.length > 0 && (
            <div className="p-5 rounded-xl bg-[#FF3D00]/5 border border-[#FF3D00]/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-[#FF3D00]" />
                <span className="text-sm font-mono text-[#FF3D00] font-semibold">ERRORS IN LAST 24 HOURS</span>
              </div>
              {errors.map(e => (
                <div key={e.id} className="flex items-start gap-3 py-2">
                  <span className="text-[12px]">{STATUS_ICONS.error}</span>
                  <div>
                    <span className="text-sm font-mono text-[#FF3D00]/70">{e.source.replace(/_/g, ' ')}</span>
                    <span className="text-[12px] font-mono text-white/20 ml-2">{timeAgo(e.created_at)}</span>
                    <p className="text-sm font-body text-white/50 mt-0.5">{e.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && load()}
                placeholder="Search activities..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm font-body text-white/70 placeholder:text-white/25 focus:outline-none" />
            </div>
            <select value={filter.source} onChange={e => setFilter(f => ({ ...f, source: e.target.value }))}
              className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm font-mono text-white/50 focus:outline-none">
              <option value="">All Sources</option>
              {Object.keys(cronStatus).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
              className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm font-mono text-white/50 focus:outline-none">
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="silent">Silent</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Activity Timeline */}
          <div className="space-y-2">
            {activities.map(a => {
              const color = SOURCE_COLORS[a.source] || '#9CA3AF'
              return (
                <div key={a.id}>
                  <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    className="w-full text-left p-5 glass-static hover:bg-white/[0.01] transition-all">
                    <div className="flex items-start gap-3">
                      <span className="text-[14px] mt-0.5">{STATUS_ICONS[a.status] || ''}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] font-mono font-semibold" style={{ color }}>{a.source.replace(/_/g, ' ')}</span>
                          <span className="text-[12px] font-mono text-white/20">{timeAgo(a.created_at)}</span>
                          {a.duration_seconds && <span className="text-[11px] font-mono text-white/15">{a.duration_seconds}s</span>}
                        </div>
                        <p className="text-sm font-body text-white/60 leading-relaxed">{a.summary}</p>
                      </div>
                    </div>
                  </button>
                  {expandedId === a.id && a.details && Object.keys(a.details).length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-5 mb-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(a.details).map(([k, v]) => (
                          <div key={k} className="p-2 rounded-lg bg-white/[0.02]">
                            <span className="text-[10px] font-mono text-white/30 uppercase">{k.replace(/_/g, ' ')}</span>
                            <p className="text-sm font-mono text-white/60">{JSON.stringify(v)}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              )
            })}
            {activities.length === 0 && (
              <div className="text-center py-16 glass-static rounded-xl">
                <Activity size={40} className="text-white/15 mx-auto mb-3" />
                <p className="font-mono text-base text-white/40">No activities match your filters</p>
              </div>
            )}
            {activities.length < total && (
              <p className="text-center text-[13px] font-mono text-white/30 py-4">Showing {activities.length} of {total}</p>
            )}
          </div>
        </div>

        {/* Right sidebar — Today's Summary */}
        <div className="space-y-6">
          <div className="glass-static p-6 sticky top-8">
            <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-4">Today's Summary</h3>
            <div className="space-y-3">
              {[
                { label: 'Check-ins', value: todayStats.count || 0 },
                ...(Object.entries(todayStats.byType || {}).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v }))),
                { label: 'Errors', value: errors.filter(e => e.created_at?.startsWith(new Date().toISOString().slice(0, 10))).length },
                { label: 'Total runtime', value: todayStats.totalRuntime ? `${Math.round(todayStats.totalRuntime)}s` : '0s' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-1">
                  <span className="text-sm font-body text-white/40">{s.label}</span>
                  <span className="text-sm font-mono text-white/70 font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
