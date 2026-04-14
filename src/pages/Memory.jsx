import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Brain, BookOpen, Camera, Clock, Calendar, ChevronLeft, ChevronRight,
  Edit3, Plus, Save, X, Loader2, Flame, Database, History
} from 'lucide-react'
import { supabase } from '../lib/supabase'

function timeAgo(d) {
  if (!d) return 'never'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const SNAPSHOT_COLORS = {
  session_end: { color: '#00BFFF', label: 'Session End' },
  pre_compaction: { color: '#F59E0B', label: 'Pre-Compaction' },
  milestone: { color: '#00E676', label: 'Milestone' },
  manual: { color: '#A855F7', label: 'Manual' },
}

const LOG_SECTIONS = [
  { key: 'summary', label: 'Summary', icon: '📝' },
  { key: 'decisions_made', label: 'Decisions Made', icon: '🎯' },
  { key: 'things_learned', label: 'Things Learned', icon: '🧠' },
  { key: 'context_notes', label: 'Context Notes', icon: '📌' },
  { key: 'active_projects', label: 'Active Projects', icon: '🔨' },
  { key: 'blocked_items', label: 'Blocked Items', icon: '⏸️' },
  { key: 'skills_updated', label: 'Skills Updated', icon: '🛠️' },
]

export default function Memory() {
  const [tab, setTab] = useState('persistent')
  const [stats, setStats] = useState(null)
  const [memoryEntries, setMemoryEntries] = useState([])
  const [userEntries, setUserEntries] = useState([])
  const [dailyLogs, setDailyLogs] = useState([])
  const [currentLog, setCurrentLog] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10))
  const [snapshots, setSnapshots] = useState([])
  const [expandedSnapshot, setExpandedSnapshot] = useState(null)
  const [expandedSnapshotData, setExpandedSnapshotData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [memRes, logRes, snapRes] = await Promise.all([
        supabase.from('agent_memory').select('*').eq('is_active', true).order('memory_type').order('created_at', { ascending: false }),
        supabase.from('memory_daily_logs').select('*').order('log_date', { ascending: false }).limit(30),
        supabase.from('memory_snapshots').select('id, snapshot_type, session_id, title, session_summary, recoverable_items, created_at').order('created_at', { ascending: false }).limit(20),
      ])
      const mem = memRes.data || []
      setMemoryEntries(mem.filter(m => m.memory_type === 'memory'))
      setUserEntries(mem.filter(m => m.memory_type === 'user'))
      setDailyLogs(logRes.data || [])
      setCurrentLog(logRes.data?.find(l => l.log_date === currentDate) || null)
      setSnapshots(snapRes.data || [])

      // Stats
      const active = mem.length
      const totalChars = mem.reduce((s, m) => s + (m.content?.length || 0), 0)
      const streak = computeStreak(logRes.data || [])
      setStats({ active, totalChars, streak, snapshots: snapRes.data?.length || 0, lastSynced: mem[0]?.updated_at })
      setLoading(false)
    }
    load()
  }, [])

  function computeStreak(logs) {
    const dates = logs.map(l => l.log_date)
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      if (dates.includes(d)) streak++
      else break
    }
    return streak
  }

  function loadLogForDate(date) {
    setCurrentDate(date)
    setCurrentLog(dailyLogs.find(l => l.log_date === date) || null)
  }

  async function loadFullSnapshot(id) {
    if (expandedSnapshot === id) { setExpandedSnapshot(null); return }
    setExpandedSnapshot(id)
    const { data } = await supabase.from('memory_snapshots').select('*').eq('id', id).single()
    setExpandedSnapshotData(data)
  }

  async function saveEdit(id) {
    setSaving(true)
    await supabase.from('agent_memory').update({ content: editContent }).eq('id', id)
    // Refresh
    const { data } = await supabase.from('agent_memory').select('*').eq('is_active', true).order('memory_type').order('created_at', { ascending: false })
    const mem = data || []
    setMemoryEntries(mem.filter(m => m.memory_type === 'memory'))
    setUserEntries(mem.filter(m => m.memory_type === 'user'))
    setEditingId(null)
    setSaving(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-12 h-12 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" /></div>
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-5xl font-heading font-bold tracking-wide text-white leading-tight" style={{ textShadow: '0 0 30px rgba(245, 158, 11, 0.3)' }}>Agent Memory</h1>
        <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#F59E0B] to-transparent" />
        <p className="mt-4 text-[15px] font-body text-white/50">What Hermes knows, learns, and remembers</p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex flex-wrap gap-6">
          {[
            { label: 'Active Facts', value: stats.active, color: '#F59E0B', icon: Database },
            { label: 'Day Streak', value: stats.streak, color: '#FF6B35', icon: Flame },
            { label: 'Snapshots', value: stats.snapshots, color: '#00BFFF', icon: Camera },
            { label: 'Last Synced', value: timeAgo(stats.lastSynced), color: '#00E676', icon: Clock },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <s.icon size={16} style={{ color: s.color }} strokeWidth={1.5} />
              <span className="text-2xl font-heading font-bold text-white">{s.value}</span>
              <span className="text-[13px] font-mono text-white/40">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'persistent', label: 'Persistent Memory', icon: Brain },
          { key: 'daily', label: 'Daily Logs', icon: BookOpen },
          { key: 'snapshots', label: 'Snapshots', icon: Camera },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-mono font-medium transition-all duration-150 border ${
              tab === t.key ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20' : 'text-white/50 border-white/[0.08] hover:text-white/70 bg-white/[0.02]'
            }`}>
            <t.icon size={16} strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PERSISTENT MEMORY TAB ── */}
      {tab === 'persistent' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent Memory column */}
          <div>
            <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-4 flex items-center gap-2">
              <Brain size={14} /> Agent Memory
            </h3>
            <div className="space-y-3">
              {memoryEntries.map(e => (
                <div key={e.id} className="glass-static p-5 group">
                  {editingId === e.id ? (
                    <div className="space-y-3">
                      <textarea value={editContent} onChange={ev => setEditContent(ev.target.value)}
                        className="w-full h-32 p-3 rounded-lg bg-white/[0.03] border border-[#F59E0B]/20 text-sm font-body text-white/80 focus:outline-none resize-y leading-relaxed" />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(e.id)} disabled={saving} className="px-3 py-1.5 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-mono">{saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg bg-white/[0.03] text-white/40 text-xs font-mono"><X size={12} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-body text-white/70 leading-relaxed whitespace-pre-wrap">{e.content}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[11px] font-mono text-white/25">{timeAgo(e.updated_at)}</span>
                        <button onClick={() => { setEditingId(e.id); setEditContent(e.content) }} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-[#F59E0B] transition-all"><Edit3 size={12} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {memoryEntries.length === 0 && <p className="text-sm font-mono text-white/30 text-center py-8">No memory entries synced yet</p>}
            </div>
          </div>

          {/* User Profile column */}
          <div>
            <h3 className="text-[13px] font-mono tracking-[0.2em] text-[#00BFFF]/60 uppercase mb-4 flex items-center gap-2">
              <Brain size={14} /> User Profile
            </h3>
            <div className="space-y-3">
              {userEntries.map(e => {
                const isRule = e.content?.includes('HARD RULE') || e.content?.includes('NEVER')
                return (
                  <div key={e.id} className={`glass-static p-5 group ${isRule ? 'border-l-2 border-l-[#FF3D00]' : ''}`}>
                    {editingId === e.id ? (
                      <div className="space-y-3">
                        <textarea value={editContent} onChange={ev => setEditContent(ev.target.value)}
                          className="w-full h-32 p-3 rounded-lg bg-white/[0.03] border border-[#00BFFF]/20 text-sm font-body text-white/80 focus:outline-none resize-y leading-relaxed" />
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(e.id)} disabled={saving} className="px-3 py-1.5 rounded-lg bg-[#00BFFF]/10 text-[#00BFFF] text-xs font-mono">{saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}</button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg bg-white/[0.03] text-white/40 text-xs font-mono"><X size={12} /></button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase text-[#00BFFF] bg-[#00BFFF]/10">user</span>
                          {isRule && <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase text-[#FF3D00] bg-[#FF3D00]/10">rule</span>}
                        </div>
                        <p className="text-sm font-body text-white/70 leading-relaxed whitespace-pre-wrap">{e.content}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[11px] font-mono text-white/25">{timeAgo(e.updated_at)}</span>
                          <button onClick={() => { setEditingId(e.id); setEditContent(e.content) }} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-[#00BFFF] transition-all"><Edit3 size={12} /></button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
              {userEntries.length === 0 && <p className="text-sm font-mono text-white/30 text-center py-8">No user profile entries synced yet</p>}
            </div>
          </div>

          {/* Char usage */}
          {stats && (
            <div className="col-span-full glass-static p-4 flex items-center gap-4">
              <span className="text-[11px] font-mono text-white/40">{stats.totalChars.toLocaleString()} chars used</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FF6B35]" style={{ width: `${Math.min(stats.totalChars / 3575 * 100, 100)}%` }} />
              </div>
              <span className="text-[11px] font-mono text-white/30">Syncs every 3 hours</span>
            </div>
          )}
        </div>
      )}

      {/* ── DAILY LOGS TAB ── */}
      {tab === 'daily' && (
        <div className="space-y-6">
          {/* Date navigation */}
          <div className="flex items-center gap-4">
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); loadLogForDate(d.toISOString().slice(0, 10)) }} className="p-2 rounded-lg bg-white/[0.03] text-white/40 hover:text-white transition-colors"><ChevronLeft size={18} /></button>
            <h3 className="text-lg font-heading font-bold text-white">
              {new Date(currentDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {currentLog && <span className="text-[13px] font-mono text-white/30 ml-3">Sync #{currentLog.sync_count}</span>}
            </h3>
            <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); loadLogForDate(d.toISOString().slice(0, 10)) }} className="p-2 rounded-lg bg-white/[0.03] text-white/40 hover:text-white transition-colors"><ChevronRight size={18} /></button>
            <button onClick={() => loadLogForDate(new Date().toISOString().slice(0, 10))} className="px-3 py-2 rounded-lg bg-white/[0.03] text-xs font-mono text-white/40 hover:text-white transition-colors">Today</button>
          </div>

          {currentLog ? (
            <div className="glass-static" style={{ padding: 32 }}>
              <div className="space-y-8">
                {LOG_SECTIONS.map(s => {
                  const content = currentLog[s.key]
                  if (!content) return null
                  return (
                    <div key={s.key}>
                      <h4 className="text-base font-heading font-bold text-white/80 mb-3 flex items-center gap-2">
                        <span>{s.icon}</span> {s.label}
                      </h4>
                      <div className="text-sm font-body text-white/60 leading-relaxed whitespace-pre-wrap pl-7">{content}</div>
                    </div>
                  )
                })}

                {/* Metrics */}
                {currentLog.metrics && Object.keys(currentLog.metrics).length > 0 && (
                  <div>
                    <h4 className="text-base font-heading font-bold text-white/80 mb-3">📊 Metrics</h4>
                    <div className="flex flex-wrap gap-3 pl-7">
                      {Object.entries(currentLog.metrics).map(([k, v]) => (
                        <div key={k} className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <span className="text-lg font-heading font-bold text-white">{String(v)}</span>
                          <span className="text-[11px] font-mono text-white/40 ml-2">{k.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 glass-static rounded-xl">
              <BookOpen size={40} className="text-white/15 mx-auto mb-4" strokeWidth={1} />
              <p className="font-mono text-base text-white/40">No log for this date</p>
            </div>
          )}
        </div>
      )}

      {/* ── SNAPSHOTS TAB ── */}
      {tab === 'snapshots' && (
        <div className="space-y-3">
          {snapshots.length === 0 ? (
            <div className="text-center py-20 glass-static rounded-xl">
              <Camera size={40} className="text-white/15 mx-auto mb-4" strokeWidth={1} />
              <p className="font-mono text-base text-white/40">No snapshots yet</p>
              <p className="font-body text-sm text-white/25">The agent saves snapshots before compaction and at session end</p>
            </div>
          ) : (
            snapshots.map((snap, i) => {
              const style = SNAPSHOT_COLORS[snap.snapshot_type] || SNAPSHOT_COLORS.manual
              const isExpanded = expandedSnapshot === snap.id
              return (
                <motion.div key={snap.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03, duration: 0.2 }}>
                  <div className="glass-static overflow-hidden">
                    <button onClick={() => loadFullSnapshot(snap.id)} className="w-full text-left p-6 hover:bg-white/[0.01] transition-all duration-150">
                      <div className="flex items-start gap-4">
                        <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ background: style.color, boxShadow: `0 0 8px ${style.color}50` }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase" style={{ color: style.color, background: `${style.color}15` }}>{style.label}</span>
                            <span className="text-[11px] font-mono text-white/25">{timeAgo(snap.created_at)}</span>
                          </div>
                          <p className="text-base font-body font-semibold text-white/90">{snap.title}</p>
                          {snap.session_summary && <p className="text-sm font-body text-white/50 mt-1 line-clamp-2">{snap.session_summary}</p>}
                          {snap.recoverable_items?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {snap.recoverable_items.map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/30 bg-white/[0.03]">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>

                    {isExpanded && expandedSnapshotData && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-white/[0.06] p-6 space-y-6">
                        {[
                          { label: 'Persistent Memory', value: expandedSnapshotData.persistent_memory },
                          { label: 'User Profile', value: expandedSnapshotData.user_profile },
                          { label: 'Session Summary', value: expandedSnapshotData.session_summary },
                          { label: 'Key Context', value: expandedSnapshotData.key_context },
                          { label: 'Open Threads', value: expandedSnapshotData.open_threads },
                        ].filter(s => s.value).map(s => (
                          <div key={s.label}>
                            <h4 className="text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase mb-2">{s.label}</h4>
                            <p className="text-sm font-body text-white/60 leading-relaxed whitespace-pre-wrap">{s.value}</p>
                          </div>
                        ))}
                        {expandedSnapshotData.cron_state && Object.keys(expandedSnapshotData.cron_state).length > 0 && (
                          <div>
                            <h4 className="text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase mb-2">Cron State</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(expandedSnapshotData.cron_state).map(([name, state]) => (
                                <div key={name} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                                  <p className="text-sm font-mono text-white/70">{name}</p>
                                  <p className="text-[11px] font-mono text-white/30">{JSON.stringify(state)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      )}
    </motion.div>
  )
}
