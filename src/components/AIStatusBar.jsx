import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const SOURCE_ICONS = { success: '\u2705', silent: '\uD83D\uDE34', error: '\u274C', partial: '\u26A0\uFE0F', running: '\u23F3', unknown: '\u2753' }

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

export default function AIStatusBar() {
  const [lastActivity, setLastActivity] = useState(null)
  const [recentActivities, setRecentActivities] = useState([])
  const [cronHealth, setCronHealth] = useState([])
  const [rotateIdx, setRotateIdx] = useState(0)

  async function refresh() {
    const { data } = await supabase
      .from('agent_activity_log')
      .select('source, summary, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (data?.length) {
      setLastActivity(data[0])
      setRecentActivities(data.slice(0, 3))

      // Build cron health from distinct sources
      const sources = {}
      for (const a of data) {
        if (!sources[a.source]) sources[a.source] = a
      }
      setCronHealth(Object.values(sources))
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (recentActivities.length <= 1) return
    const interval = setInterval(() => setRotateIdx(i => (i + 1) % recentActivities.length), 5000)
    return () => clearInterval(interval)
  }, [recentActivities.length])

  const isOnline = lastActivity && (Date.now() - new Date(lastActivity.created_at).getTime()) < 4 * 3600000
  const currentActivity = recentActivities[rotateIdx]

  return (
    <Link to="/ai-log" className="block">
      <div className="flex items-center gap-4 px-5 py-2 bg-[#0C0F1A]/80 border-b border-white/[0.04] text-[12px] font-mono backdrop-blur-sm min-h-[40px]">
        {/* Left — Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.div
            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#00E676]' : 'bg-[#FF3D00]'}`}
            animate={isOnline ? { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className={`${isOnline ? 'text-[#00E676]' : 'text-[#FF3D00]'} font-semibold`}>
            {isOnline ? 'Hermes Online' : 'Offline'}
          </span>
          <span className="text-white/25">
            {lastActivity ? timeAgo(lastActivity.created_at) : ''}
          </span>
        </div>

        {/* Center — Current activity (rotating) */}
        <div className="flex-1 text-center text-white/40 truncate">
          {currentActivity && (
            <span>
              {SOURCE_ICONS[currentActivity.status] || ''} {currentActivity.summary}
            </span>
          )}
        </div>

        {/* Right — Cron health mini icons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {cronHealth.slice(0, 8).map((c, i) => (
            <span key={i} className="text-[10px]" title={`${c.source}: ${c.status}`}>
              {SOURCE_ICONS[c.status] || SOURCE_ICONS.unknown}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
