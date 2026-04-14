import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Globe, Shield, Clock, ChevronRight, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Meetings() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('fathom_meetings')
        .select('id, title, meeting_date, duration_minutes, company_name, company_domain, meeting_type, recorded_by_name, attendee_emails, summary_markdown')
        .order('meeting_date', { ascending: false })
      setMeetings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = meetings.filter(m => {
    const matchesSearch = !search ||
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.company_domain?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || m.meeting_type === filter
    return matchesSearch && matchesFilter
  })

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
      {/* Header with gradient underline */}
      <div>
        <h1 className="text-5xl font-heading font-bold tracking-wide text-white leading-tight neon-text">Meetings</h1>
        <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#00BFFF] to-transparent" />
        <p className="mt-4 text-[15px] font-body text-white/50">{meetings.length} meetings synced from Fathom</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[280px] relative">
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search meetings, companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-13 pr-5 rounded-xl text-base font-body text-white/80 placeholder:text-white/30 bg-white/[0.02] border border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#00BFFF]/25 focus:border-[#00BFFF]/30 transition-all duration-150"
            style={{ height: 56, paddingLeft: 52, fontSize: 16 }}
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All', icon: Phone },
            { key: 'external', label: 'External', icon: Globe },
            { key: 'internal', label: 'Internal', icon: Shield },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-2.5 px-5 rounded-xl text-sm font-mono font-medium transition-all duration-150 border ${
                filter === f.key
                  ? 'bg-[#00BFFF]/10 text-[#00BFFF] border-[#00BFFF]/20 shadow-[0_0_20px_-5px_rgba(0,191,255,0.25)]'
                  : 'text-white/60 border-white/[0.08] hover:border-white/15 hover:text-white/80 bg-white/[0.02]'
              }`}
              style={{ height: 48 }}
            >
              <f.icon size={16} strokeWidth={1.5} />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meetings List */}
      <div className="space-y-1">
        {filtered.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.025, 0.4), duration: 0.2, ease: 'easeOut' }}
          >
            <Link
              to={`/meetings/${m.id}`}
              className="flex items-center gap-6 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-transparent hover:border-white/[0.08] transition-all duration-150 group cursor-pointer"
              style={{ minHeight: 76, paddingTop: 20, paddingBottom: 20, paddingLeft: 24, paddingRight: 24 }}
            >
              {/* Type Icon — 44px */}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                m.meeting_type === 'external'
                  ? 'bg-[#00BFFF]/10 border-[#00BFFF]/20'
                  : 'bg-[#FF6B35]/10 border-[#FF6B35]/20'
              }`}>
                {m.meeting_type === 'external' ? (
                  <Globe size={20} className="text-[#00BFFF]" strokeWidth={1.5} />
                ) : (
                  <Shield size={20} className="text-[#FF6B35]" strokeWidth={1.5} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[17px] font-body font-semibold text-white truncate group-hover:text-white transition-colors duration-150" style={{ lineHeight: 1.3 }}>
                  {m.title}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {m.company_domain && (
                    <span className="text-[13px] font-mono text-white/60">{m.company_domain}</span>
                  )}
                  {m.summary_markdown && (
                    <span className="text-[11px] font-mono tracking-wider uppercase text-[#00E676] bg-[#00E676]/10 border border-[#00E676]/20 px-2 py-0.5 rounded">
                      Has summary
                    </span>
                  )}
                </div>
              </div>

              {/* Meta — stacked right */}
              <div className="flex items-center gap-6 flex-shrink-0">
                {m.duration_minutes && (
                  <div className="flex items-center gap-2 text-white/50">
                    <Clock size={16} strokeWidth={1.5} />
                    <span className="text-sm font-mono">{m.duration_minutes}m</span>
                  </div>
                )}
                <div className="text-right min-w-[60px]">
                  <p className="text-[13px] font-mono text-white/60">
                    {m.meeting_date ? new Date(m.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </p>
                </div>
                <ChevronRight size={16} className="text-white/20 group-hover:text-[#00BFFF]/60 transition-colors duration-150" strokeWidth={1.5} />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="font-mono text-base text-white/50">No meetings found</p>
        </div>
      )}
    </motion.div>
  )
}
