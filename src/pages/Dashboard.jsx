import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Phone, Users, Building2, Clock, ArrowRight, Globe, Shield } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import MetricCard from '../components/MetricCard'
import ActivityPanel from '../components/ActivityPanel'

export default function Dashboard() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('fathom_meetings')
        .select('id, title, meeting_date, duration_minutes, company_name, company_domain, meeting_type, recorded_by_name, attendee_emails')
        .order('meeting_date', { ascending: false })
      setMeetings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const totalMeetings = meetings.length
  const externalMeetings = meetings.filter(m => m.meeting_type === 'external').length
  const internalMeetings = meetings.filter(m => m.meeting_type === 'internal').length
  const uniqueCompanies = new Set(meetings.map(m => m.company_domain).filter(Boolean)).size
  const totalMinutes = meetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0)
  const totalHours = Math.round(totalMinutes / 60)
  const recentMeetings = meetings.slice(0, 6)

  const weeklyData = (() => {
    const weeks = {}
    meetings.forEach(m => {
      if (!m.meeting_date) return
      const d = new Date(m.meeting_date)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toISOString().slice(5, 10)
      weeks[key] = (weeks[key] || 0) + 1
    })
    return Object.entries(weeks).reverse().slice(0, 7).reverse().map(([week, count]) => ({ week, count }))
  })()

  const pieData = [
    { name: 'External', value: externalMeetings, color: '#00BFFF' },
    { name: 'Internal', value: internalMeetings, color: '#FF6B35' },
  ]

  const companyCounts = {}
  meetings.forEach(m => {
    if (m.company_domain && m.meeting_type === 'external') {
      companyCounts[m.company_domain] = (companyCounts[m.company_domain] || 0) + 1
    }
  })
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#00BFFF]/30 border-t-[#00BFFF] rounded-full animate-spin mx-auto mb-6" />
          <p className="font-mono text-sm text-white/60">Loading mission data...</p>
        </div>
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
      {/* Page header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-5xl font-heading font-bold tracking-wide text-white leading-tight neon-text">Dashboard</h1>
          <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#00BFFF] to-transparent" />
          <p className="mt-4 text-[15px] font-body text-white/50">Meeting intelligence &bull; Last 45 days</p>
        </div>
        <div className="glass-static px-5 py-3 flex items-center gap-3 mt-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-[#00E676]"
            animate={{ scale: [1, 1.15, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
          />
          <span className="text-sm font-mono text-white/70">Synced just now</span>
        </div>
      </div>

      {/* Stat cards row — gap-6 (24px) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard icon={Phone} label="Total Meetings" value={totalMeetings} subtitle="Last 45 days" color="#00BFFF" delay={0} />
        <MetricCard icon={Globe} label="External Calls" value={externalMeetings} subtitle="Client & prospect calls" color="#00E676" delay={0.1} />
        <MetricCard icon={Building2} label="Companies" value={uniqueCompanies} subtitle="Unique domains" color="#FF6B35" delay={0.2} />
        <MetricCard icon={Clock} label="Hours in Calls" value={totalHours} subtitle={`${totalMinutes} minutes total`} color="#A855F7" delay={0.3} />
      </div>

      {/* Charts row — gap-6 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.25 }}
          className="glass-static lg:col-span-2"
          style={{ padding: 32 }}
        >
          <h3 className="text-[13px] font-mono font-semibold tracking-[0.2em] text-white/50 uppercase mb-6">Weekly Meeting Volume</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="neonGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00BFFF" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00BFFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0A0E1A', border: '1px solid rgba(0,191,255,0.2)', borderRadius: 12, fontFamily: 'Rajdhani', fontSize: 14 }}
                labelStyle={{ color: '#00BFFF' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="count" stroke="#00BFFF" strokeWidth={2.5} fill="url(#neonGradient)" dot={{ fill: '#00BFFF', strokeWidth: 0, r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Meeting Type Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.25 }}
          className="glass-static flex flex-col items-center justify-center"
          style={{ padding: 32 }}
        >
          <h3 className="text-[13px] font-mono font-semibold tracking-[0.2em] text-white/50 uppercase mb-6 self-start">Meeting Types</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} style={{ filter: `drop-shadow(0 0 8px ${entry.color}60)` }} />
                ))}
              </Pie>
              <text x="50%" y="48%" textAnchor="middle" fill="white" fontFamily="Orbitron" fontSize="32" fontWeight="bold">
                {totalMeetings}
              </text>
              <text x="50%" y="62%" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontFamily="JetBrains Mono" fontSize="11">
                TOTAL
              </text>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-6 mt-4">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                <span className="text-sm font-mono text-white/60">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom row — gap-6 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Meetings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.25 }}
          className="glass-static lg:col-span-2"
          style={{ padding: 32 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[13px] font-mono font-semibold tracking-[0.2em] text-white/50 uppercase">Recent Meetings</h3>
            <Link to="/meetings" className="text-sm font-mono text-[#00BFFF]/70 hover:text-[#00BFFF] hover:underline transition-all duration-150 flex items-center gap-1.5">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentMeetings.map((m) => (
              <Link
                key={m.id}
                to={`/meetings/${m.id}`}
                className="flex items-center justify-between rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-transparent hover:border-white/[0.08] transition-all duration-150 group cursor-pointer"
                style={{ paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20 }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${m.meeting_type === 'external' ? 'bg-[#00BFFF]/10' : 'bg-[#FF6B35]/10'}`}>
                    {m.meeting_type === 'external' ? (
                      <Globe size={18} className="text-[#00BFFF]" strokeWidth={1.5} />
                    ) : (
                      <Shield size={18} className="text-[#FF6B35]" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-body font-semibold text-white/90 truncate group-hover:text-white transition-colors duration-150">{m.title}</p>
                    <p className="text-[13px] font-mono text-white/40 mt-0.5">{m.company_domain || 'Internal'}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-6">
                  <p className="text-[13px] font-mono text-white/50">
                    {m.meeting_date ? new Date(m.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </p>
                  {m.duration_minutes && (
                    <p className="text-[13px] font-mono text-white/30 mt-0.5">{m.duration_minutes}m</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Top Companies */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.25 }}
          className="glass-static"
          style={{ padding: 32 }}
        >
          <h3 className="text-[13px] font-mono font-semibold tracking-[0.2em] text-white/50 uppercase mb-6">Top Companies</h3>
          <div className="space-y-1">
            {topCompanies.map((c, i) => (
              <div key={c.domain} className="flex items-center gap-4" style={{ paddingTop: 12, paddingBottom: 12 }}>
                <span className="text-sm font-mono text-[#00BFFF]/50 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-body text-white/80 truncate">{c.domain}</p>
                  <div className="mt-2 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#00BFFF] to-[#0066CC]"
                      style={{
                        width: `${(c.count / topCompanies[0].count) * 100}%`,
                        boxShadow: '0 0 8px rgba(0,191,255,0.4)',
                      }}
                    />
                  </div>
                </div>
                <span className="text-lg font-mono font-bold text-[#00BFFF]">{c.count}</span>
              </div>
            ))}
            {topCompanies.length === 0 && (
              <p className="text-sm font-mono text-white/40">No external companies yet</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Agent Activity */}
      <ActivityPanel />
    </motion.div>
  )
}
