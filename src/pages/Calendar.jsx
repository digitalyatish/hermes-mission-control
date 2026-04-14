import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'

const EVENT_COLORS = {
  blue: { bg: 'bg-[#00BFFF]/15', border: 'border-[#00BFFF]/30', text: 'text-[#00BFFF]' },
  purple: { bg: 'bg-[#A855F7]/15', border: 'border-[#A855F7]/30', text: 'text-[#A855F7]' },
  green: { bg: 'bg-[#00E676]/15', border: 'border-[#00E676]/30', text: 'text-[#00E676]' },
  orange: { bg: 'bg-[#FF6B35]/15', border: 'border-[#FF6B35]/30', text: 'text-[#FF6B35]' },
}

const LEGEND = [
  { color: 'blue', label: 'Your Calendar', icon: '\uD83D\uDD35' },
  { color: 'purple', label: 'Agent Tasks', icon: '\uD83D\uDFE3' },
  { color: 'green', label: 'Nurture', icon: '\uD83D\uDFE2' },
  { color: 'orange', label: 'Campaigns', icon: '\uD83D\uDFE0' },
]

function getWeekDates(referenceDate) {
  const d = new Date(referenceDate)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  const dates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    dates.push(date)
  }
  return dates
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function CalendarPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const referenceDate = new Date()
  referenceDate.setDate(referenceDate.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(referenceDate)
  const dateFrom = weekDates[0].toISOString().slice(0, 10)
  const dateTo = weekDates[6].toISOString().slice(0, 10)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Fetch from calendar_cache + nurture + campaigns
      const [cacheRes, nurtureRes, campRes] = await Promise.all([
        supabase.from('calendar_cache').select('*').gte('start_time', dateFrom).lte('start_time', dateTo + 'T23:59:59Z'),
        supabase.from('nurture_sequences').select('id, prospect_name, prospect_company, meeting_time, meeting_link').eq('status', 'active').gte('meeting_time', dateFrom).lte('meeting_time', dateTo + 'T23:59:59Z'),
        supabase.from('campaigns').select('id, name, send_window_start, send_window_end').eq('status', 'active'),
      ])

      const allEvents = []

      // Cache events
      for (const e of (cacheRes.data || [])) {
        allEvents.push({ id: e.id, source: e.source, title: e.title, start: e.start_time, end: e.end_time, color: e.color || 'blue', type: e.event_type, metadata: e.metadata })
      }

      // Nurture calls
      for (const s of (nurtureRes.data || [])) {
        allEvents.push({ id: `nurture-${s.id}`, source: 'nurture', title: `Discovery Call \u2014 ${s.prospect_name}${s.prospect_company ? `, ${s.prospect_company}` : ''}`, start: s.meeting_time, end: new Date(new Date(s.meeting_time).getTime() + 1800000).toISOString(), color: 'green', type: 'discovery_call', metadata: { meeting_link: s.meeting_link } })
      }

      // Campaign windows
      for (const c of (campRes.data || [])) {
        for (const d of weekDates) {
          const ds = d.toISOString().slice(0, 10)
          allEvents.push({ id: `camp-${c.id}-${ds}`, source: 'campaign', title: `${c.name}`, start: `${ds}T${String(c.send_window_start || 9).padStart(2, '0')}:00:00Z`, end: `${ds}T${String(c.send_window_end || 17).padStart(2, '0')}:00:00Z`, color: 'orange', type: 'campaign_window', metadata: { campaign_id: c.id } })
        }
      }

      allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      setEvents(allEvents)
      setLoading(false)
    }
    load()
  }, [weekOffset])

  const today = new Date().toISOString().slice(0, 10)
  const todayEvents = events.filter(e => e.start?.startsWith(today))

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-heading font-bold tracking-wide text-white leading-tight neon-text">Calendar</h1>
          <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#00BFFF] to-transparent" />
          <p className="mt-4 text-[15px] font-body text-white/50">Your schedule + agent activities in one view</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg bg-white/[0.03] text-white/40 hover:text-white transition-colors"><ChevronLeft size={18} /></button>
          <button onClick={() => setWeekOffset(0)} className="px-3 py-2 rounded-lg bg-white/[0.03] text-sm font-mono text-white/40 hover:text-white transition-colors">Today</button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg bg-white/[0.03] text-white/40 hover:text-white transition-colors"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4">
        {LEGEND.map(l => (
          <div key={l.color} className="flex items-center gap-1.5">
            <span className="text-[12px]">{l.icon}</span>
            <span className="text-[12px] font-mono text-white/40">{l.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Week grid — 3 cols */}
        <div className="xl:col-span-3 glass-static overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {weekDates.map(d => {
              const ds = d.toISOString().slice(0, 10)
              const isToday = ds === today
              return (
                <div key={ds} className={`px-3 py-3 text-center border-r border-white/[0.04] last:border-0 ${isToday ? 'bg-[#00BFFF]/5' : ''}`}>
                  <p className="text-[11px] font-mono text-white/30">{d.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <p className={`text-lg font-heading font-bold ${isToday ? 'text-[#00BFFF]' : 'text-white/70'}`}>{d.getDate()}</p>
                </div>
              )
            })}
          </div>

          {/* Events grid */}
          <div className="grid grid-cols-7" style={{ minHeight: 500 }}>
            {weekDates.map(d => {
              const ds = d.toISOString().slice(0, 10)
              const dayEvents = events.filter(e => e.start?.startsWith(ds))
              const isToday = ds === today
              return (
                <div key={ds} className={`px-2 py-2 border-r border-white/[0.04] last:border-0 space-y-1 ${isToday ? 'bg-[#00BFFF]/[0.02]' : ''}`}>
                  {dayEvents.map(e => {
                    const style = EVENT_COLORS[e.color] || EVENT_COLORS.blue
                    return (
                      <button key={e.id} onClick={() => setSelectedEvent(selectedEvent?.id === e.id ? null : e)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg ${style.bg} border ${style.border} transition-all hover:opacity-80 truncate`}>
                        <p className={`text-[11px] font-mono ${style.text} truncate`}>{formatTime(e.start)}</p>
                        <p className="text-[11px] font-body text-white/60 truncate">{e.title}</p>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right sidebar — Today's agenda + event detail */}
        <div className="space-y-6">
          {/* Today's Agenda */}
          <div className="glass-static p-6">
            <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-4">
              Today \u2014 {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
            {todayEvents.length === 0 ? (
              <p className="text-sm font-mono text-white/30">Nothing scheduled</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map(e => {
                  const style = EVENT_COLORS[e.color] || EVENT_COLORS.blue
                  return (
                    <div key={e.id} className="flex items-start gap-2">
                      <span className={`text-[12px] font-mono ${style.text} w-16 flex-shrink-0`}>{formatTime(e.start)}</span>
                      <p className="text-sm font-body text-white/60 truncate">{e.title}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected event detail */}
          {selectedEvent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-static p-6">
              <h3 className="text-[13px] font-mono tracking-[0.2em] text-white/50 uppercase mb-3">Event Details</h3>
              <p className="text-base font-body font-semibold text-white/90 mb-2">{selectedEvent.title}</p>
              <div className="space-y-2 text-sm font-mono text-white/40">
                <div className="flex items-center gap-2"><Clock size={12} /> {formatTime(selectedEvent.start)}{selectedEvent.end ? ` \u2013 ${formatTime(selectedEvent.end)}` : ''}</div>
                <div className="flex items-center gap-2"><CalIcon size={12} /> {new Date(selectedEvent.start).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                <div>Source: <span className="text-white/60">{selectedEvent.source}</span></div>
                <div>Type: <span className="text-white/60">{selectedEvent.type}</span></div>
              </div>
              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  {Object.entries(selectedEvent.metadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[12px] py-0.5">
                      <span className="font-mono text-white/30">{k}</span>
                      <span className="font-mono text-white/50">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
